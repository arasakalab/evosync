/**
 * Middleware global: protege rotas do admin.
 *
 * Usa a authConfig EDGE-SAFE (sem providers, sem Drizzle) — NextAuth v5
 * separa em 2 arquivos propositalmente pra o middleware poder rodar no
 * Edge runtime.
 *
 * Por enquanto (Fase 2), apenas bloqueia /admin/* (exceto /admin/login).
 * Lógica de role (super_admin vs owner/operator) é feita nos layouts/páginas.
 *
 * Próximas fases:
 *  - Fase 3: checar license do tenant e redirecionar pra /license-expired
 *  - Fase 4: escopar dados por tenantId
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/admin/:path*"],
};
