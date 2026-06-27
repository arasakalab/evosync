"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

export function ContactsHeaderStats() {
  const contactsCount = useAppStore((s) => s.contactsCount);
  const contacts = useAppStore((s) => s.contacts);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const [optOutCount, setOptOutCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.contacts.list({ mode: "opt_out", limit: 1 });
        if (mounted) setOptOutCount(r.filteredCount);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [contactsCount, contacts]);

  const selectedCount = selectedIds.size;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" className="text-sm px-3 py-1">
        {contactsCount} no catálogo
      </Badge>
      <Badge variant="success" className="text-sm px-3 py-1">
        {selectedCount} para envio
      </Badge>
      {optOutCount > 0 && (
        <Badge variant="danger" className="text-sm px-3 py-1">
          {optOutCount} opt-out
        </Badge>
      )}
    </div>
  );
}
