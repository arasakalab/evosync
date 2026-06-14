/**
 * Conversão snake_case (DB) ↔ camelCase (app) para o schema do EvoSync.
 *
 * Centraliza a hidratação dos tipos Drizzle ($inferSelect) para os tipos
 * públicos de `lib/types.ts`. Garante que campos como `id` (que existiam
 * no DB mas eram descartados) sejam preservados, e que colunas JSON
 * (`tags`, `lists`, `fields`, `selected_ids`) sejam parseadas com
 * fallback seguro para `[]` / `{}` quando o valor estiver corrompido.
 */
import type { schema } from "./index";
import type {
  Contact,
  ContactList,
  ContactFields,
} from "@/lib/types";

type ContactRow = typeof schema.contacts.$inferSelect;
type ContactListRow = typeof schema.contactLists.$inferSelect;

export function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    tags: safeParseStringArray(row.tags),
    lists: safeParseStringArray(row.lists),
    opt_out: row.optOut,
    notes: row.notes,
    fields: safeParseFields(row.fields),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToContactList(row: ContactListRow): ContactList {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export function safeParseStringArray(
  raw: string | null | undefined
): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function safeParseFields(
  raw: string | null | undefined
): ContactFields {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ContactFields;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function safeParseContactIds(
  raw: string | null | undefined
): string[] {
  return safeParseStringArray(raw);
}
