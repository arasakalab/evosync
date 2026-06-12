import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, KeyRound, UserPlus, AlertTriangle, Activity } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { eq, desc, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  const db = getDb();
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400_000).toISOString();

  const tenants = db
    .select()
    .from(schema.tenants)
    .orderBy(desc(schema.tenants.createdAt))
    .all();
  const users = db.select().from(schema.users).all();
  const licenses = db.select().from(schema.licenses).all();
  const invites = db
    .select()
    .from(schema.invites)
    .orderBy(desc(schema.invites.createdAt))
    .all();

  const activeLicenses = licenses.filter((l) => l.status === "active");
  const expiringSoon = activeLicenses.filter(
    (l) => l.expiresAt <= in30d && l.expiresAt >= now.toISOString()
  );
  const expired = licenses.filter((l) => l.status === "expired" || l.expiresAt < now.toISOString());

  const recentAudit = db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(10)
    .all();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Tenants"
          value={tenants.length}
          sub={`${tenants.filter((t) => t.status === "active").length} ativos`}
          color="indigo"
        />
        <StatCard
          icon={Users}
          label="Usuários"
          value={users.length}
          sub={`${users.filter((u) => u.role === "operator").length} operators`}
          color="emerald"
        />
        <StatCard
          icon={KeyRound}
          label="Licenças ativas"
          value={activeLicenses.length}
          sub={
            expiringSoon.length > 0
              ? `${expiringSoon.length} expira(m) em <30d`
              : "Todas válidas"
          }
          color={expiringSoon.length > 0 ? "amber" : "emerald"}
          warn={expiringSoon.length > 0}
        />
        <StatCard
          icon={UserPlus}
          label="Convites pendentes"
          value={invites.filter((i) => !i.usedAt).length}
          sub="aguardando aceite"
          color="purple"
        />
      </div>

      {expired.length > 0 && (
        <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              {expired.length} licença(s) expirada(s)
            </CardTitle>
            <CardDescription>
              Os tenants correspondentes estão com acesso bloqueado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/licenses"
              className="text-sm text-red-700 dark:text-red-300 underline"
            >
              Ver e renovar →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenants recentes</CardTitle>
            <CardDescription>Últimos 5 cadastros</CardDescription>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum tenant cadastrado.</p>
            ) : (
              <ul className="space-y-2">
                {tenants.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-slate-500">
                        {t.slug} · {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span
                      className={
                        "text-[10px] px-2 py-0.5 rounded-full font-medium " +
                        (t.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")
                      }
                    >
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>Últimos eventos do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <p className="text-sm text-slate-500">Sem atividade registrada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentAudit.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800"
                  >
                    <Activity className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs">{a.action}</div>
                      {a.details && a.details !== "{}" && (
                        <div className="text-xs text-slate-500 truncate">
                          {a.details}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  warn,
}: {
  icon: any;
  label: string;
  value: number;
  sub: string;
  color: "indigo" | "emerald" | "amber" | "purple";
  warn?: boolean;
}) {
  const colorClass = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
  }[color];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {label}
            </p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className={"text-xs mt-1 " + (warn ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>
              {sub}
            </p>
          </div>
          <div
            className={
              "h-10 w-10 rounded-lg bg-gradient-to-br " + colorClass + " flex items-center justify-center"
            }
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
