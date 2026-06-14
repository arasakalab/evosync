import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import {
  listContactLists,
  createContactList,
} from "@/server/store/contact-lists";

export const dynamic = "force-dynamic";

const CreateListSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().nullable().optional(),
});

/**
 * GET /api/contact-lists — lista todas as listas do tenant (com memberCount).
 */
export async function GET() {
  const { error, tenantId } = await requireTenantId("listas de contatos");
  if (error) return error;
  return NextResponse.json(listContactLists(tenantId!));
}

/**
 * POST /api/contact-lists — cria uma lista.
 * 409 se (tenantId, name) já existe.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("listas de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(CreateListSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const list = createContactList(tenantId!, validated.data);
    return NextResponse.json(list);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Já existe")) {
      return jsonError(msg, 409);
    }
    return jsonError(`Falha ao criar lista: ${msg}`, 500);
  }
}
