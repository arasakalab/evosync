/**
 * Seed para testes E2E (FASE 6 do ADR-001).
 *
 * Cria (idempotente) 2 tenants com operator + license de 30 dias:
 *   - Tenant 1: e2e-tenant-1 / operator@e2e.test / e2e1234
 *   - Tenant 2: e2e-tenant-2 / operator2@e2e.test / e2e1234
 *
 * Uso: `npx tsx scripts/seed-e2e.ts`
 */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "../lib/db";
import { hashPassword } from "../lib/password";
import { extendLicense } from "../lib/license";
import { eq } from "drizzle-orm";

const TENANTS = [
  {
    id: "e2e-tenant-1",
    slug: "e2e-empresa-1",
    name: "E2E Empresa 1",
    email: "operator@e2e.test",
    password: "e2e1234",
    userId: "e2e-user-1",
  },
  {
    id: "e2e-tenant-2",
    slug: "e2e-empresa-2",
    name: "E2E Empresa 2",
    email: "operator2@e2e.test",
    password: "e2e1234",
    userId: "e2e-user-2",
  },
] as const;

const SUPER_ADMIN_ID = "258f7f532810490eb17b613433c47089";

async function ensureSuperAdmin(): Promise<string> {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "super_admin"))
    .all();
  if (existing.length > 0) return existing[0].id;

  // Cria um super admin padrão para os testes
  const id = SUPER_ADMIN_ID;
  const passwordHash = await hashPassword("e2e-super-admin");
  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({
      id,
      tenantId: null,
      email: "admin@e2e.test",
      passwordHash,
      name: "E2E Super Admin",
      role: "super_admin",
      status: "active",
      lastLoginAt: null,
      createdAt: now,
    })
    .run();
  return id;
}

async function seedTenant(
  superAdminId: string,
  cfg: (typeof TENANTS)[number]
) {
  const db = getDb();

  // Tenant
  const existingTenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, cfg.id))
    .all();
  if (existingTenant.length === 0) {
    const now = new Date().toISOString();
    db.insert(schema.tenants)
      .values({
        id: cfg.id,
        name: cfg.name,
        slug: cfg.slug,
        status: "active",
        evoUrl: null,
        evoApiKeyEncrypted: null,
        evoInstance: null,
        opencodeModel: "",
        delayMin: 8,
        delayMax: 25,
        dailyLimit: 200,
        resendSent: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // License (30 dias) — extendLicense é idempotente? Não, então checa antes
  const existingLicense = db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.tenantId, cfg.id))
    .all();
  if (existingLicense.length === 0) {
    extendLicense(cfg.id, 30, superAdminId, "E2E seed (30 dias)");
  }

  // User
  const existingUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, cfg.email))
    .all();
  if (existingUser.length === 0) {
    const passwordHash = await hashPassword(cfg.password);
    const now = new Date().toISOString();
    db.insert(schema.users)
      .values({
        id: cfg.userId,
        tenantId: cfg.id,
        email: cfg.email,
        passwordHash,
        name: `Operator ${cfg.name}`,
        role: "operator",
        status: "active",
        lastLoginAt: null,
        createdAt: now,
      })
      .run();
  } else {
    // Atualiza senha (caso o user já exista com hash antigo)
    const passwordHash = await hashPassword(cfg.password);
    db.update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.email, cfg.email))
      .run();
  }
}

async function main() {
  const superAdminId = await ensureSuperAdmin();
  for (const cfg of TENANTS) {
    await seedTenant(superAdminId, cfg);
    console.log(
      `[e2e-seed] ✓ ${cfg.email} / ${cfg.password} (tenant: ${cfg.id})`
    );
  }
  console.log("\n[e2e-seed] Pronto. Credenciais para Playwright:");
  for (const cfg of TENANTS) {
    console.log(`  ${cfg.email} / ${cfg.password}`);
  }
}

main().catch((e) => {
  console.error("[e2e-seed] Erro:", e);
  process.exit(1);
});
