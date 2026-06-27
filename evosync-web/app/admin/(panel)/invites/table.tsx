"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  X,
  Mail,
  Search,
  UserPlus,
  Send,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientPublicAppUrl } from "@/lib/app-url";

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
  createdAt: string;
}

export default function InvitesTable({ invites }: { invites: Invite[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const router = useRouter();

  const filtered = invites.filter((i) => {
    const matchSearch =
      !search ||
      i.email.toLowerCase().includes(search.toLowerCase()) ||
      i.tenantName.toLowerCase().includes(search.toLowerCase());
    const exp = new Date(i.expiresAt).getTime();
    const expired = i.status === "pending" && exp < Date.now();
    const effectiveStatus = expired ? "expired" : i.status;
    const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: invites.length,
    pending: invites.filter((i) => {
      const exp = new Date(i.expiresAt).getTime();
      return i.status === "pending" && exp > Date.now();
    }).length,
    accepted: invites.filter((i) => i.status === "accepted").length,
    expired: invites.filter((i) => {
      const exp = new Date(i.expiresAt).getTime();
      return i.status === "pending" && exp < Date.now();
    }).length,
  };

  function copyLink(token: string) {
    const url = clientPublicAppUrl(`/invite/${token}`);
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Link copiado!", {
      description: url.slice(0, 50) + "...",
    });
    setTimeout(() => setCopied(null), 2000);
  }

  async function revoke(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Convite revogado");
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erro");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "all", label: "Todos", count: counts.all },
            { key: "pending", label: "Pendentes", count: counts.pending },
            { key: "accepted", label: "Aceitos", count: counts.accepted },
            { key: "expired", label: "Expirados", count: counts.expired },
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
            placeholder="Buscar por email ou tenant..."
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
              icon={UserPlus}
              title="Nenhum convite"
              description="Crie o primeiro convite para um operador."
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
                      Email
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
                      Expira
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider w-32">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const exp = new Date(i.expiresAt);
                    const expired = exp.getTime() < Date.now();
                    const effectiveStatus = expired ? "expired" : i.status;
                    return (
                      <tr
                        key={i.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-surface-alt/40 group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info-foreground ring-1 ring-info/20">
                              <Mail className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-foreground">
                              {i.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {i.tenantName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {i.tenantSlug}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-2xs font-mono uppercase text-muted-foreground">
                            {i.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={effectiveStatus} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {exp.toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {i.status === "pending" && !expired && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyLink(i.token)}
                              >
                                {copied === i.token ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-success" />
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copiar
                                  </>
                                )}
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setRevoking(i)}
                                disabled={busy === i.id}
                                className="text-muted-foreground hover:text-danger"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
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
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revogar convite"
        description={
          <>
            O link de{" "}
            <strong className="text-foreground">{revoking?.email}</strong>{" "}
            deixará de funcionar imediatamente. Esta ação não pode ser desfeita.
          </>
        }
        confirmText="Revogar"
        tone="warning"
        onConfirm={async () => {
          if (revoking) await revoke(revoking.id);
          setRevoking(null);
        }}
      />
    </div>
  );
}
