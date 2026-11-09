import type { TournamentCategory, TournamentConfig } from "./types";

/**
 * The twelve built-in categories (rubric 3.0, front profile only). Categories that correspond to a
 * rubric category use its score (`area`); the others average a
 * selection of criteria. By default only "Best Overall Face" carries weight, so the
 * weighted tournament overall equals the rubric's overall score and no criterion is
 * counted twice; users can re-weight categories in the wizard.
 */
export const DEFAULT_CATEGORIES: TournamentCategory[] = [
  { id: "overallFace", name: "Best Overall Face", criteria: [], overall: true, weight: 1, builtIn: true },
  { id: "jawline", name: "Best Jawline", criteria: [{ id: "jawWidth", weight: 5 }, { id: "jawlineDefinition", weight: 2 }, { id: "neckWidth", weight: 1 }], weight: 0, builtIn: true },
  { id: "cheekbones", name: "Best Cheekbones", criteria: [{ id: "cheekbonePosition", weight: 2 }, { id: "cheekboneProjection", weight: 2 }], weight: 0, builtIn: true },
  { id: "eyeArea", name: "Best Eye Area", criteria: [], area: "eye", weight: 0, builtIn: true },
  { id: "harmony", name: "Best Facial Harmony", criteria: [{ id: "facialThirds", weight: 2 }, { id: "eyeMouthLength", weight: 2 }, { id: "facialFifths", weight: 1 }, { id: "faceShape", weight: 2 }, { id: "foreheadHeight", weight: 1 }], weight: 0, builtIn: true },
  { id: "symmetry", name: "Best Symmetry", criteria: [{ id: "eyeSymmetry", weight: 1 }, { id: "noseSymmetry", weight: 1 }, { id: "mouthSymmetry", weight: 1 }, { id: "jawChinSymmetry", weight: 1 }], weight: 0, builtIn: true },
  { id: "proportions", name: "Best Facial Proportions", criteria: [], area: "harmonySymmetry", weight: 0, builtIn: true },
  { id: "midface", name: "Best Midface", criteria: [], area: "midfaceFront", weight: 0, builtIn: true },
  { id: "chin", name: "Best Chin", criteria: [{ id: "chinWidthShape", weight: 2 }, { id: "lowerThirdProportions", weight: 1 }, { id: "lipChinVertical", weight: 1 }], weight: 0, builtIn: true },
  { id: "lowerThird", name: "Best Lower Third", criteria: [], area: "lowerThird", weight: 0, builtIn: true },
  { id: "noseHarmony", name: "Best Nose Harmony", criteria: [], area: "nose", weight: 0, builtIn: true },
  { id: "boneStructure", name: "Best Overall Bone Structure", criteria: [{ id: "jawWidth", weight: 2 }, { id: "chinWidthShape", weight: 1 }, { id: "cheekbonePosition", weight: 2 }, { id: "foreheadWidth", weight: 1 }, { id: "jawlineDefinition", weight: 1 }, { id: "cheekboneProjection", weight: 1 }], weight: 0, builtIn: true },
];

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  format: "ranking",
  seeding: "rating",
  randomSeed: 20251106,
  winnerMethod: "weighted",
  decisiveCategoryId: "overallFace",
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
