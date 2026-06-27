"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  RotateCcw,
  Palette,
  Type as TypeIcon,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
  Upload,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Link2,
  MessageCircle,
  MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleFontsLink } from "@/components/brand/google-fonts";

import type { BrandingConfig } from "@/lib/branding";
import { FONT_FAMILIES, getLandingDisplayName } from "@/lib/branding";
import { clientPublicAppUrl } from "@/lib/app-url";

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const FONT_LINKS: Record<string, string> = {
  Inter:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  Roboto:
    "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  Poppins:
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  System: "",
};

const FONT_CSS: Record<string, string> = {
  Inter: "Inter, system-ui, sans-serif",
  Roboto: "Roboto, system-ui, sans-serif",
  Poppins: "Poppins, system-ui, sans-serif",
  System: "system-ui, -apple-system, sans-serif",
};

const THEMES = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    emoji: "💚",
    primaryColor: "#0F9D58",
    accentColor: "#25D366",
    bgColor: "#F8FAFC",
    fgColor: "#0F172A",
  },
  {
    id: "ocean",
    name: "Oceano",
    emoji: "🌊",
    primaryColor: "#2563EB",
    accentColor: "#0EA5E9",
    bgColor: "#F0F9FF",
    fgColor: "#0F172A",
  },
  {
    id: "sunset",
    name: "Pôr do sol",
    emoji: "🌅",
    primaryColor: "#EA580C",
    accentColor: "#F97316",
    bgColor: "#FFF7ED",
    fgColor: "#431407",
  },
  {
    id: "royal",
    name: "Roxo",
    emoji: "✨",
    primaryColor: "#7C3AED",
    accentColor: "#A78BFA",
    bgColor: "#FAF5FF",
    fgColor: "#1E1B4B",
  },
  {
    id: "dark",
    name: "Escuro",
    emoji: "🌙",
    primaryColor: "#25D366",
    accentColor: "#4ADE80",
    bgColor: "#0F172A",
    fgColor: "#F8FAFC",
  },
  {
    id: "minimal",
    name: "Minimal",
    emoji: "◻️",
    primaryColor: "#0F172A",
    accentColor: "#64748B",
    bgColor: "#FFFFFF",
    fgColor: "#334155",
  },
] as const;

const FILE_LIMITS: Record<
  string,
  { accept: string; maxMB: number; hint: string; icon: string }
> = {
  logo: {
    accept: "image/png,image/jpeg,image/svg+xml,image/webp",
    maxMB: 2,
    hint: "PNG, JPEG, SVG ou WebP · até 2 MB",
    icon: "🏷️",
  },
  bg: {
    accept: "image/png,image/jpeg,image/webp",
    maxMB: 5,
    hint: "PNG ou JPEG · até 5 MB · redimensiona automaticamente",
    icon: "🖼️",
  },
  favicon: {
    accept: "image/png,image/x-icon,image/vnd.microsoft.icon",
    maxMB: 0.1,
    hint: "PNG ou ICO · 64×64 px",
    icon: "⭐",
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function CustomizerClient({
  initial,
  tenantId,
  tenantSlug,
  tenantName,
}: {
  initial: BrandingConfig;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<BrandingConfig>(initial);
  const [saved, setSaved] = useState<BrandingConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [assetVersion, setAssetVersion] = useState(0);
  const [activeTab, setActiveTab] = useState("visual");

  const landingPath = tenantSlug ? `/c/${tenantSlug}` : "";

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const update = useCallback(
    <K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const applyTheme = useCallback((theme: (typeof THEMES)[number]) => {
    setDraft((d) => ({
      ...d,
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      bgColor: theme.bgColor,
      fgColor: theme.fgColor,
    }));
  }, []);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const r = await fetch("/api/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryColor: draft.primaryColor,
            accentColor: draft.accentColor,
            bgColor: draft.bgColor,
            fgColor: draft.fgColor,
            fontFamily: draft.fontFamily,
            landingTitle: draft.landingTitle,
            landingSubtitle: draft.landingSubtitle,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro ao salvar");
        setSaved(data);
        setDraft(data);
        toast.success("Alterações salvas!");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }, [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !pending) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, pending, handleSave]);

  const handleReset = useCallback(() => {
    if (
      !confirm(
        "Restaurar cores e textos padrão? Logos e imagens não serão removidos.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await fetch("/api/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: true }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        setSaved((s) => ({ ...s, ...data }));
        setDraft((d) => ({ ...d, ...data }));
        toast.success("Padrão restaurado");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro");
      }
    });
  }, []);

  async function handleUpload(type: string, file: File) {
    setUploading(type);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/branding/${type}`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro no upload");
      const fresh = await fetch("/api/branding").then((res) => res.json());
      setSaved(fresh);
      setDraft(fresh);
      setAssetVersion((v) => v + 1);
      toast.success(
        type === "logo"
          ? "Logo enviado!"
          : type === "bg"
            ? "Fundo atualizado!"
            : "Favicon atualizado!",
      );
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(null);
    }
  }

  async function handleRemove(type: string) {
    const labels: Record<string, string> = {
      logo: "a logo",
      bg: "a imagem de fundo",
      favicon: "o favicon",
    };
    if (!confirm(`Remover ${labels[type] || "este arquivo"}?`)) return;
    try {
      const r = await fetch(`/api/branding/${type}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro");
      const fresh = await fetch("/api/branding").then((res) => res.json());
      setSaved(fresh);
      setDraft(fresh);
      setAssetVersion((v) => v + 1);
      toast.success("Removido");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-accent/10 blur-xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  Personalizar landing
                </h1>
                <p className="text-sm text-muted-foreground">
                  Página pública onde clientes cadastram o WhatsApp
                </p>
              </div>
            </div>

            {landingPath ? (
              <LandingLink path={landingPath} />
            ) : (
              <p className="text-sm text-destructive">
                Slug da loja não configurado — entre em contato com o suporte.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge saved={!dirty} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={pending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending || !dirty}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Editor */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 p-1">
            <TabsTrigger value="visual" className="gap-1.5 py-2.5">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Aparência</span>
              <span className="sm:hidden">Visual</span>
            </TabsTrigger>
            <TabsTrigger value="textos" className="gap-1.5 py-2.5">
              <TypeIcon className="h-4 w-4" />
              Textos
            </TabsTrigger>
            <TabsTrigger value="imagens" className="gap-1.5 py-2.5">
              <ImageIcon className="h-4 w-4" />
              Imagens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Temas prontos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => applyTheme(theme)}
                      className="group flex items-center gap-2.5 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <span className="text-lg">{theme.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{theme.name}</p>
                        <div className="mt-1 flex gap-0.5">
                          {[theme.primaryColor, theme.accentColor, theme.bgColor].map(
                            (c) => (
                              <span
                                key={c}
                                className="h-3 w-3 rounded-full border border-black/10"
                                style={{ backgroundColor: c }}
                              />
                            ),
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cores</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <ColorField
                  label="Primária"
                  description="Botões e destaques"
                  value={draft.primaryColor}
                  onChange={(v) => update("primaryColor", v)}
                />
                <ColorField
                  label="Acento"
                  description="Links e detalhes"
                  value={draft.accentColor}
                  onChange={(v) => update("accentColor", v)}
                />
                <ColorField
                  label="Fundo"
                  description="Cor de fundo da página"
                  value={draft.bgColor}
                  onChange={(v) => update("bgColor", v)}
                />
                <ColorField
                  label="Texto"
                  description="Títulos e parágrafos"
                  value={draft.fgColor}
                  onChange={(v) => update("fgColor", v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fonte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={draft.fontFamily}
                  onValueChange={(v) => update("fontFamily", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        <span style={{ fontFamily: FONT_CSS[f] }}>{f}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p
                  className="rounded-lg border bg-muted/30 px-4 py-3 text-sm"
                  style={{ fontFamily: FONT_CSS[draft.fontFamily] }}
                >
                  <span className="font-semibold">Aa Bb Cc</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — preview da fonte {draft.fontFamily}
                  </span>
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="textos" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conteúdo da landing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">Nome exibido na landing</Label>
                  <Input
                    id="title"
                    value={draft.landingTitle || ""}
                    onChange={(e) =>
                      update("landingTitle", e.target.value || null)
                    }
                    placeholder={tenantName}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparece no título, formulário, rodapé e mensagens da página
                    pública. Nome interno no sistema:{" "}
                    <strong>{tenantName}</strong>
                    {draft.landingTitle?.trim() ? (
                      <>
                        {" "}
                        · visitantes verão:{" "}
                        <strong>{draft.landingTitle.trim()}</strong>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo</Label>
                  <Textarea
                    id="subtitle"
                    value={draft.landingSubtitle || ""}
                    onChange={(e) =>
                      update("landingSubtitle", e.target.value || null)
                    }
                    placeholder="Ex: Receba ofertas exclusivas e novidades direto no seu WhatsApp"
                    maxLength={200}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {(draft.landingSubtitle || "").length}/200 caracteres
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imagens" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Arquivos visuais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageUploader
                  type="logo"
                  label="Logo"
                  tenantId={tenantId}
                  currentPath={draft.logoPath}
                  assetVersion={assetVersion}
                  onUpload={(f) => handleUpload("logo", f)}
                  onRemove={() => handleRemove("logo")}
                  uploading={uploading === "logo"}
                />
                <ImageUploader
                  type="bg"
                  label="Imagem de fundo"
                  tenantId={tenantId}
                  currentPath={draft.bgImagePath}
                  assetVersion={assetVersion}
                  onUpload={(f) => handleUpload("bg", f)}
                  onRemove={() => handleRemove("bg")}
                  uploading={uploading === "bg"}
                />
                <ImageUploader
                  type="favicon"
                  label="Favicon"
                  tenantId={tenantId}
                  currentPath={draft.faviconPath}
                  assetVersion={assetVersion}
                  onUpload={(f) => handleUpload("favicon", f)}
                  onRemove={() => handleRemove("favicon")}
                  uploading={uploading === "favicon"}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview — sticky */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden shadow-md">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                Preview ao vivo
              </span>
              {dirty && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                  não salvo
                </span>
              )}
            </div>

            <div className="bg-gradient-to-b from-muted/30 to-muted/10 p-4">
              <LandingPreview
                draft={draft}
                tenantId={tenantId}
                tenantName={tenantName}
                assetVersion={assetVersion}
              />
            </div>

            {landingPath && (
              <div className="border-t bg-card px-4 py-3">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={landingPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir landing publicada
                  </a>
                </Button>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Preview reflete alterações antes de salvar · publique com Salvar
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing link + copy
// ---------------------------------------------------------------------------

function LandingLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const full = clientPublicAppUrl(path);
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 backdrop-blur-sm">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-sm text-primary hover:underline"
        >
          {path}
        </a>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        Copiar link
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview (uses draft — no iframe)
// ---------------------------------------------------------------------------

function LandingPreview({
  draft,
  tenantId,
  tenantName,
  assetVersion,
}: {
  draft: BrandingConfig;
  tenantId: string;
  tenantName: string;
  assetVersion: number;
}) {
  const fontFamily = FONT_CSS[draft.fontFamily] || FONT_CSS.Inter;
  const fontLink = FONT_LINKS[draft.fontFamily] || "";
  const displayName = getLandingDisplayName(draft, tenantName);
  const title = displayName;
  const subtitle =
    draft.landingSubtitle?.trim() ||
    `Receba novidades de ${displayName} no WhatsApp.`;

  const logoUrl = draft.logoPath
    ? `/_b/${tenantId}/logo?v=${assetVersion}`
    : null;
  const bgUrl = draft.bgImagePath
    ? `/_b/${tenantId}/bg?v=${assetVersion}`
    : null;
  const hasBg = Boolean(bgUrl);

  return (
    <>
      {fontLink && <GoogleFontsLink href={fontLink} />}
      <div
        className="relative mx-auto max-w-[340px] overflow-hidden rounded-[28px] border-[3px] border-foreground/10 shadow-2xl"
        style={{ fontFamily }}
      >
        <div className="h-5 bg-foreground/10" />
        <div
          className="relative max-h-[520px] overflow-y-auto px-3 pb-5 pt-3"
          style={{ backgroundColor: draft.bgColor, color: draft.fgColor }}
        >
          {bgUrl && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bgUrl})` }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 to-black/75"
              />
            </>
          )}

          <div className="relative space-y-3">
            {logoUrl ? (
              <div className="flex justify-center pt-1">
                <div className="rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-16 w-auto max-w-[220px] object-contain"
                  />
                </div>
              </div>
            ) : (
              <p
                className="text-center text-lg font-extrabold"
                style={{ color: hasBg ? "#fff" : draft.fgColor }}
              >
                {displayName}
              </p>
            )}

            <div className="space-y-1 px-1 text-center">
              <h2
                className="text-base font-extrabold leading-tight"
                style={{ color: hasBg ? "#fff" : draft.fgColor }}
              >
                {title}
              </h2>
              <p
                className="text-[11px] leading-snug opacity-80"
                style={{ color: hasBg ? "#fff" : draft.fgColor }}
              >
                {subtitle}
              </p>
            </div>

            <div className="tenant-card mx-0.5 p-3.5 text-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white">
                  <MessageCircle className="h-4 w-4" fill="white" />
                </div>
                <p className="text-xs font-bold">Cadastre seu WhatsApp</p>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-400">
                  Seu nome
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-400">
                  (11) 99999-9999
                </div>
                <div
                  className="rounded-lg py-2.5 text-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: draft.primaryColor }}
                >
                  Quero receber mensagens
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ColorField
// ---------------------------------------------------------------------------

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const valid = HEX_REGEX.test(local);

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <input
            type="color"
            value={valid ? local : "#000000"}
            onChange={(e) => {
              setLocal(e.target.value);
              onChange(e.target.value);
            }}
            className="sr-only"
          />
          <div
            className="h-11 w-11 rounded-xl border-2 border-background shadow-md ring-1 ring-border transition-transform hover:scale-105"
            style={{ backgroundColor: valid ? local : "#000000" }}
          />
        </label>
        <Input
          value={local}
          onChange={(e) => {
            const v = e.target.value;
            setLocal(v);
            if (HEX_REGEX.test(v)) onChange(v);
          }}
          placeholder="#000000"
          className="h-9 flex-1 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageUploader
// ---------------------------------------------------------------------------

function ImageUploader({
  type,
  label,
  tenantId,
  currentPath,
  assetVersion,
  onUpload,
  onRemove,
  uploading,
}: {
  type: string;
  label: string;
  tenantId: string;
  currentPath: string | null;
  assetVersion: number;
  onUpload: (f: File) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const limits = FILE_LIMITS[type];

  const previewUrl = currentPath
    ? `/api/branding/file/${tenantId}/${type}?v=${assetVersion}`
    : null;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > limits.maxMB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${limits.maxMB} MB.`);
      return;
    }
    onUpload(file);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{limits.icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{limits.hint}</p>
        </div>
      </div>

      {currentPath && previewUrl ? (
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={label}
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Arquivo enviado
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Trocar"
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onRemove}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-all ${
            dragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Enviando…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="font-medium">Clique ou arraste aqui</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={limits.accept}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ saved }: { saved: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        saved
          ? "bg-success/10 text-success"
          : "bg-warning/10 text-warning"
      }`}
    >
      {saved ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Tudo salvo
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </span>
          Alterações pendentes
        </>
      )}
    </span>
  );
}
