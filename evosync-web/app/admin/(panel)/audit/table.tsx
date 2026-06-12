"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [search, setSearch] = useState(filters.action || "");

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

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
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

            <div>
              <Input
                type="date"
                value={filters.from || ""}
                onChange={(e) => setFilter("from", e.target.value || undefined)}
                placeholder="De"
              />
            </div>

            <div>
              <Input
                type="date"
                value={filters.to || ""}
                onChange={(e) => setFilter("to", e.target.value || undefined)}
                placeholder="Até"
              />
            </div>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/audit")}
              className="text-slate-500"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Quando</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Ação</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tenant</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Usuário</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {entries.map((e) => {
                  const tenant = e.tenantId ? tenantById.get(e.tenantId) : null;
                  const user = e.userId ? userById.get(e.userId) : null;
                  return (
                    <tr
                      key={e.id}
                      className="border-b last:border-0 border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {e.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 text-xs">
                        {tenant ? tenant.name : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 text-xs">
                        {user ? user.name || user.email : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {e.details && e.details !== "{}" ? (
                          <code className="text-[11px] bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                            {e.details.length > 200 ? e.details.slice(0, 200) + "…" : e.details}
                          </code>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => goPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-xs text-slate-500">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => goPage(currentPage + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
