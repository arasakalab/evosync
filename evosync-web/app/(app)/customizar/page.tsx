/**
 * /customizar — página de personalização da landing /c/[slug].
 *
 * Layout:
 *   - Lado esquerdo: form com abas (Cores, Textos, Imagens, Fonte)
 *   - Lado direito: preview ao vivo (iframe) + link "Abrir em nova aba"
 *
 * Carrega branding inicial via API (server component) e passa pro client.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBranding } from "@/server/store/branding";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { CustomizerClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personalizar landing",
  description: "Configure logo, cores, imagens e textos da sua landing pública.",
};

export default async function CustomizarPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?callbackUrl=/customizar");
  if (!session.user.tenantId) redirect("/admin");

  const tenantId = session.user.tenantId;
  const branding = getBranding(tenantId);

  // Pega slug do tenant pro preview e pro link de compartilhamento
  const db = getDb();
  const tenant = db
    .select({ slug: schema.tenants.slug, name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();

  return (
    <CustomizerClient
      initial={branding}
      tenantId={tenantId}
      tenantSlug={tenant?.slug || ""}
      tenantName={tenant?.name || ""}
    />
  );
}
