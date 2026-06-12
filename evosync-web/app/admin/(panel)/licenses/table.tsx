"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, Clock, CheckCircle2 } from "lucide-react";

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
  const router = useRouter();

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
        setExtend(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tenant</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Emitida</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Expira</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Notas</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500">
                  Nenhuma licença emitida.
                </td>
              </tr>
            )}
            {licenses.map((l) => {
              const exp = new Date(l.expiresAt);
              const now = Date.now();
              const expSoon = exp.getTime() - now < 7 * 86400_000;
              const expired = exp.getTime() < now;
              return (
                <tr
                  key={l.id}
                  className="border-b last:border-0 border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-medium">{l.tenantName}</div>
                        <div className="text-xs text-slate-500">{l.tenantSlug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {l.status === "active" && !expired && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ativa
                      </Badge>
                    )}
                    {l.status === "active" && expired && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                        Expirada
                      </Badge>
                    )}
                    {l.status === "expired" && (
                      <Badge variant="secondary">Expirada</Badge>
                    )}
                    {l.status === "cancelled" && (
                      <Badge variant="secondary">Cancelada</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(l.issuedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className={expSoon ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-700 dark:text-slate-300"}>
                      {exp.toLocaleDateString("pt-BR")}
                    </div>
                    {expSoon && l.status === "active" && !expired && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {Math.ceil((exp.getTime() - now) / 86400_000)}d restantes
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                    {l.notes || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExtend(l);
                        setDays(30);
                      }}
                    >
                      Renovar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!extend} onOpenChange={(o) => !o && setExtend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar licença</DialogTitle>
            <DialogDescription>
              Estende a licença atual de <strong>{extend?.tenantName}</strong> a
              partir da data de expiração. Cria uma nova linha no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="days">Dias</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
              />
              {extend && (
                <p className="text-xs text-slate-500">
                  Nova expiração:{" "}
                  {new Date(
                    Math.max(new Date(extend.expiresAt).getTime(), Date.now()) +
                      days * 86400_000
                  ).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtend(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={doExtend} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
