import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for waba_connections.access_token_encrypted.
// TOKEN_ENCRYPTION_KEY must be 32 raw bytes, base64-encoded (generate with
// `openssl rand -base64 32`). Never log or expose decrypted tokens.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

// Returns "iv.authTag.ciphertext", each base64url-encoded.
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64url")).join(".");
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const [ivPart, authTagPart, ciphertextPart] = encrypted.split(".");
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error("Malformed encrypted token");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
