"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  KeyRound,
  UserPlus,
  Users,
  ScrollText,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/admin/command-palette";
import { LogoutButton } from "@/components/admin/logout-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  user: { email: string; name: string };
  stats: {
    tenants: number;
    activeTenants: number;
    users: number;
    expiringSoon: number;
    expiringCritically: number;
    pendingInvites: number;
  };
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: keyof AdminShellProps["stats"];
  description?: string;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Empresas", icon: Building2, description: "Tenants cadastrados" },
  { href: "/admin/licenses", label: "Licenças", icon: KeyRound, badge: "expiringCritically", description: "Vencimentos e renovações" },
  { href: "/admin/invites", label: "Convites", icon: UserPlus, badge: "pendingInvites", description: "Convites pendentes" },
  { href: "/admin/users", label: "Usuários", icon: Users, description: "Todos os usuários" },
  { href: "/admin/audit", label: "Auditoria", icon: ScrollText, description: "Log de ações" },
  { href: "/admin/settings", label: "Configurações", icon: Settings, description: "Preferências e zona de perigo" },
];

export default function AdminShell({ user, stats, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen flex bg-background">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-dotgrid opacity-30" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-info/5 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
        {/* Logo */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-primary/30 blur-md" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elev-2 shadow-primary/30">
              <BrandMark className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold font-display text-foreground">
              EvoSync
            </div>
            <div className="text-2xs uppercase tracking-widest text-muted-foreground">
              Admin Panel
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            const badgeValue = item.badge ? stats[item.badge] : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  "transition-all duration-200",
                  active
                    ? "bg-primary/10 text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-alt"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {badgeValue > 0 && (
                  <Badge
                    variant={
                      item.badge === "expiringCritically" ? "danger" : "warning"
                    }
                    size="sm"
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {badgeValue}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-alt transition-colors">
            <div className="relative h-8 w-8 shrink-0 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-semibold shadow-elev-1">
              {(user.name || user.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {user.name || user.email}
              </div>
              <div className="text-2xs text-muted-foreground truncate">
                {user.email}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger-subtle transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (glass) */}
        <header className="sticky top-0 z-40 h-16 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-border glass-strong">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-elev-1">
                <BrandMark className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="hidden md:block">
              <CommandPalette user={user} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {stats.expiringCritically > 0 && (
              <Link
                href="/admin/licenses"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-danger-subtle border border-danger/20 text-danger-foreground text-xs font-medium hover:bg-danger/10 transition-colors"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger" />
                </span>
                {stats.expiringCritically} licença(s) crítica(s)
              </Link>
            )}
            <ThemeToggle />
            <div className="md:hidden">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
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
      <path d="M4 12h4l2-6 4 12 2-6h4" />
    </svg>
  );
}
