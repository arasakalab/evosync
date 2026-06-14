import { NextResponse } from "next/server";
import { requireTenantId } from "@/lib/api-helpers";
import { clearContacts } from "@/server/store/contacts";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/clear — limpa todos os contatos do tenant.
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function POST() {
  const { error, tenantId } = await requireTenantId("limpar contatos");
  if (error) return error;
  const removed = clearContacts(tenantId!);
  return NextResponse.json({ ok: true, removed });
}
