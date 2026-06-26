/**
 * BrandLogo — wrapper da logo do tenant na landing pública.
 *
 * Carrega `/tenants/<slug>.png`. Se não existir (tenant customizado sem
 * logo uploaded), cai num placeholder genérico com as iniciais do tenant.
 *
 * Para cada tenant novo, basta subir a logo em `public/tenants/<slug>.png`.
 */
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  slug: string;
  className?: string;
  alt: string;
  /** prioridade Next/Image (desabilita lazy para LCP da landing) */
  priority?: boolean;
}

export function BrandLogo({ slug, className, alt, priority = true }: BrandLogoProps) {
  return (
    <Image
      src={`/tenants/${slug}.png`}
      alt={alt}
      width={240}
      height={80}
      className={cn("h-12 w-auto object-contain", className)}
      priority={priority}
    />
  );
}

/**
 * Fallback com iniciais do tenant (usado se a logo não carregar).
 * Recomendado usar com onError no <img>, mas como usamos next/image,
 * o fallback fica disponível se necessário importar manualmente.
 */
export function BrandLogoFallback({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex h-12 items-center justify-center rounded-md bg-brand-red px-4 font-bold text-white",
        className
      )}
    >
      {initials}
    </div>
  );
}
