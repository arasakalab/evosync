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
import { Plus, Loader2, Copy, Check, Mail, Sparkles, UserPlus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
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
          <Plus className="h-4 w-4" />
          Novo convite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle ring-1 ring-primary/20">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Emitir convite</DialogTitle>
                  <DialogDescription className="mt-1">
                    Gera um link único que expira em {days} dia(s). Envie
                    manualmente para o operador.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tenant">Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger id="tenant">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{" "}
                        <span className="text-muted-foreground">({t.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email do convidado</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operador@empresa.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="role">Papel</Label>
                  <Select
                    value={role}
                    onValueChange={(v: any) => setRole(v)}
                  >
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
                  <Label htmlFor="days">Expira em</Label>
                  <Select
                    value={String(days)}
                    onValueChange={(v) => setDays(Number(v))}
                  >
                    <SelectTrigger id="days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia</SelectItem>
                      <SelectItem value="3">3 dias</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="14">14 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={busy || !tenantId || !email}
                variant="gradient"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Emitindo...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Emitir convite
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-subtle ring-1 ring-success/20">
                  <Sparkles className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Convite criado!</DialogTitle>
                  <DialogDescription className="mt-1">
                    Envie este link para{" "}
                    <strong className="text-foreground">{created.email}</strong>{" "}
                    — ele terá {days} dia(s) para aceitar.
                  </DialogDescription>
                </div>
              </div>
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
                <Button
                  onClick={copyUrl}
                  variant={copied ? "default" : "outline"}
                  size="icon"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground mt-2">
                Você também pode copiar depois na tabela de convites.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
