import { NextRequest, NextResponse } from "next/server";
import { EvoClient } from "@/server/evo/client";
import { loadSettings } from "@/server/store/settings";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const current = loadSettings();
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
