import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import {
  addListMembers,
  removeListMembers,
  getContactListMembers,
} from "@/server/store/contact-lists";

export const dynamic = "force-dynamic";

const ModifyMembersSchema = z.object({
  contact_ids: z.array(z.string().min(1)).min(1).max(1000),
});

/**
 * GET /api/contact-lists/:id/members — lista contact_ids membros.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("membros da lista");
  if (error) return error;
  return NextResponse.json(getContactListMembers(tenantId!, params.id));
}

/**
 * POST /api/contact-lists/:id/members — adiciona membros.
 * Sincroniza contacts.lists denormalizado.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("membros da lista");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(ModifyMembersSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const result = addListMembers(
      tenantId!,
      params.id,
      validated.data.contact_ids
    );
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("não encontrada")) return jsonError(msg, 404);
    return jsonError(`Falha ao adicionar membros: ${msg}`, 500);
  }
}

/**
 * DELETE /api/contact-lists/:id/members — remove membros.
 * Sincroniza contacts.lists denormalizado.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenantId("membros da lista");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(ModifyMembersSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const result = removeListMembers(
      tenantId!,
      params.id,
      validated.data.contact_ids
    );
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("não encontrada")) return jsonError(msg, 404);
    return jsonError(`Falha ao remover membros: ${msg}`, 500);
  }
}
