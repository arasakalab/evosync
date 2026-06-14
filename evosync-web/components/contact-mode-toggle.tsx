"use client";

import { useAppStore, type ContactsViewMode } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Users, CheckCheck, Ban } from "lucide-react";

const MODES: Array<{ key: ContactsViewMode; label: string; icon: any }> = [
  { key: "all", label: "Todos", icon: Users },
  { key: "selected", label: "Selecionados", icon: CheckCheck },
  { key: "opt_out", label: "Opt-out", icon: Ban },
];

export function ContactModeToggle() {
  const mode = useAppStore((s) => s.contactsMode);
  const setMode = useAppStore((s) => s.setContactsMode);

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-panel/60 p-1">
      {MODES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setMode(key)}
          className={cn(
            "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
            mode === key
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:bg-neutral/40 hover:text-text"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
