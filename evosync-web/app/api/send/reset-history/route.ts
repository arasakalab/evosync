import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resetSentLog } from "@/server/store/sent-log";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

/**
 * POST /api/send/reset-history — reseta o histórico do tenant.
 * SaaS Phase 4: escopado por tenantId.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem histórico pra resetar" },
      { status: 403 }
    );
  }
  const removed = resetSentLog(session.user.tenantId);
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: `Histórico de envios resetado (${removed} número(s) removido(s))`,
      level: "warn",
    },
  });
  return NextResponse.json({ removed });
}
