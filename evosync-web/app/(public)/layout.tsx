/**
 * Layout do route group (public) — landing pages SEM auth.
 *
 * Diferenças do (app):
 *  - Sem AppShell (sem sidebar, sem header autenticado)
 *  - Sem redirect para /admin/login
 *  - Sem license check
 *  - Mantém apenas Toaster + TooltipProvider do root
 *
 * Usado para:
 *  - /promocoes/[slug] (cadastro de clientes finais por tenant)
 *
 * Estilos das variáveis brand-* já estão disponíveis via globals.css.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
