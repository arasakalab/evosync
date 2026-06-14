import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import {
  getContactList,
  updateContactList,
  deleteContactList,
} from "@/server/store/contact-lists";

export const dynamic = "force-dynamic";

const UpdateListSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().nullable().optional(),
});

/**
 * GET /api/contact-lists/:id — busca 1 lista (com memberCount).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;
  const list = getContactList(tenantId!, params.id);
  if (!list) return jsonError("Lista não encontrada", 404);
  return NextResponse.json(list);
}

/**
 * PATCH /api/contact-lists/:id — atualiza nome/cor.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(UpdateListSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const updated = updateContactList(tenantId!, params.id, validated.data);
    if (!updated) return jsonError("Lista não encontrada", 404);
    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Já existe")) {
      return jsonError(msg, 409);
    }
    return jsonError(`Falha ao atualizar: ${msg}`, 500);
  }
}

/**
 * DELETE /api/contact-lists/:id — deleta a lista.
 * CASCADE em contact_list_members trata.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("lista de contatos");
  if (error) return error;
  const ok = deleteContactList(tenantId!, params.id);
  if (!ok) return jsonError("Lista não encontrada", 404);
  return NextResponse.json({ ok: true });
}
