/**
 * Helpers de guard para rotas do tenant (Fase B+).
 *
 * Funções:
 *  - requireManagedConnection(tenantId) — verifica se tenant managed
 *    já tem WhatsApp conectado. Retorna null se OK, ou { reason }
 *    se bloqueado.
 *  - assertManagedConnection(tenantId) — mesma coisa mas lança
 *    erro estruturado pra API routes.
 *
 * Usado em:
 *  - (app)/layout.tsx — server-side redirect
 *  - /api/send/start — bloqueia envio se não conectado
 *  - outros endpoints críticos podem usar pra defense-in-depth
 */
import { getTenant } from "@/server/store/tenants";

export interface ManagedGuardResult {
  blocked: boolean;
  reason?: string;
  status?: string;
}

/**
 * Verifica se o tenant managed tem WhatsApp conectado.
 * Retorna { blocked: false } se pode prosseguir, ou { blocked: true, reason }
 * se precisa bloquear.
 */
export function checkManagedConnection(
  tenantId: string
): ManagedGuardResult {
  const t = getTenant(tenantId);
  if (!t) {
    return { blocked: true, reason: "tenant_not_found" };
  }
  // BYO: conexão é responsabilidade do próprio tenant (configurada na aba)
  if (t.evoMode !== "managed") {
    return { blocked: false };
  }
  // Managed: bloqueia até WhatsApp estar pareado
  if (t.evoManagedStatus === "connected") {
    return { blocked: false };
  }
  return {
    blocked: true,
    reason: "managed_not_connected",
    status: t.evoManagedStatus || "pending",
  };
}
