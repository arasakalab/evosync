import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { removeAllSchedules } from "@/server/store/schedules";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/schedules/all — remove TODOS os schedules do tenant.
 * SaaS Phase 4: escopado por tenantId.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem schedules" },
      { status: 403 }
    );
  }
  const removed = removeAllSchedules(session.user.tenantId);
  return NextResponse.json({ removed });
}
