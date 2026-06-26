/**
 * Managed central Evolution (Fase B) — provision/QR/revoke por tenant.
 *
 * Cada tenant managed ganha 1 instância lógica dentro da Evolution API
 * centralizada (que o SaaS provider hospeda). Esta camada encapsula:
 *
 *  1. provisionManagedTenant(tenant) — cria instância + grava creds no DB
 *  2. revokeManagedTenant(tenant)     — deleta instância + limpa creds
 *  3. getManagedInstanceStatus(tenant) — consulta estado na Evolution
 *
 * As credenciais armazenadas no tenant são SEMPRE da Evolution central
 * (single-tenant) — o tenant não vê nem escolhe a URL/key. Elas são
 * criptografadas com AES-256-GCM via `lib/crypto.ts` antes de ir pro DB.
 *
 * Idempotência:
 *  - provision: se a instância já existe (403/409), trata como sucesso.
 *  - revoke: se já não existe (404), trata como sucesso.
 *
 * Erros:
 *  - Se `CENTRAL_EVO_ENABLED` for false, lança erro com instrução clara.
 *  - Erros da Evolution são logados em evoManagedError e em audit log.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  CENTRAL_EVO_ENABLED,
  CENTRAL_EVO_URL,
  CENTRAL_EVO_APIKEY,
  getCentralEvoClient,
} from "@/server/paths";
import { logger } from "@/lib/logger";
import { logAudit } from "@/server/store/audit";
import type { Tenant } from "@/lib/db/schema";

export interface ManagedProvisionResult {
  ok: boolean;
  alreadyExisted: boolean;
  message: string;
}

/**
 * Provisiona 1 instância na Evolution central para o tenant.
 *
 * Comportamento:
 *  - Valida que CENTRAL_EVO_ENABLED é true.
 *  - Valida que tenant.evoMode = "managed" (se não, aborta).
 *  - Define status = "provisioning" no DB.
 *  - Chama EvoClient.createInstance(tenant.slug).
 *  - Em sucesso: grava URL/key criptografada + status = "ready".
 *  - Em "já existe": trata como idempotente, ainda grava credenciais.
 *  - Em erro: grava status = "failed" + evoManagedError.
 *
 * Audit log: "tenant.provisioned" (sucesso) ou "tenant.provision_failed".
 */
export async function provisionManagedTenant(
  tenant: Tenant,
  actorUserId?: string | null
): Promise<ManagedProvisionResult> {
  if (!CENTRAL_EVO_ENABLED) {
    throw new Error(
      "Modo managed não está configurado no servidor. Defina " +
        "EVOLUTION_CENTRAL_URL e EVOLUTION_CENTRAL_APIKEY no .env e rode " +
        "installer/setup_central_evo.sh."
    );
  }
  if (tenant.evoMode !== "managed") {
    throw new Error(
      `Tenant ${tenant.id} não está em modo managed (evoMode=${tenant.evoMode}).`
    );
  }

  const db = getDb();
  const instanceName = tenant.slug;

  // 1) Marca como "provisioning" imediatamente (otimista)
  db.update(schema.tenants)
    .set({
      evoManagedStatus: "provisioning",
      evoManagedError: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenant.id))
    .run();

  // 2) Chama Evolution
  const client = getCentralEvoClient();
  let result: { ok: boolean; info: string; data?: any };
  try {
    result = await client.createInstance(instanceName);
  } catch (e: any) {
    const msg = `Exceção ao criar instância: ${e?.message || e}`;
    logger.error({ tenantId: tenant.id, err: e }, msg);
    db.update(schema.tenants)
      .set({
        evoManagedStatus: "failed",
        evoManagedError: msg,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.tenants.id, tenant.id))
      .run();
    logAudit({
      tenantId: tenant.id,
      userId: actorUserId ?? null,
      action: "tenant.provision_failed",
      details: { error: msg, instance: instanceName },
    });
    return { ok: false, alreadyExisted: false, message: msg };
  }

  // 3) Sucesso OU já existe → grava credenciais e status
  const alreadyExisted = !result.ok && /já existe/i.test(result.info);
  if (result.ok || alreadyExisted) {
    // Criptografa a API key central antes de persistir
    let encryptedKey: string;
    try {
      encryptedKey = encrypt(CENTRAL_EVO_APIKEY);
    } catch (e: any) {
      const msg = `Falha ao criptografar API key: ${e?.message || e}`;
      logger.error({ tenantId: tenant.id, err: e }, msg);
      db.update(schema.tenants)
        .set({
          evoManagedStatus: "failed",
          evoManagedError: msg,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.tenants.id, tenant.id))
        .run();
      return { ok: false, alreadyExisted, message: msg };
    }

    db.update(schema.tenants)
      .set({
        evoUrl: CENTRAL_EVO_URL,
        evoApiKeyEncrypted: encryptedKey,
        evoInstance: instanceName,
        evoManagedStatus: "ready",
        evoManagedError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.tenants.id, tenant.id))
      .run();

    logAudit({
      tenantId: tenant.id,
      userId: actorUserId ?? null,
      action: alreadyExisted
        ? "tenant.provision_idempotent"
        : "tenant.provisioned",
      details: {
        instance: instanceName,
        url: CENTRAL_EVO_URL,
        alreadyExisted,
      },
    });

    return {
      ok: true,
      alreadyExisted,
      message: alreadyExisted
        ? "Instância já existia na Evolution; credenciais re-vinculadas."
        : "Instância criada com sucesso.",
    };
  }

  // 4) Erro real (≠ "já existe")
  const msg = result.info;
  logger.warn({ tenantId: tenant.id, info: msg }, "Falha ao provisionar managed");
  db.update(schema.tenants)
    .set({
      evoManagedStatus: "failed",
      evoManagedError: msg,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenant.id))
    .run();
  logAudit({
    tenantId: tenant.id,
    userId: actorUserId ?? null,
    action: "tenant.provision_failed",
    details: { error: msg, instance: instanceName },
  });
  return { ok: false, alreadyExisted: false, message: msg };
}

export interface ManagedRevokeResult {
  ok: boolean;
  alreadyAbsent: boolean;
  message: string;
}

/**
 * Revoga a instância managed do tenant: deleta da Evolution + limpa creds.
 *
 * Comportamento:
 *  - Se o tenant não tem evoInstance setado, no-op.
 *  - Chama EvoClient.deleteInstance(slug) — 404 é tratado como sucesso.
 *  - Limpa evoUrl/evoApiKeyEncrypted/evoInstance/evoManagedStatus/Error no DB.
 *  - NÃO muda evoMode (continua "managed", pode reprovisionar).
 *
 * Audit log: "tenant.revoked".
 */
export async function revokeManagedTenant(
  tenant: Tenant,
  actorUserId?: string | null
): Promise<ManagedRevokeResult> {
  if (!CENTRAL_EVO_ENABLED) {
    throw new Error("Modo managed não configurado no servidor.");
  }
  if (tenant.evoMode !== "managed") {
    throw new Error(`Tenant ${tenant.id} não está em modo managed.`);
  }
  if (!tenant.evoInstance) {
    return { ok: true, alreadyAbsent: true, message: "Nada para revogar." };
  }

  const db = getDb();
  const instanceName = tenant.evoInstance;
  const client = getCentralEvoClient();

  let result: { ok: boolean; info: string };
  try {
    result = await client.deleteInstance(instanceName);
  } catch (e: any) {
    const msg = `Exceção ao deletar instância: ${e?.message || e}`;
    logger.error({ tenantId: tenant.id, err: e }, msg);
    return { ok: false, alreadyAbsent: false, message: msg };
  }

  const alreadyAbsent = /não existia/i.test(result.info);

  // Limpa credenciais do DB independente do resultado
  db.update(schema.tenants)
    .set({
      evoUrl: null,
      evoApiKeyEncrypted: null,
      evoInstance: null,
      evoManagedStatus: "pending",
      evoManagedError: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenant.id))
    .run();

  logAudit({
    tenantId: tenant.id,
    userId: actorUserId ?? null,
    action: "tenant.revoked",
    details: { instance: instanceName, apiResult: result.info, alreadyAbsent },
  });

  return {
    ok: result.ok || alreadyAbsent,
    alreadyAbsent,
    message: result.info,
  };
}

export interface ManagedStatusResult {
  state: string | null;
  err: string;
  managedStatus: string | null;
  managedError: string | null;
}

/**
 * Consulta o estado de conexão da instância managed na Evolution.
 * Atualiza evoManagedStatus automaticamente:
 *   - "open"       → "connected"
 *   - "close"      → "ready" (instância existe mas WhatsApp não logou)
 *   - "connecting" → "ready" (ainda pareando)
 *   - 404          → "pending" (instância não existe mais)
 *   - erro         → não atualiza, retorna o erro
 */
export async function getManagedInstanceStatus(
  tenant: Tenant
): Promise<ManagedStatusResult> {
  if (!CENTRAL_EVO_ENABLED) {
    return {
      state: null,
      err: "modo managed não configurado",
      managedStatus: tenant.evoManagedStatus,
      managedError: tenant.evoManagedError,
    };
  }
  if (!tenant.evoInstance) {
    return {
      state: null,
      err: "tenant não tem instância provisionada",
      managedStatus: tenant.evoManagedStatus,
      managedError: tenant.evoManagedError,
    };
  }

  const client = getCentralEvoClient();
  const r = await client.getInstanceState(tenant.evoInstance);

  // Atualiza evoManagedStatus no DB se mudou
  const db = getDb();
  if (r.state === "open") {
    if (tenant.evoManagedStatus !== "connected") {
      db.update(schema.tenants)
        .set({
          evoManagedStatus: "connected",
          evoManagedError: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.tenants.id, tenant.id))
        .run();
    }
    return {
      state: "open",
      err: r.err,
      managedStatus: "connected",
      managedError: null,
    };
  }
  if (r.state === "close" || r.state === "connecting") {
    if (tenant.evoManagedStatus !== "ready") {
      db.update(schema.tenants)
        .set({
          evoManagedStatus: "ready",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.tenants.id, tenant.id))
        .run();
    }
    return {
      state: r.state,
      err: r.err,
      managedStatus: "ready",
      managedError: null,
    };
  }
  if (/não existe/i.test(r.err)) {
    if (tenant.evoManagedStatus !== "pending") {
      db.update(schema.tenants)
        .set({
          evoManagedStatus: "pending",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.tenants.id, tenant.id))
        .run();
    }
    return {
      state: null,
      err: r.err,
      managedStatus: "pending",
      managedError: null,
    };
  }

  // Estado desconhecido ou erro — não mexe no DB
  return {
    state: r.state,
    err: r.err,
    managedStatus: tenant.evoManagedStatus,
    managedError: tenant.evoManagedError,
  };
}
