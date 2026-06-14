import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantId,
  parseJsonBody,
  jsonError,
} from "@/lib/api-helpers";
import { addContactsBulk } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/import-csv
 * Body: { rows: [{ numero?, Numero?, ...campos }] }
 * Retorna: { added, updated, skipped, total }  (FASE 2: upsert merge)
 *
 * SaaS Phase 4: escopado por tenantId da sessão.
 *
 * Regra de merge (LGPD/anti-ban): tags, opt_out, notes, lists NUNCA
 * sobrescritos pelo input do CSV. Apenas `name` (se passado) e
 * `fields` (merge shallow) são atualizados.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("importar contatos");
  if (error) return error;

  const body = await parseJsonBody<{ rows?: unknown }>(req);
  if (!body.ok) return body.error;
  const rows = body.data?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    return jsonError("rows[] vazio", 400);
  }

  // Mapeia CSV → Contact
  const contacts: Contact[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const num = String(r.numero || r.Numero || "").trim();
    if (!num) continue;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k.toLowerCase() === "numero") continue;
      fields[k] = String(v || "").trim();
    }
    // Se a coluna "nome" existe, promove para o campo canônico
    const nome = fields.nome || fields.Nome;
    contacts.push({
      id: "",
      number: num,
      name: nome && nome.trim() ? nome.trim() : null,
      tags: [],
      lists: [],
      opt_out: false,
      notes: null,
      fields,
      createdAt: "",
      updatedAt: "",
    });
  }

  try {
    const result = addContactsBulk(tenantId!, contacts);
    return NextResponse.json(result);
  } catch (e: any) {
    return jsonError(`Falha ao importar: ${e?.message || e}`, 500);
  }
}
