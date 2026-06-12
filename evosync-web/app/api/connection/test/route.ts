import { NextRequest, NextResponse } from "next/server";
import { EvoClient } from "@/server/evo/client";
import { auth } from "@/lib/auth";
import { loadTenantSettings } from "@/server/store/settings";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

/**
 * POST /api/connection/test — testa a conexão Evolution do tenant logado.
 * SaaS Phase 4: escopado por tenantId (cada tenant testa a sua própria).
 */
export async function POST(req: NextRequest) {
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

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    /* body vazio OK */
  }

  const current = loadTenantSettings(session.user.tenantId);
  const url = body.url || current.url;
  const apiKey = body.api_key || current.api_key;
  const instance = body.instance || current.instance;

  if (!apiKey || !instance) {
    return NextResponse.json(
      { ok: false, msg: "Preencha API Key e Nome da Instância" },
      { status: 400 }
    );
  }
  const client = new EvoClient(url, apiKey, instance);
  const ping = await client.ping();
  if (!ping.ok) {
    hub.broadcast({ type: "conn", payload: { ok: false, msg: ping.msg } });
    return NextResponse.json({ ok: false, msg: ping.msg });
  }
  const { state } = await client.connectionState();
  const finalState = state ?? "?";
  const msg = `${ping.msg} · instância: ${finalState}`;
  hub.broadcast({
    type: "conn",
    payload: { ok: true, state: finalState, msg },
  });
  return NextResponse.json({ ok: true, state: finalState, msg });
}
