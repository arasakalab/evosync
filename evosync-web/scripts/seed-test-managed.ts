/**
 * Seed rápido: cria tenant "Padaria Teste" em modo managed, já provisionado.
 * Use: npx tsx scripts/seed-test-managed.ts
 */
import { getDb, schema } from "../lib/db";
import { eq } from "drizzle-orm";
import { logAudit } from "../server/store/audit";
import { provisionManagedTenant } from "../server/store/managed-evo";
import { hashPassword } from "../lib/password";
import crypto from "node:crypto";

async function main() {
  const db = getDb();

  // 0. Pega um super_admin existente pra usar como createdBy
  const admin = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "super_admin"))
    .all()[0];
  if (!admin) {
    console.error("✗ Nenhum super_admin encontrado. Rode scripts/seed-admin.ts primeiro.");
    process.exit(1);
  }
  console.log("Usando super_admin:", admin.email);

  // 1. Verifica se já existe
  const existing = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "padaria-teste"))
    .all();
  if (existing.length > 0) {
    console.log("Tenant padaria-teste já existe, pulando");
    console.log("  id:", existing[0].id);
    console.log("  status:", existing[0].evoManagedStatus);
    console.log("  instance:", existing[0].evoInstance);
    process.exit(0);
  }

  // 2. Cria tenant em modo managed
  const tenantId = "t-" + crypto.randomBytes(6).toString("hex");
  const now = new Date().toISOString();
  const days = 30;
  const exp = new Date(Date.now() + days * 86400_000).toISOString();

  db.insert(schema.tenants)
    .values({
      id: tenantId,
      name: "Padaria Teste",
      slug: "padaria-teste",
      status: "active",
      evoUrl: null,
      evoApiKeyEncrypted: null,
      evoInstance: null,
      evoMode: "managed",
      evoManagedStatus: "pending",
      evoManagedError: null,
      pausedByWatchdog: false,
      pausedReason: null,
      pausedAt: null,
      pausedCount: 0,
      opencodeModel: "",
      delayMin: 8,
      delayMax: 25,
      dailyLimit: 200,
      resendSent: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  console.log("✓ Tenant criado:", tenantId);

  // 3. License
  db.insert(schema.licenses)
    .values({
      id: "lic-" + tenantId,
      tenantId,
      issuedAt: now,
      expiresAt: exp,
      status: "active",
      notes: "Teste local",
      createdBy: admin.id,
    })
    .run();

  // 4. Operator user
  const userId = "u-" + crypto.randomBytes(6).toString("hex");
  const hash = await hashPassword("teste1234");
  db.insert(schema.users)
    .values({
      id: userId,
      tenantId,
      email: "ze@padaria.test",
      passwordHash: hash,
      name: "Zé da Padaria",
      role: "owner",
      status: "active",
      createdAt: now,
    })
    .run();
  console.log("✓ Operator: ze@padaria.test / teste1234");

  // 5. Provisiona managed
  const t = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];
  const r = await provisionManagedTenant(t, admin.id);
  console.log("✓ Provision:", r);

  // 6. Verifica
  const final = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];
  console.log("✓ Final state:", {
    evoMode: final.evoMode,
    evoManagedStatus: final.evoManagedStatus,
    hasInstance: !!final.evoInstance,
    hasUrl: !!final.evoUrl,
    hasKey: !!final.evoApiKeyEncrypted,
    instanceName: final.evoInstance,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  });
