"use client";
import type { AnalysisInput } from "@/engine/types";
import type { AnalysisRecord, AnalysisSummary, BattleRecord, BattleSummary, ProfileRow } from "@/server/repos";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
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
};

export const imageUrl = (id: string | null | undefined) => (id ? `/api/images/${id}` : null);
