"use client";
import type { AnalysisInput } from "@/engine/types";
import type { AnalysisRecord, AnalysisSummary, BattleRecord, BattleSummary, ProfileRow } from "@/server/repos";

const AUTH_URLS = ["/api/auth/login", "/api/auth/signup", "/api/auth/me", "/api/auth/logout", "/api/auth/recovery/reset"];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && typeof window !== "undefined" && !AUTH_URLS.includes(url)) {
    const target = new URL("/login", window.location.origin);
    target.searchParams.set("next", window.location.pathname + window.location.search);
    window.location.assign(target.toString()); // full reload: the session is gone, drop all client state

  }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export const api = {
  createAnalysis: (payload: {
    profileId?: string;
    profileLabel?: string;
    imageDataUrl?: string;
    storeImage: boolean;
    consent: { rightsConfirmed: true; adultsConfirmed: true };
    input: AnalysisInput;
  }) => request<{ analysis: AnalysisRecord }>("/api/analyses", { method: "POST", body: JSON.stringify(payload) }),
  createBattle: (analysisAId: string, analysisBId: string) => request<{ battle: BattleRecord }>("/api/battles", { method: "POST", body: JSON.stringify({ analysisAId, analysisBId }) }),
  listProfiles: () => request<{ profiles: ProfileRow[] }>("/api/profiles"),
  listAnalyses: (profileId?: string) => request<{ analyses: AnalysisSummary[] }>(`/api/analyses${profileId ? `?profileId=${profileId}` : ""}`),
  listBattles: () => request<{ battles: BattleSummary[] }>("/api/battles"),
  deleteBattle: (id: string) => request<{ deleted: boolean }>(`/api/battles/${id}`, { method: "DELETE" }),
  deleteAnalysis: (id: string) => request<{ deleted: boolean }>(`/api/analyses/${id}`, { method: "DELETE" }),
  deleteProfile: (id: string) => request<{ deleted: boolean }>(`/api/profiles/${id}`, { method: "DELETE" }),
  renameProfile: (id: string, label: string) => request<{ profile: ProfileRow }>(`/api/profiles/${id}`, { method: "PATCH", body: JSON.stringify({ label }) }),
  deleteAll: () => request<{ deleted: boolean }>("/api/data", { method: "DELETE" }),
  // auth
  signup: (data: { email: string; password: string; name?: string }) => request<{ user: AuthUserDto; recoveryCodes: string[] }>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (data: { email: string; code: string; newPassword: string }) => request<{ user: AuthUserDto; remainingCodes: number }>("/api/auth/recovery/reset", { method: "POST", body: JSON.stringify(data) }),
  recoveryStatus: () => request<{ remaining: number; total: number }>("/api/auth/recovery/codes"),
  regenerateCodes: (password: string) => request<{ codes: string[]; remaining: number; total: number }>("/api/auth/recovery/codes", { method: "POST", body: JSON.stringify({ password }) }),
  login: (data: { email: string; password: string }) => request<{ user: AuthUserDto }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: "{}" }),
  me: () => request<{ user: AuthUserDto }>("/api/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) => request<{ ok: boolean }>("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  logoutOthers: () => request<{ ok: boolean }>("/api/auth/sessions", { method: "DELETE" }),
  deleteAccount: (password: string) => request<{ deleted: boolean }>("/api/auth/account", { method: "DELETE", body: JSON.stringify({ password }) }),
};

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const imageUrl = (id: string | null | undefined) => (id ? `/api/images/${id}` : null);
