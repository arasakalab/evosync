/**
 * Helpers de senha usando bcryptjs (compatível com NextAuth Credentials provider).
 *
 * Formato armazenado no DB: `bcrypt$<cost>$<salt+hash>` (padrão bcrypt).
 * O Cost factor 10 = ~100ms por hash (bom balanço segurança/UX).
 */
import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  if (!stored) return false;
  try {
    return await bcrypt.compare(plain, stored);
  } catch {
    return false;
  }
}
