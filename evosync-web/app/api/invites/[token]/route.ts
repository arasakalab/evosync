import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getInviteByToken, isInviteValid } from "@/server/store/invites";

export const dynamic = "force-dynamic";

/**
 * GET /api/invites/:token
 * Retorna info do convite (email, tenant) sem expor dados sensíveis.
 * Público — token é o "segredo". Retorna 410 se inválido.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const inv = getInviteByToken(params.token);
  if (!inv) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }
  const valid = isInviteValid(inv);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.reason }, { status: 410 });
  }
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, inv.tenantId))
    .get();
  return NextResponse.json({
    invite: {
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
    },
    tenantName: tenant?.name || "Desconhecido",
  });
}
