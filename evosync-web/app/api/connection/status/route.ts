/**
 * GET /api/connection/status
 *
 * Retorna o estado de conexão atual do tenant logado.
 * Para managed, consulta a Evolution central. Para BYO, consulta a Evolution do tenant.
 * Atualiza o status no DB quando muda.
 *
 * Resposta:
 *   { ok: boolean,
 *     state: "open" | "close" | "connecting" | null,
 *     mode: "byo" | "managed",
 *     managedStatus: string | null,
 *     error: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { loadTenantSettings } from "@/server/store/settings";
import { EvoClient } from "@/server/evo/client";
import { getManagedInstanceStatus } from "@/server/store/managed-evo";
import { CENTRAL_EVO_ENABLED } from "@/server/paths";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem conexão de tenant" },
      { status: 403 }
    );
  }
  const tenant = getTenant(session.user.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  if (tenant.evoMode === "managed") {
    if (!CENTRAL_EVO_ENABLED) {
      return NextResponse.json({
        ok: false,
        state: null,
        mode: "managed",
        managedStatus: tenant.evoManagedStatus,
        error: "Modo managed não configurado no servidor",
      });
    }
    if (!tenant.evoInstance) {
      return NextResponse.json({
        ok: false,
        state: null,
        mode: "managed",
        managedStatus: tenant.evoManagedStatus,
        error: "Instância não provisionada",
      });
    }
    const r = await getManagedInstanceStatus(tenant);
    return NextResponse.json({
      ok: r.state === "open",
      state: r.state,
      mode: "managed",
      managedStatus: r.managedStatus,
      error: r.err !== "OK" ? r.err : null,
    });
  }

  // BYO
  const s = loadTenantSettings(tenant.id);
  if (!s.api_key || !s.instance) {
    return NextResponse.json({
      ok: false,
      state: null,
      mode: "byo",
      managedStatus: null,
      error: "API key ou instância não configuradas",
    });
  }
  const client = new EvoClient(s.url, s.api_key, s.instance);
  const st = await client.connectionState();
  return NextResponse.json({
    ok: st.state === "open",
    state: st.state,
    mode: "byo",
    managedStatus: null,
    error: st.err !== "OK" ? st.err : null,
  });
}
