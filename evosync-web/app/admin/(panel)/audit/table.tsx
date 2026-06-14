"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/empty-state";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  Filter,
  Clock,
  User,
  Building2,
  ScrollText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  details: string;
  createdAt: string;
}

interface Props {
  entries: AuditEntry[];
  actions: string[];
  tenants: { id: string; name: string; slug: string }[];
  users: { id: string; email: string; name: string | null }[];
  filters: { tenantId?: string; userId?: string; action?: string; from?: string; to?: string };
  totalPages: number;
  currentPage: number;
}

const actionTone: Record<string, string> = {
  "auth.login.success": "info",
  "auth.login.failed": "danger",
  "tenant.created": "success",
  "tenant.suspended": "warning",
  "tenant.activated": "success",
  "invite.created": "info",
  "invite.revoked": "warning",
  "user.created_via_invite": "success",
  "license.extended": "success",
  "contacts.cleared": "danger",
};

export default function AuditTable({
  entries,
  actions,
  tenants,
  users,
  filters,
  totalPages,
  currentPage,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));

  function setFilter(key: string, val: string | undefined) {
    const u = new URLSearchParams(sp.toString());
    if (val) u.set(key, val);
    else u.delete(key);
    u.delete("page");
    startTransition(() => router.push("/admin/audit?" + u.toString()));
  }

  function goPage(p: number) {
    const u = new URLSearchParams(sp.toString());
    if (p > 1) u.set("page", String(p));
    else u.delete("page");
    startTransition(() => router.push("/admin/audit?" + u.toString()));
  }

  const hasFilters =
    filters.tenantId || filters.userId || filters.action || filters.from || filters.to;

  function actionColor(action: string) {
    const tone = actionTone[action];
    if (tone === "danger")
      return "bg-danger-subtle text-danger-foreground border-danger/20";
    if (tone === "warning")
      return "bg-warning-subtle text-warning-foreground border-warning/20";
    if (tone === "success")
      return "bg-success-subtle text-success-foreground border-success/20";
    if (tone === "info")
      return "bg-info-subtle text-info-foreground border-info/20";
    return "bg-muted text-muted-foreground border-border";
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Filtros
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            <Select
              value={filters.tenantId || "_all"}
              onValueChange={(v) => setFilter("tenantId", v === "_all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.userId || "_all"}
              onValueChange={(v) => setFilter("userId", v === "_all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os usuários</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.action || "_all"}
              onValueChange={(v) => setFilter("action", v === "_all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as ações</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.from || ""}
              onChange={(e) => setFilter("from", e.target.value || undefined)}
            />

            <Input
              type="date"
              value={filters.to || ""}
              onChange={(e) => setFilter("to", e.target.value || undefined)}
            />
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/audit")}
              className="mt-3 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ScrollText}
              title="Nenhum registro encontrado"
              description="Ajuste os filtros para ver outros eventos."
              variant="minimal"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-hidden">
            <ul className="divide-y divide-border">
              {entries.map((e) => {
                const tenant = e.tenantId ? tenantById.get(e.tenantId) : null;
                const user = e.userId ? userById.get(e.userId) : null;
                return (
                  <li
                    key={e.id}
                    className="p-4 hover:bg-surface-alt/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-mono",
                              actionColor(e.action)
                            )}
                          >
                            {e.action}
                          </span>
                          {tenant && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {tenant.name}
                            </span>
                          )}
                          {user && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {user.name || user.email}
                            </span>
                          )}
                        </div>
                        {e.details && e.details !== "{}" && (
                          <code className="block text-2xs bg-muted/50 border border-border/50 rounded-md px-2 py-1.5 font-mono text-foreground/80 overflow-x-auto">
                            {e.details.length > 500
                              ? e.details.slice(0, 500) + "…"
                              : e.details}
                          </code>
                        )}
                        <div className="flex items-center gap-1 text-2xs text-muted-foreground/70">
                          <Clock className="h-3 w-3" />
                          {new Date(e.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => goPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => goPage(currentPage + 1)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
