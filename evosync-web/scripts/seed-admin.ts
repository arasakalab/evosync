/**
 * Cria o super admin global (único por enquanto).
 *
 * Uso:
 *   ENCRYPTION_KEY=... ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=... \
 *     npm run db:seed
 */
import { getDb, schema } from "../lib/db";
import { randomUUID } from "node:crypto";
import { scryptSync, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import * as readline from "node:readline";

const SCRYPT_KEYLEN = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

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

async function main() {
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
    // Se stdin não é TTY (ex: pipe/Echo), aborta automaticamente
    if (!process.stdin.isTTY) {
      console.log("[seed] stdin não é TTY — abortando");
      return;
    }
    const ans = await prompt("Criar outro mesmo assim? (s/N): ");
    if (ans.toLowerCase() !== "s") {
      console.log("[seed] Cancelado");
      return;
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

  db.insert(schema.users)
    .values({
      id,
      // super_admin é global, sem tenant
      tenantId: null,
      email,
      passwordHash: hashPassword(password),
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
  console.log("\n[seed] Use essas credenciais para login no /admin");
}

main().catch((e) => {
  console.error("[seed] Erro:", e);
  process.exit(1);
});
