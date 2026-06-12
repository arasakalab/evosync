"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, KeyRound, MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nome ou slug…"
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
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Empresa</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Usuários</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Licença</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Criada</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      Nenhum tenant encontrado.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => {
                  const licOk = t.latestLicense?.status === "active";
                  const licExp = t.latestLicense
                    ? new Date(t.latestLicense.expiresAt)
                    : null;
                  const licExpSoon =
                    licExp && licExp.getTime() - Date.now() < 30 * 86400_000;
                  return (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-slate-500">{t.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={t.status === "active" ? "default" : "secondary"}
                          className={
                            t.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {t.userCount}
                      </td>
                      <td className="px-4 py-3">
                        {t.latestLicense ? (
                          <div className="text-xs">
                            <div
                              className={
                                licOk
                                  ? licExpSoon
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }
                            >
                              {licExpSoon && licOk
                                ? "Expira em breve"
                                : t.latestLicense.status}
                            </div>
                            <div className="text-slate-500">
                              {licExp?.toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-red-600">Sem licença</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === t.id}
                              onClick={() => updateStatus(t.id, "suspended")}
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === t.id}
                              onClick={() => updateStatus(t.id, "active")}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
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
