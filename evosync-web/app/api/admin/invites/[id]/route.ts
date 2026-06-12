import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeInvite } from "@/server/store/invites";

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
  const ok = revokeInvite(params.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Convite não encontrado ou já utilizado" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
