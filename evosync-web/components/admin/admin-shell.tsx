"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/admin/logout-button";
import {
  LayoutDashboard,
  Building2,
  KeyRound,
  UserPlus,
  Users,
  Shield,
  AlertTriangle,
  Bell,
} from "lucide-react";
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

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Empresas", icon: Building2 },
  { href: "/admin/licenses", label: "Licenças", icon: KeyRound },
  { href: "/admin/invites", label: "Convites", icon: UserPlus },
  { href: "/admin/users", label: "Usuários", icon: Users },
];

export default function AdminShell({ user, stats, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">EvoSync</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
              Admin Panel
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin/invites" && stats.pendingInvites > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {stats.pendingInvites}
                  </span>
                )}
                {item.href === "/admin/licenses" && stats.expiringCritically > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    {stats.expiringCritically}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {user.name || user.email}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            <h1 className="text-base font-semibold">Painel administrativo</h1>
            <p className="text-xs text-slate-500">
              Gerencie tenants, licenças e usuários
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stats.expiringCritically > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {stats.expiringCritically} licença(s) expira(m) em &lt;7d
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
