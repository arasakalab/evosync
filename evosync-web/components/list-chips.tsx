"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ListChecks, Plus } from "lucide-react";

/**
 * Chips horizontais de listas. Clicar seleciona/deseleciona.
 * O botão "+ Nova lista" abre o diálogo de criação.
 */
export function ListChips({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  const lists = useAppStore((s) => s.contactLists);
  const active = useAppStore((s) => s.contactsListFilter);
  const setFilter = useAppStore((s) => s.setContactsListFilter);

  if (lists.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      <span className="text-[11px] uppercase tracking-wider text-muted shrink-0 mr-1">
        Listas
      </span>
      <button
        type="button"
        onClick={() => setFilter(null)}
        className={cn(
          "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
          active === null
            ? "border-primary bg-primary/15 text-primary"
            : "border-border bg-panel/40 text-muted hover:bg-neutral/40"
        )}
      >
        Todas
      </button>
      {lists.map((l) => {
        const isActive = active === l.id;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => setFilter(isActive ? null : l.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-panel/40 text-muted hover:bg-neutral/40"
            )}
          >
            <ListChecks className="h-3 w-3" />
            {l.name}
            <span className="text-muted/60">·{l.memberCount ?? 0}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onCreateClick}
        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-transparent px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary"
        title="Criar lista a partir da seleção atual"
      >
        <Plus className="h-3 w-3" />
        Nova
      </button>
    </div>
  );
}
