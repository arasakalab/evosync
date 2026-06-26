/**
 * GET /api/connection/qr
 *
 * Retorna o QR code de pareamento WhatsApp para o tenant logado.
 * Só funciona para tenants em modo managed.
 *
 * Cache: 30s por instância. Gera novo QR se cache expirou.
 *
 * Resposta:
 *   { qr: { base64, code, pairingCode } | null,
 *     expiresInMs: number,     // tempo restante do cache atual
 *     instance: string,
 *     cached: boolean,         // true se veio do cache
 *     state: string | null,    // estado atual na Evolution (open/close/connecting)
 *     error: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { CENTRAL_EVO_ENABLED, getCentralEvoClient } from "@/server/paths";
import {
  getCachedQr,
  setCachedQr,
  QR_CACHE_TTL_MS,
} from "@/server/store/qr-cache";

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
  if (tenant.evoMode !== "managed") {
    return NextResponse.json(
      { error: "QR só disponível para tenants em modo managed" },
      { status: 400 }
    );
  }
  if (!CENTRAL_EVO_ENABLED) {
    return NextResponse.json(
      { error: "Modo managed não configurado no servidor" },
      { status: 503 }
    );
  }
  if (!tenant.evoInstance) {
    return NextResponse.json(
      { error: "Tenant ainda não tem instância provisionada. Contate o admin." },
      { status: 409 }
    );
  }

  // 1) Verifica cache primeiro
  const cached = getCachedQr(tenant.evoInstance);
  if (cached) {
    // Verifica também o estado atual (pode ter mudado de connecting pra open)
    const client = getCentralEvoClient();
    const st = await client.getInstanceState(tenant.evoInstance);
    return NextResponse.json({
      qr: {
        base64: cached.base64 || null,
        code: cached.code || null,
        pairingCode: cached.pairingCode || null,
      },
      expiresInMs: Math.max(0, QR_CACHE_TTL_MS - cached.ageMs),
      instance: tenant.evoInstance,
      cached: true,
      state: st.state,
      error: null,
    });
  }

  // 2) Cache miss → chama Evolution
  const client = getCentralEvoClient();
  const connect = await client.connectInstance(tenant.evoInstance);

  // 3) Se Evolution diz que já está conectado, não precisa de QR
  if (/já conectado/i.test(connect.info)) {
    return NextResponse.json({
      qr: null,
      expiresInMs: 0,
      instance: tenant.evoInstance,
      cached: false,
      state: "open",
      error: null,
    });
  }

  if (!connect.ok || !connect.qr) {
    return NextResponse.json(
      {
        qr: null,
        expiresInMs: 0,
        instance: tenant.evoInstance,
        cached: false,
        state: null,
        error: connect.info,
      },
      { status: 502 }
    );
  }

  // 4) Salva no cache
  setCachedQr(tenant.evoInstance, connect.qr, QR_CACHE_TTL_MS);

  // 5) Verifica estado atual
  const st = await client.getInstanceState(tenant.evoInstance);

  return NextResponse.json({
    qr: {
      base64: connect.qr.base64 || null,
      code: connect.qr.code || null,
      pairingCode: connect.qr.pairingCode || null,
    },
    expiresInMs: QR_CACHE_TTL_MS,
    instance: tenant.evoInstance,
    cached: false,
    state: st.state,
    error: null,
  });
}
