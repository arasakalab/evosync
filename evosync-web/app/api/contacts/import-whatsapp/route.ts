import { NextRequest, NextResponse } from "next/server";
import { requireTenantId, jsonError } from "@/lib/api-helpers";
import { loadTenantSettings } from "@/server/store/settings";
import { EvoClient } from "@/server/evo/client";
import { addContactsBulk } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/import-whatsapp — importa contatos da Evolution API
 * do tenant logado. SaaS Phase 4: escopado por tenantId.
 *
 * Retorna: { added, updated, skipped, found, existed }  (FASE 2)
 *   - added: novos inseridos
 *   - updated: já existiam e foram atualizados (ex: novo pushName)
 *   - skipped: já existiam e caller não passou nada novo
 *   - found: total encontrado na Evolution
 *   - existed: atalho para `found - added - updated` (não foi alterado)
 */
export async function POST(_req: NextRequest) {
  const { error, tenantId } = await requireTenantId("importar contatos");
  if (error) return error;

  const s = loadTenantSettings(tenantId!);
  if (!s.api_key || !s.instance) {
    return jsonError(
      "Preencha API Key e Nome da Instância na aba Conexão.",
      400
    );
  }
  const client = new EvoClient(s.url, s.api_key, s.instance);
  const { data, err } = await client.findContactsRaw();
  if (data === null) {
    return jsonError(`Falha ao buscar contatos: ${err}`, 500);
  }
  const valid: Contact[] = [];
  const seenNums = new Set<string>();
  for (const d of data) {
    if (!d || typeof d !== "object") continue;
    if (d.isGroup) continue;
    if (d.type && d.type !== "contact") continue;
    const jid: string = d.remoteJid || "";
    if (!jid.includes("@")) continue;
    const suffix = jid.split("@", 1)[1];
    if (!["s.whatsapp.net", "lid"].includes(suffix)) continue;
    const num = jid.split("@", 1)[0];
    const digits = num.replace(/\D+/g, "");
    if (digits.length < 7 || digits === "0") continue;
    if (seenNums.has(digits)) continue;
    seenNums.add(digits);
    const name =
      String(d.pushName || d.verifiedName || "").trim() || null;
    valid.push({
      id: "",
      number: digits,
      name,
      tags: [],
      lists: [],
      opt_out: false,
      notes: null,
      // Mantém compat: nome também em fields.nome para o render de template
      fields: name ? { nome: name } : {},
      createdAt: "",
      updatedAt: "",
    });
  }
  if (!valid.length) {
    return jsonError("Nenhum contato válido encontrado na instância.", 404);
  }

  try {
    const result = addContactsBulk(tenantId!, valid);
    return NextResponse.json({
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      found: valid.length,
      existed: result.skipped,
    });
  } catch (e: any) {
    return jsonError(`Falha ao importar: ${e?.message || e}`, 500);
  }
}
