/**
 * Encrypted image storage (AES-256-GCM). Images are only stored when the user
 * explicitly opts in. The key comes from PSL_ARENA_IMAGE_KEY (hex, 32 bytes) or is
 * generated once and kept in <data dir>/image.key (mode 0600).
 * Every read is scoped to the owning user.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir, getDb, newId } from "./db";

let cachedKey: Buffer | null = null;

function imageKey(): Buffer {
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

function imagesDir(): string {
  const d = join(dataDir(), "images");
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

export interface StoredImage {
  id: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export function storeImage(userId: string, buf: Buffer, mime: string, width: number, height: number): StoredImage {
  const id = newId("img");
  const key = imageKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  const path = join(imagesDir(), `${id}.bin`);
  writeFileSync(path, Buffer.concat([iv, tag, enc]), { mode: 0o600 });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  getDb()
    .prepare("INSERT INTO images (id, user_id, mime, width, height, bytes, sha256, encrypted, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
    .run(id, userId, mime, width, height, buf.length, sha256, path, new Date().toISOString());
  return { id, mime, width, height, bytes: buf.length, sha256 };
}

export function readImage(userId: string, id: string): { buf: Buffer; mime: string } | null {
  const row = getDb().prepare("SELECT mime, path FROM images WHERE id = ? AND user_id = ?").get(id, userId) as { mime: string; path: string } | undefined;
  if (!row || !existsSync(row.path)) return null;
  const raw = readFileSync(row.path);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", imageKey(), iv);
  decipher.setAuthTag(tag);
  const buf = Buffer.concat([decipher.update(enc), decipher.final()]);
  return { buf, mime: row.mime };
}

/** Removes the file and the row. Internal: callers must have verified ownership. */
export function deleteImageFile(id: string) {
  const row = getDb().prepare("SELECT path FROM images WHERE id = ?").get(id) as { path: string } | undefined;
  if (row && existsSync(row.path)) {
    try {
      unlinkSync(row.path);
    } catch {
      /* ignore */
    }
  }
  getDb().prepare("DELETE FROM images WHERE id = ?").run(id);
}

export function deleteAllImageFiles(userId: string) {
  const rows = getDb().prepare("SELECT id FROM images WHERE user_id = ?").all(userId) as { id: string }[];
  for (const r of rows) deleteImageFile(r.id);
}
