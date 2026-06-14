/**
 * Persistência da SELEÇÃO DE CONTATOS POR TENANT.
 *
 * Modelo: 1 row por tenant em `contact_selections` (PK = tenant_id).
 * A coluna `selected_ids` é JSON array de contact_ids marcados para envio.
 *
 * Comportamento:
 *  - `getSelection` é tolerante: se não há row, retorna `{ ids: [], updatedAt: <agora> }`.
 *  - `setSelection` faz UPSERT (idempotente).
 *  - `bulkToggleSelection` faz add/remove em 1 transação.
 *
 * Limits:
 *  - `setSelection`: warn se > 10.000 (anti-OOM).
 *  - `bulkToggleSelection`: erro se > 1.000 (caller faz batching).
 */
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { safeParseStringArray } from "@/lib/db/mappers";
import type { ContactSelection } from "@/lib/types";

const MAX_SELECTION_SIZE = 10_000;
const MAX_BULK_TOGGLE = 1_000;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Retorna a seleção atual. Se não há row, retorna Set vazio (NÃO faz upsert).
 */
export function getSelection(tenantId: string): ContactSelection {
  if (!tenantId) return { ids: [], updatedAt: nowIso() };
  const db = getDb();
  const row = db
    .select()
    .from(schema.contactSelections)
    .where(eq(schema.contactSelections.tenantId, tenantId))
    .all()[0];
  if (!row) {
    return { ids: [], updatedAt: nowIso() };
  }
  return {
    ids: safeParseStringArray(row.selectedIds),
    updatedAt: row.updatedAt,
  };
}

/**
 * Substitui a seleção inteira. UPSERT idempotente.
 */
export function setSelection(
  tenantId: string,
  ids: string[]
): ContactSelection {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (ids.length > MAX_SELECTION_SIZE) {
    // eslint-disable-next-line no-console
    console.warn(
      `[contact-selections] setSelection com ${ids.length} ids (limite soft: ${MAX_SELECTION_SIZE})`
    );
  }
  const db = getDb();
  const updatedAt = nowIso();
  const payload = JSON.stringify(ids);

  // Drizzle SQLite: ON CONFLICT via insert
  db.insert(schema.contactSelections)
    .values({
      tenantId,
      selectedIds: payload,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.contactSelections.tenantId,
      set: { selectedIds: payload, updatedAt },
    })
    .run();

  return { ids, updatedAt };
}

/**
 * Adiciona ou remove `ids` do Set atual. 1 transação.
 *
 * `selected=true` → adiciona `ids` ao Set (sem duplicar).
 * `selected=false` → remove `ids` do Set.
 *
 * Retorna o Set final.
 */
export function bulkToggleSelection(
  tenantId: string,
  ids: string[],
  selected: boolean
): { ids: string[]; total: number } {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!ids.length) return { ids: getSelection(tenantId).ids, total: 0 };
  if (ids.length > MAX_BULK_TOGGLE) {
    throw new Error(
      `bulkToggleSelection aceita no máximo ${MAX_BULK_TOGGLE} ids por chamada (recebeu ${ids.length})`
    );
  }

  const db = getDb();
  const result = db.transaction((tx) => {
    const row = tx
      .select()
      .from(schema.contactSelections)
      .where(eq(schema.contactSelections.tenantId, tenantId))
      .all()[0];
    const current = row ? safeParseStringArray(row.selectedIds) : [];
    const set = new Set(current);
    for (const id of ids) {
      if (selected) set.add(id);
      else set.delete(id);
    }
    const next = Array.from(set);
    const updatedAt = nowIso();
    const payload = JSON.stringify(next);
    tx.insert(schema.contactSelections)
      .values({ tenantId, selectedIds: payload, updatedAt })
      .onConflictDoUpdate({
        target: schema.contactSelections.tenantId,
        set: { selectedIds: payload, updatedAt },
      })
      .run();
    return { ids: next, total: next.length };
  });

  // Mantém a referência ao sql para evitar tree-shake warning em alguns bundlers
  void sql;
  return result;
}
