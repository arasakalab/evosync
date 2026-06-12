/**
 * Configuração EDGE-SAFE do NextAuth (sem providers que importem DB).
 * Este arquivo é importado pelo `middleware.ts` (que roda em Edge runtime)
 * e pelo `lib/auth.ts` (que adiciona o provider Credentials com Drizzle).
 *
 * Edge runtime não tem suporte a `node:*` nem `better-sqlite3`, então NÃO
 * importe nada que use essas APIs aqui.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 dias
  pages: {
    signIn: "/admin/login",
  },
  // Providers são adicionados em lib/auth.ts (server-only)
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith("/admin");
      const isLoginPage = nextUrl.pathname === "/admin/login";

      // /admin/* exige login
      if (isAdminRoute && !isLoggedIn && !isLoginPage) return false;
      // Já logado em /admin/login → deixa passar (a página redireciona)
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
};
