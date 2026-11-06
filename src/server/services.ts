import { analyzeFace } from "@/engine/analysis";
import { resolveBattle } from "@/engine/battle";
import type { AnalysisInput } from "@/engine/types";
import { createProfile, getAnalysis, getProfile, insertAnalysis, insertBattle, type AnalysisRecord, type BattleRecord } from "./repos";
import { storeImage } from "./images";

export class ServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function decodeDataUrl(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ServiceError(400, "Invalid image data URL.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 8_000_000) throw new ServiceError(413, "Image too large (max 8 MB).");
  return { buf, mime: m[1] };
}

export function createAnalysis(args: { profileId?: string; profileLabel?: string; imageDataUrl?: string; storeImage: boolean; input: AnalysisInput }): AnalysisRecord {
  const result = analyzeFace(args.input);
  if (!result.quality.analyzable) {
    throw new ServiceError(422, `Image not analyzable: ${result.quality.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ")}`);
  }
  let profile = args.profileId ? getProfile(args.profileId) : null;
  if (args.profileId && !profile) throw new ServiceError(404, "Profile not found.");
  if (!profile) profile = createProfile(args.profileLabel?.trim() || "Unnamed");

  let imageId: string | null = null;
  if (args.storeImage && args.imageDataUrl) {
    const { buf, mime } = decodeDataUrl(args.imageDataUrl);
    imageId = storeImage(buf, mime, args.input.rawQuality.imageWidth, args.input.rawQuality.imageHeight).id;
  }
  return insertAnalysis({ profileId: profile.id, imageId, input: args.input, result });
}

export function createBattle(analysisAId: string, analysisBId: string): BattleRecord {
  const a = getAnalysis(analysisAId);
  const b = getAnalysis(analysisBId);
  if (!a || !b) throw new ServiceError(404, "Analysis not found.");
  if (a.id === b.id) throw new ServiceError(400, "Choose two different analyses.");
  const result = resolveBattle(a.result, b.result);
  return insertBattle({ a, b, result });
}
