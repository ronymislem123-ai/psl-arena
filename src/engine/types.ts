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
  /** Relative depth (pixels, same scale as x, larger = further from the camera) when the landmark model provides it. */
  z?: number;
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
  /** Language-neutral note code (UI translates). */
  noteCode?: LandmarkNoteCode;
  /** engine 2.0: moved by the user (manual correction); the automatic position is kept in originalRaw */
  corrected?: boolean;
  originalRaw?: Point;
}

export type LandmarkNoteCode =
  | "nasion"
  | "alare"
  | "glabella"
  | "meshTop"
  | "chinCorner"
  | "frontotemporale"
  | "zygion"
  | "gonionConstructed"
  | "gonionFallback"
  | "trichionManual"
  | "trichionEstimated"
  | "neckManual"
  | "browLine";

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
  /**
   * "3d": pose-normalised with the landmark depth (rigid fit to the canonical face,
   * rotated back to frontal, weak-perspective approximation); "2d": in-plane roll
   * correction only (no depth available). Missing on results of engine 1.x (= "2d").
   */
  method?: "3d" | "2d";
  /** Head rotation found by the 3D fit (degrees; yaw + = face turned to image right, pitch + = chin up, roll + = clockwise). */
  pose3d?: HeadPose;
  /** Manual adjustment of the horizontal reference axis included in the alignment (degrees). */
  axisAdjustDeg?: number;
  /** Row-major 3×3 rotation (template → detected) and the fit centroid, to map further points. */
  rotation?: number[];
  centroid?: { x: number; y: number; z: number };
  /** 2D shift that keeps the pupil midpoint at its raw position. */
  offset?: { x: number; y: number };
  /** Residual in-plane rotation applied after the 3D correction so the pupil line is horizontal. */
  levelDeg?: number;
  /** RMS residual of the rigid fit in IPD units (shape mismatch + landmark noise). */
  residualIpd?: number;
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
  | "NOSE_CHIN"
  | "EML"
  | "MRD1"
  | "SSI";

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

export type UnavailableCode = "incomplete" | "hairline" | "neck" | "landmarks" | "computation" | "excluded";
export type TierCode = "inT1" | "outsideUndetermined" | "verifiedTier" | "notScoredIncomplete" | "notScoredLandmarks" | "notScoredComputation" | "excluded";

export interface RatioResult {
  id: RatioId;
  value: number | null;
  availability: Availability;
  unavailableReason?: string;
  /** Language-neutral reason (UI translates); `missingLandmarks` lists the ids for "landmarks". */
  unavailableCode?: UnavailableCode;
  missingLandmarks?: SemanticLandmarkId[];
  tierCode?: TierCode;
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
  /** engine 2.0: measured and shown, but not scored (reference contradicted by evidence or not matching the measurement construction) */
  excludedFromScore?: boolean;
}

export type AdditionalNoteCode = "eyelid" | "requiresProfile" | "requiresProfileSeeGS" | "fingerRule" | "fifths" | "byzBig" | "noEarLandmarks" | "noseChin" | "eyeMouthLength" | "hairlineMissing" | "landmarksMissing";

export interface AdditionalMeasurementResult {
  id: AdditionalMeasurementId;
  value: number | null;
  values?: Record<string, number>;
  availability: Availability;
  note: string;
  noteCode?: AdditionalNoteCode;
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
  /** asymmetry in `unit` (engine 2.0: noise-floor corrected when σ is known) */
  value: number;
  /** signed asymmetry before taking the absolute value (R − L convention of the metric) */
  signed?: number;
  /** absolute asymmetry before the noise-floor correction */
  rawValue?: number;
  /** σ of the signed asymmetry under landmark noise (Monte-Carlo) */
  sigma?: number;
  unit: "deg" | "ipd" | "percent";
  /** dispersion unit of the Gaussian fall-off (engine 1.x: halving constant) */
  tolerance: number;
  score: number; // 0..100
  landmarks: SemanticLandmarkId[];
}

export interface SymmetryResult {
  score: number | null;
  metrics: SymmetryMetric[];
  confidence: number;
  note: string;
  noteCode?: "pupilsMissing" | "yawInflates" | "standard";
  sigma?: number;
}

export type FeatureKind = "measured" | "approximate" | "visual-estimate" | "not-determinable";

export type FeatureSummaryCode =
  | "ratioValue" // params: value, unit, inT1
  | "ratioUnavailable" // params: unavailableCode
  | "eyeShape" // descriptor: elongated | round | balanced; value = EAR
  | "symmetrySub" // params: score, metricIds (comma-separated)
  | "browPosition"
  | "browToEye"
  | "browShape" // descriptor: pronounced | soft | flat
  | "midfaceLength"
  | "zygomaticWidth"
  | "categoryIndex"
  | "bigonialWidth"
  | "jawAngularity" // descriptor: angular | moderate | rounded
  | "scoreValue" // params: kind
  | "featureHarmony" // descriptor: consistent | varied | uneven
  | "proportionalConsistency" // params: inT1, evaluable
  | "visualProperty"
  | "requires3D"
  | "requiresProfile"
  | "landmarksUnavailable"
  | "notEnoughCoverage"
  | "notAssessed";

export interface FeatureObservation {
  id: string;
  group: "eyesBrows" | "midface" | "jawChin" | "noseLips" | "overall";
  label: string;
  kind: FeatureKind;
  /** Textual summary (unit-aware, English fallback). */
  summary: string;
  value?: number;
  unit?: string;
  sourceRatio?: RatioId;
  note?: string;
  /** Language-neutral summary (UI translates). */
  code?: FeatureSummaryCode;
  descriptor?: string;
  params?: Record<string, number | string | boolean>;
  /** Language-neutral note code. */
  noteCode?: "aspectOnly" | "noReference" | "softTissueZygion" | "constructedGonions" | "needsProfile" | "reconstructedChin";
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
  /** σ of each rubric 2.0 category index (frontal measures) */
  rubricSigma?: Record<string, number>;
  /**
   * Per-sample indices of every frontal measure (keys r:/s:/a:, rounded to 0.1;
   * null = unavailable in that sample) so that the PSL rater can propagate the
   * correlated landmark noise through its own aggregation (engine ≥ 2.0).
   */
  measureSamples?: Record<string, (number | null)[]>;
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

export type QualityIssueKey =
  | "lowResolution.error"
  | "lowResolution.warning"
  | "blurry.error"
  | "blurry.warning"
  | "tooDark"
  | "tooBright"
  | "lowContrast.error"
  | "lowContrast.warning"
  | "yaw.error"
  | "yaw.warning"
  | "yaw.info"
  | "roll.info"
  | "exposure.bright"
  | "exposure.dark"
  | "lighting.sided"
  | "compression"
  | "editing.tag"
  | "smoothing"
  | "perspective.close"
  | "perspective.info"
  | "pitch.error"
  | "pitch.warning"
  | "roll.error"
  | "roll.warning"
  | "eyesClosed"
  | "mouthOpen.error"
  | "mouthOpen.parted"
  | "expression.smile"
  | "expression.mild"
  | "faceCutOff"
  | "multipleFaces"
  | "hairlineNotFound"
  | "selfie";

export interface QualityIssue {
  /** Language-neutral message key with parameters (UI translates). */
  key?: QualityIssueKey;
  params?: Record<string, number | string>;
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
    | "face-cut-off" | "lighting" | "compression" | "editing";
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
  // --- capture analysis (engine 2.0; optional so older inputs stay valid) ---
  /** Size of the uploaded file before the app downscaled it (long edge ≤ 1600 px). */
  sourceWidth?: number;
  sourceHeight?: number;
  /** 35 mm-equivalent focal length from EXIF (null/absent = unknown). */
  focalLength35mm?: number | null;
  /** EXIF "Software" tag (editing hint), if present. */
  editingSoftware?: string | null;
  /** Share of face-region pixels that are clipped dark (≤ 4) / bright (≥ 251). */
  clipDark?: number;
  clipBright?: number;
  /** |L − R| / mean of the mean luminance of the two cheek patches (side lighting). */
  lightingAsymmetry?: number;
  /** JPEG 8×8 block-boundary gradient ratio on the face at full resolution (null when the image was downscaled or is not a JPEG). */
  blockiness?: number | null;
  /** Fine skin texture (cheek/forehead high-pass energy) relative to the eye region (low = very smooth skin; heuristic). */
  skinTexture?: number | null;
  /** Standard deviation of the luminance along the image border (plain backdrop ⇒ low). */
  backgroundSpread?: number | null;
}

export type CaptureBasis = "measured" | "derived" | "inferred" | "undeterminable";
export type CaptureItemId = "view" | "tilt" | "elevation" | "framing" | "distance" | "selfie" | "mirror" | "photographer" | "setting" | "editing" | "smoothing" | "compression" | "exposure" | "lighting" | "occlusion";

export interface CaptureItem {
  id: CaptureItemId;
  /** language-neutral code rendered by the UI */
  value: string;
  basis: CaptureBasis;
  /** 0–1: how sure the classification is (1 for measured facts) */
  confidence: number;
  params?: Record<string, number | string>;
}

export interface CaptureReport {
  items: CaptureItem[];
  /** camera-to-face distance estimated from the EXIF focal length and the iris diameter (11.7 mm) */
  distanceCm: { estimate: number; low: number; high: number } | null;
  /** estimated apparent enlargement of central features (nose) relative to the face width from perspective (0.3 = +30 %) */
  perspectiveInflation: number | null;
}

export interface QualityReport {
  level: QualityLevel;
  /** 0..1 overall usability score */
  score: number;
  metrics: QualityMetric[];
  issues: QualityIssue[];
  pose: HeadPose;
  expression: ExpressionReport;
  /** effective capture distance (the user's setting, or "selfie"/"standard" from the distance estimate when the setting is "unknown") */
  captureDistance: CaptureDistance;
  /** capture conditions (engine 2.0) */
  capture?: CaptureReport;
  /** side-lighting asymmetry and clipped share of the face (copied from the raw metrics for the confidence model) */
  lightingAsymmetry?: number;
  clipFraction?: number;
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
  /**
   * engine 2.0: manual corrections — semantic landmarks moved by the user (raw
   * image pixels) and an adjustment of the horizontal reference axis (degrees,
   * positive = counter-clockwise in the image). Every measure is recomputed.
   */
  corrections?: AnalysisCorrections | null;
  /** Blendshape coefficients keyed by name (ARKit-style). */
  blendshapes: Record<string, number>;
  /** 4x4 facial transformation matrix (column-major, 16 numbers) if available. */
  transformMatrix?: number[] | null;
  rawQuality: RawQualityMetrics;
  config: AnalysisConfig;
  /** rubric 2.1: image-based appearance measures from the photo (browser), shown, not scored */
  appearanceImage?: import("./appearance").AppearanceImageInput | null;
}

export interface AnalysisCorrections {
  landmarks?: Partial<Record<SemanticLandmarkId, Point>>;
  axisAdjustDeg?: number;
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
  /** rubric 2.1: descriptive appearance measures of the visual criteria (never scored) */
  appearance?: import("./appearance").AppearanceMeasure[];
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
    /**
     * Engine ≥ 2.0: rubric 2.0 hierarchical index (frontal measures only; see
     * scores.rubric). Engine 1.x: 0.8 × proportion + 0.2 × symmetry.
     */
    overall: number | null;
    /** rubric 2.0 breakdown of `overall` (engine ≥ 2.0) */
    rubric?: {
      version: string;
      categories: Record<string, number | null>;
      overallArithmetic: number | null;
      compensationPenalty: number | null;
      coverage: number;
      p: number;
    };
    /** Mean confidence of available ratios (0..1). */
    confidence: number;
  };
  uncertainty: UncertaintyReport | null;
  /** engine 2.0: manual corrections applied to this analysis (flag for comparisons) */
  corrections?: { landmarks: SemanticLandmarkId[]; axisAdjustDeg: number } | null;
  warnings: string[];
  /** Language-neutral warnings (UI translates). */
  warningCodes?: { code: "unusable" | "lowCoverage" | "uncertainRatios" | "noHairline" | "smile" | "corrected"; params?: Record<string, number> }[];
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
  /** Language-neutral verdict reason (UI translates). */
  verdictCode?: "qualityFailed" | "engineMismatch" | "noOverall" | "lowCoverage" | "lowConfidence" | "draw" | "winner";
  verdictParams?: Record<string, number>;
  coverageA: number;
  coverageB: number;
  confidenceA: number;
  confidenceB: number;
  keyDifferences: KeyDifference[];
  summary: string;
}
