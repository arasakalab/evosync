/**
 * POST /api/admin/reset-database
 *
 * Operação DESTRUTIVA e IRREVERSÍVEL. Zera o banco de dados do EvoSync
 * (mantém o super_admin que está chamando, para ele não perder o acesso).
 *
 * Requisitos de segurança (defense in depth):
 *  1. Sessão válida de super_admin
 *  2. Senha do admin (bcrypt verify) — proteção contra sessão deixada aberta
 *  3. Frase de confirmação "ZERAR" digitada — proteção contra click acidental
 *
 * Fluxo:
 *  1. Verifica auth + password + frase
 *  2. Cria backup do SQLite (sqlite3 .backup API, atômico)
 *  3. Abre transação, apaga todas as tabelas (exceto o próprio admin)
 *  4. Insere 1 entry de audit log "system.reset_database"
 *  5. Retorna 200 com path do backup
 *
 * Tabelas zeradas (ordem importa por causa de FKs):
 *   contactListMembers, contactSelections, contactLists, contacts,
 *   schedules, sentLog, invites, licenses, tenantSettings, tenants,
 *   users WHERE role != 'super_admin'
 * Mantidas:
 *   users WHERE role = 'super_admin' (o caller)
 *   auditLog (apaga e recria com 1 entry do reset)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, getRawSqlite, getDbFilePath, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { eq, ne } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

// Frase que o usuário precisa digitar para confirmar
const REQUIRED_PHRASE = "ZERAR";

interface ResetRequest {
  password: string;
  confirmation: string;
}

export async function POST(req: NextRequest) {
  // 1. === AUTENTICAÇÃO ===
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401 }
    );
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Acesso restrito a super_admin" },
      { status: 403 }
    );
  }

  // 2. === BODY ===
  let body: ResetRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { password, confirmation } = body;
  if (!password || !confirmation) {
    return NextResponse.json(
      { error: "Senha e confirmação são obrigatórias" },
      { status: 400 }
    );
  }

  // 3. === CONFIRMAÇÃO TYPED ===
  if (confirmation.trim() !== REQUIRED_PHRASE) {
    return NextResponse.json(
      { error: `Digite exatamente "${REQUIRED_PHRASE}" para confirmar` },
      { status: 400 }
    );
  }

  // 4. === VERIFICAÇÃO DE SENHA ===
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
    // Log tentativa falha (defesa contra brute-force na operação)
    return NextResponse.json(
      { error: "Senha incorreta" },
      { status: 401 }
    );
  }

  // 5. === BACKUP ===
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
    `evosync-pre-reset-${timestamp}.db`
  );

  try {
    // SQLite online backup API (better-sqlite3 v11) — snapshot consistente
    // mesmo com WAL ativo. Não bloqueia leituras do app.
    const sqlite = getRawSqlite();
    await (sqlite as any).backup(backupPath);
  } catch (err: any) {
    console.error("[reset-database] Backup falhou:", err);
    return NextResponse.json(
      {
        error: "Falha ao criar backup. Banco NÃO foi zerado.",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }

  // 6. === WIPE TRANSACIONAL ===
  // Ordem importa por causa de FKs. AuditLog é apagada também
  // e recriada com 1 entrada do reset (1º registro do "novo banco").
  try {
    db.transaction((tx) => {
      // Leaf tables primeiro
      tx.delete(schema.contactListMembers).run();
      tx.delete(schema.contactSelections).run();
      tx.delete(schema.contactLists).run();
      tx.delete(schema.contacts).run();
      tx.delete(schema.schedules).run();
      tx.delete(schema.sentLog).run();
      tx.delete(schema.invites).run();
      tx.delete(schema.licenses).run();
      tx.delete(schema.tenantSettings).run();
      // Parents
      tx.delete(schema.tenants).run();
      // Users: preserva super_admins
      tx.delete(schema.users)
        .where(ne(schema.users.role, "super_admin"))
        .run();
      // Audit: zera
      tx.delete(schema.auditLog).run();
    });
  } catch (err: any) {
    console.error("[reset-database] Wipe falhou:", err);
    return NextResponse.json(
      {
        error:
          "Backup criado, mas wipe falhou. Banco restaurado via transação.",
        details: err?.message || String(err),
        backupPath,
      },
      { status: 500 }
    );
  }

  // 7. === PRIMEIRA ENTRY DO NOVO AUDIT LOG ===
  // (Inserida fora da transação de wipe para garantir visibilidade)
  try {
    const auditId = "aud-" + crypto.randomBytes(8).toString("hex");
    db.insert(schema.auditLog)
      .values({
        id: auditId,
        tenantId: null,
        userId: session.user.id,
        action: "system.reset_database",
        details: JSON.stringify({
          by: session.user.email,
          byUserId: session.user.id,
          backupPath,
          preservedRoles: ["super_admin"],
        }),
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    // Não é fatal — só não temos o registro inicial
    console.error("[reset-database] Falha ao criar audit inicial:", err);
  }

  return NextResponse.json({
    ok: true,
    backupPath,
    message:
      "Banco zerado. Backup salvo. O super_admin foi preservado — faça logout/login para sincronizar a sessão.",
  });
}
