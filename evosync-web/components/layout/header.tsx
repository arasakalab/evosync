"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { SendStateBadge } from "@/components/status-badge";
import { CircleDot, History, Users } from "lucide-react";
import { api } from "@/lib/api";

export function Header() {
  const connection = useAppStore((s) => s.connection);
  const status = useAppStore((s) => s.status);
  const contacts = useAppStore((s) => s.contacts);
  const [historyCount, setHistoryCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const r = await api.send.sentLogCount();
        if (mounted) setHistoryCount(r.count);
      } catch {
        /* noop */
      }
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [status.sent]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-panel/30 px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Send className="h-4 w-4" />
        </div>
        <span className="font-bold tracking-tight">EvoSync</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-panel/60 px-3 py-1.5 text-xs">
          <Users className="h-3.5 w-3.5 text-muted" />
          <span className="text-muted">Contatos:</span>
          <span className="font-semibold text-text">{contacts.length}</span>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-panel/60 px-3 py-1.5 text-xs">
          <History className="h-3.5 w-3.5 text-muted" />
          <span className="text-muted">Histórico:</span>
          <span className="font-semibold text-text">{historyCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-panel/60 px-3 py-1.5 text-xs">
          <CircleDot
            className={`h-3.5 w-3.5 ${
              connection.ok ? "text-success animate-pulse-soft" : "text-muted"
            }`}
          />
          <span className="text-muted">Conexão:</span>
          <span
            className={`font-semibold ${
              connection.ok ? "text-success" : "text-muted"
            }`}
          >
            {connection.ok ? connection.state || "OK" : "—"}
          </span>
        </div>
        <SendStateBadge state={status.state} />
      </div>
    </header>
  );
}

function Send(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}
