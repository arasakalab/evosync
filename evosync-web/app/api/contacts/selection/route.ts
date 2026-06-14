import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
} from "@/lib/api-helpers";
import { getSelection, setSelection } from "@/server/store/contact-selections";

export const dynamic = "force-dynamic";

const PutSelectionSchema = z.object({
  ids: z.array(z.string()),
});

/**
 * GET /api/contacts/selection — retorna a seleção atual do tenant.
 * Se não há row, retorna { ids: [], updatedAt: <agora> }.
 */
export async function GET() {
  const { error, tenantId } = await requireTenantId("seleção de contatos");
  if (error) return error;
  return NextResponse.json(getSelection(tenantId!));
}

/**
 * PUT /api/contacts/selection — SUBSTITUI a seleção inteira.
 *
 * Use POST /api/contacts/bulk-select para adicionar/remover incrementalmente
 * (recomendado para grandes volumes).
 */
export async function PUT(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("seleção de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(PutSelectionSchema, body.data);
  if (!validated.ok) return validated.error;

  const result = setSelection(tenantId!, validated.data.ids);
  return NextResponse.json(result);
}
