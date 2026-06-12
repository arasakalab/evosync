import { getDb, schema } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import crypto from "crypto";

export interface InviteRow {
  id: string;
  tenantId: string;
  email: string;
  role: "owner" | "operator";
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdBy: string;
  createdAt: string;
}

function rowToInvite(r: typeof schema.invites.$inferSelect): InviteRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    email: r.email,
    role: r.role as "owner" | "operator",
    token: r.token,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

export function listInvites(opts?: { tenantId?: string; pendingOnly?: boolean }): InviteRow[] {
  const db = getDb();
  let q = db.select().from(schema.invites);
  if (opts?.tenantId) {
    q = q.where(eq(schema.invites.tenantId, opts.tenantId)) as typeof q;
  }
  if (opts?.pendingOnly) {
    q = q.where(isNull(schema.invites.usedAt)) as typeof q;
  }
  return q.orderBy(desc(schema.invites.createdAt)).all().map(rowToInvite);
}

export function getInviteByToken(token: string): InviteRow | null {
  const db = getDb();
  const r = db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.token, token))
    .get();
  return r ? rowToInvite(r) : null;
}

export function getInviteById(id: string): InviteRow | null {
  const db = getDb();
  const r = db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.id, id))
    .get();
  return r ? rowToInvite(r) : null;
}

export interface CreateInviteArgs {
  tenantId: string;
  email: string;
  role: "owner" | "operator";
  createdBy: string;
  expiresInDays?: number; // default 7
}

export function createInvite(args: CreateInviteArgs): InviteRow {
  const db = getDb();
  const id = "inv-" + crypto.randomBytes(12).toString("hex");
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expDays = args.expiresInDays ?? 7;
  const expiresAt = new Date(now.getTime() + expDays * 86400_000).toISOString();

  // Verifica que o tenant existe
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, args.tenantId))
    .get();
  if (!tenant) {
    throw new Error("Tenant não encontrado");
  }

  // Revoga invites pendentes anteriores para o mesmo email+tenant
  db.update(schema.invites)
    .set({ usedAt: new Date().toISOString() }) // marca como "revoked" via usedAt hack
    .where(
      and(
        eq(schema.invites.tenantId, args.tenantId),
        eq(schema.invites.email, args.email),
        isNull(schema.invites.usedAt)
      )
    )
    .run();

  db.insert(schema.invites)
    .values({
      id,
      tenantId: args.tenantId,
      email: args.email,
      role: args.role,
      token,
      expiresAt,
      usedAt: null,
      createdBy: args.createdBy,
      createdAt: now.toISOString(),
    })
    .run();

  return {
    id,
    tenantId: args.tenantId,
    email: args.email,
    role: args.role,
    token,
    expiresAt,
    usedAt: null,
    createdBy: args.createdBy,
    createdAt: now.toISOString(),
  };
}

export function revokeInvite(id: string): boolean {
  const db = getDb();
  const inv = db
    .select()
    .from(schema.invites)
    .where(eq(schema.invites.id, id))
    .get();
  if (!inv) return false;
  if (inv.usedAt) return false; // já usado não pode revogar
  // Marca como "revoked" usando usedAt com sufixo
  db.update(schema.invites)
    .set({ usedAt: "revoked:" + new Date().toISOString() })
    .where(eq(schema.invites.id, id))
    .run();
  return true;
}

export function markInviteUsed(id: string): void {
  const db = getDb();
  db.update(schema.invites)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(schema.invites.id, id))
    .run();
}

export function isInviteValid(inv: InviteRow): { ok: true } | { ok: false; reason: string } {
  if (inv.usedAt) {
    if (inv.usedAt.startsWith("revoked:")) return { ok: false, reason: "Convite revogado" };
    return { ok: false, reason: "Convite já utilizado" };
  }
  if (new Date(inv.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "Convite expirado" };
  }
  return { ok: true };
}
