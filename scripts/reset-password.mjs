#!/usr/bin/env node
/**
 * Operator fallback: set a new password for an account directly in the database
 * (for when recovery codes are lost). Run on the server:
 *
 *   node scripts/reset-password.mjs user@example.com            # prints a generated temporary password
 *   node scripts/reset-password.mjs user@example.com --password "new strong password"
 *
 * Uses PSL_ARENA_DATA_DIR (default ./data). All sessions of the account are signed out.
 * The hashing parameters mirror src/server/auth.ts (scrypt N=16384 r=8 p=1, 64-byte key, 16-byte salt);
 * tests/unit/recovery.test.ts verifies the two stay compatible.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
}

export function generateTemporaryPassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function resetPassword(dbPath, email, password) {
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);
  try {
    const normalized = String(email).trim().toLowerCase();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized);
    if (!user) throw new Error(`No account with e-mail ${normalized}`);
    const { hash, salt } = hashPassword(password);
    const tx = db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, user.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    });
    tx();
    return user.id;
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const pwIdx = args.indexOf("--password");
  if (!email) {
    console.error("Usage: node scripts/reset-password.mjs <email> [--password <new password>]");
    process.exit(1);
  }
  const password = pwIdx >= 0 ? args[pwIdx + 1] : generateTemporaryPassword();
  if (!password || password.length < 10) {
    console.error("The password must be at least 10 characters long.");
    process.exit(1);
  }
  const dbPath = join(resolve(process.cwd(), process.env.PSL_ARENA_DATA_DIR ?? "data"), "psl-arena.sqlite");
  if (!existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath} (set PSL_ARENA_DATA_DIR).`);
    process.exit(1);
  }
  try {
    resetPassword(dbPath, email, password);
    console.log(`Password updated for ${email}; all sessions signed out.`);
    if (pwIdx < 0) console.log(`Temporary password: ${password}\nAsk the user to change it in Settings → Account right after signing in.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
