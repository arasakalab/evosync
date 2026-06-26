"use client";

import { useEffect, useState } from "react";
import { Cable, Save, Play, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Info, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import ManagedConnectionCard from "./managed-card";

/**
 * Aba Conexão — branch por evoMode:
 *  - "managed" → ManagedConnectionCard (QR + status polling, sem campos editáveis)
 *  - "byo"     → form atual (URL + API key + instance)
 *
 * O evoMode é definido pelo super_admin no momento da criação do tenant e
 * imutável pelo próprio tenant. O Settings carrega evo_mode e managed_status
 * para a UI decidir qual card mostrar.
 */
export default function ConexaoPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setConnection = useAppStore((s) => s.setConnection);

  // Tenant em modo managed? Mostra o card de QR.
  // Importante: settings.evo_mode pode ser "byo" no SSR/initial render antes
  // de carregar do /api/settings. Mas como o Settings vem do server no
  // primeiro render via getServerSideProps / loader, deve estar correto.
  if (settings.evo_mode === "managed") {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="section-title flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Conexão
          </h1>
          <p className="section-subtitle">
            Sua conexão WhatsApp é gerenciada pelo EvoSync. Escaneie o QR code
            abaixo para parear.
          </p>
        </header>
        <ManagedConnectionCard />
      </div>
    );
  }

  return <ByoConnectionCard settings={settings} setSettings={setSettings} setConnection={setConnection} />;
}

function ByoConnectionCard({
  settings,
  setSettings,
  setConnection,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  setConnection: (c: any) => void;
}) {
  const [form, setForm] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok?: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => setForm(settings), [settings]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.connection.test({
        url: form.url,
        api_key: form.api_key,
        instance: form.instance,
      });
      setTestResult({ ok: r.ok, msg: r.msg });
      setConnection({
        ok: r.ok,
        state: r.state || null,
        msg: r.msg,
        checkedAt: new Date().toISOString(),
      });
      if (r.ok) {
        toast.success(r.msg);
      } else {
        toast.error(r.msg);
      }
    } catch (e: any) {
      const msg = e?.message || "Falha ao testar";
      setTestResult({ ok: false, msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await api.settings.save(form);
      setSettings(saved);
      toast.success("Configurações salvas. API Key gravada no .env.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title flex items-center gap-2">
          <Cable className="h-6 w-6 text-primary" />
          Conexão
        </h1>
        <p className="section-subtitle">
          Configure a API, salve suas credenciais e confira o status da instância.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Evolution API (BYO)</CardTitle>
          <CardDescription>
            Endereço, chave de autenticação e nome da instância Evolution que
            <strong> você </strong> hospeda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="url"
            label="URL da Evolution"
            hint="Ex: http://localhost:8080"
          >
            <Input
              id="url"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="http://localhost:8080"
            />
          </Field>

          <Field
            id="key"
            label="API Key"
            hint="A chave fica gravada em .env com permissão 600."
          >
            <div className="relative">
              <Input
                id="key"
                type={showKey ? "text" : "password"}
                value={form.api_key}
                onChange={(e) => update("api_key", e.target.value)}
                placeholder="cole aqui"
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-neutral/40"
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          <Field id="instance" label="Nome da instância" hint="Ex: minha-instancia">
            <Input
              id="instance"
              value={form.instance}
              onChange={(e) => update("instance", e.target.value)}
              placeholder="ex: minha-instancia"
            />
          </Field>

          <Separator />

          <Field
            id="opencode"
            label="Modelo OpenCode"
            hint="Vazio usa nvidia/meta/llama-3.2-90b-vision-instruct"
          >
            <Input
              id="opencode"
              value={form.opencode_model}
              onChange={(e) => update("opencode_model", e.target.value)}
              placeholder="provider/model"
              className="font-mono"
            />
          </Field>

          <div className="rounded-md border border-blue/30 bg-blue/5 p-3 text-xs text-blue/90 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p>
                As credenciais da Evolution são gravadas em <code className="text-blue">.env</code>{" "}
                com permissões 600. As demais preferências (delays, modelo, última
                mensagem) vão em <code className="text-blue">config.json</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="blue"
              onClick={onTest}
              disabled={testing || !form.api_key || !form.instance}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Testar conexão
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  testResult.ok
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger-soft"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.msg}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
