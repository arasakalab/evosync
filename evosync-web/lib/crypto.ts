/**
 * Criptografia AES-256-GCM para dados sensíveis (API keys).
 *
 * Formato de saída: `iv:ciphertext:tag` (todos base64)
 *  - iv: 12 bytes aleatórios (96 bits, recomendado pro GCM)
 *  - ciphertext: tamanho variável
 *  - tag: 16 bytes (padrão GCM)
 *
 * A master key (ENCRYPTION_KEY) deve ter 32 bytes em hex (= 64 chars hex).
 * Em produção, gere uma vez e guarde em local seguro.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits
const KEY_LENGTH = 32; // 256 bits
const SEPARATOR = ":";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não definida no .env. Use `openssl rand -hex 32` para gerar uma."
    );
  }
  // Aceita hex (64 chars) OU qualquer string (hash SHA-256 → 32 bytes)
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = createHash("sha256").update(raw).digest();
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY inválida: esperado ${KEY_LENGTH} bytes, recebi ${key.length}`
    );
  }
  return key;
}

/**
 * Criptografa um texto. Retorna `iv:ciphertext:tag` em base64.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(SEPARATOR);
}

/**
 * Decriptografa um texto no formato `iv:ciphertext:tag`.
 * Lança erro se o texto foi adulterado (tag mismatch).
 */
export function decrypt(payload: string): string {
  const parts = payload.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Formato de payload criptografado inválido");
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV inválido: esperado ${IV_LENGTH} bytes`);
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Gera uma nova chave AES-256 (para uso no setup inicial).
 * Retorna 64 chars hex.
 */
export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
