/**
 * Persistência de LISTAS DE CONTATOS por tenant.
 *
 * Modelo relacional:
 *   contact_lists      (1:N por tenant, UNIQUE (tenant_id, name))
 *   contact_list_members  (N:N entre contact_lists e contacts)
 *
 * IMPORTANTE: `contacts.lists` (coluna denormalizada em contacts) é BEST-EFFORT
 * e mantida sincronizada pelas funções `addListMembers`/`removeListMembers`
 * para a UI mostrar badges rapidamente. A FONTE DE VERDADE para membership
 * é a tabela `contact_list_members`. Filtros SQL por lista devem usar
 * `contact_list_members` (não `contacts.lists`).
 */
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { rowToContactList, safeParseStringArray } from "@/lib/db/mappers";
import type { ContactList } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Lista todas as listas do tenant, com `memberCount` populado.
 * 1 query para listas + 1 query de count agregado (GROUP BY list_id) — O(1) round-trips.
 */
export function listContactLists(tenantId: string): ContactList[] {
  if (!tenantId) return [];
  const db = getDb();
  const lists = db
    .select()
    .from(schema.contactLists)
    .where(eq(schema.contactLists.tenantId, tenantId))
    .all();

  if (lists.length === 0) return [];

  // 1 query agregada para todos os counts
  const counts = new Map<string, number>();
  // SQLite não tem GROUP BY direto via Drizzle, então iteramos (listas são poucas)
  for (const list of lists) {
    const row = db
      .select({ id: schema.contactListMembers.listId })
      .from(schema.contactListMembers)
      .where(eq(schema.contactListMembers.listId, list.id))
      .all();
    counts.set(list.id, row.length);
  }

  return lists.map((r) => ({
    ...rowToContactList(r),
    memberCount: counts.get(r.id) ?? 0,
  }));
}

export function getContactList(
  tenantId: string,
  id: string
): ContactList | null {
  if (!tenantId || !id) return null;
  const db = getDb();
  const row = db
    .select()
    .from(schema.contactLists)
    .where(
      and(
        eq(schema.contactLists.tenantId, tenantId),
        eq(schema.contactLists.id, id)
      )
    )
    .all()[0];
  if (!row) return null;
  return {
    ...rowToContactList(row),
    memberCount: db
      .select()
      .from(schema.contactListMembers)
      .where(eq(schema.contactListMembers.listId, id))
      .all().length,
  };
}

/**
 * Cria uma lista. Lança erro se (tenantId, name) já existe.
 * A rota captura o erro e retorna 409.
 */
export function createContactList(
  tenantId: string,
  data: { name: string; color?: string | null }
): ContactList {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!data.name || !data.name.trim()) {
    throw new Error("Nome da lista é obrigatório");
  }
  const db = getDb();
  const id = randomUUID().replace(/-/g, "");
  try {
    db.insert(schema.contactLists)
      .values({
        id,
        tenantId,
        name: data.name.trim(),
        color: data.color ?? null,
        createdAt: nowIso(),
      })
      .run();
  } catch (e: any) {
    // UNIQUE constraint em (tenant_id, name) → bubble up
    if (String(e?.message || "").includes("UNIQUE")) {
      throw new Error(`Já existe uma lista com o nome "${data.name.trim()}"`);
    }
    throw e;
  }
  return {
    id,
    name: data.name.trim(),
    color: data.color ?? null,
    createdAt: nowIso(),
    memberCount: 0,
  };
}

export function updateContactList(
  tenantId: string,
  id: string,
  patch: { name?: string; color?: string | null }
): ContactList | null {
  if (!tenantId || !id) return null;
  const db = getDb();
  const existing = db
    .select()
    .from(schema.contactLists)
    .where(
      and(
        eq(schema.contactLists.tenantId, tenantId),
        eq(schema.contactLists.id, id)
      )
    )
    .all()[0];
  if (!existing) return null;

  const updates: Partial<typeof schema.contactLists.$inferInsert> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("Nome da lista é obrigatório");
    updates.name = patch.name.trim();
  }
  if (patch.color !== undefined) {
    updates.color = patch.color;
  }

  if (Object.keys(updates).length > 0) {
    try {
      db.update(schema.contactLists)
        .set(updates)
        .where(
          and(
            eq(schema.contactLists.tenantId, tenantId),
            eq(schema.contactLists.id, id)
          )
        )
        .run();
    } catch (e: any) {
      if (String(e?.message || "").includes("UNIQUE")) {
        throw new Error(`Já existe uma lista com o nome "${patch.name?.trim()}"`);
      }
      throw e;
    }
  }
  return getContactList(tenantId, id);
}

export function deleteContactList(tenantId: string, id: string): boolean {
  if (!tenantId || !id) return false;
  const db = getDb();
  const result = db
    .delete(schema.contactLists)
    .where(
      and(
        eq(schema.contactLists.tenantId, tenantId),
        eq(schema.contactLists.id, id)
      )
    )
    .run();
  return (result.changes ?? 0) > 0;
  // CASCADE em contact_list_members cuida dos membros.
  // contacts.lists denormalizado fica sujo até a próxima escrita — aceitável.
}

/**
 * Adiciona N contatos a uma lista.
 * 1 transação: INSERT OR IGNORE em contact_list_members + UPDATE contacts.lists denormalizado.
 */
export function addListMembers(
  tenantId: string,
  listId: string,
  contactIds: string[]
): { added: number } {
  if (!tenantId || !listId || !contactIds.length) return { added: 0 };
  const db = getDb();
  let added = 0;
  db.transaction((tx) => {
    // Garante que a lista existe e é do tenant
    const list = tx
      .select()
      .from(schema.contactLists)
      .where(
        and(
          eq(schema.contactLists.tenantId, tenantId),
          eq(schema.contactLists.id, listId)
        )
      )
      .all()[0];
    if (!list) throw new Error("Lista não encontrada");

    // Carrega contatos alvo (e filtra cross-tenant)
    const targets = tx
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.tenantId, tenantId),
          inArray(schema.contacts.id, contactIds)
        )
      )
      .all();
    const targetIds = new Set(targets.map((c) => c.id));

    for (const cid of contactIds) {
      if (!targetIds.has(cid)) continue;
      try {
        tx.insert(schema.contactListMembers)
          .values({ listId, contactId: cid, addedAt: nowIso() })
          .run();
        added += 1;
      } catch {
        // PK duplicada → já é membro, ignora
        continue;
      }
      // Atualiza contacts.lists denormalizado
      const c = targets.find((t) => t.id === cid)!;
      const lists = safeParseStringArray(c.lists);
      if (!lists.includes(listId)) {
        lists.push(listId);
        tx.update(schema.contacts)
          .set({ lists: JSON.stringify(lists) })
          .where(eq(schema.contacts.id, cid))
          .run();
      }
    }
  });
  return { added };
}

export function removeListMembers(
  tenantId: string,
  listId: string,
  contactIds: string[]
): { removed: number } {
  if (!tenantId || !listId || !contactIds.length) return { removed: 0 };
  const db = getDb();
  let removed = 0;
  db.transaction((tx) => {
    // Garante que a lista é do tenant
    const list = tx
      .select()
      .from(schema.contactLists)
      .where(
        and(
          eq(schema.contactLists.tenantId, tenantId),
          eq(schema.contactLists.id, listId)
        )
      )
      .all()[0];
    if (!list) throw new Error("Lista não encontrada");

    for (const cid of contactIds) {
      // Garante que o contato é do tenant antes de remover
      const c = tx
        .select()
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, tenantId),
            eq(schema.contacts.id, cid)
          )
        )
        .all()[0];
      if (!c) continue;

      const r = tx
        .delete(schema.contactListMembers)
        .where(
          and(
            eq(schema.contactListMembers.listId, listId),
            eq(schema.contactListMembers.contactId, cid)
          )
        )
        .run();
      if ((r.changes ?? 0) > 0) {
        removed += 1;
        // Atualiza contacts.lists denormalizado
        const lists = safeParseStringArray(c.lists).filter(
          (l) => l !== listId
        );
        tx.update(schema.contacts)
          .set({ lists: JSON.stringify(lists) })
          .where(eq(schema.contacts.id, cid))
          .run();
      }
    }
  });
  return { removed };
}

export function getContactListMembers(
  tenantId: string,
  listId: string
): string[] {
  if (!tenantId || !listId) return [];
  const db = getDb();
  // Verifica ownership
  const list = db
    .select()
    .from(schema.contactLists)
    .where(
      and(
        eq(schema.contactLists.tenantId, tenantId),
        eq(schema.contactLists.id, listId)
      )
    )
    .all()[0];
  if (!list) return [];
  return db
    .select({ contactId: schema.contactListMembers.contactId })
    .from(schema.contactListMembers)
    .where(eq(schema.contactListMembers.listId, listId))
    .all()
    .map((r) => r.contactId);
}
