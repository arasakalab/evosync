import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { ContactFilters } from "@/lib/types";

/** Monta filtros ativos a partir do store (modo, tag, lista, busca). */
export function buildContactFiltersFromStore(): ContactFilters {
  const {
    contactsMode,
    contactsTagFilter,
    contactsListFilter,
    contactsSearch,
  } = useAppStore.getState();
  return {
    q: contactsSearch || undefined,
    mode: contactsMode === "all" ? undefined : contactsMode,
    tag: contactsTagFilter || undefined,
    list: contactsListFilter || undefined,
  };
}

/** Recarrega contatos respeitando filtros ativos e atualiza o store. */
export async function refetchContactsWithActiveFilters(): Promise<void> {
  const { setContacts } = useAppStore.getState();
  const r = await api.contacts.list(buildContactFiltersFromStore());
  setContacts(r.contacts, { count: r.count, filteredCount: r.filteredCount });
}
