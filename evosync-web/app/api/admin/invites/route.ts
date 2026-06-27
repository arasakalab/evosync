import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createInvite, listInvites } from "@/server/store/invites";
import { logAudit } from "@/server/store/audit";
import { publicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/invites?tenantId=xxx
 * Lista invites. Super admin: vê todos. Outros: 403.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito ao super admin" }, { status: 403 });
  }
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") || undefined;
  const pendingOnly = url.searchParams.get("pending") === "1";
  return NextResponse.json({ invites: listInvites({ tenantId, pendingOnly }) });
}

/**
 * POST /api/admin/invites
 * Body: { tenantId, email, role, expiresInDays? }
 * Cria um convite. Retorna { invite, acceptUrl } para o admin copiar
 * e enviar por email/WhatsApp manualmente.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito ao super admin" }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { tenantId, email, role, expiresInDays } = body;
  if (!tenantId || !email || !role) {
    return NextResponse.json(
      { error: "tenantId, email e role são obrigatórios" },
      { status: 400 }
    );
  }
  if (!["owner", "operator"].includes(role)) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }
  try {
    const inv = createInvite({
      tenantId,
      email: String(email).toLowerCase().trim(),
      role,
      createdBy: session.user.id,
      expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
    });
    logAudit({
      tenantId,
      userId: session.user.id,
      action: "invite.created",
      details: { inviteId: inv.id, email: inv.email, role: inv.role, expiresInDays: inv.expiresAt },
    });
    return NextResponse.json({
      invite: inv,
      acceptUrl: publicAppUrl(`/invite/${inv.token}`, req),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao criar convite" },
      { status: 400 }
    );
  }
}
