"use client";

import { cn } from "@/lib/utils";
import { Hash } from "lucide-react";

interface TagChipsProps {
  tags: Array<{ name: string; count: number }>;
  active: string | null;
  onSelect: (tag: string | null) => void;
}

/**
 * Chips horizontais de tags, scrolláveis. Clicar seleciona/deseleciona.
 */
export function TagChips({ tags, active, onSelect }: TagChipsProps) {
  if (tags.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      <span className="text-[11px] uppercase tracking-wider text-muted shrink-0 mr-1">
        Tags
      </span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
          active === null
            ? "border-primary bg-primary/15 text-primary"
            : "border-border bg-panel/40 text-muted hover:bg-neutral/40"
        )}
      >
        Todas
      </button>
      {tags.map((t) => {
        const isActive = active === t.name;
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => onSelect(isActive ? null : t.name)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-panel/40 text-muted hover:bg-neutral/40"
            )}
          >
            <Hash className="h-3 w-3" />
            {t.name}
            <span className="text-muted/60">·{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
