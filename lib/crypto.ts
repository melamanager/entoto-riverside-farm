import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// AES-256-GCM encryption for secrets stored in the database (integration tokens
// and API keys). The key is derived from NEXTAUTH_SECRET so no extra config is
// needed. Format: "enc:v1:<iv>:<tag>:<ciphertext>" (all base64).
// decrypt() is backward-compatible: a value that isn't in this format (e.g. a
// legacy plaintext token) is returned unchanged, so existing data keeps working
// until it is next saved (and thereby encrypted).

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "entoto-dev-secret";
  return scryptSync(secret, "entoto-appsetting-salt", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored; // legacy plaintext
  try {
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return ""; // wrong key / corrupt — fail closed
  }
}

export function isEncrypted(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}
