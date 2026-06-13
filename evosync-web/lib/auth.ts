/**
 * Configuração SERVER-ONLY do NextAuth (roda em Node runtime).
 * Importa a config edge-safe e adiciona o provider Credentials com Drizzle.
 *
 * Usado em:
 *  - API route /api/auth/[...nextauth]/route.ts
 *  - Componentes server (Server Components, Route Handlers)
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { authConfig } from "@/lib/auth.config";
import { logAudit } from "@/server/store/audit";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: "super_admin" | "owner" | "operator";
      tenantId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "super_admin" | "owner" | "operator";
    tenantId?: string | null;
  }

  interface JWT {
    id?: string;
    role?: "super_admin" | "owner" | "operator";
    tenantId?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const email = String(creds.email).toLowerCase().trim();
        const password = String(creds.password);

        // Rate limit por email: 5 tentativas a cada 15 min.
        // Bloqueia brute-force em conta específica.
        const rl = rateLimit({
          key: `login:${email}`,
          limit: 5,
          windowMs: 15 * 60 * 1000,
        });
        if (!rl.ok) {
          logAudit({
            action: "auth.login.rate_limited",
            details: { email, retryAfterSec: rl.retryAfterSec },
          });
          // Lança erro com mensagem; NextAuth exibe na UI via redirect ?error=
          throw new Error("Muitas tentativas. Tente novamente em " + rl.retryAfterSec + "s.");
        }

        const db = getDb();
        const found = db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .all();

        const user = found[0];
        if (!user) {
          logAudit({
            action: "auth.login.failed",
            details: { email, reason: "user_not_found" },
          });
          return null;
        }
        if (user.status !== "active") {
          logAudit({
            tenantId: user.tenantId,
            userId: user.id,
            action: "auth.login.failed",
            details: { email, reason: "user_inactive" },
          });
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          logAudit({
            tenantId: user.tenantId,
            userId: user.id,
            action: "auth.login.failed",
            details: { email, reason: "bad_password" },
          });
          return null;
        }

        // Login OK: reseta o rate limit pra esse email
        resetRateLimit(`login:${email}`);

        // Atualiza last_login_at (best-effort)
        try {
          db.update(schema.users)
            .set({ lastLoginAt: new Date().toISOString() })
            .where(eq(schema.users.id, user.id))
            .run();
        } catch {
          /* best-effort */
        }

        logAudit({
          tenantId: user.tenantId,
          userId: user.id,
          action: "auth.login.success",
          details: { email },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role as "super_admin" | "owner" | "operator",
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role: "super_admin" | "owner" | "operator";
          tenantId: string | null;
        };
        token.id = u.id;
        token.role = u.role;
        token.tenantId = u.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role =
          (token.role as "super_admin" | "owner" | "operator") ?? "operator";
        session.user.tenantId = (token.tenantId as string | null) ?? null;
      }
      return session;
    },
  },
});
