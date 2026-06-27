"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  locked?: boolean;
}

export function Sidebar({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg bg-primary/30 blur-md" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elev-2 shadow-primary/30">
            <BrandMark className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold font-display text-foreground">
            EvoSync
          </span>
          <span className="text-2xs uppercase tracking-widest text-muted-foreground">
            Web · v1
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={item.locked || undefined}
              tabIndex={item.locked ? -1 : undefined}
              onClick={(e) => {
                if (item.locked) {
                  e.preventDefault();
                }
              }}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                "transition-all duration-200",
                item.locked
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : active
                  ? "bg-primary/10 text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-alt"
              )}
              title={
                item.locked
                  ? "Conecte seu WhatsApp primeiro (aba Conexão)"
                  : undefined
              }
            >
              {active && !item.locked && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  item.locked
                    ? "text-muted-foreground/40"
                    : active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.locked && (
                <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-2xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground/70">
          Plataforma profissional de campanhas
        </p>
        <p className="mt-1 uppercase tracking-widest text-muted-foreground/70">
          by Arasaka Lab
        </p>
      </div>
    </aside>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="18" r="2" fill="currentColor" />
      <path d="M7.5 7.5L11 16.5" />
      <path d="M16.5 7.5L13 16.5" />
      <path d="M8 6H16" />
    </svg>
  );
}
