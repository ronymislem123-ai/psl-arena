/**
 * Semantic landmark construction on top of the MediaPipe Face Landmarker mesh
 * (478 points: 468 face mesh + 10 iris points).
 *
 * Index choices were validated empirically on frontal test portraits (see
 * docs/RATIOS.md → "Landmark mapping"). "R"/"L" are the SUBJECT's right/left as
 * defined by the mesh topology (the subject's right eye is mesh index 33/133/468).
 */
import {
  angleAt,
  dist,
  fitLine,
  intersectLines,
  midpoint,
  rotateAround,
  toDeg,
} from "../geometry";
import type {
  AlignedMesh,
  AnalysisInput,
  LandmarkMap,
  LandmarkPrecision,
  LandmarkSource,
  Point,
  SemanticLandmark,
  SemanticLandmarkId,
} from "../types";

export const MESH_POINT_COUNT = 478;

/** Direct mesh indices for single-point semantic landmarks. */
export const MESH_INDEX: Partial<Record<SemanticLandmarkId, number>> = {
  pupil_R: 468,
  pupil_L: 473,
  // canthi on the lid-junction ring (ring 1), slightly outside the visible fissure edge (33/133, 263/362)
  endocanthion_R: 243,
  endocanthion_L: 463,
  exocanthion_R: 130,
  exocanthion_L: 359,
  palpebrale_sup_R: 159,
  palpebrale_sup_L: 386,
  palpebrale_inf_R: 145,
  palpebrale_inf_L: 374,
  brow_lower_mid_R: 52,
  brow_lower_mid_L: 282,
  nasion: 168,
  nose_bridge: 6,
  pronasale: 1,
  subnasale: 2,
  // alar base at the lateral edge of the alar wing (alar crease); 129/358 lie on the cheek side of the crease
  alare_R: 48,
  alare_L: 278,
  cheilion_R: 61,
  cheilion_L: 291,
  labrale_sup: 0,
  labrale_inf: 17,
  stomion_sup: 13,
  stomion_inf: 14,
  glabella: 9,
  menton: 152,
  forehead_top: 10,
  chin_corner_R: 176,
  chin_corner_L: 400,
  frontotemporale_R: 21,
  frontotemporale_L: 251,
};

/** Face-oval contour from the chin up to the forehead top, per side. */
export const CONTOUR_R = [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
export const CONTOUR_L = [152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338, 10];

export const BROW_UPPER_R = [70, 63, 105, 66, 107];
export const BROW_LOWER_R = [46, 53, 52, 65, 55];
export const BROW_UPPER_L = [300, 293, 334, 296, 336];
export const BROW_LOWER_L = [276, 283, 282, 295, 285];

/** Candidate (R, L) pairs for the widest facial point (zygion stand-in). */
export const ZYGION_CANDIDATES: [number, number][] = [
  [127, 356],
  [234, 454],
  [93, 323],
];
export const RAMUS_R = [93, 132, 58];
export const RAMUS_L = [323, 361, 288];
export const BODY_R = [150, 136, 172];
export const BODY_L = [379, 365, 397];

/** Eye contour rings (used for drawing). */
export const EYE_RING_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const EYE_RING_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58,
  132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
export const NOSE_LINE = [168, 6, 197, 195, 5, 4, 1, 2];

const PRECISION_FACTOR: Record<LandmarkPrecision, number> = { high: 1, medium: 0.9, low: 0.75 };
const SOURCE_FACTOR: Record<LandmarkSource, number> = { model: 1, derived: 0.95, estimated: 0.7, manual: 0.8 };

export function landmarkConfidence(precision: LandmarkPrecision, source: LandmarkSource, extra = 1): number {
  return Math.max(0, Math.min(1, PRECISION_FACTOR[precision] * SOURCE_FACTOR[source] * extra));
}

/**
 * Roll-normalise the mesh: rotate about the inter-pupillary midpoint so that the
 * line between the image-left and image-right pupils becomes horizontal.
 */
export function alignMesh(mesh: Point[]): AlignedMesh {
  if (mesh.length < MESH_POINT_COUNT) {
    throw new Error(`Expected ${MESH_POINT_COUNT} mesh points, received ${mesh.length}`);
  }
  const pr = mesh[468];
  const pl = mesh[473];
  const left = pr.x <= pl.x ? pr : pl;
  const right = pr.x <= pl.x ? pl : pr;
  const rollDeg = toDeg(Math.atan2(right.y - left.y, right.x - left.x));
  const pivot = midpoint(pr, pl);
  const aligned = mesh.map((p) => rotateAround(p, pivot, -rollDeg));
  return { raw: mesh, aligned, rollDeg, pivot };
}

interface Build {
  map: LandmarkMap;
  list: SemanticLandmark[];
}

export function buildLandmarks(input: AnalysisInput, am: AlignedMesh): Build {
  const map: LandmarkMap = {};
  const A = am.aligned;
  const R = am.raw;

  const add = (
    id: SemanticLandmarkId,
    label: string,
    region: SemanticLandmark["region"],
    side: SemanticLandmark["side"],
    precision: LandmarkPrecision,
    source: LandmarkSource,
    aligned: Point,
    raw: Point,
    extra: Partial<SemanticLandmark> = {},
    confExtra = 1,
  ) => {
    map[id] = {
      id,
      label,
      region,
      side,
      source,
      precision,
      raw,
      aligned,
      confidence: landmarkConfidence(precision, source, confExtra),
      ...extra,
    };
  };

  const addIdx = (
    id: SemanticLandmarkId,
    label: string,
    region: SemanticLandmark["region"],
    side: SemanticLandmark["side"],
    precision: LandmarkPrecision,
    note?: string,
  ) => {
    const i = MESH_INDEX[id]!;
    add(id, label, region, side, precision, "model", A[i], R[i], { meshIndex: i, note });
  };

  // --- eyes -------------------------------------------------------------
  addIdx("pupil_R", "Pupil centre (right)", "eye", "right", "high");
  addIdx("pupil_L", "Pupil centre (left)", "eye", "left", "high");
  addIdx("endocanthion_R", "Medial canthus (right)", "eye", "right", "high");
  addIdx("endocanthion_L", "Medial canthus (left)", "eye", "left", "high");
  addIdx("exocanthion_R", "Lateral canthus (right)", "eye", "right", "high");
  addIdx("exocanthion_L", "Lateral canthus (left)", "eye", "left", "high");
  addIdx("palpebrale_sup_R", "Upper eyelid apex (right)", "eye", "right", "medium");
  addIdx("palpebrale_sup_L", "Upper eyelid apex (left)", "eye", "left", "medium");
  addIdx("palpebrale_inf_R", "Lower eyelid (right)", "eye", "right", "medium");
  addIdx("palpebrale_inf_L", "Lower eyelid (left)", "eye", "left", "medium");

  // --- brows ------------------------------------------------------------
  const browEnds = (upper: number[], lower: number[]) => {
    const medial = midpoint(A[upper[4]], A[lower[4]]);
    const medialRaw = midpoint(R[upper[4]], R[lower[4]]);
    const lateral = midpoint(A[upper[0]], A[lower[0]]);
    const lateralRaw = midpoint(R[upper[0]], R[lower[0]]);
    // apex = highest (smallest y) point of the upper contour, excluding the ends
    let apexIdx = upper[2];
    for (const i of [upper[1], upper[2], upper[3]]) if (A[i].y < A[apexIdx].y) apexIdx = i;
    return { medial, medialRaw, lateral, lateralRaw, apexIdx, medialIdx: [upper[4], lower[4]], lateralIdx: [upper[0], lower[0]] };
  };
  const bR = browEnds(BROW_UPPER_R, BROW_LOWER_R);
  const bL = browEnds(BROW_UPPER_L, BROW_LOWER_L);
  add("brow_medial_R", "Brow head (right)", "brow", "right", "medium", "derived", bR.medial, bR.medialRaw, { meshIndices: bR.medialIdx });
  add("brow_medial_L", "Brow head (left)", "brow", "left", "medium", "derived", bL.medial, bL.medialRaw, { meshIndices: bL.medialIdx });
  add("brow_lateral_R", "Brow tail (right)", "brow", "right", "medium", "derived", bR.lateral, bR.lateralRaw, { meshIndices: bR.lateralIdx });
  add("brow_lateral_L", "Brow tail (left)", "brow", "left", "medium", "derived", bL.lateral, bL.lateralRaw, { meshIndices: bL.lateralIdx });
  add("brow_apex_R", "Brow arch apex (right)", "brow", "right", "medium", "model", A[bR.apexIdx], R[bR.apexIdx], { meshIndex: bR.apexIdx });
  add("brow_apex_L", "Brow arch apex (left)", "brow", "left", "medium", "model", A[bL.apexIdx], R[bL.apexIdx], { meshIndex: bL.apexIdx });
  addIdx("brow_lower_mid_R", "Brow lower edge, mid (right)", "brow", "right", "medium");
  addIdx("brow_lower_mid_L", "Brow lower edge, mid (left)", "brow", "left", "medium");

  // brow line: lower edge of the brows at mid-brow, on the midline (upper bound of FWHR)
  const pivotX = midpoint(A[468], A[473]).x;
  const browLineY = (A[52].y + A[282].y) / 2;
  const browLineAligned = { x: pivotX, y: browLineY };
  add("brow_line", "Brow line (lower brow edge, midline)", "brow", "mid", "medium", "derived", browLineAligned, rotateAround(browLineAligned, am.pivot, am.rollDeg), {
    meshIndices: [52, 282],
    note: "Horizontal line through the lower edge of both brows at mid-brow; used as the upper bound of FWHR.",
  });

  // --- nose -------------------------------------------------------------
  addIdx("nasion", "Nasion / sellion (soft tissue)", "nose", "mid", "medium", "Deepest midline point between the eyes (mesh 168).");
  addIdx("nose_bridge", "Nasal bridge", "nose", "mid", "medium");
  addIdx("pronasale", "Nose tip", "nose", "mid", "high");
  addIdx("subnasale", "Subnasale", "nose", "mid", "high");
  addIdx("alare_R", "Alar base (right)", "nose", "right", "medium", "Lateral edge of the alar wing at the crease (mesh 48).");
  addIdx("alare_L", "Alar base (left)", "nose", "left", "medium", "Lateral edge of the alar wing at the crease (mesh 278).");

  // --- mouth ------------------------------------------------------------
  addIdx("cheilion_R", "Mouth corner (right)", "mouth", "right", "high");
  addIdx("cheilion_L", "Mouth corner (left)", "mouth", "left", "high");
  addIdx("labrale_sup", "Upper lip vermilion top", "mouth", "mid", "medium");
  addIdx("labrale_inf", "Lower lip vermilion bottom", "mouth", "mid", "medium");
  addIdx("stomion_sup", "Upper lip inner edge", "mouth", "mid", "medium");
  addIdx("stomion_inf", "Lower lip inner edge", "mouth", "mid", "medium");
  const sto = midpoint(A[13], A[14]);
  add("stomion", "Stomion (lip contact point)", "mouth", "mid", "medium", "derived", sto, midpoint(R[13], R[14]), { meshIndices: [13, 14] });

  // --- face / midline ---------------------------------------------------
  addIdx("glabella", "Glabella (mid-brow reference)", "forehead", "mid", "medium", "Midline point at brow level (mesh 9).");
  addIdx("menton", "Menton (chin bottom)", "chin", "mid", "high");
  addIdx("forehead_top", "Mesh top (not the hairline)", "forehead", "mid", "low", "Upper boundary of the mesh; the hairline lies above it.");
  addIdx("chin_corner_R", "Chin corner (right)", "chin", "right", "medium", "Lateral edge of the chin pad (mesh 176).");
  addIdx("chin_corner_L", "Chin corner (left)", "chin", "left", "medium", "Lateral edge of the chin pad (mesh 400).");
  addIdx("frontotemporale_R", "Frontotemporale (right)", "forehead", "right", "low", "Temple contour at brow level (mesh 21).");
  addIdx("frontotemporale_L", "Frontotemporale (left)", "forehead", "left", "low", "Temple contour at brow level (mesh 251).");

  // zygion: widest contour pair between lateral orbit and ear level
  let best = ZYGION_CANDIDATES[0];
  let bestW = -1;
  for (const pair of ZYGION_CANDIDATES) {
    const w = dist(A[pair[0]], A[pair[1]]);
    if (w > bestW) {
      bestW = w;
      best = pair;
    }
  }
  add("zygion_R", "Zygion (right, soft-tissue stand-in)", "cheek", "right", "low", "model", A[best[0]], R[best[0]], {
    meshIndex: best[0],
    note: "Widest point of the face contour; soft-tissue approximation of the zygomatic arch.",
  });
  add("zygion_L", "Zygion (left, soft-tissue stand-in)", "cheek", "left", "low", "model", A[best[1]], R[best[1]], {
    meshIndex: best[1],
    note: "Widest point of the face contour; soft-tissue approximation of the zygomatic arch.",
  });

  // gonion: intersection of the ramus line and the mandibular body line
  const gonion = (ramus: number[], body: number[], side: "right" | "left") => {
    const ramusLine = fitLine(ramus.map((i) => A[i]));
    const bodyLine = fitLine(body.map((i) => A[i]));
    const corner = A[ramus[2]]; // mesh 58 / 288 sits at the turn of the contour
    const ix = intersectLines(ramusLine, bodyLine);
    const maxOff = dist(A[ramus[2]], A[body[2]]) * 0.9;
    let pt = ix ?? corner;
    let conf = 1;
    let note = "Constructed as the intersection of the ramus and mandibular-body contour lines.";
    if (!ix || dist(pt, corner) > maxOff) {
      pt = corner;
      conf = 0.8;
      note = "Contour lines did not intersect near the jaw angle; fell back to the contour corner point.";
    }
    const rawPt = rotateAround(pt, am.pivot, am.rollDeg);
    const sideCap = side === "right" ? "right" : "left";
    add(side === "right" ? "gonion_R" : "gonion_L", `Gonion (${sideCap}, frontal construction)`, "jaw", side, "low", "derived", pt, rawPt, {
      meshIndices: [...ramus, ...body],
      note,
    }, conf);
    add(side === "right" ? "ramus_upper_R" : "ramus_upper_L", `Ramus contour (${sideCap})`, "jaw", side, "low", "model", A[ramus[0]], R[ramus[0]], { meshIndex: ramus[0] });
    add(side === "right" ? "mandible_body_R" : "mandible_body_L", `Mandibular body contour (${sideCap})`, "jaw", side, "low", "model", A[body[0]], R[body[0]], { meshIndex: body[0] });
  };
  gonion(RAMUS_R, BODY_R, "right");
  gonion(RAMUS_L, BODY_L, "left");

  // trichion (hairline) — estimated or manual
  if (input.trichion) {
    const rawPt = input.trichion.point;
    const al = rotateAround(rawPt, am.pivot, -am.rollDeg);
    add("trichion", "Trichion (hairline)", "forehead", "mid", "low", input.trichion.source, al, rawPt, {
      note:
        input.trichion.source === "manual"
          ? "Placed manually by the user."
          : "Estimated by scanning the forehead for the skin/hair transition; adjust if wrong.",
    }, Math.max(0.3, Math.min(1, input.trichion.confidence)));
  }

  // neck (manual only)
  if (input.neck) {
    const r = rotateAround(input.neck.right, am.pivot, -am.rollDeg);
    const l = rotateAround(input.neck.left, am.pivot, -am.rollDeg);
    add("neck_R", "Neck edge (right)", "neck", "right", "low", "manual", r, input.neck.right, { note: "Placed manually." });
    add("neck_L", "Neck edge (left)", "neck", "left", "low", "manual", l, input.neck.left, { note: "Placed manually." });
  }

  const list = Object.values(map) as SemanticLandmark[];
  return { map, list };
}

/** Frontal gonial angle helper (degrees) used by GS. */
export function frontalGonialAngle(map: LandmarkMap, side: "R" | "L"): number | null {
  const g = map[`gonion_${side}` as SemanticLandmarkId];
  const up = map[`ramus_upper_${side}` as SemanticLandmarkId];
  const body = map[`mandible_body_${side}` as SemanticLandmarkId];
  if (!g || !up || !body) return null;
  return angleAt(up.aligned, g.aligned, body.aligned);
}
