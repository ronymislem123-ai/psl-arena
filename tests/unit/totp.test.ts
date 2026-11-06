import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, otpauthUri, totpCode, verifyTotp } from "@/server/totp";

const dir = mkdtempSync(join(tmpdir(), "psl-totp-"));
process.env.PSL_ARENA_DATA_DIR = dir;
const auth = await import("@/server/auth");
const db = await import("@/server/db");
const crypto = await import("@/server/crypto");

beforeAll(() => {
  db.closeDb();
  crypto.resetDataKeyCache();
});
afterAll(() => {
  db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

// RFC 6238 appendix B vectors (SHA-1, secret "12345678901234567890"), truncated to 6 digits
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("TOTP primitives", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 42]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });
  it("matches the RFC 6238 test vectors", () => {
    for (const [t, code] of VECTORS) expect(totpCode(RFC_SECRET, t * 1000)).toBe(code);
    expect(hotp(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
  });
  it("accepts codes within ±1 step and rejects replays and garbage", () => {
    const now = 1111111111 * 1000;
    expect(verifyTotp(RFC_SECRET, "050471", { nowMs: now }).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, "081804", { nowMs: now }).ok).toBe(true); // previous step (t=1111111109)
    expect(verifyTotp(RFC_SECRET, "287082", { nowMs: now }).ok).toBe(false); // far away
    expect(verifyTotp(RFC_SECRET, "05 04 71", { nowMs: now }).ok).toBe(true); // spaces tolerated
    expect(verifyTotp(RFC_SECRET, "abcdef", { nowMs: now }).ok).toBe(false);
    const first = verifyTotp(RFC_SECRET, "050471", { nowMs: now });
    expect(verifyTotp(RFC_SECRET, "050471", { nowMs: now, lastUsedStep: first.step }).ok).toBe(false);
  });
  it("builds a standard otpauth URI", () => {
    const uri = otpauthUri("PSL ARENA", "me@example.com", "ABCDEFGH");
    expect(uri).toMatch(/^otpauth:\/\/totp\/PSL%20ARENA%3Ame%40example.com\?secret=ABCDEFGH&issuer=PSL\+ARENA&algorithm=SHA1&digits=6&period=30$/);
  });
});

describe("two-factor enrollment and sign-in", () => {
  it("enrolls with password + first code, stores the secret encrypted and requires a challenge on login", () => {
    const user = auth.signup({ email: "mfa@example.com", password: "mfa strong password" });
    expect(user.totpEnabled).toBe(false);
    expect(() => auth.startTotpEnrollment(user.id, "wrong", user.email)).toThrow(/incorrect/);
    const setup = auth.startTotpEnrollment(user.id, "mfa strong password", user.email);
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.uri).toContain("otpauth://totp/");
    expect(auth.totpStatus(user.id)).toMatchObject({ enabled: false, pending: true });
    // the raw secret must not be visible in the database
    const row = db.getDb().prepare("SELECT totp_pending_enc FROM users WHERE id = ?").get(user.id) as { totp_pending_enc: string };
    expect(row.totp_pending_enc).not.toContain(setup.secret);
    expect(crypto.decryptString(row.totp_pending_enc)).toBe(setup.secret);
    expect(() => auth.confirmTotpEnrollment(user.id, "000000")).toThrow(/not valid/);
    const status = auth.confirmTotpEnrollment(user.id, totpCode(setup.secret));
    expect(status.enabled).toBe(true);
    expect(auth.login({ email: "mfa@example.com", password: "mfa strong password" }).totpEnabled).toBe(true);
    expect(auth.isTotpEnabled(user.id)).toBe(true);

    // challenge flow
    const { token } = auth.createMfaChallenge(user.id);
    expect(() => auth.completeMfaChallenge("deadbeef", { code: "123456" })).toThrow(/expired/);
    expect(() => auth.completeMfaChallenge(token, { code: "000000" })).toThrow(/not valid/);
    // the code accepted during enrollment cannot be replayed within the same step
    const current = totpCode(setup.secret);
    const next = totpCode(setup.secret, Date.now() + 30_000);
    const res = auth.completeMfaChallenge(token, { code: current === totpCode(setup.secret) && next !== current ? next : current });
    expect(res.user.id).toBe(user.id);
    expect(res.usedRecoveryCode).toBe(false);
    // the challenge is single-use
    expect(() => auth.completeMfaChallenge(token, { code: next })).toThrow(/expired/);
  });

  it("accepts a recovery code as the second factor and limits attempts per challenge", () => {
    const user = auth.login({ email: "mfa@example.com", password: "mfa strong password" });
    const codes = auth.generateRecoveryCodes(user.id);
    const { token } = auth.createMfaChallenge(user.id);
    const res = auth.completeMfaChallenge(token, { recoveryCode: codes[0] });
    expect(res.usedRecoveryCode).toBe(true);
    expect(res.remainingCodes).toBe(7);
    const second = auth.createMfaChallenge(user.id);
    for (let i = 0; i < auth.MFA_MAX_ATTEMPTS - 1; i++) expect(() => auth.completeMfaChallenge(second.token, { code: "000000" }, "10.1.1.1")).toThrow(/not valid/);
    expect(() => auth.completeMfaChallenge(second.token, { code: "000000" }, "10.1.1.1")).toThrow(/Too many/);
    expect(() => auth.completeMfaChallenge(second.token, { recoveryCode: codes[1] }, "10.1.1.1")).toThrow(/expired/);
  });

  it("expires challenges and disables the factor only with password + code", () => {
    const user = auth.login({ email: "mfa@example.com", password: "mfa strong password" });
    const { token } = auth.createMfaChallenge(user.id);
    db.getDb().prepare("UPDATE mfa_challenges SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(() => auth.completeMfaChallenge(token, { code: "123456" })).toThrow(/expired/);
    const secretRow = db.getDb().prepare("SELECT totp_secret_enc FROM users WHERE id = ?").get(user.id) as { totp_secret_enc: string };
    const secret = crypto.decryptString(secretRow.totp_secret_enc);
    expect(() => auth.disableTotp(user.id, "wrong password", totpCode(secret))).toThrow(/incorrect/);
    expect(() => auth.disableTotp(user.id, "mfa strong password", "000000")).toThrow(/not valid/);
    // the previous tests already consumed the current and the next step; simulate time passing
    db.getDb().prepare("UPDATE users SET totp_last_step = NULL WHERE id = ?").run(user.id);
    const future = totpCode(secret, Date.now() + 30_000);
    expect(auth.disableTotp(user.id, "mfa strong password", future).enabled).toBe(false);
    expect(auth.login({ email: "mfa@example.com", password: "mfa strong password" }).totpEnabled).toBe(false);
    expect(() => auth.disableTotp(user.id, "mfa strong password", future)).toThrow(/not enabled/);
  });
});
