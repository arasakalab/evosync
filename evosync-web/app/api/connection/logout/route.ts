/**
 * POST /api/connection/logout
 *
 * Desconecta a sessão WhatsApp do tenant logado (logout na Evolution).
 * Para managed: chama DELETE /instance/logout/{slug} na Evolution central.
 * Para BYO: chama DELETE /instance/logout/{instance} na Evolution do tenant.
 *
 * NÃO deleta a instância — só desloga o WhatsApp. Para revogar a
 * instância managed, o admin usa POST /api/admin/tenants/[id]/revoke.
 *
 * Resposta: { ok, info }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { loadTenantSettings } from "@/server/store/settings";
import { EvoClient } from "@/server/evo/client";
import { getCentralEvoClient } from "@/server/paths";
import { clearCachedQr } from "@/server/store/qr-cache";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
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
    if (!tenant.evoInstance) {
      return NextResponse.json(
        { error: "Tenant não tem instância provisionada" },
        { status: 409 }
      );
    }
    const client = getCentralEvoClient();
    const r = await client.logoutInstance(tenant.evoInstance);
    clearCachedQr(tenant.evoInstance);
    return NextResponse.json(
      { ok: r.ok, info: r.info },
      { status: r.ok ? 200 : 502 }
    );
  }

  // BYO
  const s = loadTenantSettings(tenant.id);
  if (!s.api_key || !s.instance) {
    return NextResponse.json(
      { error: "API key ou instância não configuradas" },
      { status: 400 }
    );
  }
  const client = new EvoClient(s.url, s.api_key, s.instance);
  const r = await client.logoutInstance(s.instance);
  return NextResponse.json(
    { ok: r.ok, info: r.info },
    { status: r.ok ? 200 : 502 }
  );
}
