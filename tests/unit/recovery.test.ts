import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "psl-recovery-"));
process.env.PSL_ARENA_DATA_DIR = dir;

const auth = await import("@/server/auth");
const db = await import("@/server/db");
const cli = await import("../../scripts/reset-password.mjs");

beforeAll(() => db.closeDb());
afterAll(() => {
  db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("recovery codes", () => {
  it("generates 8 unambiguous codes and stores only hashes", () => {
    const user = auth.signup({ email: "rec@example.com", password: "initial strong pw" });
    const codes = auth.generateRecoveryCodes(user.id);
    expect(codes).toHaveLength(auth.RECOVERY_CODE_COUNT);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(codes).size).toBe(codes.length);
    const rows = db.getDb().prepare("SELECT id FROM recovery_codes WHERE user_id = ?").all(user.id) as { id: string }[];
    expect(rows).toHaveLength(8);
    for (const r of rows) expect(codes.map(auth.normalizeRecoveryCode)).not.toContain(r.id);
    expect(auth.recoveryCodeStatus(user.id)).toEqual({ remaining: 8, total: 8 });
  });

  it("resets the password with a code once, signs every session out and keeps counting", () => {
    const user = auth.login({ email: "rec@example.com", password: "initial strong pw" });
    const codes = auth.generateRecoveryCodes(user.id);
    const session = auth.createSession(user.id).token;
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: "AAAAA-BBBBB", newPassword: "another strong pw" })).toThrow(/incorrect/);
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "nobody@example.com", code: codes[0], newPassword: "another strong pw" })).toThrow(/incorrect/);
    // codes are accepted in any formatting
    const res = auth.resetPasswordWithRecoveryCode({ email: "REC@example.com ", code: codes[0].toLowerCase().replace("-", " "), newPassword: "another strong pw" });
    expect(res.user.id).toBe(user.id);
    expect(res.remainingCodes).toBe(7);
    expect(auth.findSession(session)).toBeNull();
    expect(auth.login({ email: "rec@example.com", password: "another strong pw" }).id).toBe(user.id);
    expect(() => auth.login({ email: "rec@example.com", password: "initial strong pw" })).toThrow(/incorrect/);
    // the same code cannot be used twice
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: codes[0], newPassword: "third strong pw!" })).toThrow(/incorrect/);
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: codes[1], newPassword: "short" })).toThrow(/at least 10/);
  });

  it("regenerating codes requires the password and invalidates the old set", () => {
    const user = auth.login({ email: "rec@example.com", password: "another strong pw" });
    const old = auth.generateRecoveryCodes(user.id);
    expect(() => auth.regenerateRecoveryCodes(user.id, "wrong password")).toThrow(/incorrect/);
    const fresh = auth.regenerateRecoveryCodes(user.id, "another strong pw");
    expect(fresh).toHaveLength(8);
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: old[2], newPassword: "yet another strong pw" })).toThrow(/incorrect/);
    expect(auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: fresh[2], newPassword: "yet another strong pw" }).remainingCodes).toBe(7);
  });

  it("rate-limits code guessing per client", () => {
    const user = auth.login({ email: "rec@example.com", password: "yet another strong pw" });
    auth.generateRecoveryCodes(user.id);
    for (let i = 0; i < 10; i++) expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: "AAAAA-AAAAA", newPassword: "whatever strong pw" }, "10.9.9.9")).toThrow(/incorrect/);
    expect(() => auth.resetPasswordWithRecoveryCode({ email: "rec@example.com", code: "AAAAA-AAAAA", newPassword: "whatever strong pw" }, "10.9.9.9")).toThrow(/Too many/);
  });

  it("operator CLI script sets a password compatible with the app's verifier", () => {
    const dbPath = join(dir, "psl-arena.sqlite");
    db.closeDb(); // the script opens its own connection
    const id = cli.resetPassword(dbPath, "REC@example.com", "operator reset password");
    const row = db.getDb().prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(id) as { password_hash: string; password_salt: string };
    expect(auth.verifyPassword("operator reset password", row.password_hash, row.password_salt)).toBe(true);
    expect(auth.login({ email: "rec@example.com", password: "operator reset password" }).id).toBe(id);
    expect(() => cli.resetPassword(dbPath, "ghost@example.com", "operator reset password")).toThrow(/No account/);
    expect(cli.generateTemporaryPassword()).toHaveLength(16);
  });
});
