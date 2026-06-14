import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireTenantId,
  parseJsonBody,
  validateWith,
  jsonError,
} from "@/lib/api-helpers";
import { bulkToggleSelection, getSelection } from "@/server/store/contact-selections";

export const dynamic = "force-dynamic";

const BulkSelectSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  selected: z.boolean(),
});

/**
 * POST /api/contacts/bulk-select
 *
 * Body: { ids: string[], selected: boolean }
 *  - selected=true: adiciona ids ao Set atual (sem duplicar)
 *  - selected=false: remove ids do Set
 *
 * Limitado a 1000 ids por chamada (caller faz batching se precisar mais).
 *
 * Resposta: { ids: string[], total: number }  (Set final)
 */
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenantId("seleção de contatos");
  if (error) return error;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.error;
  const validated = validateWith(BulkSelectSchema, body.data);
  if (!validated.ok) return validated.error;

  try {
    const result = bulkToggleSelection(
      tenantId!,
      validated.data.ids,
      validated.data.selected
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return jsonError(`Falha no bulk-select: ${e?.message || e}`, 400);
  }
}
