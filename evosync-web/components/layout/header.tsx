"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { SendStateBadge } from "@/components/status-badge";
import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CircleDot, History, Users, UserCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatConnectionState } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const connection = useAppStore((s) => s.connection);
  const status = useAppStore((s) => s.status);
  const contactsCount = useAppStore((s) => s.contactsCount);
  const selectedIds = useAppStore((s) => s.selectedIds);
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border glass-strong px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary text-white">
          <Send className="h-4 w-4" />
        </div>
        <span className="font-bold font-display tracking-tight">EvoSync</span>
      </div>
      <div className="flex items-center gap-1.5 md:gap-2 ml-auto flex-wrap justify-end">
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Contatos:</span>
          <span className="font-semibold text-foreground tabular-nums">{contactsCount}</span>
        </div>
        <Link
          href="/contatos?panel=send"
          className="hidden md:flex items-center gap-2 rounded-lg border border-primary/40 bg-primary-subtle px-3 py-1.5 text-xs hover:bg-primary/10 transition-colors"
        >
          <span className="text-primary">Para envio:</span>
          <span className="font-semibold text-primary tabular-nums">{selectedIds.size}</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Histórico:</span>
          <span className="font-semibold text-foreground tabular-nums">{historyCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
          <CircleDot
            className={cn(
              "h-3.5 w-3.5",
              connection.ok ? "text-success animate-pulse-soft" : "text-muted-foreground"
            )}
          />
          <span className="text-muted-foreground">Conexão:</span>
          <span
            className={cn(
              "font-semibold",
              connection.ok ? "text-success" : "text-muted-foreground"
            )}
          >
            {formatConnectionState(connection.ok, connection.state)}
          </span>
        </div>
        <SendStateBadge state={status.state} />
        {session?.user && (
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
            <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground truncate max-w-[160px]">{session.user.email}</span>
          </div>
        )}
        <ThemeToggle />
        {session?.user && <LogoutButton />}
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
