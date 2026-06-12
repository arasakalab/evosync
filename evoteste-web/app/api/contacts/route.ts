import { NextRequest, NextResponse } from "next/server";
import { loadContacts, saveContacts } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const contacts = loadContacts();
  return NextResponse.json({ contacts, count: contacts.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const current = loadContacts();
  const number = String(body.number || "").trim();
  if (!number) {
    return NextResponse.json(
      { error: "Número é obrigatório" },
      { status: 400 }
    );
  }
  const fields =
    body.fields && typeof body.fields === "object" ? body.fields : {};
  const contact: Contact = { number, fields };
  const next = [...current, contact];
  saveContacts(next);
  return NextResponse.json(contact);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const numbers: string[] = Array.isArray(body.numbers) ? body.numbers : [];
  if (!numbers.length) {
    return NextResponse.json({ error: "numbers[] é obrigatório" }, { status: 400 });
  }
  const set = new Set(numbers.map((n) => String(n)));
  const current = loadContacts();
  const next = current.filter((c) => !set.has(c.number));
  saveContacts(next);
  return NextResponse.json({ removed: current.length - next.length });
}
