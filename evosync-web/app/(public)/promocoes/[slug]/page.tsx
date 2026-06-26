import { notFound } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  Tag,
  Bell,
  Clock,
  ShoppingBag,
  Truck,
  Percent,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import { getTenantBySlug } from "@/server/store/tenants";
import { PromoForm } from "./form";
import { BrandLogo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Receba promoções no WhatsApp | Extra Atacarejo",
  description:
    "Cadastre seu nome e WhatsApp para receber ofertas exclusivas, descontos e promoções relâmpago do Extra Atacarejo direto no seu celular.",
};

interface PageProps {
  params: { slug: string };
}

export default function PromocoesPage({ params }: PageProps) {
  const tenant = getTenantBySlug(params.slug);
  if (!tenant) notFound();
  if (tenant.status !== "active") notFound();

  return (
    <div className="brand-landing relative overflow-hidden">
      {/* Background decorations */}
      <div
        className="brand-blob"
        style={{
          top: "-10%",
          right: "-10%",
          width: 480,
          height: 480,
          background: "hsl(var(--brand-red) / 0.18)",
        }}
      />
      <div
        className="brand-blob"
        style={{
          bottom: "10%",
          left: "-15%",
          width: 520,
          height: 520,
          background: "hsl(var(--brand-yellow) / 0.45)",
        }}
      />
      <div
        className="brand-blob"
        style={{
          top: "40%",
          right: "20%",
          width: 300,
          height: 300,
          background: "hsl(var(--brand-teal) / 0.12)",
        }}
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:py-14">
        {/* === TOPO: Logo + Selo de Confiança === */}
        <header className="mb-6 flex items-center justify-between sm:mb-10">
          <div className="flex items-center gap-2.5 animate-fade-up">
            <div className="rounded-xl bg-white p-2 shadow-elev-2 ring-1 ring-black/5">
              <BrandLogo
                slug={params.slug}
                className="h-9 w-auto sm:h-11"
                alt={tenant.name}
              />
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-brand-teal/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-sm backdrop-blur sm:flex animate-fade-up animate-fade-up-1">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-teal" />
            100% seguro · LGPD
          </div>
        </header>

        {/* === GRID PRINCIPAL === */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
          {/* COLUNA ESQUERDA: Headline + Benefícios */}
          <div className="space-y-6 lg:space-y-8">
            {/* Etiqueta de destaque */}
            <div className="flex flex-wrap gap-2 animate-fade-up animate-fade-up-1">
              <span className="brand-tag brand-tag-yellow">
                <Percent className="h-4 w-4" />5% off na 1ª compra
              </span>
              <span className="brand-tag brand-tag-white">
                <Sparkles className="h-4 w-4" />Exclusivo
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-ink sm:text-5xl lg:text-6xl animate-fade-up animate-fade-up-2">
              As melhores{" "}
              <span className="relative inline-block">
                <span
                  className="relative z-10 bg-gradient-to-r from-brand-red to-brand-red-hover bg-clip-text text-transparent"
                  style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  ofertas
                </span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M2 9 Q 50 1, 100 5 T 198 4"
                    stroke="hsl(var(--brand-yellow))"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              direto no seu{" "}
              <span className="inline-flex items-baseline gap-1.5">
                WhatsApp
                <MessageCircle
                  className="h-9 w-9 -translate-y-1 text-[#25D366] sm:h-12 sm:h-12 lg:h-14"
                  fill="#25D366"
                  strokeWidth={1.5}
                />
              </span>
            </h1>

            <p className="max-w-lg text-pretty text-base leading-relaxed text-brand-ink/75 sm:text-lg animate-fade-up animate-fade-up-3">
              Cadastre-se em segundos e receba{" "}
              <strong className="font-semibold text-brand-ink">promoções
              exclusivas</strong>,{" "}
              <strong className="font-semibold text-brand-ink">descontos
              relâmpago</strong> e ofertas personalizadas da nossa loja.
            </p>

            {/* Benefícios em grid 2 colunas */}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 animate-fade-up animate-fade-up-4">
              <BenefitItem
                icon={<Tag className="h-4 w-4" />}
                title="Ofertas exclusivas"
                description="Preços só para assinantes"
              />
              <BenefitItem
                icon={<Bell className="h-4 w-4" />}
                title="Promo relâmpago"
                description="Avisamos na hora que abre"
              />
              <BenefitItem
                icon={<Truck className="h-4 w-4" />}
                title="Entrega no atacado"
                description="Compre sem sair de casa"
              />
              <BenefitItem
                icon={<Percent className="h-4 w-4" />}
                title="Cupom de boas-vindas"
                description="5% OFF na primeira compra"
              />
            </ul>

            {/* Trust bar com social proof */}
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3 animate-fade-up animate-fade-up-4">
              <div className="brand-trust flex-1">
                <CheckCircle2 className="h-4 w-4 text-brand-teal" />
                <span>
                  <strong className="font-bold text-brand-ink">+12.847</strong>{" "}
                  pessoas já recebem
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-brand-ink/70 shadow-sm ring-1 ring-black/5 sm:justify-start">
                <Clock className="h-3.5 w-3.5 text-brand-teal" />
                Resposta em até 1 min
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: Card do Form + Preview WhatsApp */}
          <div className="relative animate-fade-up animate-fade-up-2">
            {/* Etiqueta flutuante decorativa */}
            <div
              className="brand-tag brand-tag-yellow absolute -left-3 -top-3 z-20 hidden animate-float sm:flex"
              aria-hidden
            >
              <Sparkles className="h-3.5 w-3.5" />
              Grátis
            </div>
            <div
              className="brand-tag brand-tag-white absolute -right-4 top-12 z-20 hidden animate-float-delayed sm:flex"
              aria-hidden
            >
              <Percent className="h-3.5 w-3.5" />
              5% OFF
            </div>

            {/* Card principal */}
            <div className="brand-card p-6 sm:p-8">
              <header className="mb-5 flex items-start gap-3">
                <div className="brand-wpp-icon shrink-0 animate-pulse-ring">
                  <MessageCircle className="h-5 w-5" fill="white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight text-brand-ink sm:text-2xl">
                    Cadastre-se em 10 segundos
                  </h2>
                  <p className="mt-0.5 text-sm text-brand-ink/60">
                    É rápido, gratuito e você pode cancelar quando quiser.
                  </p>
                </div>
              </header>

              <PromoForm slug={params.slug} tenantName={tenant.name} />

              {/* Micro preview de WhatsApp embaixo do form */}
              <div className="mt-6 flex items-start gap-2.5 border-t border-dashed border-brand-ink/10 pt-5">
                <div className="brand-wpp-icon !h-9 !w-9 shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wider text-brand-teal">
                    Exemplo de oferta
                  </p>
                  <div className="mt-1.5 brand-bubble">
                    🛒{" "}
                    <strong className="font-semibold">
                      Arroz 5kg por R$ 19,90
                    </strong>
                    <br />
                    Só hoje! Válido para assinantes.{" "}
                    <span className="text-brand-ink/50">10:42 ✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === FOOTER === */}
        <footer className="mt-12 flex flex-col items-center gap-2 text-center text-xs text-brand-ink/50 sm:mt-16">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus dados estão protegidos. Não enviamos spam.
          </p>
          <p>
            © {new Date().getFullYear()} {tenant.name} · Powered by EvoSync
          </p>
        </footer>
      </main>
    </div>
  );
}

function BenefitItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="group flex items-start gap-3 rounded-xl border border-brand-ink/5 bg-white/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-yellow/60 hover:bg-white hover:shadow-elev-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white shadow-sm shadow-brand-red/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-ink">{title}</p>
        <p className="text-xs text-brand-ink/60">{description}</p>
      </div>
    </li>
  );
}
