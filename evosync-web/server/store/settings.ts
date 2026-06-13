/**
 * Persistência de settings POR TENANT (SaaS Phase 4).
 *
 * Antes (single-tenant): .env + config.json globais
 * Agora (multi-tenant):
 *   - Credenciais + defaults (delays, daily_limit, etc.) → tabela `tenants`
 *   - Rascunho de mensagem (last_message) → tabela `tenant_settings` (k/v)
 *   - api_key é criptografada com AES-256-GCM (tenants.evoApiKeyEncrypted)
 *     e descriptografada na leitura
 *
 * Funções:
 *   - loadTenantSettings(tenantId) → Settings
 *   - saveTenantSettings(tenantId, s) → Settings (com encrypt da api_key)
 *   - getLastMessage(tenantId) → string
 *   - setLastMessage(tenantId, msg) → void
 */
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import type { Settings } from "@/lib/types";
import { DEFAULT_EVO_URL } from "@/server/paths";
import { logger } from "@/lib/logger";

const defaults: Settings = {
  url: DEFAULT_EVO_URL,
  api_key: "",
  instance: "",
  opencode_model: "",
  delay_min: 8,
  delay_max: 25,
  daily_limit: 200,
  last_message: "",
  resend_sent: true,
};

/**
 * Lê uma setting k/v do tenant_settings. Retorna null se não existir.
 */
function getTenantSetting(tenantId: string, key: string): string | null {
  const db = getDb();
  const row = db
    .select()
    .from(schema.tenantSettings)
    .where(
      and(
        eq(schema.tenantSettings.tenantId, tenantId),
        eq(schema.tenantSettings.key, key)
      )
    )
    .all()[0];
  return row?.value ?? null;
}

/**
 * Salva uma setting k/v do tenant_settings (upsert).
 */
function setTenantSetting(tenantId: string, key: string, value: string): void {
  const db = getDb();
  const existing = getTenantSetting(tenantId, key);
  if (existing === null) {
    db.insert(schema.tenantSettings)
      .values({ tenantId, key, value })
      .run();
  } else {
    db.update(schema.tenantSettings)
      .set({ value })
      .where(
        and(
          eq(schema.tenantSettings.tenantId, tenantId),
          eq(schema.tenantSettings.key, key)
        )
      )
      .run();
  }
}

/**
 * Carrega todas as settings do tenant a partir do DB.
 * Decriptografa a API key automaticamente.
 *
 * @throws se o tenant não existir
 */
export function loadTenantSettings(tenantId: string): Settings {
  if (!tenantId) {
    throw new Error("tenantId é obrigatório pra loadTenantSettings");
  }
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} não encontrado`);
  }

  const lastMessage = getTenantSetting(tenantId, "last_message") ?? "";

  let apiKey = "";
  if (tenant.evoApiKeyEncrypted) {
    try {
      apiKey = decrypt(tenant.evoApiKeyEncrypted);
    } catch (e: any) {
      // ENCRYPTION_KEY mudou ou payload corrompido
      logger.error(
        { tenantId, err: e?.message },
        "Falha ao decriptografar API key"
      );
      apiKey = "";
    }
  }

  const s: Settings = {
    url: tenant.evoUrl || defaults.url,
    api_key: apiKey,
    instance: tenant.evoInstance || "",
    opencode_model: tenant.opencodeModel || defaults.opencode_model,
    delay_min: tenant.delayMin,
    delay_max: tenant.delayMax,
    daily_limit: tenant.dailyLimit,
    last_message: lastMessage || defaults.last_message,
    resend_sent: tenant.resendSent,
  };
  if (s.delay_min < 1) s.delay_min = 1;
  if (s.delay_max < s.delay_min) s.delay_max = s.delay_min;
  return s;
}

/**
 * Salva settings do tenant. Criptografa a api_key se foi alterada.
 *
 * @returns Settings com a api_key descriptografada (a mesma coisa que foi passada)
 */
export function saveTenantSettings(tenantId: string, s: Settings): Settings {
  if (!tenantId) {
    throw new Error("tenantId é obrigatório pra saveTenantSettings");
  }
  const db = getDb();

  // Criptografa a api_key se não estiver vazia
  let apiKeyEncrypted: string | null = null;
  if (s.api_key) {
    try {
      apiKeyEncrypted = encrypt(s.api_key);
    } catch (e: any) {
      throw new Error(
        `Falha ao criptografar api_key (ENCRYPTION_KEY definida?): ${e?.message}`
      );
    }
  }

  const updates: Partial<typeof schema.tenants.$inferInsert> = {
    evoUrl: s.url,
    evoApiKeyEncrypted: apiKeyEncrypted,
    evoInstance: s.instance,
    opencodeModel: s.opencode_model,
    delayMin: s.delay_min,
    delayMax: s.delay_max,
    dailyLimit: s.daily_limit,
    resendSent: s.resend_sent,
    updatedAt: new Date().toISOString(),
  };

  db.update(schema.tenants)
    .set(updates)
    .where(eq(schema.tenants.id, tenantId))
    .run();

  // last_message vai em tenant_settings (k/v)
  if (s.last_message !== undefined) {
    setTenantSetting(tenantId, "last_message", s.last_message);
  }

  // Retorna o estado atual descriptografado
  return loadTenantSettings(tenantId);
}

/**
 * Helpers para last_message (campo mais acessado do que settings completo)
 */
export function getLastMessage(tenantId: string): string {
  return getTenantSetting(tenantId, "last_message") ?? "";
}

export function setLastMessage(tenantId: string, message: string): void {
  setTenantSetting(tenantId, "last_message", message);
}
