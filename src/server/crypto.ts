/**
 * Symmetric at-rest encryption for sensitive columns and files (AES-256-GCM).
 * The key comes from PSL_ARENA_IMAGE_KEY (32-byte hex) or <data dir>/image.key
 * (generated once, mode 0600). Despite the historic name it protects every
 * encrypted secret of the installation, not only images.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./db";

let cachedKey: Buffer | null = null;

export function getDataKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.PSL_ARENA_IMAGE_KEY;
  if (env && /^[0-9a-f]{64}$/i.test(env)) {
    cachedKey = Buffer.from(env, "hex");
    return cachedKey;
  }
  const keyPath = join(dataDir(), "image.key");
  if (existsSync(keyPath)) {
    cachedKey = Buffer.from(readFileSync(keyPath, "utf8").trim(), "hex");
  } else {
    cachedKey = randomBytes(32);
    writeFileSync(keyPath, cachedKey.toString("hex"), { mode: 0o600 });
    try {
      chmodSync(keyPath, 0o600);
    } catch {
      /* best effort */
    }
  }
  return cachedKey;
}

/** iv (12) ‖ tag (16) ‖ ciphertext */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getDataKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptBuffer(raw: Buffer): Buffer {
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getDataKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function encryptString(plain: string): string {
  return encryptBuffer(Buffer.from(plain, "utf8")).toString("base64");
}

export function decryptString(enc: string): string {
  return decryptBuffer(Buffer.from(enc, "base64")).toString("utf8");
}

/** Test helper: forget the cached key (e.g. when the data dir changes). */
export function resetDataKeyCache() {
  cachedKey = null;
}
