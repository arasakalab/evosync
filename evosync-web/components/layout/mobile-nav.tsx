"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNavItem } from "@/lib/nav-items";

export function MobileNav({
  items,
  pathname,
}: {
  items: AppNavItem[];
  pathname: string;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-6 gap-0.5 px-1 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const label = item.shortLabel || item.label;
          if (item.locked) {
            return (
              <span
                key={item.href}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-muted-foreground/40 cursor-not-allowed"
                title="Conecte seu WhatsApp primeiro"
              >
                <Lock className="h-4 w-4" />
                <span className="text-[10px] leading-none truncate max-w-full">
                  {label}
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 min-h-[52px] transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-alt"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              <span className="text-[10px] leading-none truncate max-w-full">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
