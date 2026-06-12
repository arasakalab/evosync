"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

export function Sidebar({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-panel/40 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Send className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-text">
            EvoTeste
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Web · v1
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-neutral/40 hover:text-text"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "text-primary" : "text-muted group-hover:text-text"
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-[11px] leading-relaxed text-muted">
        <p>Disparador via Evolution API.</p>
        <p className="mt-1 text-muted/70">Uso local · chmod 600 nas credenciais</p>
      </div>
    </aside>
  );
}
