"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import {
  Search,
  Shield,
  User as UserIcon,
  Mail,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.tenantName || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    all: users.length,
    super_admin: users.filter((u) => u.role === "super_admin").length,
    owner: users.filter((u) => u.role === "owner").length,
    operator: users.filter((u) => u.role === "operator").length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "all", label: "Todos", count: counts.all },
            { key: "super_admin", label: "Super admins", count: counts.super_admin },
            { key: "owner", label: "Owners", count: counts.owner },
            { key: "operator", label: "Operators", count: counts.operator },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all",
                roleFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-elev-1"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-2xs",
                  roleFilter === f.key
                    ? "bg-primary-foreground/20"
                    : "bg-muted"
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por email, nome ou tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserIcon}
              title="Nenhum usuário encontrado"
              variant="minimal"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Papel
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Criado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const isSuper = u.role === "super_admin";
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-surface-alt/40 group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-semibold text-xs",
                                isSuper
                                  ? "bg-gradient-to-br from-primary to-info"
                                  : "bg-gradient-to-br from-info to-primary"
                              )}
                            >
                              {isSuper ? (
                                <Shield className="h-4 w-4" />
                              ) : (
                                <span>
                                  {(u.name || u.email)
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {u.name || (
                                  <span className="text-muted-foreground/60">
                                    Sem nome
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.tenantName ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <div className="text-foreground">
                                  {u.tenantName}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {u.tenantSlug}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-mono uppercase",
                              isSuper
                                ? "bg-primary-subtle text-primary border border-primary/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
