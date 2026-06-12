import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listContacts } from "@/server/store/contacts";
import { loadTenantSettings } from "@/server/store/settings";
import { sender } from "@/server/sender/manager";
import fs from "node:fs";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

/**
 * POST /api/send/start — inicia disparo manual.
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não pode iniciar disparos manuais" },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const template = String(body.template || "").trim();
  const mediaPath = String(body.mediaPath || "").trim() || null;
  const mediatype = String(body.mediatype || "image");
  const delayMin = Math.max(1, Number(body.delayMin) || 8);
  const delayMax = Math.max(delayMin, Number(body.delayMax) || 25);
  const dailyLimit = Math.max(1, Number(body.dailyLimit) || 200);
  const validateFirst = !!body.validateFirst;
  const skipSentHistory = body.skipSentHistory !== false;

  const contacts = listContacts(session.user.tenantId);
  if (!contacts.length) {
    return NextResponse.json(
      { ok: false, error: "Sem contatos. Importe ou adicione antes de iniciar." },
      { status: 400 }
    );
  }
  if (!template && !mediaPath) {
    return NextResponse.json(
      { ok: false, error: "Digite uma mensagem ou selecione uma mídia antes de iniciar." },
      { status: 400 }
    );
  }
  if (mediaPath && !fs.existsSync(mediaPath)) {
    return NextResponse.json(
      { ok: false, error: `Arquivo de mídia não encontrado: ${mediaPath}` },
      { status: 400 }
    );
  }
  if (sender.isBusy()) {
    return NextResponse.json(
      { ok: false, error: "Já existe um disparo em andamento." },
      { status: 409 }
    );
  }

  const settings = loadTenantSettings(session.user.tenantId);
  if (!settings.api_key || !settings.instance) {
    return NextResponse.json(
      {
        ok: false,
        error: "Preencha API Key e Nome da Instância na aba Conexão.",
      },
      { status: 400 }
    );
  }

  sender.setActiveScheduleId(null);
  const ok = sender.start({
    tenantId: session.user.tenantId,
    url: settings.url,
    apiKey: settings.api_key,
    instance: settings.instance,
    contacts,
    template,
    mediaPath,
    mediatype,
    delayMin,
    delayMax,
    dailyLimit,
    validateFirst,
    skipSentHistory,
    source: "manual",
  });

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Não foi possível iniciar o disparo." },
      { status: 500 }
    );
  }

  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: `Iniciando disparo manual: ${contacts.length} contatos, delay ${delayMin}-${delayMax}s, limite ${dailyLimit}/dia`,
      level: "info",
    },
  });

  return NextResponse.json({ ok: true });
}
