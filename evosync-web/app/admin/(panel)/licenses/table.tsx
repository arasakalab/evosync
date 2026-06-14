"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Clock,
  Plus,
  Loader2,
  Search,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface License {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  notes: string | null;
}

export default function LicensesTable({ licenses }: { licenses: License[] }) {
  const [extend, setExtend] = useState<License | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const router = useRouter();

  const filtered = licenses.filter((l) => {
    const matchSearch =
      !search ||
      l.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      l.tenantSlug.toLowerCase().includes(search.toLowerCase());
    const exp = new Date(l.expiresAt).getTime();
    const now = Date.now();
    const expired = exp < now;
    const effectiveStatus = l.status === "active" && !expired ? "active" : "expired";
    const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: licenses.length,
    active: licenses.filter((l) => {
      const exp = new Date(l.expiresAt).getTime();
      return l.status === "active" && exp > Date.now();
    }).length,
    expired: licenses.filter((l) => {
      const exp = new Date(l.expiresAt).getTime();
      return l.status === "expired" || exp < Date.now();
    }).length,
  };

  async function doExtend() {
    if (!extend) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/licenses/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: extend.tenantId, days }),
      });
      if (res.ok) {
        toast.success(`Licença renovada por mais ${days} dias`);
        setExtend(null);
        router.refresh();
      } else {
        toast.error("Erro ao renovar");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "all", label: "Todas", count: counts.all },
            { key: "active", label: "Válidas", count: counts.active },
            { key: "expired", label: "Expiradas", count: counts.expired },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-elev-1"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
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
            placeholder="Buscar por tenant..."
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
              icon={KeyRound}
              title="Nenhuma licença encontrada"
              description={
                search
                  ? `Sem resultados para "${search}".`
                  : "Crie um tenant para emitir a primeira licença."
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
                      Tenant
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Emitida
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Expira
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Notas
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const exp = new Date(l.expiresAt);
                    const now = Date.now();
                    const expSoon = exp.getTime() - now < 7 * 86400_000;
                    const expired = exp.getTime() < now;
                    const daysToExp = Math.ceil((exp.getTime() - now) / 86400_000);
                    return (
                      <tr
                        key={l.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-surface-alt/40 group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary ring-1 ring-primary/20">
                              <KeyRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {l.tenantName}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {l.tenantSlug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              l.status === "active" && !expired
                                ? "active"
                                : "expired"
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(l.issuedAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={cn(
                              "text-xs font-medium flex items-center gap-1.5",
                              expired
                                ? "text-danger"
                                : expSoon
                                ? "text-warning"
                                : "text-foreground"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {exp.toLocaleDateString("pt-BR")}
                          </div>
                          {!expired && daysToExp <= 30 && (
                            <div
                              className={cn(
                                "text-2xs mt-0.5",
                                expSoon
                                  ? "text-danger"
                                  : "text-muted-foreground"
                              )}
                            >
                              {daysToExp === 0
                                ? "expira hoje"
                                : `${daysToExp}d restantes`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">
                          {l.notes || (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant={
                                  expSoon || expired ? "default" : "outline"
                                }
                              >
                                Renovar
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {[30, 90, 365].map((d) => (
                                <DropdownMenuItem
                                  key={d}
                                  onClick={() => {
                                    setExtend(l);
                                    setDays(d);
                                  }}
                                >
                                  +{d} dias
                                </DropdownMenuItem>
                              ))}
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

      <Dialog open={!!extend} onOpenChange={(o) => !o && setExtend(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle ring-1 ring-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle>Renovar licença</DialogTitle>
                <DialogDescription className="mt-1">
                  Estende a licença de{" "}
                  <strong className="text-foreground">
                    {extend?.tenantName}
                  </strong>{" "}
                  a partir da data de expiração.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Dias a adicionar</Label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 30, 90, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium transition-all",
                      days === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              {extend && (
                <p className="text-xs text-muted-foreground mt-2">
                  Nova expiração:{" "}
                  <span className="text-foreground font-medium">
                    {new Date(
                      Math.max(
                        new Date(extend.expiresAt).getTime(),
                        Date.now()
                      ) +
                        days * 86400_000
                    ).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtend(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={doExtend} disabled={busy} variant="gradient">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Renovando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Renovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
