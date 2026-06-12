import { NextRequest, NextResponse } from "next/server";
import { loadContacts, saveContacts } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ error: "rows[] vazio" }, { status: 400 });
  }
  const current = loadContacts();
  let added = 0;
  for (const row of rows) {
    const num = String(row.numero || row.Numero || "").trim();
    if (!num) continue;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === "numero") continue;
      fields[k] = String(v || "").trim();
    }
    current.push({ number: num, fields });
    added += 1;
  }
  saveContacts(current);
  return NextResponse.json({ added, total: current.length });
}
