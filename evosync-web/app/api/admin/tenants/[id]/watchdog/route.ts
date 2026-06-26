/**
 * GET /api/admin/tenants/[id]/watchdog
 *
 * Retorna o status do watchdog do tenant (pausado ou não).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const tenant = getTenant(params.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    paused: !!tenant.pausedByWatchdog,
    reason: tenant.pausedReason,
    at: tenant.pausedAt,
    count: tenant.pausedCount ?? 0,
  });
}
