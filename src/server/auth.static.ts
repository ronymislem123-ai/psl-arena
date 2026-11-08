/**
 * Browser edition of ./auth.ts. There are no accounts: everything belongs to the
 * single local user of this browser, and the data never leaves the device. Only
 * the functions used by route handlers and pages exist here.
 */
import { LEGACY_USER_ID } from "./db";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  totpEnabled: boolean;
}

export const LOCAL_USER: AuthUser = { id: LEGACY_USER_ID, email: "", name: "Local", createdAt: "1970-01-01T00:00:00.000Z", totpEnabled: false };

export function userFromRequest(req: Request): AuthUser | null {
  void req; // same signature as the server version
  return LOCAL_USER;
}

export function requireUserApi(req: Request): AuthUser {
  void req;
  return LOCAL_USER;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return LOCAL_USER;
}

export async function requireUser(nextPath?: string): Promise<AuthUser> {
  void nextPath;
  return LOCAL_USER;
}
