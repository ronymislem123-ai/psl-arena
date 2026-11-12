"use client";
import type { AnalysisInput } from "@/engine/types";
import type { AnalysisRecord, AnalysisSummary, BattleRecord, BattleSummary, ProfileRow } from "@/server/repos";
import type { RatingRecord, RatingSummary, ScaleInput, ScaleSummary, TournamentRecord, TournamentSummary, TournamentVersionRow } from "@/server/repos-psl";
import type { PslScale, ScaleExport } from "@/engine/psl/scale";
import type { TournamentConfig } from "@/engine/tournament/types";
import type { CategoryRanking } from "@/engine/tournament/types";
import { request } from "./transport";

export { imageUrl, downloadApi } from "./transport";

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
  // PSL scales
  listScales: () => request<{ scales: ScaleSummary[] }>("/api/scales"),
  getScale: (id: string) => request<{ scale: PslScale }>(`/api/scales/${id}`),
  createScale: (input: ScaleInput) => request<{ scale: PslScale }>("/api/scales", { method: "POST", body: JSON.stringify(input) }),
  updateScale: (id: string, input: ScaleInput) => request<{ scale: PslScale }>(`/api/scales/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteScale: (id: string) => request<{ deleted: boolean }>(`/api/scales/${id}`, { method: "DELETE" }),
  duplicateScale: (id: string, name?: string) => request<{ scale: PslScale }>(`/api/scales/${id}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }),
  importScale: (data: ScaleExport, name?: string) => request<{ scale: PslScale }>("/api/scales/import", { method: "POST", body: JSON.stringify({ data, name }) }),
  addTierImage: (id: string, payload: { tierId: string; imageDataUrl: string; width: number; height: number; caption: string }) => request<{ scale: PslScale }>(`/api/scales/${id}/images`, { method: "POST", body: JSON.stringify(payload) }),
  // ratings
  listRatings: (profileId?: string) => request<{ ratings: RatingSummary[] }>(`/api/ratings${profileId ? `?profileId=${profileId}` : ""}`),
  getRating: (id: string) => request<{ rating: RatingRecord }>(`/api/ratings/${id}`),
  createRating: (payload: {
    analysisId?: string;
    newAnalysis?: { profileId?: string; profileLabel?: string; imageDataUrl?: string; storeImage: boolean; input: AnalysisInput };
    scaleId?: string;
    consent: { rightsConfirmed: true; adultsConfirmed: true };
    visualConsent?: boolean;
    visualImageDataUrl?: string;
    lang?: "de" | "en";
    selfAssessment?: Partial<Record<"eyeShape" | "lipShape" | "cheekboneProjection" | "jawlineDefinition", number>> | null;
  }) => request<{ rating: RatingRecord }>("/api/ratings", { method: "POST", body: JSON.stringify(payload) }),
  rubric: () => request<{ version: string; visualProvider: { configured: boolean; providerId: string | null; model: string | null; criteria: string[]; hint: "notConfigured" | "missingKey" | "browserKey" | null } }>("/api/rubric"),
  deleteRating: (id: string) => request<{ deleted: boolean }>(`/api/ratings/${id}`, { method: "DELETE" }),
  leaderboards: () => request<{ participants: { id: string; name: string; imageId: string | null; score: number | null; tier: string | null }[]; categories: { id: string; name: string }[]; rankings: CategoryRanking[]; legacyExcluded?: number }>("/api/leaderboards"),
  // tournaments
  listTournaments: () => request<{ tournaments: TournamentSummary[] }>("/api/tournaments"),
  getTournament: (id: string) => request<{ tournament: TournamentRecord }>(`/api/tournaments/${id}`),
  createTournament: (payload: { name: string; description?: string; config: TournamentConfig; scaleId?: string; participants: { profileId: string; ratingId?: string; displayName?: string }[] }) => request<{ tournament: TournamentRecord }>("/api/tournaments", { method: "POST", body: JSON.stringify(payload) }),
  updateTournament: (id: string, payload: { name?: string; description?: string; config?: TournamentConfig; scaleId?: string; participants?: { profileId: string; ratingId?: string; displayName?: string }[] }) => request<{ tournament: TournamentRecord }>(`/api/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  tournamentAction: (id: string, payload: { action: "start" | "advance" | "playAll" | "pause" | "resume" | "complete" | "decide" | "reopen" | "duplicate"; matchId?: string; winnerId?: string; note?: string }) => request<{ tournament: TournamentRecord; blocked: boolean }>(`/api/tournaments/${id}/actions`, { method: "POST", body: JSON.stringify(payload) }),
  deleteTournament: (id: string) => request<{ deleted: boolean }>(`/api/tournaments/${id}`, { method: "DELETE" }),
  tournamentVersions: (id: string) => request<{ versions: TournamentVersionRow[] }>(`/api/tournaments/${id}/versions`),
  tournamentVersion: (id: string, versionId: string) => request<{ tournament: TournamentRecord }>(`/api/tournaments/${id}/versions/${versionId}`),
  // auth
  signup: (data: { email: string; password: string; name?: string }) => request<{ user: AuthUserDto; recoveryCodes: string[] }>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (data: { email: string; code: string; newPassword: string }) => request<{ user: AuthUserDto; remainingCodes: number }>("/api/auth/recovery/reset", { method: "POST", body: JSON.stringify(data) }),
  recoveryStatus: () => request<{ remaining: number; total: number }>("/api/auth/recovery/codes"),
  regenerateCodes: (password: string) => request<{ codes: string[]; remaining: number; total: number }>("/api/auth/recovery/codes", { method: "POST", body: JSON.stringify({ password }) }),
  login: (data: { email: string; password: string }) => request<{ user?: AuthUserDto; mfaRequired?: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  loginTotp: (data: { code?: string; recoveryCode?: string }) => request<{ user: AuthUserDto; usedRecoveryCode: boolean; remainingCodes: number | null }>("/api/auth/login/totp", { method: "POST", body: JSON.stringify(data) }),
  totpStatus: () => request<{ enabled: boolean; enabledAt: string | null; pending: boolean }>("/api/auth/totp/status"),
  totpSetup: (password: string) => request<{ uri: string; qrDataUrl: string; secretFormatted: string }>("/api/auth/totp/setup", { method: "POST", body: JSON.stringify({ password }) }),
  totpEnable: (code: string) => request<{ enabled: boolean; enabledAt: string | null; pending: boolean }>("/api/auth/totp/enable", { method: "POST", body: JSON.stringify({ code }) }),
  totpCancel: () => request<{ enabled: boolean }>("/api/auth/totp/cancel", { method: "POST", body: "{}" }),
  totpDisable: (password: string, code: string) => request<{ enabled: boolean }>("/api/auth/totp/disable", { method: "POST", body: JSON.stringify({ password, code }) }),
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

