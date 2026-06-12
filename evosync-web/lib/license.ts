/**
 * Helpers de licença por tenant.
 *
 * Regras (Fase 3):
 *  - Cada tenant tem 0..N licenças
 *  - Uma licença é considerada "ativa" se:
 *    1) status === 'active'
 *    2) expires_at > now
 *  - Licenças revidadas (status='revoked') ou expiradas (status='expired') não contam
 *  - Ao estender, criamos uma NOVA license e a anterior vira 'expired'
 *
 * Próximas fases (não implementadas aqui):
 *  - Stripe billing
 *  - Grace period
 *  - Email reminders antes do vencimento
 */
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const LICENSE_DAYS_DEFAULT = 30;

export interface ActiveLicense {
  id: string;
  tenantId: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  notes: string | null;
}

/**
 * Retorna a license ATIVA mais recente do tenant, ou null.
 * Atende os critérios: status='active' E expires_at > now.
 */
export async function getActiveLicense(
  tenantId: string
): Promise<ActiveLicense | null> {
  if (!tenantId) return null;
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db
    .select()
    .from(schema.licenses)
    .where(
      and(
        eq(schema.licenses.tenantId, tenantId),
        eq(schema.licenses.status, "active"),
        gt(schema.licenses.expiresAt, now)
      )
    )
    .orderBy(desc(schema.licenses.expiresAt))
    .limit(1)
    .all();
  return (rows[0] as ActiveLicense | undefined) ?? null;
}

/**
 * Retorna a license mais recente do tenant (qualquer status).
 * Útil pra mostrar "última licença venceu em X" na tela de license-expired.
 */
export async function getLatestLicense(
  tenantId: string
): Promise<ActiveLicense | null> {
  if (!tenantId) return null;
  const db = getDb();
  const rows = db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.tenantId, tenantId))
    .orderBy(desc(schema.licenses.expiresAt))
    .limit(1)
    .all();
  return (rows[0] as ActiveLicense | undefined) ?? null;
}

/**
 * Verifica rapidamente se o tenant tem license ativa.
 * Usado no middleware/layout pra decidir se redireciona.
 */
export async function isLicenseValid(tenantId: string): Promise<boolean> {
  const license = await getActiveLicense(tenantId);
  return license !== null;
}

/**
 * Cria uma nova license e marca as anteriores como 'expired'.
 * Retorna a nova license criada.
 *
 * @param tenantId  tenant que vai receber a extensão
 * @param days      dias de duração (default 30)
 * @param createdBy id do super_admin que emitiu
 * @param notes     opcional (ex: "Pago via Pix em 12/06")
 */
export function extendLicense(
  tenantId: string,
  days: number = LICENSE_DAYS_DEFAULT,
  createdBy: string,
  notes?: string
): ActiveLicense {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const id = crypto.randomUUID().replace(/-/g, "");
  const issuedAtIso = now.toISOString();
  const expiresAtIso = expiresAt.toISOString();

  // Marca licenças anteriores como 'expired' (best-effort)
  try {
    db.update(schema.licenses)
      .set({ status: "expired" })
      .where(
        and(
          eq(schema.licenses.tenantId, tenantId),
          inArray(schema.licenses.status, ["active"])
        )
      )
      .run();
  } catch {
    /* best-effort */
  }

  db.insert(schema.licenses)
    .values({
      id,
      tenantId,
      issuedAt: issuedAtIso,
      expiresAt: expiresAtIso,
      status: "active",
      notes: notes ?? null,
      createdBy,
    })
    .run();

  return {
    id,
    tenantId,
    issuedAt: issuedAtIso,
    expiresAt: expiresAtIso,
    status: "active",
    notes: notes ?? null,
  };
}

/**
 * Lista todas as licenças do tenant (histórico).
 * Ordenadas da mais recente pra mais antiga.
 */
export async function listLicenses(
  tenantId: string
): Promise<ActiveLicense[]> {
  if (!tenantId) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.tenantId, tenantId))
    .orderBy(desc(schema.licenses.expiresAt))
    .all() as ActiveLicense[];
}
