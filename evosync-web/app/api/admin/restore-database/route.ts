/**
 * POST /api/admin/restore-database
 *
 * Substitui o banco SQLite atual pelo arquivo .db enviado no body
 * (multipart/form-data, field "database").
 *
 * Camadas de segurança (defense in depth):
 *  1. Sessão válida de super_admin
 *  2. Senha do admin (bcrypt verify)
 *  3. Frase de confirmação "RESTAURAR" digitada
 *  4. Validação do arquivo (ver lib/admin/backup-validation):
 *     - Magic bytes "SQLite format 3\0"
 *     - Tabelas obrigatórias presentes
 *     - ≥ 1 super admin (proteção contra lock-out)
 *  5. Backup automático do estado atual ANTES da troca
 *
 * Pré-requisito: o cliente já deve ter chamado /api/admin/inspect-backup
 * para ver o preview. Aqui, a validação é repetida (defense in depth) —
 * nunca confie no cliente.
 *
 * Fluxo:
 *  1. Valida body (multipart, senha, frase, tamanho)
 *  2. Salva upload em temp file
 *  3. validateBackupFile() no temp
 *  4. Backup do estado atual via better-sqlite3 .backup()
 *  5. resetDb() (close + clear cache)
 *  6. Remove -wal e -shm stale
 *  7. Substitui o .db (copy + atomic rename)
 *  8. Próxima query re-abre a conexão
 *  9. Loga no audit
 *
 * ⚠️  Janela de indisponibilidade entre passos 5-7: queries em voo falham.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import {
  getDb,
  getRawSqlite,
  getDbFilePath,
  schema,
  resetDb,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { validateBackupFile } from "@/lib/admin/backup-validation";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const REQUIRED_PHRASE = "RESTAURAR";

export async function POST(req: NextRequest) {
  // 1. === AUTENTICAÇÃO ===
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Acesso restrito a super_admin" },
      { status: 403 }
    );
  }

  // 2. === PARSE MULTIPART ===
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body inválido. Esperado multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("database");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Arquivo "database" não enviado' },
      { status: 400 }
    );
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json(
      { error: "Senha não enviada" },
      { status: 400 }
    );
  }
  if (typeof confirmation !== "string" || !confirmation) {
    return NextResponse.json(
      { error: "Confirmação não enviada" },
      { status: 400 }
    );
  }

  // 3. === TAMANHO ===
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
      },
      { status: 413 }
    );
  }
  if (file.size < 100) {
    return NextResponse.json(
      { error: "Arquivo muito pequeno para ser um banco SQLite válido." },
      { status: 400 }
    );
  }

  // 4. === CONFIRMAÇÃO TYPED ===
  if (confirmation.trim() !== REQUIRED_PHRASE) {
    return NextResponse.json(
      { error: `Digite exatamente "${REQUIRED_PHRASE}" para confirmar` },
      { status: 400 }
    );
  }

  // 5. === SENHA ===
  const db = getDb();
  const adminRow = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();

  if (!adminRow) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(password, adminRow.passwordHash);
  if (!passwordOk) {
    return NextResponse.json(
      { error: "Senha incorreta" },
      { status: 401 }
    );
  }

  // 6. === SALVA UPLOAD E VALIDA ===
  const uploadTmpPath = path.join(
    os.tmpdir(),
    `evosync-upload-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.db`
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(uploadTmpPath, buffer);

  const validation = validateBackupFile(uploadTmpPath);
  if (!validation.valid) {
    fs.unlinkSync(uploadTmpPath);
    return NextResponse.json(
      { error: validation.reason || "Arquivo inválido" },
      { status: 400 }
    );
  }

  // 7. === BACKUP DO ESTADO ATUAL ===
  const dbFilePath = getDbFilePath();
  const dbDir = path.dirname(dbFilePath);
  const backupDir = path.join(dbDir, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/T/, "_")
    .slice(0, 19);
  const backupPath = path.join(
    backupDir,
    `evosync-pre-restore-${timestamp}.db`
  );

  try {
    const sqlite = getRawSqlite();
    await (sqlite as any).backup(backupPath);
  } catch (err: any) {
    fs.unlinkSync(uploadTmpPath);
    console.error("[restore-database] Backup falhou:", err);
    return NextResponse.json(
      {
        error: "Falha ao criar backup do estado atual. Restore cancelado.",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }

  // 8. === SWAP DO ARQUIVO ===
  // ⚠️  Queries em voo falham entre o resetDb() e a próxima re-abertura.
  const walPath = dbFilePath + "-wal";
  const shmPath = dbFilePath + "-shm";

  try {
    // 8a. Fecha a conexão SQLite
    resetDb();

    // 8b. Remove -wal e -shm (stale do banco anterior)
    try {
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch {
      /* ignore */
    }

    // 8c. Substitui o .db (copy + atomic rename)
    fs.copyFileSync(uploadTmpPath, dbFilePath + ".new");
    try {
      if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath);
    } catch {
      /* ignore */
    }
    fs.renameSync(dbFilePath + ".new", dbFilePath);
    try {
      fs.chmodSync(dbFilePath, 0o600);
    } catch {
      /* ignore */
    }

    // 8d. Cleanup
    fs.unlinkSync(uploadTmpPath);
  } catch (err: any) {
    // Tenta re-abrir para o servidor não ficar inutilizado
    try {
      getDb();
    } catch {
      /* ignore */
    }
    console.error("[restore-database] Swap falhou:", err);
    return NextResponse.json(
      {
        error: "Backup criado mas swap do arquivo falhou. Banco intacto.",
        details: err?.message || String(err),
        backupPath,
      },
      { status: 500 }
    );
  }

  // 9. === AUDIT LOG ===
  // (Pode falhar se a conexão re-abrir antes do getDb() — tentamos mesmo assim)
  try {
    const auditId = "aud-" + crypto.randomBytes(8).toString("hex");
    const db2 = getDb();
    db2.insert(schema.auditLog)
      .values({
        id: auditId,
        tenantId: null,
        userId: session.user.id,
        action: "system.restore_database",
        details: JSON.stringify({
          by: session.user.email,
          byUserId: session.user.id,
          backupPath,
          uploadedFileName: file.name,
          uploadedFileSize: file.size,
          preservedSuperAdmins: validation.superAdminEmails,
          counts: validation.counts,
        }),
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    console.error("[restore-database] Falha ao criar audit inicial:", err);
  }

  return NextResponse.json({
    ok: true,
    backupPath,
    message:
      "Banco restaurado com sucesso. Backup do estado anterior salvo. Faça logout/login para sincronizar a sessão.",
    counts: validation.counts,
    superAdmins: validation.superAdminEmails,
  });
}

export const maxDuration = 60;
