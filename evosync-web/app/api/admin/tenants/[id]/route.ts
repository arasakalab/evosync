import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/tenants/:id
 * Body: { status: "active" | "suspended" }
 * Super admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { status } = body;
  if (!["active", "suspended", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  const db = getDb();
  const t = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, params.id))
    .get();
  if (!t) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  db.update(schema.tenants)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(schema.tenants.id, params.id))
    .run();
  return NextResponse.json({ ok: true });
}
