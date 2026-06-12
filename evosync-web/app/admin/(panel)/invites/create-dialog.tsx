"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function CreateInviteDialog({ tenants }: { tenants: Tenant[] }) {
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"operator" | "owner">("operator");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ acceptUrl: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function reset() {
    setEmail("");
    setRole("operator");
    setDays(7);
    setCreated(null);
    setCopied(false);
    setTenantId(tenants[0]?.id || "");
  }

  async function submit() {
    if (!tenantId || !email) {
      toast.error("Selecione o tenant e informe o email");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, email, role, expiresInDays: days }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao criar convite");
        return;
      }
      setCreated({ acceptUrl: data.acceptUrl, email: data.invite.email });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function copyUrl() {
    if (!created) return;
    navigator.clipboard.writeText(created.acceptUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo convite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Emitir convite</DialogTitle>
              <DialogDescription>
                Gera um link único que expira em {days} dia(s). Envie
                manualmente para o operador (email, WhatsApp, etc).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tenant">Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger id="tenant">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} <span className="text-slate-400">({t.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email do convidado</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@empresa.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="role">Papel</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Expira em (dias)</Label>
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) || 7)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={busy || !tenantId || !email}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Emitir convite
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Convite criado para {created.email}</DialogTitle>
              <DialogDescription>
                Envie este link ao operador. Ele terá {days} dia(s) para aceitá-lo.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label>Link de aceite</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  readOnly
                  value={created.acceptUrl}
                  className="font-mono text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button onClick={copyUrl} variant="outline" size="icon">
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Você também pode ver este link na tabela de convites (botão copiar).
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); reset(); }}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
