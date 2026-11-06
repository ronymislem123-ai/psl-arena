/**
 * Local email/password authentication with database-backed sessions.
 *
 * - Passwords: scrypt (N=16384, r=8, p=1, 64-byte key) with a per-user 16-byte salt.
 * - Sessions: 32 random bytes; only the SHA-256 of the token is stored. The raw token
 *   travels in an HttpOnly, SameSite=Lax cookie (Secure on HTTPS).
 * - Brute force: in-memory limiter per client + email (10 failures / 15 min).
 * - CSRF: mutating API requests must come from the same origin (Sec-Fetch-Site / Origin).
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PUBLIC_PATHS, SESSION_COOKIE, SESSION_DAYS } from "./auth-constants";
import { getDb, LEGACY_USER_ID, newId } from "./db";
import { ServiceError } from "./errors";
import { deleteAllImageFiles } from "./images";

export { SESSION_COOKIE, PUBLIC_PATHS };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- passwords
export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
}

export function verifyPassword(password: string, hashHex: string, saltHex: string): boolean {
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 10) return "Password must be at least 10 characters long.";
  if (password.length > 200) return "Password is too long.";
  return null;
}

export function normalizeEmail(email: string): string {
  const e = String(email ?? "").trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ServiceError(400, "Please enter a valid e-mail address.");
  return e;
}

// ---------------------------------------------------------------- rate limiting
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function limiterKey(client: string, email: string) {
  return `${client}|${email}`;
}

export function checkRateLimit(client: string, email: string) {
  const k = limiterKey(client, email);
  const a = attempts.get(k);
  if (a && Date.now() - a.first > WINDOW_MS) attempts.delete(k);
  const cur = attempts.get(k);
  if (cur && cur.count >= MAX_FAILURES) throw new ServiceError(429, "Too many failed attempts. Try again in a few minutes.");
}

function recordFailure(client: string, email: string) {
  const k = limiterKey(client, email);
  const cur = attempts.get(k);
  if (cur && Date.now() - cur.first <= WINDOW_MS) cur.count++;
  else attempts.set(k, { count: 1, first: Date.now() });
}

function clearFailures(client: string, email: string) {
  attempts.delete(limiterKey(client, email));
}

// ---------------------------------------------------------------- users
function rowToUser(r: { id: string; email: string | null; name: string; created_at: string }): AuthUser {
  return { id: r.id, email: r.email ?? "", name: r.name, createdAt: r.created_at };
}

export function countAccounts(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE email IS NOT NULL").get() as { n: number }).n;
}

export function isSignupAllowed(): boolean {
  if (countAccounts() === 0) return true; // the first account can always be created
  return process.env.PSL_ARENA_ALLOW_SIGNUP !== "false";
}

/** Moves data of the pre-authentication local user to the first real account. */
function adoptLegacyData(db: ReturnType<typeof getDb>, userId: string) {
  const legacy = db.prepare("SELECT id FROM users WHERE id = ? AND email IS NULL").get(LEGACY_USER_ID);
  if (!legacy) return;
  const tx = db.transaction(() => {
    for (const t of ["images", "face_profiles", "analysis_sessions", "battle_sessions", "settings"]) {
      db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(userId, LEGACY_USER_ID);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(LEGACY_USER_ID);
  });
  tx();
}

export function signup(input: { email: string; password: string; name?: string }, client = "local"): AuthUser {
  const email = normalizeEmail(input.email);
  const pwError = validatePassword(input.password);
  if (pwError) throw new ServiceError(400, pwError);
  const db = getDb();
  const first = countAccounts() === 0;
  if (!first && process.env.PSL_ARENA_ALLOW_SIGNUP === "false") throw new ServiceError(403, "Sign-up is disabled on this server.");
  const exists = db.prepare("SELECT 1 FROM users WHERE email = ?").get(email);
  if (exists) throw new ServiceError(409, "An account with this e-mail already exists.");
  const { hash, salt } = hashPassword(input.password);
  const id = newId("usr");
  const name = (input.name ?? "").trim().slice(0, 60) || email.split("@")[0];
  const t = now();
  db.prepare("INSERT INTO users (id, name, created_at, email, password_hash, password_salt, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, t, email, hash, salt, t);
  if (first) adoptLegacyData(db, id);
  clearFailures(client, email);
  return { id, email, name, createdAt: t };
}

export function login(input: { email: string; password: string }, client = "local"): AuthUser {
  const email = normalizeEmail(input.email);
  checkRateLimit(client, email);
  const row = getDb().prepare("SELECT id, email, name, created_at, password_hash, password_salt FROM users WHERE email = ?").get(email) as
    | { id: string; email: string; name: string; created_at: string; password_hash: string | null; password_salt: string | null }
    | undefined;
  const ok = !!row && !!row.password_hash && !!row.password_salt && verifyPassword(String(input.password ?? ""), row.password_hash, row.password_salt);
  if (!ok) {
    // always do a hash round so timing does not reveal whether the e-mail exists
    if (!row) hashPassword(String(input.password ?? ""));
    recordFailure(client, email);
    throw new ServiceError(401, "E-mail or password is incorrect.");
  }
  clearFailures(client, email);
  getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), row!.id);
  return rowToUser(row!);
}

export function changePassword(userId: string, current: string, next: string) {
  const pwError = validatePassword(next);
  if (pwError) throw new ServiceError(400, pwError);
  const row = getDb().prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId) as { password_hash: string; password_salt: string } | undefined;
  if (!row || !verifyPassword(String(current ?? ""), row.password_hash, row.password_salt)) throw new ServiceError(401, "The current password is incorrect.");
  const { hash, salt } = hashPassword(next);
  getDb().prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, userId);
}

export function deleteAccount(userId: string, password: string) {
  const row = getDb().prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId) as { password_hash: string; password_salt: string } | undefined;
  if (!row || !verifyPassword(String(password ?? ""), row.password_hash, row.password_salt)) throw new ServiceError(401, "The password is incorrect.");
  deleteAllImageFiles(userId);
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId); // cascades to sessions, profiles, analyses, battles, settings
}

// ---------------------------------------------------------------- recovery codes
export const RECOVERY_CODE_COUNT = 8;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const sha = (token: string) => createHash("sha256").update(token).digest("hex");

export function normalizeRecoveryCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recoveryHash(userId: string, code: string): string {
  return sha(`${userId}:${normalizeRecoveryCode(code)}`);
}

function randomCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Replaces all codes of the user with a fresh set and returns the plain codes (shown once). */
export function generateRecoveryCodes(userId: string): string[] {
  const db = getDb();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomCode);
  const t = now();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM recovery_codes WHERE user_id = ?").run(userId);
    const ins = db.prepare("INSERT INTO recovery_codes (id, user_id, created_at) VALUES (?, ?, ?)");
    for (const c of codes) ins.run(recoveryHash(userId, c), userId, t);
  });
  tx();
  return codes;
}

export function recoveryCodeStatus(userId: string): { remaining: number; total: number } {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL").get(userId) as { n: number };
  return { remaining: row.n, total: RECOVERY_CODE_COUNT };
}

/** Regenerates codes after re-authentication with the password. */
export function regenerateRecoveryCodes(userId: string, password: string): string[] {
  const row = getDb().prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId) as { password_hash: string; password_salt: string } | undefined;
  if (!row || !verifyPassword(String(password ?? ""), row.password_hash, row.password_salt)) throw new ServiceError(401, "The password is incorrect.");
  return generateRecoveryCodes(userId);
}

/**
 * Sets a new password after proving possession of an unused recovery code.
 * The code is consumed, every session of the account is destroyed and the
 * remaining-code count is returned so the UI can warn when codes run out.
 */
export function resetPasswordWithRecoveryCode(input: { email: string; code: string; newPassword: string }, client = "local"): { user: AuthUser; remainingCodes: number } {
  const email = normalizeEmail(input.email);
  checkRateLimit(client, email);
  const pwError = validatePassword(input.newPassword);
  if (pwError) throw new ServiceError(400, pwError);
  const db = getDb();
  const user = db.prepare("SELECT id, email, name, created_at FROM users WHERE email = ?").get(email) as { id: string; email: string; name: string; created_at: string } | undefined;
  const normalized = normalizeRecoveryCode(input.code);
  const codeRow = user && normalized.length === 10 ? (db.prepare("SELECT id FROM recovery_codes WHERE id = ? AND user_id = ? AND used_at IS NULL").get(recoveryHash(user.id, normalized), user.id) as { id: string } | undefined) : undefined;
  if (!user || !codeRow) {
    recordFailure(client, email);
    throw new ServiceError(401, "E-mail or recovery code is incorrect.");
  }
  const { hash, salt } = hashPassword(input.newPassword);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, last_login_at = ? WHERE id = ?").run(hash, salt, now(), user.id);
    db.prepare("UPDATE recovery_codes SET used_at = ? WHERE id = ?").run(now(), codeRow.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  });
  tx();
  clearFailures(client, email);
  return { user: rowToUser(user), remainingCodes: recoveryCodeStatus(user.id).remaining };
}

// ---------------------------------------------------------------- sessions

export function createSession(userId: string, userAgent?: string | null): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const t = now();
  getDb().prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)").run(sha(token), userId, t, expiresAt.toISOString(), t, (userAgent ?? "").slice(0, 300));
  return { token, expiresAt };
}

export function findSession(token: string | undefined | null): AuthUser | null {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT s.id AS sid, s.expires_at, s.last_seen_at, u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?")
    .get(sha(token)) as { sid: string; expires_at: string; last_seen_at: string; id: string; email: string | null; name: string; created_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.sid);
    return null;
  }
  if (Date.now() - new Date(row.last_seen_at).getTime() > 10 * 60 * 1000) db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now(), row.sid);
  return rowToUser(row);
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sha(token));
}

export function destroyOtherSessions(userId: string, keepToken?: string | null) {
  if (keepToken) getDb().prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, sha(keepToken));
  else getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function purgeExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
}

// ---------------------------------------------------------------- request helpers
export function cookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookieOptions(req: Request, maxAgeSeconds: number = SESSION_DAYS * 86_400) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return { httpOnly: true, sameSite: "lax" as const, secure: proto === "https", path: "/", maxAge: maxAgeSeconds };
}

export function clientId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

export function tokenFromRequest(req: Request): string | undefined {
  return cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE);
}

/** Current user for route handlers (null when not signed in). */
export function userFromRequest(req: Request): AuthUser | null {
  return findSession(tokenFromRequest(req));
}

/** Route handlers: throws 401 when not signed in and 403 for cross-site mutations. */
export function requireUserApi(req: Request): AuthUser {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const site = req.headers.get("sec-fetch-site");
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (site && site !== "same-origin" && site !== "none") throw new ServiceError(403, "Cross-site request rejected.");
    if (origin && host && new URL(origin).host !== host) throw new ServiceError(403, "Cross-site request rejected.");
  }
  const user = userFromRequest(req);
  if (!user) throw new ServiceError(401, "Sign in required.");
  return user;
}

/** Server components: current user or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  return findSession(store.get(SESSION_COOKIE)?.value);
}

/** Server components: redirect to /login when not signed in. */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}
