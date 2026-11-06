/**
 * PSL ARENA — shared engine types.
 *
 * The engine is pure TypeScript (no DOM, no Node APIs) so the exact same code
 * runs in the browser (live preview) and on the server (persisted results).
 *
 * Coordinate conventions
 * - `raw`     : pixel coordinates of the uploaded image (x → right, y → down).
 * - `aligned` : raw coordinates rotated about the inter-pupillary midpoint so the
 *               inter-pupillary line is horizontal (head-roll normalisation).
 *               All distances are rotation-invariant; angles are measured in
 *               the aligned frame relative to the inter-pupillary line.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Point3 extends Point {
  z: number;
}

/** Where a landmark came from. */
export type LandmarkSource =
  | "model" // directly output by the landmark model
  | "derived" // computed from model points (midpoints, line intersections, …)
  | "estimated" // estimated by image analysis (e.g. hairline scan)
  | "manual"; // placed/adjusted by the user

/**
 * How precisely the semantic point is localised in a frontal 2D photo.
 * high   – crisp soft-tissue features (canthi, pupils, mouth corners, subnasale, menton)
 * medium – feature boundaries with definitional spread (alar base, brow ends, lips)
 * low    – soft-tissue stand-ins for bony landmarks (zygion, gonion, frontotemporale)
 *          or estimates (hairline, neck)
 */
export type LandmarkPrecision = "high" | "medium" | "low";

export type FaceRegion =
  | "eye"
  | "brow"
  | "nose"
  | "mouth"
  | "chin"
  | "jaw"
  | "cheek"
  | "forehead"
  | "midline"
  | "neck";

export type Side = "left" | "right" | "mid";

export type SemanticLandmarkId =
  // eyes
  | "pupil_R"
  | "pupil_L"
  | "endocanthion_R"
  | "endocanthion_L"
  | "exocanthion_R"
  | "exocanthion_L"
  | "palpebrale_sup_R"
  | "palpebrale_sup_L"
  | "palpebrale_inf_R"
  | "palpebrale_inf_L"
  // brows
  | "brow_medial_R"
  | "brow_medial_L"
  | "brow_lateral_R"
  | "brow_lateral_L"
  | "brow_apex_R"
  | "brow_apex_L"
  | "brow_lower_mid_R"
  | "brow_lower_mid_L"
  | "brow_line" // derived mid-brow reference on the midline
  // nose
  | "nasion"
  | "nose_bridge" // rhinion-level bridge point
  | "pronasale"
  | "subnasale"
  | "alare_R"
  | "alare_L"
  // mouth
  | "cheilion_R"
  | "cheilion_L"
  | "labrale_sup"
  | "labrale_inf"
  | "stomion_sup"
  | "stomion_inf"
  | "stomion"
  // face / midline
  | "trichion"
  | "glabella"
  | "menton"
  | "chin_corner_R"
  | "chin_corner_L"
  | "gonion_R"
  | "gonion_L"
  | "zygion_R"
  | "zygion_L"
  | "frontotemporale_R"
  | "frontotemporale_L"
  | "ramus_upper_R"
  | "ramus_upper_L"
  | "mandible_body_R"
  | "mandible_body_L"
  | "forehead_top" // top of the detected mesh (NOT the hairline)
  // neck (manual only)
  | "neck_R"
  | "neck_L";

export interface SemanticLandmark {
  id: SemanticLandmarkId;
  label: string;
  region: FaceRegion;
  side: Side;
  source: LandmarkSource;
  precision: LandmarkPrecision;
  /** Original image pixel coordinates (for drawing). */
  raw: Point;
  /** Roll-normalised coordinates (for measuring). */
  aligned: Point;
  /** Mesh index when the point is a direct model output. */
  meshIndex?: number;
  /** Mesh indices that contributed to a derived point. */
  meshIndices?: number[];
  /** 0..1 — localisation confidence used for measurement confidence. */
  confidence: number;
  note?: string;
}

export type LandmarkMap = Partial<Record<SemanticLandmarkId, SemanticLandmark>>;

export interface AlignedMesh {
  /** 478 raw mesh points in image pixels. */
  raw: Point[];
  /** 478 roll-normalised points. */
  aligned: Point[];
  /** Rotation applied (degrees, positive = counter-clockwise in image space). */
  rollDeg: number;
  /** Centre of rotation (inter-pupillary midpoint, raw pixels). */
  pivot: Point;
}

// ---------------------------------------------------------------------------
// Ratio database
// ---------------------------------------------------------------------------

export type RatioId =
  | "ESR"
  | "OCD"
  | "ICD"
  | "EAR"
  | "PFL_BYZGO"
  | "M_IPD"
  | "EBL"
  | "EBS"
  | "ICD_N"
  | "EME"
  | "IAA"
  | "JFA"
  | "DEV_IAA_JFA"
  | "BIT"
  | "DEV_BIT_BIG"
  | "BIG"
  | "JWHR"
  | "M_BIG"
  | "GS"
  | "M_N"
  | "MF"
  | "FWHR"
  | "TFWHR"
  | "CBS"
  | "N_H"
  | "M_C"
  | "NBR_ALA"
  | "N_BYZGO"
  | "CT"
  | "ET"
  | "DEV_CT_ET"
  | "FWHF"
  | "LL_UL"
  | "L3P"
  | "LFF"
  | "C_P"
  | "FT_L"
  | "FT_M"
  | "FT_U"
  | "LIP_WHR"
  | "NW"
  | "EYS";

export type AdditionalMeasurementId =
  | "CMA"
  | "GA"
  | "FH_FINGER"
  | "FIFTHS"
  | "BYZ_BIG"
  | "EAR_ANGLE"
  | "NOSE_CHIN";

/** Scoring categories used for category indices and battle rounds. */
export type CategoryId =
  | "eyeArea"
  | "midface"
  | "nose"
  | "lips"
  | "jawline"
  | "lowerThird"
  | "structure";

export type RatioUnit = "percent" | "ratio" | "degrees";

/**
 * defined       – formula and reference points are explicitly given in the source material
 * reconstructed – the measurement convention had to be reconstructed; scored, but flagged
 * incomplete    – not fully defined in the material; NEVER scored (value may be absent)
 */
export type DefinitionStatus = "defined" | "reconstructed" | "incomplete";

export interface T1Range {
  /** null = open-ended on that side */
  min: number | null;
  max: number | null;
}

export type Tier = "T1" | "T2" | "T3" | "T4" | "T5";

/**
 * Optional outer tier boundaries. They are NOT part of the material provided to
 * this project and are therefore `null` for every ratio. The structure exists so
 * that a verified template can be entered later without code changes.
 * Each entry is the absolute deviation from the T1 edge up to which the tier applies.
 */
export interface TierBoundaries {
  t2: number;
  t3: number;
  t4: number;
  /** anything beyond t4 is T5 */
}

export interface RatioDefinition {
  id: RatioId;
  number: number; // 1..42
  name: string;
  abbreviation: string;
  category: CategoryId;
  unit: RatioUnit;
  /** Human-readable formula. */
  formula: string;
  /** Semantic landmark inputs. */
  landmarks: SemanticLandmarkId[];
  t1: T1Range;
  /** Mathematical midpoint of the T1 range (or the bound for one-sided ranges). */
  target: number | null;
  /** Tolerance unit for the PSL ARENA harmony index (see docs/SCORING.md). */
  tolerance: number;
  status: DefinitionStatus;
  tierBoundaries: TierBoundaries | null;
  /** How the value is measured in this implementation. */
  methodology: string;
  source: string;
  limitations: string[];
  /** Ratios this one is statistically dependent on (used for weighting). */
  dependencies: RatioId[];
  /** Weight inside its category / the harmony index (dependency-adjusted). */
  weight: number;
  /** Sensitivity flags used for confidence propagation. */
  sensitivity: {
    yaw: boolean; // horizontal widths are foreshortened by yaw
    expression: ("mouth" | "eyes" | "brows" | "jaw")[];
    depth: boolean; // affected by perspective/capture distance
    hairline: boolean;
  };
  notes?: string;
}

export interface AdditionalMeasurementDefinition {
  id: AdditionalMeasurementId;
  name: string;
  description: string;
  unit: RatioUnit | "none";
  referenceValue: string | null;
  status: "measurable" | "raw-only" | "unavailable-frontal" | "undefined";
  methodology: string;
  limitations: string[];
  landmarks: SemanticLandmarkId[];
}

export type Availability = "available" | "unavailable" | "excluded";

export interface RatioResult {
  id: RatioId;
  value: number | null;
  availability: Availability;
  unavailableReason?: string;
  /** 0..1 */
  confidence: number;
  /** true when confidence is below the "uncertain" threshold */
  uncertain: boolean;
  inT1: boolean | null;
  /** Signed distance outside the T1 range in the ratio's unit (0 when inside). */
  deviation: number | null;
  /** Deviation normalised by the tolerance (0 when inside T1). */
  normalizedDeviation: number | null;
  tier: Tier | null;
  tierPoints: number | null;
  tierNote: string;
  /** PSL ARENA harmony index 0..100 (null when unavailable). */
  index: number | null;
  /** Raw intermediate quantities (pixels in the aligned frame) for explanations. */
  intermediate: Record<string, number>;
  /** Standard deviation of the value under landmark jitter (Monte Carlo). */
  valueSigma?: number;
}

export interface AdditionalMeasurementResult {
  id: AdditionalMeasurementId;
  value: number | null;
  values?: Record<string, number>;
  availability: Availability;
  note: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export interface Coverage {
  evaluable: number;
  total: number;
  unavailable: number;
  incomplete: number;
  excluded: number;
  uncertain: number;
  /** evaluable / total */
  fraction: number;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** 0..100, null when no member ratio is available */
  index: number | null;
  coverage: { available: number; total: number };
  /** Mean confidence of the available member ratios */
  confidence: number;
  contributors: RatioId[];
  /** Weight of the category inside the proportion score */
  weight: number;
  sigma?: number;
}

export interface OriginalScoring {
  system: "T1–T5 (source material)";
  t1Count: number;
  outsideT1Count: number;
  evaluableCount: number;
  unavailableCount: number;
  incompleteCount: number;
  uncertainCount: number;
  pointsFromT1: number;
  theoreticalMax: 420;
  /**
   * Only defined when all 42 ratios have a determinable tier. With the material
   * at hand (T1 ranges only) this is always null and the field documents why.
   */
  originalPercent: number | null;
  originalPercentNote: string;
  /** T1 points / (10 × evaluable) — clearly labelled coverage-adjusted figure. */
  coverageAdjustedT1Percent: number | null;
  undeterminedTierCount: number;
}

export interface SymmetryMetric {
  id: string;
  label: string;
  /** raw asymmetry in `unit` */
  value: number;
  unit: "deg" | "ipd" | "percent";
  tolerance: number;
  score: number; // 0..100
  landmarks: SemanticLandmarkId[];
}

export interface SymmetryResult {
  score: number | null;
  metrics: SymmetryMetric[];
  confidence: number;
  note: string;
  sigma?: number;
}

export type FeatureKind = "measured" | "approximate" | "visual-estimate" | "not-determinable";

export interface FeatureObservation {
  id: string;
  group: "eyesBrows" | "midface" | "jawChin" | "noseLips" | "overall";
  label: string;
  kind: FeatureKind;
  /** Textual summary (unit-aware). */
  summary: string;
  value?: number;
  unit?: string;
  sourceRatio?: RatioId;
  note?: string;
}

export interface UncertaintyReport {
  method: string;
  samples: number;
  /** Landmark jitter sigma in pixels (model landmarks, high precision). */
  jitterPx: number;
  overallSigma: number;
  proportionSigma: number;
  harmonySigma: number;
  symmetrySigma: number;
  categorySigma: Record<CategoryId, number>;
}

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

export type QualityLevel = "good" | "acceptable" | "poor" | "unusable";

export interface QualityMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  score: number; // 0..1
  level: QualityLevel;
  hint: string;
}

export interface QualityIssue {
  code:
    | "no-face"
    | "multiple-faces"
    | "low-resolution"
    | "blurry"
    | "too-dark"
    | "too-bright"
    | "low-contrast"
    | "yaw"
    | "pitch"
    | "roll"
    | "expression"
    | "mouth-open"
    | "eyes-closed"
    | "hairline-not-found"
    | "selfie-perspective"
    | "face-cut-off";
  severity: "info" | "warning" | "error";
  message: string;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface ExpressionReport {
  smile: number;
  jawOpen: number;
  blink: number;
  browRaise: number;
  browDown: number;
  pucker: number;
  squint: number;
  /** 0..1 — 1 = fully neutral */
  neutrality: number;
  level: QualityLevel;
}

export type CaptureDistance = "unknown" | "selfie" | "standard";

export interface RawQualityMetrics {
  imageWidth: number;
  imageHeight: number;
  faceWidthPx: number;
  faceHeightPx: number;
  /** Variance of Laplacian on a 256-px-wide grayscale face crop. */
  sharpness: number;
  /** Mean luminance 0..255 of the face crop. */
  brightness: number;
  /** Std-dev of luminance of the face crop. */
  contrast: number;
  /** Face bounding box in pixels. */
  faceBox: { x: number; y: number; w: number; h: number };
  faceCount: number;
}

export interface QualityReport {
  level: QualityLevel;
  /** 0..1 overall usability score */
  score: number;
  metrics: QualityMetric[];
  issues: QualityIssue[];
  pose: HeadPose;
  expression: ExpressionReport;
  captureDistance: CaptureDistance;
  faceCount: number;
  faceWidthPx: number;
  /** Whether the analysis may proceed at all. */
  analyzable: boolean;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface AnalysisConfig {
  /** Include reconstructed-status ratios in scoring (default true). */
  includeReconstructed: boolean;
  captureDistance: CaptureDistance;
  /** Monte-Carlo samples for uncertainty (default 40, 0 disables). */
  uncertaintySamples: number;
  /** Deterministic seed for the uncertainty simulation. */
  seed: number;
}

export interface ManualPoints {
  trichion?: Point;
  neckRight?: Point;
  neckLeft?: Point;
}

export interface AnalysisInput {
  /** 478 mesh points in image pixel coordinates (MediaPipe Face Landmarker order). */
  mesh: Point[];
  /** Estimated / manual extra points (raw pixel coords). */
  trichion?: { point: Point; source: "estimated" | "manual"; confidence: number } | null;
  neck?: { right: Point; left: Point; source: "manual" } | null;
  /** Blendshape coefficients keyed by name (ARKit-style). */
  blendshapes: Record<string, number>;
  /** 4x4 facial transformation matrix (column-major, 16 numbers) if available. */
  transformMatrix?: number[] | null;
  rawQuality: RawQualityMetrics;
  config: AnalysisConfig;
}

export interface AnalysisResult {
  engineVersion: string;
  createdAt: string;
  config: AnalysisConfig;
  landmarks: SemanticLandmark[];
  mesh: AlignedMesh;
  quality: QualityReport;
  ratios: RatioResult[];
  additional: AdditionalMeasurementResult[];
  symmetry: SymmetryResult;
  features: FeatureObservation[];
  categories: CategoryScore[];
  original: OriginalScoring;
  coverage: Coverage;
  scores: {
    /** Flat, dependency- and confidence-weighted mean of all available ratio indices. */
    harmony: number | null;
    /** Category-weighted mean of category indices. */
    proportion: number | null;
    /** Composite of jawline, midface and structure categories (display only). */
    structure: number | null;
    symmetry: number | null;
    /** 0.8 × proportion + 0.2 × symmetry */
    overall: number | null;
    /** Mean confidence of available ratios (0..1). */
    confidence: number;
  };
  uncertainty: UncertaintyReport | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

export type RoundWinner = "A" | "B" | "draw" | "n/a";
export type Verdict = "A" | "B" | "draw" | "inconclusive";

export interface BattleRound {
  id: CategoryId | "harmony" | "symmetry";
  label: string;
  a: number | null;
  b: number | null;
  diff: number | null;
  /** Decision margin derived from both sides' uncertainty (points). */
  margin: number;
  winner: RoundWinner;
  confidenceA: number;
  confidenceB: number;
  weight: number;
}

export interface KeyDifference {
  ratioId: RatioId;
  a: number | null;
  b: number | null;
  indexA: number | null;
  indexB: number | null;
  /** index difference B − A */
  delta: number;
  favours: "A" | "B";
}

export interface BattleResult {
  engineVersion: string;
  rounds: BattleRound[];
  roundWinsA: number;
  roundWinsB: number;
  roundDraws: number;
  overallA: number | null;
  overallB: number | null;
  diff: number | null;
  margin: number;
  verdict: Verdict;
  verdictReason: string;
  coverageA: number;
  coverageB: number;
  confidenceA: number;
  confidenceB: number;
  keyDifferences: KeyDifference[];
  summary: string;
}
