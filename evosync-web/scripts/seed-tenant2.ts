import { getDb, schema } from "../lib/db";
import { hashPassword } from "../lib/password";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();

// === Check if tenant 2 already exists ===
const existing = db
  .select()
  .from(schema.tenants)
  .where(eq(schema.tenants.slug, "outra-empresa"))
  .all();

if (existing.length) {
  console.log("Tenant 2 already exists, removing...");
  for (const t of existing) {
    db.delete(schema.users).where(eq(schema.users.tenantId, t.id)).run();
    db.delete(schema.licenses).where(eq(schema.licenses.tenantId, t.id)).run();
    db.delete(schema.contacts).where(eq(schema.contacts.tenantId, t.id)).run();
    db.delete(schema.schedules).where(eq(schema.schedules.tenantId, t.id)).run();
    db.delete(schema.sentLog).where(eq(schema.sentLog.tenantId, t.id)).run();
    db.delete(schema.tenantSettings).where(eq(schema.tenantSettings.tenantId, t.id)).run();
    db.delete(schema.tenants).where(eq(schema.tenants.id, t.id)).run();
  }
}

const tenantId = "t2-isolation-test";
const now = new Date().toISOString();

// === Create tenant 2 ===
db.insert(schema.tenants)
  .values({
    id: tenantId,
    name: "Outra Empresa",
    slug: "outra-empresa",
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

// === License 30 days ===
const exp = new Date(Date.now() + 30 * 86400_000).toISOString();
db.insert(schema.licenses)
  .values({
    id: "lic-" + tenantId,
    tenantId,
    issuedAt: now,
    expiresAt: exp,
    status: "active",
    notes: "Phase 4 isolation test",
    createdBy: "258f7f532810490eb17b613433c47089",
  })
  .run();

// === Operator 2 ===
const userId = "u2-isolation-test";
const pw = await hashPassword("teste123");
db.insert(schema.users)
  .values({
    id: userId,
    tenantId,
    email: "operator2@isolation.test",
    passwordHash: pw,
    name: "Operator 2",
    role: "operator",
    status: "active",
    createdAt: now,
  })
  .run();

console.log(`Tenant 2 created: ${tenantId}`);
console.log(`Operator 2: operator2@isolation.test / teste123`);
console.log(`License expires: ${exp}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
