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

export function getDb() {
  if (!globalThis.__evosync_db) {
    const sqlite = getSqlite();
    globalThis.__evosync_db = drizzle(sqlite, { schema });
  }
  return globalThis.__evosync_db;
}

export type DbClient = ReturnType<typeof getDb>;
export { schema };
