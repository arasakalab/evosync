"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  Search,
  X,
  Plus,
  KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  userCount: number;
  latestLicense: { status: string; expiresAt: string } | null;
}

export default function TenantsTable({ tenants }: { tenants: Tenant[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const router = useRouter();

  const filtered = tenants.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: tenants.length,
    active: tenants.filter((t) => t.status === "active").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
  };

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(
          status === "active" ? "Tenant ativado" : "Tenant suspenso"
        );
        router.refresh();
      } else {
        toast.error("Erro ao atualizar");
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteTenant() {
    if (!deleting) return;
    const res = await fetch(`/api/admin/tenants/${deleting.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Tenant deletado", {
        description: deleting.name,
      });
      setDeleting(null);
      router.refresh();
    } else {
      toast.error("Erro ao deletar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "all", label: "Todos", count: counts.all },
            { key: "active", label: "Ativos", count: counts.active },
            { key: "suspended", label: "Suspensos", count: counts.suspended },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium",
                "transition-all duration-200",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-elev-1"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-2xs",
                  statusFilter === f.key
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
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Building2}
              title={
                search
                  ? "Nenhum tenant encontrado"
                  : "Nenhum tenant cadastrado"
              }
              description={
                search
                  ? `Não encontramos resultados para "${search}".`
                  : "Crie o primeiro tenant para começar."
              }
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
                      Empresa
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Usuários
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Licença
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Criada
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-12">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const licExp = t.latestLicense
                      ? new Date(t.latestLicense.expiresAt)
                      : null;
                    const daysToExp = licExp
                      ? Math.floor(
                          (licExp.getTime() - Date.now()) / 86400_000
                        )
                      : null;
                    const licCritical =
                      daysToExp !== null && daysToExp <= 7 && daysToExp >= 0;
                    const licWarning =
                      daysToExp !== null && daysToExp <= 30 && daysToExp > 7;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-surface-alt/40 group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-xs ring-1 ring-primary/20">
                              {t.name
                                .split(" ")
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {t.name}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {t.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-medium tabular-nums">
                              {t.userCount}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {t.userCount === 1 ? "usuário" : "usuários"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {t.latestLicense && licExp ? (
                            <div className="space-y-0.5">
                              <div
                                className={cn(
                                  "text-xs font-medium flex items-center gap-1.5",
                                  licCritical
                                    ? "text-danger"
                                    : licWarning
                                    ? "text-warning"
                                    : "text-foreground"
                                )}
                              >
                                <KeyRound className="h-3 w-3" />
                                {daysToExp !== null && daysToExp >= 0
                                  ? daysToExp === 0
                                    ? "Expira hoje"
                                    : `${daysToExp}d restantes`
                                  : "Expirada"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {licExp.toLocaleDateString("pt-BR")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-danger-foreground bg-danger-subtle border border-danger/20 rounded-full px-2 py-0.5">
                              Sem licença
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={busy === t.id}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {t.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatus(t.id, "suspended")
                                  }
                                  className="gap-2"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                  Suspender
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => updateStatus(t.id, "active")}
                                  className="gap-2"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  Ativar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleting(t)}
                                className="gap-2 text-danger focus:text-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Deletar tenant"
        description={
          <>
            Esta ação é <strong>irreversível</strong>. Todos os contatos,
            agendamentos, envios e logs do tenant{" "}
            <strong className="text-foreground">{deleting?.name}</strong>{" "}
            serão removidos.
          </>
        }
        confirmText="Deletar permanentemente"
        tone="danger"
        onConfirm={deleteTenant}
      />
    </div>
  );
}
