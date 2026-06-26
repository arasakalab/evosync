/**
 * POST /api/admin/tenants/[id]/provision
 *
 * Cria uma instância na Evolution API central para um tenant em modo managed.
 * Idempotente: se a instância já existe, re-vincula credenciais.
 *
 * Body: { } (vazio — usa o slug do tenant como nome da instância)
 *
 * Requer: super_admin
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { provisionManagedTenant } from "@/server/store/managed-evo";
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
      {
        error:
          "Modo managed não configurado no servidor. Rode installer/setup_central_evo.sh.",
      },
      { status: 503 }
    );
  }
  const tenant = getTenant(params.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  if (tenant.evoMode !== "managed") {
    return NextResponse.json(
      {
        error: `Tenant em modo '${tenant.evoMode}' (não-managed). Não é possível provisionar.`,
      },
      { status: 400 }
    );
  }

  try {
    const r = await provisionManagedTenant(tenant, session.user.id);
    return NextResponse.json(
      {
        ok: r.ok,
        alreadyExisted: r.alreadyExisted,
        message: r.message,
      },
      { status: r.ok ? 200 : 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao provisionar" },
      { status: 500 }
    );
  }
}
