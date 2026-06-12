import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getInviteById, revokeInvite } from "@/server/store/invites";
import { logAudit } from "@/server/store/audit";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/invites/:id
 * Revoga um convite pendente. Super admin only.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito ao super admin" }, { status: 403 });
  }
  // Pega o invite ANTES de revogar pra ter o email/tenant no audit
  const target = getInviteById(params.id);
  const ok = revokeInvite(params.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Convite não encontrado ou já utilizado" },
      { status: 404 }
    );
  }
  if (target) {
    logAudit({
      tenantId: target.tenantId,
      userId: session.user.id,
      action: "invite.revoked",
      details: { inviteId: target.id, email: target.email },
    });
  }
  return NextResponse.json({ ok: true });
}
