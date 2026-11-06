/** Shared by the edge-safe proxy and the Node auth module (no Node imports here). */
export const SESSION_COOKIE = "psl_session";
export const SESSION_DAYS = 30;
/** Short-lived cookie carrying the pending second-factor challenge after a correct password. */
export const MFA_COOKIE = "psl_mfa";
export const MFA_MINUTES = 10;
export const PUBLIC_PATHS = ["/login", "/signup", "/reset"];
