/**
 * Rate limiter in-memory (LRU + TTL).
 *
 * Estratégia: Map<key, { count, resetAt }>. Ao bater o limite, retorna
 * { ok: false, retryAfterSec }. Janela deslizante simplificada — o
 * "reset" é absoluto (não rolling), suficiente pra brute-force.
 *
 * Limite de keys: 10.000 (LRU-ish via inserção; se passar, faz sweep
 * removendo as mais antigas).
 *
 * Para produção com múltiplas instâncias, troque por Redis. Aqui, in-process
 * é OK porque rodamos 1 instância por VPS.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const MAX_KEYS = 10_000;
const store = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimitOpts {
  /** chave única (ex: IP + endpoint) */
  key: string;
  /** máximo de requests na janela */
  limit: number;
  /** tamanho da janela em ms */
  windowMs: number;
}

/**
 * Verifica se `key` está dentro do limite. Incrementa o contador se sim.
 * Se não, retorna ok=false com retryAfterSec.
 */
export function rateLimit(opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  let b = store.get(opts.key);

  if (!b || b.resetAt < now) {
    // nova janela
    b = { count: 0, resetAt: now + opts.windowMs };
    store.set(opts.key, b);
  }

  b.count++;

  // Sweep se passou do limite de keys
  if (store.size > MAX_KEYS) {
    const cutoff = now;
    for (const [k, v] of store) {
      if (v.resetAt < cutoff) store.delete(k);
    }
    // Se ainda passou, deleta aleatórios
    if (store.size > MAX_KEYS) {
      const toDelete = store.size - MAX_KEYS;
      let i = 0;
      for (const k of store.keys()) {
        if (i++ >= toDelete) break;
        store.delete(k);
      }
    }
  }

  if (b.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    remaining: opts.limit - b.count,
    retryAfterSec: 0,
  };
}

/**
 * Helper: extrai IP do request, considerando x-forwarded-for (nginx).
 * Fallback pra "unknown" se não tiver.
 */
export function getRequestIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Limpa o store (útil pra testes). */
export function _resetRateLimit(): void {
  store.clear();
}

/**
 * Reseta o bucket de uma chave específica (ex: após login bem-sucedido,
 * pra não contar a próxima tentativa na janela atual).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
