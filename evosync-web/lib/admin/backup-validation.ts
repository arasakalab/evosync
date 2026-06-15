/**
 * Helpers compartilhados para validação de arquivos SQLite.
 * Usado por:
 *  - /api/admin/inspect-backup (read-only, retorna metadados)
 *  - /api/admin/restore-database (valida E faz o swap)
 */

import Database from "better-sqlite3";
import fs from "node:fs";

// Tabelas obrigatórias para considerar um arquivo como backup do EvoSync
export const REQUIRED_TABLES = [
  "tenants",
  "users",
  "licenses",
  "invites",
  "contacts",
  "contact_lists",
  "contact_list_members",
  "contact_selections",
  "schedules",
  "sent_log",
  "audit_log",
  "tenant_settings",
];

// Magic bytes do SQLite
export const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf-8");

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  fileSize: number;
  tables: string[];
  counts: Record<string, number>;
  superAdminEmails: string[];
}

/**
 * Valida um arquivo SQLite como backup válido do EvoSync.
 * Faz:
 *  1. Verifica magic bytes
 *  2. Abre em readonly
 *  3. Lista tabelas
 *  4. Verifica tabelas obrigatórias
 *  5. Coleta contagens (tenants, users, etc)
 *  6. Lista emails de super admins
 *  7. Garante que há pelo menos 1 super admin
 *
 * @param filePath Path absoluto do arquivo .db
 * @returns Resultado da validação (sempre retorna, nunca throw)
 */
export function validateBackupFile(filePath: string): ValidationResult {
  // 1. Magic bytes
  let header: Buffer;
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    header = buf;
  } catch (err: any) {
    return {
      valid: false,
      reason: `Não foi possível ler o arquivo: ${err?.message || err}`,
      fileSize: 0,
      tables: [],
      counts: {},
      superAdminEmails: [],
    };
  }

  if (!header.equals(SQLITE_MAGIC)) {
    return {
      valid: false,
      reason: "Não é um arquivo SQLite válido (magic bytes ausentes).",
      fileSize: 0,
      tables: [],
      counts: {},
      superAdminEmails: [],
    };
  }

  // 2-6. Abre readonly e inspeciona
  let db: Database.Database | null = null;
  try {
    const stat = fs.statSync(filePath);
    db = new Database(filePath, { readonly: true });

    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as { name: string }[]
    ).map((r) => r.name);

    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Não é um backup do EvoSync. Tabelas faltando: ${missing.join(", ")}`,
        fileSize: stat.size,
        tables,
        counts: {},
        superAdminEmails: [],
      };
    }

    // Contagens
    const counts: Record<string, number> = {};
    for (const table of [
      "tenants",
      "users",
      "licenses",
      "invites",
      "contacts",
      "contact_lists",
      "schedules",
      "sent_log",
      "audit_log",
    ]) {
      try {
        const r = db
          .prepare(`SELECT COUNT(*) as c FROM ${table}`)
          .get() as { c: number };
        counts[table] = r.c;
      } catch {
        counts[table] = 0;
      }
    }

    // Super admins
    const superAdminEmails = (
      db
        .prepare(
          "SELECT email FROM users WHERE role='super_admin' ORDER BY email"
        )
        .all() as { email: string }[]
    ).map((r) => r.email);

    if (superAdminEmails.length === 0) {
      return {
        valid: false,
        reason:
          "Arquivo não contém nenhum super_admin. Restaurar trancaria TODOS os admins para fora.",
        fileSize: stat.size,
        tables,
        counts,
        superAdminEmails,
      };
    }

    return {
      valid: true,
      fileSize: stat.size,
      tables,
      counts,
      superAdminEmails,
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: `Falha ao abrir SQLite: ${err?.message || err}`,
      fileSize: 0,
      tables: [],
      counts: {},
      superAdminEmails: [],
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  }
}
