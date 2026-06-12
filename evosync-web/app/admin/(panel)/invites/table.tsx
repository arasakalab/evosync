"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, Check, X, UserPlus, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";

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
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  const filtered = invites.filter(
    (i) =>
      i.email.toLowerCase().includes(search.toLowerCase()) ||
      i.tenantName.toLowerCase().includes(search.toLowerCase())
  );

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  }

  async function revoke(id: string) {
    if (!confirm("Revogar este convite? O link deixará de funcionar.")) return;
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
    <>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por email ou tenant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tenant</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Role</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Expira</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      Nenhum convite emitido.
                    </td>
                  </tr>
                )}
                {filtered.map((i) => {
                  const exp = new Date(i.expiresAt);
                  const expired = exp.getTime() < Date.now();
                  return (
                    <tr
                      key={i.id}
                      className="border-b last:border-0 border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">{i.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {i.tenantName}
                        <div className="text-xs text-slate-500">{i.tenantSlug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{i.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {i.status === "pending" && !expired && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Pendente
                          </Badge>
                        )}
                        {i.status === "pending" && expired && (
                          <Badge variant="secondary">Expirado</Badge>
                        )}
                        {i.status === "accepted" && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Aceito
                          </Badge>
                        )}
                        {i.status === "revoked" && (
                          <Badge variant="secondary">Revogado</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {exp.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {i.status === "pending" && !expired && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyLink(i.token)}
                                title="Copiar link"
                              >
                                {copied === i.token ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => revoke(i.id)}
                                disabled={busy === i.id}
                                title="Revogar"
                              >
                                <X className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
