import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getInviteByToken,
  isInviteValid,
  markInviteUsed,
} from "@/server/store/invites";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/server/store/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/invites/accept
 * Body: { token, name, password }
 * Cria o user (operator/owner) no tenant, marca o invite como usado,
 * retorna ok. O front redireciona pra /admin/login pra o user logar.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { token, name, password } = body;
  if (!token || !name || !password) {
    return NextResponse.json(
      { error: "token, name e password são obrigatórios" },
      { status: 400 }
    );
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: "Senha deve ter pelo menos 8 caracteres" },
      { status: 400 }
    );
  }

  const inv = getInviteByToken(String(token));
  if (!inv) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }
  const valid = isInviteValid(inv);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.reason }, { status: 410 });
  }

  const db = getDb();

  // Verifica se já existe user com esse email no tenant
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, inv.email))
    .all();
  const inThisTenant = existing.find((u) => u.tenantId === inv.tenantId);
  if (inThisTenant) {
    return NextResponse.json(
      { error: "Já existe um usuário com este email neste tenant" },
      { status: 409 }
    );
  }

  // Tenant precisa estar active
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, inv.tenantId))
    .get();
  if (!tenant || tenant.status !== "active") {
    return NextResponse.json(
      { error: "Tenant inativo ou não encontrado" },
      { status: 403 }
    );
  }

  const userId = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pwHash = await hashPassword(String(password));
  const now = new Date().toISOString();

  db.insert(schema.users)
    .values({
      id: userId,
      tenantId: inv.tenantId,
      email: inv.email,
      passwordHash: pwHash,
      name: String(name).trim(),
      role: inv.role,
      status: "active",
      createdAt: now,
    })
    .run();

  markInviteUsed(inv.id);

  logAudit({
    tenantId: inv.tenantId,
    userId,
    action: "user.created_via_invite",
    details: { email: inv.email, role: inv.role, name: String(name).trim() },
  });

  return NextResponse.json({
    ok: true,
    email: inv.email,
    tenantName: tenant.name,
  });
}
