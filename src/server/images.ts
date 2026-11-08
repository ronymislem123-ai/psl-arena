/**
 * Encrypted image storage (AES-256-GCM via ./crypto). Images are only stored when
 * the user explicitly opts in. Every read is scoped to the owning user.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptBuffer, encryptBuffer } from "./crypto";
import { dataDir, getDb, newId } from "./db";

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

export function storeImage(userId: string, buf: Uint8Array, mime: string, width: number, height: number): StoredImage {
  const id = newId("img");
  const path = join(imagesDir(), `${id}.bin`);
  writeFileSync(path, encryptBuffer(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)), { mode: 0o600 });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  getDb()
    .prepare("INSERT INTO images (id, user_id, mime, width, height, bytes, sha256, encrypted, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
    .run(id, userId, mime, width, height, buf.length, sha256, path, new Date().toISOString());
  return { id, mime, width, height, bytes: buf.length, sha256 };
}

export function readImage(userId: string, id: string): { buf: Uint8Array; mime: string } | null {
  const row = getDb().prepare("SELECT mime, path FROM images WHERE id = ? AND user_id = ?").get(id, userId) as { mime: string; path: string } | undefined;
  if (!row || !existsSync(row.path)) return null;
  const buf = decryptBuffer(readFileSync(row.path));
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
