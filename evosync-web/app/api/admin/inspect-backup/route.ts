/**
 * POST /api/admin/inspect-backup
 *
 * Recebe um arquivo .db via multipart/form-data, valida como backup
 * do EvoSync e retorna metadados (tamanho, tabelas, contagens,
 * super admins). NÃO modifica nada — read-only.
 *
 * Usado pelo client para mostrar preview do arquivo ANTES do restore
 * destrutivo. A validação aqui é re-validada no /restore-database
 * (defense in depth).
 *
 * Requer: sessão de super_admin.
 * Não requer: senha (operação read-only e idempotente).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBackupFile, REQUIRED_TABLES, SQLITE_MAGIC } from "@/lib/admin/backup-validation";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. Auth
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

  // 2. Parse
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
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Arquivo "database" não enviado' },
      { status: 400 }
    );
  }
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
      { error: "Arquivo muito pequeno para ser SQLite válido." },
      { status: 400 }
    );
  }

  // 3. Salva em temp
  const tmpPath = path.join(
    os.tmpdir(),
    `evosync-inspect-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.db`
  );
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);

    // 4. Valida
    const result = validateBackupFile(tmpPath);
    return NextResponse.json({
      ...result,
      fileName: file.name,
      uploadedSize: file.size,
      requiredTables: REQUIRED_TABLES,
      sqliteMagic: SQLITE_MAGIC.toString("utf-8"),
    });
  } finally {
    // 5. Cleanup
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

export const maxDuration = 30;
