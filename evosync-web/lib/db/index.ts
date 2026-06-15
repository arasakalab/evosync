/**
 * Cliente SQLite + Drizzle ORM.
 * Singleton compartilhado em todo o processo Next.js.
 *
 * Configura WAL mode (melhor concorrência) e habilita foreign keys
 * (que ficam off por default no SQLite).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __evosync_db: ReturnType<typeof drizzle> | undefined;
  // eslint-disable-next-line no-var
  var __evosync_sqlite: Database.Database | undefined;
}

const DEFAULT_DB_PATH = "./data/evosync.db";

function getDbPath(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return DEFAULT_DB_PATH;
  if (url === ":memory:") return url;
  // Garante que o diretório existe
  const dir = path.dirname(url);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return url;
}

function openSqlite(): Database.Database {
  const dbPath = getDbPath();
  const sqlite = new Database(dbPath);
  // WAL: escritores não bloqueiam leitores
  sqlite.pragma("journal_mode = WAL");
  // Foreign keys (default off no SQLite)
  sqlite.pragma("foreign_keys = ON");
  // Busy timeout: 5s ao invés de falhar imediatamente
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

function getSqlite(): Database.Database {
  if (!globalThis.__evosync_sqlite) {
    globalThis.__evosync_sqlite = openSqlite();
  }
  return globalThis.__evosync_sqlite;
}

/**
 * Retorna a conexão SQLite bruta (better-sqlite3).
 * Útil para operações de baixo nível como backup via `db.backup()`.
 * NÃO use para queries — prefira `getDb()` (Drizzle).
 */
export function getRawSqlite(): Database.Database {
  return getSqlite();
}

/** Retorna o caminho do arquivo SQLite atual. */
export function getDbFilePath(): string {
  return getDbPath();
}

/**
 * Fecha a conexão SQLite atual e limpa o cache singleton.
 *
 * ⚠️  CUIDADO: use apenas em casos extremos (ex: após restaurar um backup
 *     de banco). Após chamar, a próxima chamada a `getDb()` re-abre a
 *     conexão apontando para o MESMO arquivo no disco. Se o arquivo foi
 *     substituído no meio tempo, a nova conexão lê os dados novos.
 *
 * Não é seguro chamar com queries em voo — todas as conexões ativas
 * verão erro "database is closed".
 */
export function resetDb(): void {
  if (globalThis.__evosync_sqlite) {
    try {
      globalThis.__evosync_sqlite.close();
    } catch {
      /* ignore */
    }
  }
  globalThis.__evosync_db = undefined;
  globalThis.__evosync_sqlite = undefined;
}

export function getDb() {
  if (!globalThis.__evosync_db) {
    const sqlite = getSqlite();
    globalThis.__evosync_db = drizzle(sqlite, { schema });
  }
  return globalThis.__evosync_db;
}

export type DbClient = ReturnType<typeof getDb>;
export { schema };
