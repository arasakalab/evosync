/**
 * Helpers HTTP compartilhados entre rotas Next.js App Router.
 *
 * Centraliza:
 *  - Validação de sessão + tenantId (401/403 padronizados)
 *  - Parse seguro de body JSON (400 se inválido)
 *  - Validação com Zod (400 com details.flatten() se falhar)
 *  - Helper de erro JSON
 *
 * Reduz duplicação (3+ rotas duplicavam o mesmo `requireTenantId` inline)
 * e padroniza a forma de erro 4xx em toda a API.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { z } from "zod";

export interface TenantGate {
  error: NextResponse | null;
  tenantId: string | null;
}

/**
 * Extrai o tenantId da sessão autenticada.
 *
 * - Sem `session.user` → 401 "Não autenticado"
 * - `session.user.tenantId` ausente (super admin) → 403 "Super admin não tem [contexto]"
 * - Sucesso → `{ error: null, tenantId: <id> }`
 *
 * Caller deve fazer:
 *   const { error, tenantId } = await requireTenantId();
 *   if (error) return error;
 *   // ... usar tenantId
 */
export async function requireTenantId(
  contextLabel: string = "recurso"
): Promise<TenantGate> {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
      tenantId: null,
    };
  }
  if (!session.user.tenantId) {
    return {
      error: NextResponse.json(
        { error: `Super admin não tem ${contextLabel}` },
        { status: 403 }
      ),
      tenantId: null,
    };
  }
  return { error: null, tenantId: session.user.tenantId };
}

/**
 * Faz parse do body JSON da requisição.
 *
 * - Body vazio/inválido (não é JSON) → 400 "Body inválido"
 * - Sucesso → `{ ok: true, data }` (typed como T, sem validação)
 *
 * **Não valida o schema** — combine com `validateWith` se precisar.
 */
export async function parseJsonBody<T = unknown>(
  req: Request
): Promise<{ ok: true; data: T } | { ok: false; error: NextResponse }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: NextResponse.json({ error: "Body inválido" }, { status: 400 }),
    };
  }
}

/**
 * Valida `data` contra um schema Zod.
 *
 * - Falha → 400 com `{ error, details: result.error.flatten() }`
 * - Sucesso → `{ ok: true, data: T }`
 */
export function validateWith<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Dados inválidos", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Helper curto para `NextResponse.json({ error }, { status })`.
 */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
