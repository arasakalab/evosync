import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { logAudit } from "@/server/store/audit";
import { revokeManagedTenant } from "@/server/store/managed-evo";
import { logger } from "@/lib/logger";

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
  const prev = t.status;
  db.update(schema.tenants)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(schema.tenants.id, params.id))
    .run();
  if (prev !== status) {
    logAudit({
      tenantId: t.id,
      userId: session.user.id,
      action: status === "active" ? "tenant.activated" : "tenant.suspended",
      details: { from: prev, to: status, name: t.name, slug: t.slug },
    });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/tenants/:id
 * Deleta um tenant e TUDO associado (cascade no schema):
 *  - users, contacts, schedules, sent_log, licenses, invites, audit_log
 *  - Para tenants managed: revoga a instância na Evolution API antes
 *
 * Super admin only. IRREVERSÍVEL.
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
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
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

  // Snapshot pra audit log antes de deletar
  const snapshot = {
    id: t.id,
    name: t.name,
    slug: t.slug,
    evoMode: t.evoMode,
    evoInstance: t.evoInstance,
    pausedByWatchdog: !!t.pausedByWatchdog,
    pausedCount: t.pausedCount,
  };

  // Para tenants managed: revogar a instância na Evolution antes de
  // deletar do DB. Best-effort: se falhar (ex: Evolution offline),
  // continuamos com a deleção do DB pra não bloquear o admin.
  if (t.evoMode === "managed" && t.evoInstance) {
    try {
      const r = await revokeManagedTenant(t, session.user.id);
      logger.info(
        { tenantId: t.id, instance: t.evoInstance, ...r },
        "Instância managed revogada antes de deletar tenant"
      );
    } catch (e: any) {
      logger.error(
        { err: e, tenantId: t.id, instance: t.evoInstance },
        "Falha ao revogar instância managed (continuando deleção do DB)"
      );
      // não propaga — admin não deve ficar bloqueado se Evolution estiver off
    }
  }

  // Deleta o tenant. CASCADE remove users, contacts, schedules,
  // sent_log, licenses, invites, audit_log (FK onDelete: "cascade").
  db.delete(schema.tenants)
    .where(eq(schema.tenants.id, params.id))
    .run();

  logAudit({
    tenantId: null, // tenant já foi deletado
    userId: session.user.id,
    action: "tenant.deleted",
    details: snapshot,
  });

  return NextResponse.json({ ok: true, deleted: snapshot.id });
}
