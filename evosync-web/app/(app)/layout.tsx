/**
 * Layout do route group (app) — APLICAR o AppShell + auth guard + license guard.
 *
 * Por que route group com (parens)?
 *  - O root `app/layout.tsx` precisa ser LEVE (só html, body, Providers)
 *  - Páginas com chrome (sidebar, header, statusbar) ficam em (app)/
 *  - Páginas sem chrome (admin login, futuras landing pages) ficam fora
 *
 * Route groups (parens) NÃO afetam a URL: `(app)/conexao` vira `/conexao`.
 *
 * Auth + License (Fase 2 + 3 do SaaS):
 *  - Sem sessão → /admin/login?callbackUrl=
 *  - Com sessão, mas tenantId (e license vencida) → /license-expired
 *  - super_admin (tenantId null) sempre passa (é a plataforma, não cliente)
 *
 * Próximas fases:
 *  - Fase 4: escopar dados por tenantId da sessão
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isLicenseValid } from "@/lib/license";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login?callbackUrl=/");
  }

  // super_admin (sem tenant) sempre tem acesso à plataforma
  if (session.user.tenantId) {
    const valid = await isLicenseValid(session.user.tenantId);
    if (!valid) {
      redirect("/license-expired");
    }
  }

  return <AppShell>{children}</AppShell>;
}
