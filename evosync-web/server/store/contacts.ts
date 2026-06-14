/**
 * Persistência de contatos POR TENANT (SaaS Phase 4) — Estendido (FASE 2 ADR-001).
 *
 * Schema de `fields` é armazenado como JSON string (SQLite JSON1).
 * Schema de `tags`/`lists` é JSON array de strings.
 * `opt_out` é boolean (Drizzle converte 0/1 ↔ false/true).
 *
 * Mudanças desta versão (FASE 2):
 *  - `listContacts(tenantId, filters?)` aceita filtros estruturados e filtra no SQL.
 *  - `addContactsBulk` faz upsert com merge (preserva tags/opt_out/notes/lists).
 *  - Novas funções: getContact, updateContact, deleteContact, bulkSetTag, bulkSetOptOut.
 */
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { rowToContact } from "@/lib/db/mappers";
import type { Contact, ContactFilters } from "@/lib/types";

export interface ListContactsResult {
  contacts: Contact[];
  /** Total do tenant sem filtros (catálogo inteiro). */
  count: number;
  /** Total com filtros aplicados, mas ANTES de LIMIT/OFFSET. */
  filteredCount: number;
}

export interface AddContactsBulkResult {
  added: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Lista contatos do tenant com filtros opcionais.
 *
 * Filtros suportados (todos opcionais, todos combináveis):
 *  - q: busca em number, name e fields (fields é fallback em memória)
 *  - mode: "all" | "selected" | "opt_out"
 *  - tag: string
 *  - list: listId (filtra via contact_list_members)
 *  - opt_out: boolean (true → só opt-out; false → só não opt-out)
 *  - limit, offset: paginação (aplicada por último)
 */
export function listContacts(
  tenantId: string,
  filters?: ContactFilters
): ListContactsResult {
  if (!tenantId) {
    return { contacts: [], count: 0, filteredCount: 0 };
  }
  const db = getDb();
  const f = filters ?? {};

  // count: total sem filtros
  const countRow = db
    .select({ value: sql<number>`count(*)` })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId))
    .all()[0];
  const count = Number(countRow?.value ?? 0);

  // Se mode é "opt_out" E não tem outros filtros, encurta para um WHERE simples
  // (otimização: filtra direto). Caso geral, monta WHERE dinâmico.
  const whereClauses: any[] = [eq(schema.contacts.tenantId, tenantId)];

  // q: busca em number, name (SQL) e fields (fallback em memória)
  const hasQ = !!(f.q && f.q.trim());
  if (hasQ) {
    const likeTerm = `%${f.q!.trim()}%`;
    whereClauses.push(
      or(
        like(schema.contacts.number, likeTerm),
        like(schema.contacts.name, likeTerm)
      )!
    );
  }

  // mode
  if (f.mode === "opt_out") {
    whereClauses.push(eq(schema.contacts.optOut, true));
  } else if (f.mode === "selected") {
    // Importa lazy para evitar ciclo: bulk-selections é independente mas não há ciclo real.
    // Carrega os IDs selecionados e filtra.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSelection } = require("@/server/store/contact-selections");
    const sel = getSelection(tenantId);
    if (!sel.ids.length) {
      // Sem seleção → resultado vazio
      return { contacts: [], count, filteredCount: 0 };
    }
    whereClauses.push(inArray(schema.contacts.id, sel.ids));
  }

  // tag
  if (f.tag) {
    // json_each em SQL: EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
    whereClauses.push(
      sql`EXISTS (SELECT 1 FROM json_each(${schema.contacts.tags}) WHERE json_each.value = ${f.tag})`
    );
  }

  // list
  if (f.list) {
    whereClauses.push(
      sql`${schema.contacts.id} IN (SELECT contact_id FROM contact_list_members WHERE list_id = ${f.list})`
    );
  }

  // opt_out explícito (false é o default, mas permite inverter)
  if (f.opt_out === true && f.mode !== "opt_out") {
    whereClauses.push(eq(schema.contacts.optOut, true));
  } else if (f.opt_out === false && f.mode !== "opt_out") {
    whereClauses.push(eq(schema.contacts.optOut, false));
  }

  // filteredCount: count com mesmos WHERE
  const filteredCountRow = db
    .select({ value: sql<number>`count(*)` })
    .from(schema.contacts)
    .where(and(...whereClauses))
    .all()[0];
  const filteredCount = Number(filteredCountRow?.value ?? 0);

  // Query principal
  let q = db
    .select()
    .from(schema.contacts)
    .where(and(...whereClauses))
    .orderBy(desc(schema.contacts.createdAt));

  if (f.limit !== undefined && f.limit > 0) {
    q = q.limit(f.limit) as any;
  }
  if (f.offset !== undefined && f.offset > 0) {
    q = q.offset(f.offset) as any;
  }

  let rows = q.all();
  let contacts = rows.map(rowToContact);

  // Fallback: filtra fields em memória (q em fields só é feito aqui)
  if (hasQ) {
    const term = f.q!.trim().toLowerCase();
    const digits = term.replace(/\D+/g, "");
    contacts = contacts.filter((c) => {
      const haystack = [
        c.number,
        c.name || "",
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

  return { contacts, count, filteredCount };
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
    return rowToContact(existing);
  }

  const id = randomUUID().replace(/-/g, "");
  db.insert(schema.contacts)
    .values({
      id,
      tenantId,
      number: contact.number,
      name: contact.name ?? null,
      fields: JSON.stringify(contact.fields || {}),
      tags: JSON.stringify(contact.tags ?? []),
      lists: JSON.stringify(contact.lists ?? []),
      optOut: contact.opt_out ?? false,
      notes: contact.notes ?? null,
      updatedAt: sql`(CURRENT_TIMESTAMP)`,
    })
    .run();

  const inserted = db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, id))
    .all()[0];
  return rowToContact(inserted!);
}

/**
 * Adiciona vários contatos (bulk import) com upsert merge.
 *
 * Regra de merge (LGPD/anti-ban):
 *  - `name` passado (não-vazio) → atualiza `name`. `null` ou vazio → não toca.
 *  - `fields` passado → merge shallow: `{ ...existing, ...new }`.
 *  - tags, opt_out, notes, lists NUNCA sobrescritos pelo input.
 *  - `updated_at = CURRENT_TIMESTAMP` em qualquer update.
 */
export function addContactsBulk(
  tenantId: string,
  contacts: Contact[]
): AddContactsBulkResult {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!contacts || !contacts.length) {
    return { added: 0, updated: 0, skipped: 0, total: 0 };
  }
  const db = getDb();

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const total = contacts.length;

  db.transaction((tx) => {
    // Carrega existing por número (1 query)
    const numbers = contacts
      .map((c) => String(c.number || "").trim())
      .filter(Boolean);
    const existingRows = numbers.length
      ? tx
          .select()
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.tenantId, tenantId),
              inArray(schema.contacts.number, numbers)
            )
          )
          .all()
      : [];
    const existingByNumber = new Map(existingRows.map((r) => [r.number, r]));

    const toInsert: Array<{
      id: string;
      tenantId: string;
      number: string;
      name: string | null;
      fields: string;
      tags: string;
      lists: string;
      optOut: boolean;
      notes: string | null;
      updatedAt: ReturnType<typeof sql>;
    }> = [];

    for (const c of contacts) {
      const num = String(c.number || "").trim();
      if (!num) {
        skipped += 1;
        continue;
      }
      const existing = existingByNumber.get(num);
      if (!existing) {
        // INSERT novo
        toInsert.push({
          id: randomUUID().replace(/-/g, ""),
          tenantId,
          number: num,
          name: c.name ?? null,
          fields: JSON.stringify(c.fields || {}),
          tags: JSON.stringify(c.tags ?? []),
          lists: JSON.stringify(c.lists ?? []),
          optOut: c.opt_out ?? false,
          notes: c.notes ?? null,
          updatedAt: sql`(CURRENT_TIMESTAMP)`,
        });
        continue;
      }
      // UPSERT: merge respeitando regra LGPD
      const updates: Partial<typeof schema.contacts.$inferInsert> = {};
      let changed = false;

      if (c.name && c.name.trim()) {
        if (c.name !== existing.name) {
          updates.name = c.name;
          changed = true;
        }
      }
      // fields merge shallow
      const newFields = c.fields || {};
      const oldFields = (() => {
        try {
          const parsed = JSON.parse(existing.fields || "{}");
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          return {};
        }
      })();
      const mergedFields = { ...oldFields, ...newFields };
      // Detecta diff em fields
      const oldKeys = Object.keys(oldFields);
      const newKeys = Object.keys(newFields);
      if (
        oldKeys.length !== newKeys.length ||
        newKeys.some((k) => oldFields[k] !== newFields[k])
      ) {
        updates.fields = JSON.stringify(mergedFields);
        changed = true;
      }

      // tags, opt_out, notes, lists NUNCA sobrescritos pelo input.

      if (changed) {
        updates.updatedAt = new Date().toISOString();
        tx.update(schema.contacts)
          .set(updates as any)
          .where(
            and(
              eq(schema.contacts.tenantId, tenantId),
              eq(schema.contacts.id, existing.id)
            )
          )
          .run();
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    if (toInsert.length > 0) {
      tx.insert(schema.contacts).values(toInsert).run();
      added = toInsert.length;
    }
  });

  return { added, updated, skipped, total };
}

/**
 * Remove contatos pelo número (escopado por tenant).
 * Mantido por retrocompat. Preferir `deleteContact(tenantId, id)` para single.
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

// ============================================================================
// Funções novas (FASE 2)
// ============================================================================

/**
 * Busca 1 contato por id (escopado por tenant).
 */
export function getContact(tenantId: string, id: string): Contact | null {
  if (!tenantId || !id) return null;
  const db = getDb();
  const row = db
    .select()
    .from(schema.contacts)
    .where(
      and(eq(schema.contacts.tenantId, tenantId), eq(schema.contacts.id, id))
    )
    .all()[0];
  return row ? rowToContact(row) : null;
}

/**
 * Atualiza campos editáveis de 1 contato.
 * - name: string vazia → null
 * - tags/lists: aceitam string[] (JSON.stringify antes de gravar)
 * - opt_out: boolean
 * - notes: string | null
 * - fields: merge shallow (preserva chaves não enviadas)
 */
export function updateContact(
  tenantId: string,
  id: string,
  patch: Partial<
    Pick<Contact, "name" | "tags" | "lists" | "opt_out" | "notes" | "fields">
  >
): Contact | null {
  if (!tenantId || !id) return null;
  const db = getDb();

  const existing = db
    .select()
    .from(schema.contacts)
    .where(
      and(eq(schema.contacts.tenantId, tenantId), eq(schema.contacts.id, id))
    )
    .all()[0];
  if (!existing) return null;

  const updates: Partial<typeof schema.contacts.$inferInsert> = {};
  let changed = false;

  if (patch.name !== undefined) {
    const next = patch.name && patch.name.trim() ? patch.name.trim() : null;
    if (next !== existing.name) {
      updates.name = next;
      changed = true;
    }
  }

  if (patch.tags !== undefined) {
    const next = Array.isArray(patch.tags) ? patch.tags : [];
    const nextJson = JSON.stringify(next);
    if (nextJson !== existing.tags) {
      updates.tags = nextJson;
      changed = true;
    }
  }

  if (patch.lists !== undefined) {
    const next = Array.isArray(patch.lists) ? patch.lists : [];
    const nextJson = JSON.stringify(next);
    if (nextJson !== existing.lists) {
      updates.lists = nextJson;
      changed = true;
    }
  }

  if (patch.opt_out !== undefined) {
    if (patch.opt_out !== existing.optOut) {
      updates.optOut = patch.opt_out;
      changed = true;
    }
  }

  if (patch.notes !== undefined) {
    if (patch.notes !== existing.notes) {
      updates.notes = patch.notes;
      changed = true;
    }
  }

  if (patch.fields !== undefined) {
    const oldFields = (() => {
      try {
        const parsed = JSON.parse(existing.fields || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    })();
    const merged = { ...oldFields, ...(patch.fields || {}) };
    const nextJson = JSON.stringify(merged);
    if (nextJson !== existing.fields) {
      updates.fields = nextJson;
      changed = true;
    }
  }

  if (!changed) {
    return rowToContact(existing);
  }

  updates.updatedAt = new Date().toISOString();
  db.update(schema.contacts)
    .set(updates as any)
    .where(
      and(eq(schema.contacts.tenantId, tenantId), eq(schema.contacts.id, id))
    )
    .run();

  const updated = db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, id))
    .all()[0];
  return rowToContact(updated!);
}

/**
 * Remove 1 contato por id. CASCADE em contact_list_members trata.
 * Retorna true se removeu, false se não existia.
 */
export function deleteContact(tenantId: string, id: string): boolean {
  if (!tenantId || !id) return false;
  const db = getDb();
  const result = db
    .delete(schema.contacts)
    .where(
      and(eq(schema.contacts.tenantId, tenantId), eq(schema.contacts.id, id))
    )
    .run();
  return (result.changes ?? 0) > 0;
}

/**
 * Adiciona ou remove uma tag de N contatos em massa.
 * Carrega-muta-salva (O(n) pequeno, simples).
 */
export function bulkSetTag(
  tenantId: string,
  ids: string[],
  tag: string,
  add: boolean
): { updated: number } {
  if (!tenantId || !ids.length || !tag) return { updated: 0 };
  const db = getDb();
  let updated = 0;
  db.transaction((tx) => {
    const rows = tx
      .select()
      .from(schema.contacts)
      .where(
        and(eq(schema.contacts.tenantId, tenantId), inArray(schema.contacts.id, ids))
      )
      .all();
    for (const row of rows) {
      const tags = (() => {
        try {
          const parsed = JSON.parse(row.tags || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
      let next: string[];
      if (add) {
        if (tags.includes(tag)) continue;
        next = [...tags, tag];
      } else {
        if (!tags.includes(tag)) continue;
        next = tags.filter((t) => t !== tag);
      }
      tx.update(schema.contacts)
        .set({ tags: JSON.stringify(next), updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(schema.contacts.id, row.id))
        .run();
      updated += 1;
    }
  });
  return { updated };
}

/**
 * Marca/desmarca opt-out de N contatos em 1 UPDATE.
 */
export function bulkSetOptOut(
  tenantId: string,
  ids: string[],
  optOut: boolean
): { updated: number } {
  if (!tenantId || !ids.length) return { updated: 0 };
  const db = getDb();
  const result = db
    .update(schema.contacts)
    .set({ optOut, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(
      and(eq(schema.contacts.tenantId, tenantId), inArray(schema.contacts.id, ids))
    )
    .run();
  return { updated: result.changes ?? 0 };
}
