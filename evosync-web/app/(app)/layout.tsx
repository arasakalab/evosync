/**
 * Layout do route group (app) — AppShell + auth guard + license guard +
 * managed connection guard.
 *
 * Guards em ordem:
 *  1. Sem sessão → /admin/login
 *  2. super_admin (sem tenant) → /admin
 *  3. License inválida → /license-expired
 *  4. **Tenant managed MAS WhatsApp não conectado** → /conexao
 *     (exceto se já está em /conexao — aí deixa acessar)
 *
 * O pathname vem do header `x-pathname` setado pelo middleware.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isLicenseValid } from "@/lib/license";
import { checkManagedConnection } from "@/server/store/managed-guard";
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

  if (!session.user.tenantId) {
    redirect("/admin");
  }

  const valid = await isLicenseValid(session.user.tenantId);
  if (!valid) {
    redirect("/license-expired");
  }

  // Managed connection guard
  const headersList = headers();
  const pathname = headersList.get("x-pathname") || "/";
  const guard = checkManagedConnection(session.user.tenantId);
  if (guard.blocked) {
    // BYO + sem credenciais = também bloqueia, mas é uma mensagem
    // diferente (handled na própria página /conexao)
    if (pathname !== "/conexao") {
      const reason = guard.reason || "blocked";
      redirect(`/conexao?reason=${encodeURIComponent(reason)}`);
    }
  }

  return <AppShell>{children}</AppShell>;
}
