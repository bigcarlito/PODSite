// No "server-only" import here: this module is also used by prisma/seed.ts,
// a plain Node script run via tsx outside of Next's server/client bundling.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

const SCRYPT_KEYLEN = 64;

/** Hash a store's admin password for storage. Never store the plaintext. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

/** Generate a new agent-API key for a store. Returned to the caller once. */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/** Hash an agent-API key for storage — keys are high-entropy, so sha256 is enough. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyApiKey(key: string, stored: string): boolean {
  const candidate = Buffer.from(hashApiKey(key), "hex");
  const expected = Buffer.from(stored, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
