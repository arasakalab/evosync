import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadTenantSettings } from "@/server/store/settings";
import { EvoClient } from "@/server/evo/client";
import { addContactsBulk, listContacts } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/import-whatsapp — importa contatos da Evolution API
 * do tenant logado. SaaS Phase 4: escopado por tenantId.
 */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não pode importar contatos" },
      { status: 403 }
    );
  }
  const tenantId = session.user.tenantId;

  const s = loadTenantSettings(tenantId);
  if (!s.api_key || !s.instance) {
    return NextResponse.json(
      { error: "Preencha API Key e Nome da Instância na aba Conexão." },
      { status: 400 }
    );
  }
  const client = new EvoClient(s.url, s.api_key, s.instance);
  const { data, err } = await client.findContactsRaw();
  if (data === null) {
    return NextResponse.json(
      { error: `Falha ao buscar contatos: ${err}` },
      { status: 500 }
    );
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
      String(d.pushName || d.verifiedName || "").trim() || "(sem nome)";
    valid.push({ number: digits, fields: { nome: name } });
  }
  if (!valid.length) {
    return NextResponse.json(
      { error: "Nenhum contato válido encontrado na instância." },
      { status: 404 }
    );
  }

  // addContactsBulk já faz upsert com dedup contra existentes
  const result = addContactsBulk(tenantId, valid);
  return NextResponse.json({
    added: result.added,
    found: valid.length,
    existed: result.existing,
  });
}
