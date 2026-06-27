import path from "node:path";
import fs from "node:fs";
import {
  Bell,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getLandingDisplayName } from "@/lib/branding";
import { getBrandingFromRow } from "@/server/store/branding";
import { UPLOADS_DIR } from "@/server/paths";
import { SignupForm } from "./form";
import NotFound from "./not-found";
import { GoogleFontsLink } from "@/components/brand/google-fonts";

const FILE_TYPES = ["logo", "bg"] as const;
function hasFile(tenantId: string, type: (typeof FILE_TYPES)[number]) {
  const dir = path.join(UPLOADS_DIR, "branding", tenantId);
  try {
    return fs.readdirSync(dir).some((f) => f.startsWith(type));
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

const FONT_FAMILY_MAP: Record<string, string> = {
  Inter: "Inter, system-ui, sans-serif",
  Roboto: "Roboto, system-ui, sans-serif",
  Poppins: "Poppins, system-ui, sans-serif",
  System: "system-ui, -apple-system, sans-serif",
};

const FONT_IMPORT_LINKS: Record<string, string> = {
  Inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  Roboto: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap",
  Poppins:
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
  System: "",
};

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(15,157,88,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export async function generateMetadata({ params }: PageProps) {
  const db = getDb();
  const tenant = db
    .select({
      id: schema.tenants.id,
      status: schema.tenants.status,
      name: schema.tenants.name,
      faviconPath: schema.tenants.faviconPath,
      landingTitle: schema.tenants.landingTitle,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, params.slug))
    .get();
  if (!tenant || tenant.status !== "active") {
    return { title: "Loja não encontrada" };
  }
  const title = tenant.landingTitle || tenant.name;
  return {
    title: `Cadastre-se no WhatsApp — ${title}`,
    description:
      "Cadastre seu nome e WhatsApp para receber mensagens e novidades direto no seu celular.",
    icons: tenant.faviconPath
      ? { icon: `/_b/${tenant.id}/favicon` }
      : undefined,
  };
}

export default function SignupPage({ params }: PageProps) {
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, params.slug))
    .get();
  if (!tenant || tenant.status !== "active") {
    return <NotFound slug={params.slug} />;
  }

  const branding = getBrandingFromRow(tenant);
  const fontFamily =
    FONT_FAMILY_MAP[branding.fontFamily] || FONT_FAMILY_MAP.Inter;
  const fontImport = FONT_IMPORT_LINKS[branding.fontFamily] || "";

  const displayName = getLandingDisplayName(branding, tenant.name);
  const title = displayName;
  const subtitle =
    branding.landingSubtitle ||
    `Receba novidades, promoções e avisos de ${displayName} direto no seu WhatsApp.`;
  const logoUrl =
    branding.logoPath && hasFile(tenant.id, "logo")
      ? `/_b/${tenant.id}/logo`
      : null;
  const bgUrl =
    branding.bgImagePath && hasFile(tenant.id, "bg")
      ? `/_b/${tenant.id}/bg`
      : null;
  const hasBg = Boolean(bgUrl);

  const cssVars = {
    "--tenant-primary": branding.primaryColor,
    "--tenant-accent": branding.accentColor,
    "--tenant-bg": branding.bgColor,
    "--tenant-fg": branding.fgColor,
    fontFamily,
  } as React.CSSProperties;

  return (
    <>
      {fontImport && <GoogleFontsLink href={fontImport} />}
      <div
        className="tenant-landing relative overflow-hidden"
        style={{
          ...cssVars,
          backgroundColor: branding.bgColor,
          color: branding.fgColor,
        }}
      >
        {/* Background */}
        {bgUrl ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${bgUrl})` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/45 to-black/70"
            />
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl"
              style={{ background: hexAlpha(branding.primaryColor, 0.22) }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
              style={{ background: hexAlpha(branding.accentColor, 0.18) }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, currentColor 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
          </>
        )}

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
          {/* Mobile trust */}
          <div className="mb-6 flex justify-end lg:hidden">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md"
              style={{
                background: hasBg ? "rgba(255,255,255,0.15)" : hexAlpha(branding.primaryColor, 0.1),
                color: hasBg ? "#fff" : branding.primaryColor,
                border: `1px solid ${hasBg ? "rgba(255,255,255,0.2)" : hexAlpha(branding.primaryColor, 0.2)}`,
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Seguro · LGPD
            </div>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16 xl:gap-20">
            {/* Hero */}
            <div className="space-y-6 lg:space-y-8">
              {logoUrl ? (
                <div className="animate-fade-up flex justify-center lg:justify-start">
                  <div className="rounded-2xl bg-white p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5 sm:p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={title}
                      className="mx-auto h-24 w-auto max-w-[min(100%,320px)] object-contain sm:h-28 lg:h-36 lg:max-w-[380px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="animate-fade-up text-center lg:text-left">
                  <span
                    className="inline-block rounded-2xl px-5 py-3 text-2xl font-extrabold tracking-tight sm:text-3xl"
                    style={{
                      background: hexAlpha(branding.primaryColor, 0.12),
                      color: hasBg ? "#fff" : branding.primaryColor,
                    }}
                  >
                    {displayName}
                  </span>
                </div>
              )}

              <div className="animate-fade-up animate-fade-up-1 flex flex-wrap justify-center gap-2 lg:justify-start">
                <span className="tenant-badge">
                  <Sparkles className="h-3.5 w-3.5" />
                  Cadastro em 10 segundos
                </span>
                <span
                  className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:inline-flex"
                  style={{
                    background: hasBg ? "rgba(255,255,255,0.12)" : "white",
                    color: hasBg ? "#fff" : branding.fgColor,
                    border: `1px solid ${hasBg ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)"}`,
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: branding.accentColor }} />
                  100% seguro
                </span>
              </div>

              <div className="animate-fade-up animate-fade-up-2 space-y-4 text-center lg:text-left">
                <h1
                  className="text-balance text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl"
                  style={{ color: hasBg ? "#ffffff" : branding.fgColor }}
                >
                  {title}
                </h1>
                <p
                  className="mx-auto max-w-lg text-pretty text-base leading-relaxed sm:text-lg lg:mx-0"
                  style={{
                    color: hasBg ? "rgba(255,255,255,0.82)" : `${branding.fgColor}cc`,
                  }}
                >
                  {subtitle}
                </p>
              </div>

              <ul className="animate-fade-up animate-fade-up-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Benefit
                  icon={<MessageCircle className="h-4 w-4" fill="white" strokeWidth={1.5} />}
                  title="Direto no WhatsApp"
                  description="Sem app extra, sem complicação"
                  hasBg={hasBg}
                  primary={branding.primaryColor}
                />
                <Benefit
                  icon={<Zap className="h-4 w-4" />}
                  title="Rápido e gratuito"
                  description="Só nome e número, leva segundos"
                  hasBg={hasBg}
                  primary={branding.primaryColor}
                />
                <Benefit
                  icon={<Bell className="h-4 w-4" />}
                  title="Fique por dentro"
                  description="Promoções e novidades em primeira mão"
                  hasBg={hasBg}
                  primary={branding.primaryColor}
                />
                <Benefit
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Você no controle"
                  description='Responda "SAIR" para cancelar'
                  hasBg={hasBg}
                  primary={branding.primaryColor}
                />
              </ul>

              <div
                className="animate-fade-up animate-fade-up-4 hidden tenant-trust lg:flex"
                style={{
                  color: hasBg ? "rgba(255,255,255,0.75)" : `${branding.fgColor}99`,
                  borderColor: hasBg ? "rgba(255,255,255,0.2)" : hexAlpha(branding.primaryColor, 0.2),
                  background: hasBg ? "rgba(255,255,255,0.06)" : hexAlpha(branding.primaryColor, 0.05),
                }}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: branding.accentColor }} />
                Seus dados estão protegidos. Sem spam — cancele quando quiser.
              </div>
            </div>

            {/* Form card */}
            <div className="animate-fade-up animate-fade-up-2 relative">
              <SignupForm
                displayName={displayName}
                slug={params.slug}
                accentColor={branding.accentColor}
              />
            </div>
          </div>

          <footer
            className="mt-12 text-center text-xs sm:mt-16"
            style={{ color: hasBg ? "rgba(255,255,255,0.45)" : `${branding.fgColor}66` }}
          >
            <p>
              Powered by <span className="font-semibold">EvoSync</span>
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}

function Benefit({
  icon,
  title,
  description,
  hasBg,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  hasBg: boolean;
  primary: string;
}) {
  if (hasBg) {
    return (
      <li className="tenant-benefit">
        <div className="tenant-benefit-icon">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/70">{description}</p>
        </div>
      </li>
    );
  }
  return (
    <li
      className="flex items-start gap-3 rounded-xl border bg-white/80 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: `${primary}18` }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ background: primary }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-65">{description}</p>
      </div>
    </li>
  );
}
