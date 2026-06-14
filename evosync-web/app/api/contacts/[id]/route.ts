import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import { getContact, updateContact, deleteContact } from "@/server/store/contacts";

export const dynamic = "force-dynamic";

const UpdateContactSchema = z.object({
  name: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  opt_out: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  fields: z.record(z.string()).optional(),
});

/**
 * GET /api/contacts/:id — busca 1 contato por id.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("contato");
  if (error) return error;

  const contact = getContact(tenantId!, params.id);
  if (!contact) return jsonError("Contato não encontrado", 404);
  return NextResponse.json(contact);
}

/**
 * PATCH /api/contacts/:id — atualiza campos editáveis.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("contato");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(UpdateContactSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const updated = updateContact(tenantId!, params.id, validated.data);
    if (!updated) return jsonError("Contato não encontrado", 404);
    return NextResponse.json(updated);
  } catch (e: any) {
    return jsonError(`Falha ao atualizar: ${e?.message || e}`, 500);
  }
}

/**
 * DELETE /api/contacts/:id — remove 1 contato.
 * CASCADE em contact_list_members trata.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("contato");
  if (error) return error;
  const ok = deleteContact(tenantId!, params.id);
  if (!ok) return jsonError("Contato não encontrado", 404);
  return NextResponse.json({ ok: true });
}
