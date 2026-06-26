/**
 * GET /api/admin/tenants/[id]/instance-status
 *
 * Retorna o estado de conexão atual da instância managed do tenant.
 * Atualiza automaticamente evoManagedStatus no DB se mudou.
 *
 * Resposta:
 *   { state: "open" | "close" | "connecting" | null,
 *     managedStatus: "pending" | "provisioning" | "ready" | "connected" | "failed" | null,
 *     managedError: string | null,
 *     error: string | null }
 *
 * Requer: super_admin
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { getManagedInstanceStatus } from "@/server/store/managed-evo";

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
  if (tenant.evoMode !== "managed") {
    return NextResponse.json(
      { error: `Tenant em modo '${tenant.evoMode}' (não-managed).` },
      { status: 400 }
    );
  }

  try {
    const r = await getManagedInstanceStatus(tenant);
    return NextResponse.json({
      state: r.state,
      managedStatus: r.managedStatus,
      managedError: r.managedError,
      error: r.err !== "OK" ? r.err : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao consultar status" },
      { status: 500 }
    );
  }
}
