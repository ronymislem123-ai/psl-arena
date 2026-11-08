/**
 * Browser edition of ./images.ts. Images the user explicitly chose to keep are
 * stored as BLOBs inside the local SQLite database (table image_blobs), which in
 * turn lives in this browser's IndexedDB. Nothing is uploaded anywhere. Unlike the
 * server edition there is no separate encryption key: a key kept next to the data
 * in the same browser profile would not add real protection.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { getDb, LEGACY_USER_ID, newId } from "./db";

export interface StoredImage {
  id: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

const objectUrls = new Map<string, string>();

export function storeImage(userId: string, buf: Uint8Array, mime: string, width: number, height: number): StoredImage {
  const id = newId("img");
  const digest = bytesToHex(sha256(buf));
  const db = getDb();
  db.prepare("INSERT INTO images (id, user_id, mime, width, height, bytes, sha256, encrypted, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
    .run(id, userId, mime, width, height, buf.length, digest, `local:${id}`, new Date().toISOString());
  db.prepare("INSERT INTO image_blobs (id, data) VALUES (?, ?)").run(id, buf);
  return { id, mime, width, height, bytes: buf.length, sha256: digest };
}

export function readImage(userId: string, id: string): { buf: Uint8Array; mime: string } | null {
  const row = getDb()
    .prepare("SELECT i.mime AS mime, b.data AS data FROM images i JOIN image_blobs b ON b.id = i.id WHERE i.id = ? AND i.user_id = ?")
    .get(id, userId) as { mime: string; data: Uint8Array } | undefined;
  return row ? { buf: row.data, mime: row.mime } : null;
}

/** Removes the blob and the row. Internal: callers must have verified ownership. */
export function deleteImageFile(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM image_blobs WHERE id = ?").run(id);
  db.prepare("DELETE FROM images WHERE id = ?").run(id);
  revokeImageUrl(id);
}

export function deleteAllImageFiles(userId: string) {
  const rows = getDb().prepare("SELECT id FROM images WHERE user_id = ?").all(userId) as { id: string }[];
  for (const r of rows) deleteImageFile(r.id);
}

/** Object URL for a stored image (cached until the image is deleted or the database reloads). */
export function localImageUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  const hit = objectUrls.get(id);
  if (hit) return hit;
  let img: { buf: Uint8Array; mime: string } | null = null;
  try {
    img = readImage(LEGACY_USER_ID, id);
  } catch {
    return null; // database not ready
  }
  if (!img) return null;
  const url = URL.createObjectURL(new Blob([img.buf.slice()], { type: img.mime }));
  objectUrls.set(id, url);
  return url;
}

export function revokeImageUrl(id: string) {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

export function clearImageUrlCache() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
