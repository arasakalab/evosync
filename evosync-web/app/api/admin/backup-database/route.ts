/**
 * GET /api/admin/backup-database
 *
 * Faz um snapshot do SQLite e devolve como download stream.
 * O cliente decide onde salvar (File System Access API no Chromium,
 * ou download via <a> em outros browsers).
 *
 * Requisitos:
 *  - Sessão válida de super_admin
 *
 * Não recebe body. Retorna o arquivo .db com Content-Disposition
 * sugerindo o nome `evosync-backup-YYYY-MM-DD_HHMMSS.db`.
 *
 * Notas técnicas:
 *  - better-sqlite3 v11 .backup(path) cria snapshot consistente mesmo com WAL.
 *  - Streaming via Node Readable → Web ReadableStream para Next.js.
 *  - Arquivo temporário é apagado após o stream ser consumido (ou em 60s).
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRawSqlite, getDbFilePath } from "@/lib/db";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/T/, "_")
    .slice(0, 19);
}

export async function GET(_req: NextRequest) {
  // 1. === AUTENTICAÇÃO ===
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (session.user.role !== "super_admin") {
    return new Response(
      JSON.stringify({ error: "Acesso restrito a super_admin" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 2. === BACKUP TO TEMP ===
  const filename = `evosync-backup-${timestamp()}.db`;
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `evosync-backup-${Date.now()}-${filename}`);

  try {
    const sqlite = getRawSqlite();
    await (sqlite as any).backup(tmpPath);
  } catch (err: any) {
    console.error("[backup-database] Falha ao criar snapshot:", err);
    return new Response(
      JSON.stringify({
        error: "Falha ao criar backup",
        details: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 3. === STREAM RESPONSE ===
  let stat: fs.Stats;
  try {
    stat = fs.statSync(tmpPath);
  } catch {
    return new Response(
      JSON.stringify({ error: "Backup temporário desapareceu" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Detecta tamanho do DB original para mostrar no header (opcional)
  const dbPath = getDbFilePath();
  let dbSize: number | null = null;
  try {
    dbSize = fs.statSync(dbPath).size;
  } catch {
    /* ignore */
  }

  const nodeStream = fs.createReadStream(tmpPath);
  // Converte Node Readable → Web ReadableStream para NextResponse
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  // Cleanup: apaga temp file quando o stream termina (ou dá erro)
  const cleanup = () => {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  };
  nodeStream.on("end", cleanup);
  nodeStream.on("close", cleanup);
  nodeStream.on("error", cleanup);
  // Safety net: se o cliente desconectar antes de consumir, ainda limpa
  setTimeout(cleanup, 60_000).unref();

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Length": stat.size.toString(),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Backup-Size": stat.size.toString(),
      "X-DB-Size": String(dbSize ?? stat.size),
      "Cache-Control": "no-store",
    },
  });
}
