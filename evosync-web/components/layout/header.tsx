"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { SendStateBadge } from "@/components/status-badge";
import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CircleDot, History, Users, UserCircle2 } from "lucide-react";
import { cn, formatConnectionState } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const connection = useAppStore((s) => s.connection);
  const status = useAppStore((s) => s.status);
  const contactsCount = useAppStore((s) => s.contactsCount);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const sentHistoryCount = useAppStore((s) => s.sentHistoryCount);

  return (
    <header className="shrink-0 border-b border-border glass-strong">
      <div className="flex h-14 md:h-16 items-center justify-between gap-2 px-3 md:px-6">
        <div className="flex items-center gap-2 md:hidden min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary text-white">
            <Send className="h-4 w-4" />
          </div>
          <span className="font-bold font-display tracking-tight truncate">
            EvoSync
          </span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 ml-auto flex-wrap justify-end min-w-0">
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Contatos:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {contactsCount}
            </span>
          </div>
          <Link
            href="/contatos?panel=send"
            className="hidden md:flex items-center gap-2 rounded-lg border border-primary/40 bg-primary-subtle px-3 py-1.5 text-xs hover:bg-primary/10 transition-colors"
          >
            <span className="text-primary">Para envio:</span>
            <span className="font-semibold text-primary tabular-nums">
              {selectedIds.size}
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Histórico:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {sentHistoryCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2 py-1 md:px-3 md:py-1.5 text-xs max-w-[140px] sm:max-w-none">
            <CircleDot
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                connection.ok
                  ? "text-success animate-pulse-soft"
                  : "text-muted-foreground"
              )}
            />
            <span className="text-muted-foreground hidden sm:inline">
              Conexão:
            </span>
            <span
              className={cn(
                "font-semibold truncate",
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
              <span className="text-muted-foreground truncate max-w-[160px]">
                {session.user.email}
              </span>
            </div>
          )}
          <ThemeToggle />
          {session?.user && <LogoutButton />}
        </div>
      </div>
      {/* Stats compactos no mobile */}
      <div className="md:hidden flex items-center gap-2 px-3 pb-2 overflow-x-auto text-xs">
        <span className="shrink-0 rounded-md border border-border bg-surface/60 px-2 py-1">
          <span className="text-muted-foreground">Contatos </span>
          <span className="font-semibold tabular-nums">{contactsCount}</span>
        </span>
        <Link
          href="/contatos?panel=send"
          className="shrink-0 rounded-md border border-primary/40 bg-primary-subtle px-2 py-1"
        >
          <span className="text-primary">Envio </span>
          <span className="font-semibold text-primary tabular-nums">
            {selectedIds.size}
          </span>
        </Link>
        <span className="shrink-0 rounded-md border border-border bg-surface/60 px-2 py-1">
          <span className="text-muted-foreground">Histórico </span>
          <span className="font-semibold tabular-nums">{sentHistoryCount}</span>
        </span>
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
