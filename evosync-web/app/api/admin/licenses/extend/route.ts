/**
 * API: estende (ou cria) a licença de um tenant.
 * Apenas super_admin pode chamar.
 *
 * POST /api/admin/licenses/extend
 * Body: { tenantId: string, days?: number, notes?: string }
 * Retorna: { license: ActiveLicense }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extendLicense, getActiveLicense, listLicenses } from "@/lib/license";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  days: z.number().int().min(1).max(3650).optional().default(30),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas super_admin pode estender licenças" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verifica que o tenant existe
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, parsed.data.tenantId))
    .all()[0];
  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant não encontrado" },
      { status: 404 }
    );
  }

  try {
    const newLicense = extendLicense(
      parsed.data.tenantId,
      parsed.data.days,
      session.user.id,
      parsed.data.notes
    );
    return NextResponse.json({ license: newLicense });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao estender licença", details: e?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/licenses/extend?tenantId=xxx
 * Lista licenças de um tenant (histórico) + status atual.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Apenas super_admin" }, { status: 403 });
  }

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId é obrigatório" },
      { status: 400 }
    );
  }

  const [licenses, active] = await Promise.all([
    listLicenses(tenantId),
    getActiveLicense(tenantId),
  ]);
  return NextResponse.json({ licenses, active });
}
