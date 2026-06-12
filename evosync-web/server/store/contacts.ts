/**
 * Persistência de contatos POR TENANT (SaaS Phase 4).
 *
 * Antes (single-tenant): persisted_contacts.json global
 * Agora (multi-tenant): tabela `contacts` no SQLite, filtrada por tenantId.
 *
 * Schema de `fields` é armazenado como JSON string (SQLite JSON1).
 */
import { and, eq, like, or, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import type { Contact } from "@/lib/types";

/**
 * Lista contatos do tenant. Filtra opcionalmente por termo de busca
 * (em `number` ou em qualquer chave/valor de `fields`).
 */
export function listContacts(
  tenantId: string,
  search?: string
): Contact[] {
  if (!tenantId) return [];
  const db = getDb();
  const rows = db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .orderBy(desc(schema.contacts.createdAt))
    .all();

  const all: Contact[] = rows.map((r) => ({
    number: r.number,
    fields: safeParseFields(r.fields),
  }));

  if (!search || !search.trim()) return all;

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D+/g, "");
  return all.filter((c) => {
    const haystack = [
      c.number,
      ...Object.entries(c.fields || {}).flatMap(([k, v]) => [k, v]),
    ]
      .join(" ")
      .toLowerCase();
    const digitsN = c.number.replace(/\D+/g, "");
    if (haystack.includes(term)) return true;
    if (digits && digitsN.includes(digits)) return true;
    return false;
  });
}

/**
 * Adiciona 1 contato ao tenant. Retorna o contato criado.
 * Se já existir (mesmo tenant + mesmo número), retorna o existente.
 */
export function addContact(
  tenantId: string,
  contact: Contact
): Contact {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  const db = getDb();

  // Verifica duplicata
  const existing = db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        eq(schema.contacts.number, contact.number)
      )
    )
    .all()[0];
  if (existing) {
    return {
      number: existing.number,
      fields: safeParseFields(existing.fields),
    };
  }

  const id = randomUUID().replace(/-/g, "");
  db.insert(schema.contacts)
    .values({
      id,
      tenantId,
      number: contact.number,
      fields: JSON.stringify(contact.fields || {}),
    })
    .run();

  return { number: contact.number, fields: contact.fields || {} };
}

/**
 * Adiciona vários contatos (bulk import).
 * Retorna { added, existing, total }.
 */
export function addContactsBulk(
  tenantId: string,
  contacts: Contact[]
): { added: number; existing: number; total: number } {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  const db = getDb();

  // Carrega numbers existentes (1 query)
  const existing = new Set(
    db
      .select({ number: schema.contacts.number })
      .from(schema.contacts)
      .where(eq(schema.contacts.tenantId, tenantId))
      .all()
      .map((r) => r.number)
  );

  let added = 0;
  let skipped = 0;

  // INSERT em batch
  const toInsert: { id: string; tenantId: string; number: string; fields: string }[] =
    [];
  for (const c of contacts) {
    const num = String(c.number || "").trim();
    if (!num) continue;
    if (existing.has(num)) {
      skipped += 1;
      continue;
    }
    toInsert.push({
      id: randomUUID().replace(/-/g, ""),
      tenantId,
      number: num,
      fields: JSON.stringify(c.fields || {}),
    });
    existing.add(num);
  }

  if (toInsert.length > 0) {
    db.insert(schema.contacts).values(toInsert).run();
    added = toInsert.length;
  }

  return { added, existing: skipped, total: contacts.length };
}

/**
 * Remove contatos pelo número (escopado por tenant).
 * Retorna quantos foram removidos.
 */
export function removeContacts(
  tenantId: string,
  numbers: string[]
): number {
  if (!tenantId || !numbers.length) return 0;
  const db = getDb();
  const before = db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .all().length;

  for (const num of numbers) {
    db.delete(schema.contacts)
      .where(
        and(
          eq(schema.contacts.tenantId, tenantId),
          eq(schema.contacts.number, num)
        )
      )
      .run();
  }

  const after = db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .all().length;

  return before - after;
}

/**
 * Limpa TODOS os contatos do tenant.
 */
export function clearContacts(tenantId: string): number {
  if (!tenantId) return 0;
  const db = getDb();
  const before = db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .all().length;
  db.delete(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .run();
  return before;
}

/**
 * Helpers internos
 */
function safeParseFields(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}
