import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listContacts, addContact, removeContacts } from "@/server/store/contacts";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Helper: extrai tenantId da sessão, ou retorna erro 4xx */
async function requireTenantId() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
      tenantId: null,
    };
  }
  if (!session.user.tenantId) {
    return {
      error: NextResponse.json(
        { error: "Super admin não tem lista de contatos" },
        { status: 403 }
      ),
      tenantId: null,
    };
  }
  return { error: null, tenantId: session.user.tenantId };
}

/**
 * GET /api/contacts — lista contatos do tenant
 * Aceita ?q=termo para busca.
 */
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const contacts = listContacts(tenantId!, q);
  return NextResponse.json({ contacts, count: contacts.length });
}

/**
 * POST /api/contacts — adiciona 1 contato
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const number = String(body.number || "").trim();
  if (!number) {
    return NextResponse.json(
      { error: "Número é obrigatório" },
      { status: 400 }
    );
  }
  const fields =
    body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)
      ? body.fields
      : {};

  const contact: Contact = { number, fields };
  const saved = addContact(tenantId!, contact);
  return NextResponse.json(saved);
}

/**
 * DELETE /api/contacts — remove contatos pelos números
 */
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await requireTenantId();
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const numbers: string[] = Array.isArray(body.numbers) ? body.numbers : [];
  if (!numbers.length) {
    return NextResponse.json(
      { error: "numbers[] é obrigatório" },
      { status: 400 }
    );
  }
  const removed = removeContacts(
    tenantId!,
    numbers.map((n) => String(n))
  );
  return NextResponse.json({ removed });
}
