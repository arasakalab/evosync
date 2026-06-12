/**
 * Script de migração do banco. Roda todas as migrations SQL pendentes.
 * É idempotente — pode ser executado múltiplas vezes.
 *
 * Uso: npm run db:migrate
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";

const dbPath = process.env.DATABASE_URL || "./data/evosync.db";

// Garante que o diretório existe
const dir = path.dirname(dbPath);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[migrate] Diretório criado: ${dir}`);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

console.log(`[migrate] Banco: ${dbPath}`);
console.log(`[migrate] Rodando migrations de lib/db/migrations/...`);

try {
  migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("[migrate] ✓ Migrations aplicadas com sucesso");
} catch (e: any) {
  console.error("[migrate] ✗ Erro:", e.message);
  process.exit(1);
} finally {
  sqlite.close();
}
