/**
 * Layout do route group (app) — APLICAR o AppShell aqui.
 *
 * Por que route group com (parens)?
 *  - O root `app/layout.tsx` precisa ser LEVE (só html, body, Providers)
 *  - Páginas com chrome (sidebar, header, statusbar) ficam em (app)/
 *  - Páginas sem chrome (admin login, futuras landing pages) ficam fora
 *
 * Route groups (parens) NÃO afetam a URL: `(app)/conexao` vira `/conexao`.
 */
import { AppShell } from "@/components/layout/app-shell";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
