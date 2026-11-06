import type { TournamentCategory, TournamentConfig } from "./types";

/** The twelve built-in categories. Weights follow the brief's example (others 0 = not part of the weighted overall by default). */
export const DEFAULT_CATEGORIES: TournamentCategory[] = [
  { id: "overallFace", name: "Best Overall Face", criteria: [], overall: true, weight: 0, builtIn: true },
  { id: "jawline", name: "Best Jawline", criteria: [{ id: "jawWidth", weight: 5 }, { id: "jawHeightRatio", weight: 2 }, { id: "jawAngularityFrontal", weight: 2 }, { id: "gonialAngle", weight: 3 }, { id: "jawlineDefinition", weight: 1 }], weight: 20, builtIn: true },
  { id: "cheekbones", name: "Best Cheekbones", criteria: [{ id: "cheekbonePosition", weight: 2 }, { id: "cheekboneProjection", weight: 2 }, { id: "fwhr", weight: 1 }], weight: 15, builtIn: true },
  { id: "eyeArea", name: "Best Eye Area", criteria: [{ id: "canthalTilt", weight: 4 }, { id: "eyeSpacing", weight: 4 }, { id: "fissureProportions", weight: 3 }, { id: "browArea", weight: 3 }, { id: "upperLidExposure", weight: 2 }, { id: "scleralShow", weight: 1 }, { id: "eyeShape", weight: 1 }], weight: 15, builtIn: true },
  { id: "harmony", name: "Best Facial Harmony", criteria: [{ id: "areaBalance", weight: 7 }, { id: "verticalBalance", weight: 3 }, { id: "profileConvexity", weight: 3 }, { id: "lowerFaceHarmony", weight: 3 }], weight: 25, builtIn: true },
  { id: "symmetry", name: "Best Symmetry", criteria: [{ id: "eyeSymmetry", weight: 3 }, { id: "noseSymmetry", weight: 2 }, { id: "mouthSymmetry", weight: 2 }, { id: "jawChinSymmetry", weight: 3 }], weight: 15, builtIn: true },
  { id: "proportions", name: "Best Facial Proportions", criteria: [{ id: "midfaceRatio", weight: 3 }, { id: "facialThirds", weight: 3 }, { id: "fwhr", weight: 2 }, { id: "faceShape", weight: 2 }, { id: "lowerThirdProportions", weight: 1 }, { id: "facialFifths", weight: 1 }, { id: "eyeMouthGeometry", weight: 2 }], weight: 10, builtIn: true },
  { id: "midface", name: "Best Midface", criteria: [{ id: "midfaceRatio", weight: 3 }, { id: "cheekbonePosition", weight: 2 }, { id: "eyeMouthGeometry", weight: 2 }, { id: "fwhr", weight: 2 }], weight: 0, builtIn: true },
  { id: "chin", name: "Best Chin", criteria: [{ id: "chinWidthShape", weight: 2 }, { id: "chinProjection", weight: 3 }, { id: "lowerThirdProportions", weight: 1 }, { id: "neckChinDefinition", weight: 1 }], weight: 0, builtIn: true },
  { id: "profile", name: "Best Profile", criteria: [{ id: "gonialAngle", weight: 3 }, { id: "chinProjection", weight: 3 }, { id: "neckChinDefinition", weight: 2 }, { id: "noseProjection", weight: 2 }, { id: "nasalAngles", weight: 2 }, { id: "nasolabialAngle", weight: 1 }, { id: "lipChinVertical", weight: 1 }, { id: "profileConvexity", weight: 3 }, { id: "lowerFaceHarmony", weight: 3 }], weight: 0, builtIn: true },
  { id: "noseHarmony", name: "Best Nose Harmony", criteria: [{ id: "noseWidth", weight: 3 }, { id: "noseHeightWidth", weight: 2 }, { id: "noseProjection", weight: 2 }, { id: "nasalAngles", weight: 2 }, { id: "noseSymmetry", weight: 1 }], weight: 0, builtIn: true },
  { id: "boneStructure", name: "Best Overall Bone Structure", criteria: [{ id: "jawWidth", weight: 5 }, { id: "jawHeightRatio", weight: 2 }, { id: "jawAngularityFrontal", weight: 2 }, { id: "gonialAngle", weight: 3 }, { id: "chinProjection", weight: 3 }, { id: "neckChinDefinition", weight: 2 }, { id: "chinWidthShape", weight: 2 }, { id: "cheekboneProjection", weight: 2 }, { id: "jawlineDefinition", weight: 1 }, { id: "fwhr", weight: 1 }], weight: 0, builtIn: true },
];

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  format: "ranking",
  seeding: "rating",
  randomSeed: 20251106,
  winnerMethod: "weighted",
  decisiveCategoryId: "harmony",
  tieEpsilon: 0.05,
  groupSize: 4,
  qualifyPerGroup: 2,
  minCategoryCoverage: 0.5,
  categories: DEFAULT_CATEGORIES,
};

/** Normalised category weights (sum = 1). All-zero weights fall back to equal weights. */
export function normalizeWeights(categories: TournamentCategory[]): Map<string, number> {
  const total = categories.reduce((s, c) => s + Math.max(0, c.weight), 0);
  const out = new Map<string, number>();
  if (total <= 0) {
    for (const c of categories) out.set(c.id, 1 / categories.length);
    return out;
  }
  for (const c of categories) out.set(c.id, Math.max(0, c.weight) / total);
  return out;
}
