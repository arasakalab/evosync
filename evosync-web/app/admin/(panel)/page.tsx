import Link from "next/link";
import {
  Building2,
  Users,
  KeyRound,
  UserPlus,
  AlertTriangle,
  Activity,
  TrendingUp,
  ArrowRight,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { getDb, schema } from "@/lib/db";
import { desc, eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  const db = getDb();
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400_000).toISOString();
  const in7d = new Date(now.getTime() + 7 * 86400_000).toISOString();

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
  const expiringCritically = activeLicenses.filter(
    (l) => l.expiresAt <= in7d && l.expiresAt >= now.toISOString()
  );
  const expired = licenses.filter(
    (l) => l.status === "expired" || l.expiresAt < now.toISOString()
  );

  const recentAudit = db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(8)
    .all();

  // Simple sparkline (fake demo; pode ser substituído por dados reais depois)
  const sparklineData = [12, 18, 15, 22, 28, 24, 32, 38, 42, 45];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visão geral dos tenants, licenças e atividade recente."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/tenants">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tenants"
          value={tenants.length}
          sub={`${tenants.filter((t) => t.status === "active").length} ativos`}
          icon={Building2}
          tone="primary"
          sparkline={sparklineData}
          trend={{ value: 12.5, label: "vs. mês ant." }}
        />
        <StatCard
          label="Usuários"
          value={users.length}
          sub={`${users.filter((u) => u.role === "operator").length} operators`}
          icon={Users}
          tone="info"
          sparkline={[5, 8, 12, 10, 15, 18, 22, 25, 28, 30]}
          trend={{ value: 8.2 }}
        />
        <StatCard
          label="Licenças ativas"
          value={activeLicenses.length}
          sub={
            expiringSoon.length > 0
              ? `${expiringSoon.length} expira(m) em <30d`
              : "Todas válidas"
          }
          icon={KeyRound}
          tone={expiringCritically.length > 0 ? "warning" : "success"}
          sparkline={[20, 22, 25, 24, 28, 30, 32, 35, 38, 40]}
          trend={expiringSoon.length > 0 ? { value: -3.4 } : { value: 4.1 }}
        />
        <StatCard
          label="Convites pendentes"
          value={invites.filter((i) => !i.usedAt).length}
          sub="aguardando aceite"
          icon={UserPlus}
          tone="neutral"
          sparkline={[1, 2, 1, 3, 2, 4, 3, 2, 1, 2]}
        />
      </div>

      {/* Alerta crítico */}
      {expired.length > 0 && (
        <Card
          variant="default"
          className="border-danger/30 bg-danger-subtle/40"
        >
          <CardContent className="p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-subtle ring-1 ring-danger/20">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground font-display">
                {expired.length} licença(s) expirada(s)
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Os tenants correspondentes estão com acesso bloqueado. Renove
                para liberar.
              </p>
            </div>
            <Button variant="destructive" size="sm" asChild>
              <Link href="/admin/licenses">
                Renovar agora
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenants recentes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Tenants recentes</CardTitle>
              <CardDescription>
                Últimos {Math.min(5, tenants.length)} cadastros
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/tenants">
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Nenhum tenant cadastrado"
                description="Crie o primeiro tenant para começar a usar o EvoSync."
                action={
                  <Button asChild>
                    <Link href="/admin/tenants">
                      <Building2 className="h-4 w-4" />
                      Criar tenant
                    </Link>
                  </Button>
                }
                variant="minimal"
              />
            ) : (
              <ul className="divide-y divide-border">
                {tenants.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary font-semibold text-sm">
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {t.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.slug} ·{" "}
                          {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Atividade recente (timeline) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Atividade recente</CardTitle>
              <CardDescription>Últimos eventos</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/audit">
                <Activity className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sem atividade registrada"
                variant="minimal"
              />
            ) : (
              <ul className="space-y-3">
                {recentAudit.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground font-mono">
                        {a.action}
                      </div>
                      {a.details && a.details !== "{}" && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {a.details}
                        </div>
                      )}
                      <div className="text-2xs text-muted-foreground/70 mt-0.5">
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

      {/* Resumo de saúde */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Resumo de saúde
          </CardTitle>
          <CardDescription>
            Indicadores operacionais do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <HealthMetric
              label="Tenants ativos"
              value={`${tenants.filter((t) => t.status === "active").length}/${tenants.length}`}
              status={tenants.length > 0 ? "success" : "neutral"}
            />
            <HealthMetric
              label="Licenças válidas"
              value={`${activeLicenses.length}/${licenses.length}`}
              status={expired.length === 0 ? "success" : "danger"}
            />
            <HealthMetric
              label="Operadores"
              value={users.filter((u) => u.role === "operator").length.toString()}
              status="info"
            />
            <HealthMetric
              label="Convites pendentes"
              value={invites.filter((i) => !i.usedAt).length.toString()}
              status={
                invites.filter((i) => !i.usedAt).length > 5 ? "warning" : "neutral"
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const dotColor = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-muted-foreground",
  }[status];

  return (
    <div className="rounded-lg border border-border bg-surface-alt/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold font-display text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
