import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addContactsBulk } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/import-csv
 * Body: { rows: [{ numero?, Numero?, ...campos }] }
 * Retorna: { added, existing, total }
 *
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function POST(req: NextRequest) {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const rows: Record<string, string>[] = Array.isArray(body.rows)
    ? body.rows
    : [];
  if (!rows.length) {
    return NextResponse.json({ error: "rows[] vazio" }, { status: 400 });
  }

  // Mapeia CSV → Contact
  const contacts: Contact[] = [];
  for (const row of rows) {
    const num = String(row.numero || row.Numero || "").trim();
    if (!num) continue;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === "numero") continue;
      fields[k] = String(v || "").trim();
    }
    contacts.push({ number: num, fields });
  }

  const result = addContactsBulk(session.user.tenantId, contacts);
  return NextResponse.json(result);
}
