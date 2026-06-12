import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sentLogCount } from "@/server/store/sent-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/send/sent-log-count — conta envios do tenant logado.
 * SaaS Phase 4: escopado por tenantId da sessão.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem histórico de envios" },
      { status: 403 }
    );
  }
  return NextResponse.json({ count: sentLogCount(session.user.tenantId) });
}
