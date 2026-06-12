import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminShell from "@/components/admin/admin-shell";
import { getDb, schema } from "@/lib/db";
import { count, eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Layout do painel admin (super_admin only). Aplica sidebar + topbar
 * e verifica permissão. O /admin/login fica FORA deste group, então
 * não herda este chrome.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  if (session.user.role !== "super_admin") {
    redirect("/?error=forbidden");
  }

  const db = getDb();
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400_000).toISOString();
  const in7d = new Date(now.getTime() + 7 * 86400_000).toISOString();

  const [tenants] = db
    .select({ c: count() })
    .from(schema.tenants)
    .all();

  const [activeTenants] = db
    .select({ c: count() })
    .from(schema.tenants)
    .where(eq(schema.tenants.status, "active"))
    .all();

  const [users] = db.select({ c: count() }).from(schema.users).all();

  const [expiringLicenses] = db
    .select({ c: count() })
    .from(schema.licenses)
    .where(
      and(
        eq(schema.licenses.status, "active"),
        gte(schema.licenses.expiresAt, now.toISOString()),
        // expirando em 30d: expiresAt <= now+30d
        // usamos um hack via subquery não — faremos no SQL puro
      )
    )
    .all();

  // contagem "expiring soon" via fetch
  const allActive = db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.status, "active"))
    .all();
  const expiringSoon = allActive.filter(
    (l) => l.expiresAt <= in30d && l.expiresAt >= now.toISOString()
  ).length;
  const expiringCritically = allActive.filter(
    (l) => l.expiresAt <= in7d && l.expiresAt >= now.toISOString()
  ).length;

  const [pendingInvites] = db
    .select({ c: count() })
    .from(schema.invites)
    .where(eq(schema.invites.usedAt, null as any))
    .all();

  return (
    <AdminShell
      user={{ email: session.user.email, name: session.user.name || session.user.email }}
      stats={{
        tenants: tenants?.c ?? 0,
        activeTenants: activeTenants?.c ?? 0,
        users: users?.c ?? 0,
        expiringSoon,
        expiringCritically,
        pendingInvites: pendingInvites?.c ?? 0,
      }}
    >
      {children}
    </AdminShell>
  );
}
