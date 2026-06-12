/**
 * Layout do route group (app) — APLICAR o AppShell + auth guard.
 *
 * Por que route group com (parens)?
 *  - O root `app/layout.tsx` precisa ser LEVE (só html, body, Providers)
 *  - Páginas com chrome (sidebar, header, statusbar) ficam em (app)/
 *  - Páginas sem chrome (admin login, futuras landing pages) ficam fora
 *
 * Route groups (parens) NÃO afetam a URL: `(app)/conexao` vira `/conexao`.
 *
 * Auth: a partir da Fase 2 do SaaS, todas as páginas do app exigem login.
 *  - Se não logado, redireciona pra /admin/login com callbackUrl
 *  - Se logado, renderiza o AppShell
 *
 * Próximas fases:
 *  - Fase 3: redirecionar pra /license-expired se license venceu
 *  - Fase 4: escopar dados por tenantId da sessão
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

  return <AppShell>{children}</AppShell>;
}
