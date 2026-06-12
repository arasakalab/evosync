import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearContacts } from "@/server/store/contacts";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/clear — limpa todos os contatos do tenant.
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não pode limpar contatos" },
      { status: 403 }
    );
  }
  const removed = clearContacts(session.user.tenantId);
  return NextResponse.json({ ok: true, removed });
}
