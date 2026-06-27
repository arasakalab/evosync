import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { listContacts } from "@/server/store/contacts";
import { loadTenantSettings } from "@/server/store/settings";
import { sender } from "@/server/sender/manager";
import { jsonError, parseJsonBody, requireTenantId, validateWith } from "@/lib/api-helpers";
import { checkWatchdogPause } from "@/server/store/watchdog";
import { checkManagedConnection } from "@/server/store/managed-guard";
import fs from "node:fs";
import { hub } from "@/server/ws/hub";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

const StartSendSchema = z.object({
  template: z.string().default(""),
  mediaPath: z.string().nullable().optional(),
  mediatype: z.string().default("image"),
  delayMin: z.number().int().positive().default(8),
  delayMax: z.number().int().positive().default(25),
  dailyLimit: z.number().int().positive().default(200),
  validateFirst: z.boolean().default(true),
  skipSentHistory: z.boolean().default(true),
  contactIds: z.array(z.string()).optional(), // FASE 3: subset selecionado
});

/**
 * POST /api/send/start — inicia disparo manual.
 * SaaS Phase 4: escopado por tenantId da sessão.
 *
 * FASE 3: aceita `contactIds?: string[]` no payload. Se presente, filtra
 * o catálogo pelos IDs (e opt_out=true é checado no SenderRunner por segurança).
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("iniciar disparos manuais");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(StartSendSchema, body.data);
  if (!validated.ok) return validated.error;
  const v = validated.data;

  const template = (v.template || "").trim();
  const mediaPath = v.mediaPath?.trim() || null;
  const mediatype = v.mediatype || "image";
  const delayMin = Math.max(1, v.delayMin || 8);
  const delayMax = Math.max(delayMin, v.delayMax || 25);
  const dailyLimit = Math.max(1, v.dailyLimit || 200);
  const validateFirst = v.validateFirst ?? true;
  const skipSentHistory = v.skipSentHistory ?? true;

  // Filtra diretamente do catálogo pelos IDs do payload (fonte única no client).
  const listResult = listContacts(tenantId!);
  let contacts: Contact[] = listResult.contacts;
  if (v.contactIds && v.contactIds.length) {
    const idSet = new Set(v.contactIds);
    contacts = contacts.filter((c) => idSet.has(c.id));
  }
  if (!contacts.length) {
    return jsonError(
      v.contactIds && v.contactIds.length
        ? "Nenhum contato selecionado para enviar. Marque contatos na aba Contatos."
        : "Sem contatos. Importe ou adicione antes de iniciar.",
      400
    );
  }
  if (!template && !mediaPath) {
    return jsonError(
      "Digite uma mensagem ou selecione uma mídia antes de iniciar.",
      400
    );
  }
  if (mediaPath && !fs.existsSync(mediaPath)) {
    return jsonError(`Arquivo de mídia não encontrado: ${mediaPath}`, 400);
  }
  if (sender.isBusy()) {
    return jsonError("Já existe um disparo em andamento.", 409);
  }

  // Watchdog anti-ban: se este tenant está pausado por auth/ban, recusa
  const watchdogPause = checkWatchdogPause(tenantId!);
  if (watchdogPause) {
    return jsonError(
      `Tenant pausado pelo watchdog (desde ${watchdogPause.at || "?"}). ` +
        `Motivo: ${watchdogPause.reason}. ` +
        `Contate o administrador para liberar.`,
      423 // Locked
    );
  }

  // Managed connection: se tenant é managed e WhatsApp não está conectado,
  // recusa (defense-in-depth — UI já bloqueia via layout, mas API confirma)
  const connGuard = checkManagedConnection(tenantId!);
  if (connGuard.blocked && connGuard.reason === "managed_not_connected") {
    return jsonError(
      "WhatsApp não está conectado. Conecte seu WhatsApp na aba Conexão antes de enviar.",
      423
    );
  }

  const settings = loadTenantSettings(tenantId!);
  if (!settings.api_key || !settings.instance) {
    return jsonError(
      "Preencha API Key e Nome da Instância na aba Conexão.",
      400
    );
  }

  sender.setActiveScheduleId(null);
  const ok = sender.start({
    tenantId: tenantId!,
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
    return jsonError("Não foi possível iniciar o disparo.", 500);
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
