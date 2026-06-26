/**
 * POST /api/admin/tenants/[id]/revoke
 *
 * Deleta a instância managed do tenant na Evolution central + limpa credenciais.
 * NÃO muda evoMode (continua "managed", pode reprovisionar).
 *
 * Requer: super_admin
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { revokeManagedTenant } from "@/server/store/managed-evo";
import { CENTRAL_EVO_ENABLED } from "@/server/paths";

export const dynamic = "force-dynamic";

export async function POST(
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
  if (!CENTRAL_EVO_ENABLED) {
    return NextResponse.json(
      { error: "Modo managed não configurado no servidor." },
      { status: 503 }
    );
  }
  const tenant = getTenant(params.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  if (tenant.evoMode !== "managed") {
    return NextResponse.json(
      { error: `Tenant em modo '${tenant.evoMode}' (não-managed).` },
      { status: 400 }
    );
  }

  try {
    const r = await revokeManagedTenant(tenant, session.user.id);
    return NextResponse.json(
      {
        ok: r.ok,
        alreadyAbsent: r.alreadyAbsent,
        message: r.message,
      },
      { status: r.ok ? 200 : 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao revogar" },
      { status: 500 }
    );
  }
}
