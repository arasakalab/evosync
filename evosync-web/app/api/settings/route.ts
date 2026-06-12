import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadTenantSettings, saveTenantSettings } from "@/server/store/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings — settings do tenant do usuário logado.
 * 401 se não autenticado, 403 se super_admin (não tem tenant).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não tem settings de tenant. Use a UI admin." },
      { status: 403 }
    );
  }
  try {
    const s = loadTenantSettings(session.user.tenantId);
    return NextResponse.json(s);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao carregar settings", details: e?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings — atualiza settings do tenant.
 * Mesma regra: precisa estar logado e ter tenantId.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!session.user.tenantId) {
    return NextResponse.json(
      { error: "Super admin não pode editar settings de tenant" },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const current = loadTenantSettings(session.user.tenantId);
    const next = {
      ...current,
      ...body,
      delay_min: Number(body.delay_min ?? current.delay_min) || 8,
      delay_max: Number(body.delay_max ?? current.delay_max) || 25,
      daily_limit: Number(body.daily_limit ?? current.daily_limit) || 200,
    };
    if (next.delay_min < 1) next.delay_min = 1;
    if (next.delay_max < next.delay_min) next.delay_max = next.delay_min;

    const saved = saveTenantSettings(session.user.tenantId, next);
    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao salvar settings", details: e?.message },
      { status: 500 }
    );
  }
}
