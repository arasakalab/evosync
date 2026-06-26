/**
 * Store de tenants — Fase 4 (multi-tenant) + helpers públicos.
 *
 * Funções:
 *  - listTenants() / getTenant() / getTenantBySlug() — leitura
 *  - suspendTenant() / activateTenant() / upsertTenant() — admin (uso futuro)
 *
 * A landing pública /promocoes/[slug] usa `getTenantBySlug()` para resolver
 * qual tenant recebe o cadastro. O slug é único por tenant (índice único).
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import type { Tenant } from "@/lib/db/schema";

export function listTenants(): Tenant[] {
  const db = getDb();
  return db.select().from(schema.tenants).all();
}

export function getTenant(id: string): Tenant | null {
  if (!id) return null;
  const db = getDb();
  const row = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, id))
    .all()[0];
  return row ?? null;
}

/**
 * Resolve tenant pelo slug (URL pública).
 * Retorna null se não existir. Não filtra por status — a caller decide.
 */
export function getTenantBySlug(slug: string): Tenant | null {
  if (!slug) return null;
  const db = getDb();
  const row = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .all()[0];
  return row ?? null;
}

export interface UpsertTenantInput {
  id?: string;
  name: string;
  slug: string;
  status?: "active" | "suspended" | "cancelled";
}

export function upsertTenant(input: UpsertTenantInput): Tenant {
  const db = getDb();
  const id = input.id || randomUUID().replace(/-/g, "");
  const existing = db
    .select()
    .from(schema.tenants)
    .where(
      and(
        eq(schema.tenants.slug, input.slug),
        input.id ? eq(schema.tenants.id, input.id) : undefined
      )
    )
    .all()[0];

  if (existing) {
    db.update(schema.tenants)
      .set({
        name: input.name,
        status: input.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.tenants.id, existing.id))
      .run();
    return { ...existing, name: input.name, status: input.status ?? existing.status };
  }

  db.insert(schema.tenants)
    .values({
      id,
      name: input.name,
      slug: input.slug,
      status: input.status ?? "active",
    })
    .run();
  const created = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, id))
    .all()[0];
  return created!;
}

export function suspendTenant(id: string): boolean {
  const db = getDb();
  const r = db
    .update(schema.tenants)
    .set({ status: "suspended", updatedAt: new Date().toISOString() })
    .where(eq(schema.tenants.id, id))
    .run();
  return (r.changes ?? 0) > 0;
}

export function activateTenant(id: string): boolean {
  const db = getDb();
  const r = db
    .update(schema.tenants)
    .set({ status: "active", updatedAt: new Date().toISOString() })
    .where(eq(schema.tenants.id, id))
    .run();
  return (r.changes ?? 0) > 0;
}
