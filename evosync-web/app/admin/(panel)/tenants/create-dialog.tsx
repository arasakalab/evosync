"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  Plus,
  Sparkles,
  Server,
  KeyRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Info } from "lucide-react";

type EvoMode = "byo" | "managed";

export default function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [days, setDays] = useState(30);
  const [evoMode, setEvoMode] = useState<EvoMode>("byo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function autoSlug(v: string) {
    return v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  async function submit() {
    if (!name || !slug) {
      setError("Nome e slug são obrigatórios");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          licenseDays: days,
          evoMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar");
        return;
      }
      // Se for managed e provision falhou, mostra warning mas não bloqueia
      if (evoMode === "managed" && data.provision && !data.provision.ok) {
        setError(
          `Tenant criado, mas provision falhou: ${data.provision.message}. ` +
            `Use o botão "Provisionar" na tabela pra tentar de novo.`
        );
        // Não fecha o dialog, deixa o admin ver o erro e decidir
        setBusy(false);
        return;
      }
      setOpen(false);
      setName("");
      setSlug("");
      setEvoMode("byo");
      setDays(30);
      router.refresh();
    } catch (e: any) {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle ring-1 ring-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>Cadastrar nova empresa</DialogTitle>
              <DialogDescription className="mt-1">
                Cria o tenant e emite uma licença inicial. Você poderá
                convidar o primeiro operador na próxima tela.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da empresa</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === autoSlug(name)) {
                  setSlug(autoSlug(e.target.value));
                }
              }}
              placeholder="Ex: Padaria do Zé"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evoMode">Modo de conexão Evolution</Label>
            <Select value={evoMode} onValueChange={(v) => setEvoMode(v as EvoMode)}>
              <SelectTrigger id="evoMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="byo">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>BYO (cliente traz a Evolution)</span>
                      <span className="text-2xs text-muted-foreground">
                        Cliente configura URL/API key manualmente
                      </span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="managed">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-primary" />
                    <div className="flex flex-col">
                      <span>Managed (recomendado)</span>
                      <span className="text-2xs text-muted-foreground">
                        Você hospeda a Evolution — cliente só escaneia QR
                      </span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {evoMode === "managed" && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs text-foreground/80">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div>
                  Ao criar, a instância será provisionada automaticamente na
                  Evolution central. O cliente verá um <strong>QR code</strong>{" "}
                  na aba Conexão para parear o WhatsApp.
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <div className="relative">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="padaria-do-ze"
                className="font-mono"
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Identificador único (URLs, Docker, banco). Apenas letras,
              números e hífen.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="days">Dias de licença</Label>
            <div className="flex items-center gap-2">
              <Input
                id="days"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
              />
              <div className="flex items-center gap-1">
                {[30, 90, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className="text-2xs h-7 px-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors"
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <p className="text-2xs text-muted-foreground">
              Após criar, você pode renovar a qualquer momento em
              <span className="text-foreground/70"> Licenças</span>.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy} variant="gradient">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Criar tenant
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
