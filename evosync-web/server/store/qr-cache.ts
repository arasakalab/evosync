/**
 * Cache in-memory de QR codes com TTL (Fase B managed).
 *
 * O endpoint GET /api/connection/qr é polled a cada ~2s pelo tenant, mas
 * chamar `GET /instance/connect/{name}` na Evolution a cada poll gera um
 * novo QR e invalida o anterior — o cliente escaneia às cegas e dá ruim.
 *
 * Solução: cachear o QR por 30s. Se o cliente pedir antes do TTL, devolvemos
 * o mesmo QR. Após 30s, geramos um novo.
 *
 * Limitação: cache é in-memory no processo Node. Em multi-instância (PM2
 * cluster) cada processo tem seu próprio cache — sem impacto funcional,
 * só mais chamadas à Evolution.
 */
type CacheEntry = {
  base64?: string;
  code?: string;
  pairingCode?: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 30_000;

export function getCachedQr(
  instanceName: string
): { base64?: string; code?: string; pairingCode?: string; ageMs: number } | null {
  const entry = cache.get(instanceName);
  if (!entry) return null;
  const age = Date.now() - (entry.expiresAt - DEFAULT_TTL_MS);
  if (Date.now() > entry.expiresAt) {
    cache.delete(instanceName);
    return null;
  }
  return { ...entry, ageMs: age };
}

export function setCachedQr(
  instanceName: string,
  qr: { base64?: string; code?: string; pairingCode?: string },
  ttlMs: number = DEFAULT_TTL_MS
): void {
  cache.set(instanceName, {
    ...qr,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCachedQr(instanceName: string): void {
  cache.delete(instanceName);
}

/** TTL default em ms (30s) — usado pelos endpoints para indicar idade ao cliente. */
export const QR_CACHE_TTL_MS = DEFAULT_TTL_MS;
