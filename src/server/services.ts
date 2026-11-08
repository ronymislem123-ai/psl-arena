import { analyzeFace } from "@/engine/analysis";
import { resolveBattle } from "@/engine/battle";
import type { AnalysisInput } from "@/engine/types";
import { analyzeSideView, SIDE_LANDMARK_ORDER, type SidePoints } from "@/engine/side-view";
import { base64ToBytes } from "./bytes";
import { ServiceError } from "./errors";
import { createProfile, getAnalysis, getProfile, insertAnalysis, insertBattle, insertSideAnalysis, type AnalysisRecord, type BattleRecord, type SideAnalysisRecord } from "./repos";
import { storeImage } from "./images";

export { ServiceError };

function decodeDataUrl(dataUrl: string): { buf: Uint8Array; mime: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ServiceError(400, "Invalid image data URL.");
  const buf = base64ToBytes(m[2]);
  if (buf.length > 8_000_000) throw new ServiceError(413, "Image too large (max 8 MB).");
  return { buf, mime: m[1] };
}

export function createAnalysis(userId: string, args: { profileId?: string; profileLabel?: string; imageDataUrl?: string; storeImage: boolean; input: AnalysisInput }): AnalysisRecord {
  const result = analyzeFace(args.input);
  if (!result.quality.analyzable) {
    throw new ServiceError(422, `Image not analyzable: ${result.quality.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ")}`);
  }
  let profile = args.profileId ? getProfile(userId, args.profileId) : null;
  if (args.profileId && !profile) throw new ServiceError(404, "Profile not found.");
  if (!profile) profile = createProfile(userId, args.profileLabel?.trim() || "Unnamed");

  let imageId: string | null = null;
  if (args.storeImage && args.imageDataUrl) {
    const { buf, mime } = decodeDataUrl(args.imageDataUrl);
    imageId = storeImage(userId, buf, mime, args.input.rawQuality.imageWidth, args.input.rawQuality.imageHeight).id;
  }
  return insertAnalysis({ userId, profileId: profile.id, imageId, input: args.input, result });
}

export function createBattle(userId: string, analysisAId: string, analysisBId: string): BattleRecord {
  const a = getAnalysis(userId, analysisAId);
  const b = getAnalysis(userId, analysisBId);
  if (!a || !b) throw new ServiceError(404, "Analysis not found.");
  if (a.id === b.id) throw new ServiceError(400, "Choose two different analyses.");
  const result = resolveBattle(a.result, b.result);
  return insertBattle({ userId, a, b, result });
}

export function createSideAnalysis(
  userId: string,
  args: { profileId?: string; profileLabel?: string; imageDataUrl?: string; storeImage: boolean; imageWidth: number; imageHeight: number; points: SidePoints },
): SideAnalysisRecord {
  for (const id of SIDE_LANDMARK_ORDER) {
    const p = args.points[id];
    if (!p || p.x < 0 || p.y < 0 || p.x > args.imageWidth || p.y > args.imageHeight) throw new ServiceError(400, `Landmark "${id}" lies outside the image.`);
  }
  const result = analyzeSideView(args.points);
  if (!result.analyzable) {
    throw new ServiceError(422, `Placement not usable: ${result.issues.filter((i) => i.severity === "error").map((i) => i.code).join(", ")}`);
  }
  let profile = args.profileId ? getProfile(userId, args.profileId) : null;
  if (args.profileId && !profile) throw new ServiceError(404, "Profile not found.");
  if (!profile) profile = createProfile(userId, args.profileLabel?.trim() || "Unnamed");

  let imageId: string | null = null;
  if (args.storeImage && args.imageDataUrl) {
    const { buf, mime } = decodeDataUrl(args.imageDataUrl);
    imageId = storeImage(userId, buf, mime, args.imageWidth, args.imageHeight).id;
  }
  return insertSideAnalysis({ userId, profileId: profile.id, imageId, imageWidth: args.imageWidth, imageHeight: args.imageHeight, points: args.points, result });
}
