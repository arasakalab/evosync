/**
 * Cria o super admin global (único por enquanto).
 *
 * Uso:
 *   ENCRYPTION_KEY=... ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=... \
 *     npm run db:seed
 *
 * Se DEMO_TENANT=1 (ou via prompt), também cria:
 *   - 1 tenant de teste ("Empresa Demo")
 *   - 1 license de 30 dias
 *   - 1 usuário operator (operator@demo.test / demo123)
 *   - Permite testar o fluxo de license expirada
 */
import { getDb, schema } from "../lib/db";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../lib/password";
import { extendLicense } from "../lib/license";
import { eq } from "drizzle-orm";
import * as readline from "node:readline";

async function prompt(question: string, hidden = false): Promise<string> {
  if (hidden) {
    process.stdout.write(question);
    return new Promise((resolve) => {
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (ch) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r" || c === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(input);
        } else if (c === "\u0003") {
          process.exit(1);
        } else if (c === "\u007f" || c === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += c;
          process.stdout.write("*");
        }
      });
    });
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(question, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function seedSuperAdmin(): Promise<string> {
  const db = getDb();

  // Verifica se já existe super admin
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "super_admin"))
    .all();

  if (existing.length > 0) {
    console.log(`[seed] Já existe(m) ${existing.length} super admin(s):`);
    for (const u of existing) {
      console.log(`  - ${u.email} (criado em ${u.createdAt})`);
    }
    if (!process.stdin.isTTY) {
      console.log("[seed] stdin não é TTY — usando o primeiro existente");
      return existing[0].id;
    }
    const ans = await prompt("Criar outro mesmo assim? (s/N): ");
    if (ans.toLowerCase() !== "s") {
      return existing[0].id;
    }
  }

  const email = process.env.ADMIN_EMAIL || (await prompt("Email do admin: "));
  const password =
    process.env.ADMIN_PASSWORD ||
    (await prompt("Senha (mín. 8 chars): ", true));

  if (!email.includes("@")) {
    console.error("[seed] Email inválido");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("[seed] Senha deve ter no mínimo 8 caracteres");
    process.exit(1);
  }

  // Verifica email duplicado
  const dup = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .all();
  if (dup.length > 0) {
    console.error(`[seed] Email ${email} já está em uso`);
    process.exit(1);
  }

  const id = randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  db.insert(schema.users)
    .values({
      id,
      tenantId: null,
      email,
      passwordHash,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
      lastLoginAt: null,
      createdAt: now,
    })
    .run();

  console.log(`[seed] ✓ Super admin criado:`);
  console.log(`  Email: ${email}`);
  console.log(`  ID: ${id}`);
  return id;
}

async function seedDemoTenant(superAdminId: string) {
  const db = getDb();
  console.log("\n[seed] Criando tenant demo + license + operator de teste...");

  // Verifica se já existe
  const existing = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "empresa-demo"))
    .all();
  if (existing.length > 0) {
    console.log("[seed] Tenant demo já existe, pulando");
    return;
  }

  const tenantId = randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const operatorEmail = "operator@demo.test";
  const operatorPassword = "demo123";

  // Tenant
  db.insert(schema.tenants)
    .values({
      id: tenantId,
      name: "Empresa Demo",
      slug: "empresa-demo",
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

  // License de 30 dias
  extendLicense(tenantId, 30, superAdminId, "Demo seed (30 dias)");

  // Operator user
  const operatorHash = await hashPassword(operatorPassword);
  db.insert(schema.users)
    .values({
      id: randomUUID().replace(/-/g, ""),
      tenantId,
      email: operatorEmail,
      passwordHash: operatorHash,
      name: "Operator Demo",
      role: "operator",
      status: "active",
      lastLoginAt: null,
      createdAt: now,
    })
    .run();

  console.log(`[seed] ✓ Tenant demo criado:`);
  console.log(`  Slug: empresa-demo`);
  console.log(`  ID: ${tenantId}`);
  console.log(`  License: 30 dias (ativa até ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")})`);
  console.log(`  Operator: ${operatorEmail} / ${operatorPassword}`);
}

async function seedPromoTenant(superAdminId: string) {
  const db = getDb();
  console.log("\n[seed] Criando tenant 'Extra Atacarejo' (landing /promocoes/extra-atacarejo)...");

  // Verifica se já existe
  const existing = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "extra-atacarejo"))
    .all();
  if (existing.length > 0) {
    console.log("[seed] Tenant Extra Atacarejo já existe, pulando");
    return;
  }

  const tenantId = randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();

  // Tenant
  db.insert(schema.tenants)
    .values({
      id: tenantId,
      name: "Extra Atacarejo",
      slug: "extra-atacarejo",
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

  // License de 30 dias
  extendLicense(tenantId, 30, superAdminId, "Promo seed (30 dias)");

  console.log(`[seed] ✓ Tenant Extra Atacarejo criado:`);
  console.log(`  Slug: extra-atacarejo`);
  console.log(`  URL:  /promocoes/extra-atacarejo`);
  console.log(`  ID:   ${tenantId}`);
}

async function main() {
  const superAdminId = await seedSuperAdmin();

  // Demo tenant (se DEMO_TENANT=1 ou interativo + prompt s/n)
  let createDemo = process.env.DEMO_TENANT === "1";
  if (!createDemo && process.stdin.isTTY) {
    const ans = await prompt("\nCriar tenant de demo (com operator + license de 30d)? (s/N): ");
    createDemo = ans.toLowerCase() === "s";
  }
  if (createDemo) {
    await seedDemoTenant(superAdminId);
  }

  // Tenant da landing pública de promoções (idempotente)
  let createPromo = process.env.PROMO_TENANT === "1";
  if (!createPromo && process.stdin.isTTY) {
    const ans = await prompt("\nCriar tenant 'Extra Atacarejo' (landing /promocoes/extra-atacarejo)? (s/N): ");
    createPromo = ans.toLowerCase() === "s";
  }
  if (createPromo) {
    await seedPromoTenant(superAdminId);
  }

  console.log("\n[seed] ✓ Tudo pronto!");
  console.log("\n[seed] Credenciais:");
  console.log("  Super admin: <email que você definiu>");
  console.log("  Operator:    operator@demo.test / demo123");
  console.log("  Landing:     /promocoes/extra-atacarejo");
}

main().catch((e) => {
  console.error("[seed] Erro:", e);
  process.exit(1);
});
