import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import {
  listContacts,
  addContact,
  removeContacts,
} from "@/server/store/contacts";
import type { ContactFilters, Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

const ContactFiltersSchema = z.object({
  q: z.string().optional(),
  mode: z.enum(["all", "selected", "opt_out"]).optional(),
  tag: z.string().optional(),
  list: z.string().optional(),
  opt_out: z.boolean().optional(),
  limit: z.coerce.number().int().positive().max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const AddContactSchema = z.object({
  number: z.string().min(1),
  name: z.string().nullable().optional(),
  fields: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  opt_out: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const RemoveContactsSchema = z.object({
  numbers: z.array(z.string()).min(1),
});

/**
 * GET /api/contacts — lista contatos do tenant com filtros opcionais.
 *
 * Query params (todos opcionais):
 *  - q: termo de busca (em number, name, fields)
 *  - mode: "all" | "selected" | "opt_out"
 *  - tag: filtra por tag específica
 *  - list: filtra por list id
 *  - opt_out: true | false
 *  - limit, offset: paginação
 *
 * Resposta: { contacts, count, filteredCount }
 */
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = validateWith(ContactFiltersSchema, params);
  if (!parsed.ok) return parsed.error;

  const result = listContacts(tenantId!, parsed.data as ContactFilters);
  return NextResponse.json({
    contacts: result.contacts,
    count: result.count,
    filteredCount: result.filteredCount,
  });
}

/**
 * POST /api/contacts — adiciona 1 contato.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(AddContactSchema, body.data);
  if (!validated.ok) return validated.error;

  // Constrói o Contact com defaults seguros
  const contact: Contact = {
    id: "",
    number: validated.data.number,
    name: validated.data.name ?? null,
    tags: validated.data.tags ?? [],
    lists: validated.data.lists ?? [],
    opt_out: validated.data.opt_out ?? false,
    notes: validated.data.notes ?? null,
    fields: validated.data.fields ?? {},
    createdAt: "",
    updatedAt: "",
  };

  try {
    const saved = addContact(tenantId!, contact);
    return NextResponse.json(saved);
  } catch (e: any) {
    return jsonError(`Falha ao criar contato: ${e?.message || e}`, 500);
  }
}

/**
 * DELETE /api/contacts — remove contatos pelos números (bulk).
 */
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(RemoveContactsSchema, body.data);
  if (!validated.ok) return validated.error;

  const removed = removeContacts(tenantId!, validated.data.numbers);
  return NextResponse.json({ removed });
}
