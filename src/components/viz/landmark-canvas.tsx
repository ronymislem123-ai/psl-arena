"use client";
/**
 * Interactive measurement overlay drawn as SVG on top of the analysed photo.
 * All geometry is in raw image pixels (viewBox = image size), so it scales with
 * the rendered image. Layers map to the analysis sections; clicking a point opens
 * an info card; optional editing supports the hairline (drag) and neck points (click).
 */
import { useCallback, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { BROW_LOWER_L, BROW_LOWER_R, BROW_UPPER_L, BROW_UPPER_R, CONTOUR_L, CONTOUR_R, EYE_RING_L, EYE_RING_R, FACE_OVAL, LIPS_INNER, LIPS_OUTER, NOSE_LINE } from "@/engine/landmarks/mesh-map";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { formatValue } from "@/engine/explain";
import { midlineX } from "@/engine/scoring/symmetry";
import { useT } from "@/lib/i18n";
import { landmarkLabel, landmarkNote } from "@/lib/i18n/ratio-texts";
import type { AnalysisResult, LandmarkMap, Point, RatioId, SemanticLandmark, SemanticLandmarkId } from "@/engine/types";
import { cn } from "@/lib/utils";

export type LayerId = "landmarks" | "eyes" | "brows" | "midface" | "nose" | "mouth" | "jaw" | "thirds" | "ratios" | "symmetry";
export const LAYERS: LayerId[] = ["landmarks", "eyes", "brows", "midface", "nose", "mouth", "jaw", "thirds", "ratios", "symmetry"];

export interface EditProps {
  trichion?: boolean;
  neck?: boolean;
  neckPlacing?: boolean;
  onTrichionChange?: (p: Point) => void;
  onNeckChange?: (pts: { right: Point; left: Point }) => void;
}

interface Props {
  /** null = no photo available: draws a wireframe on a neutral background */
  imageSrc: string | null;
  width: number;
  height: number;
  result: Pick<AnalysisResult, "landmarks" | "mesh" | "ratios" | "symmetry">;
  layer: LayerId;
  showMesh?: boolean;
  scanning?: boolean;
  edit?: EditProps;
  highlight?: SemanticLandmarkId[];
  className?: string;
  compact?: boolean;
  onSelect?: (l: SemanticLandmark | null) => void;
  selectedId?: SemanticLandmarkId | null;
}

const C = {
  accent: "#4f7cff",
  cyan: "#22d3ee",
  violet: "#a78bfa",
  mint: "#34d399",
  amber: "#f5b547",
  rose: "#f0506e",
  white: "#eef0f3",
  dim: "#ffffff55",
};

export function LandmarkCanvas({ imageSrc, width, height, result, layer, showMesh, scanning, edit, highlight, className, compact, onSelect, selectedId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { lang } = useT();
  const [hover, setHover] = useState<SemanticLandmarkId | null>(null);
  const [drag, setDrag] = useState(false);
  const [neckFirst, setNeckFirst] = useState<Point | null>(null);

  const L = useMemo(() => Object.fromEntries(result.landmarks.map((l) => [l.id, l])) as Partial<Record<SemanticLandmarkId, SemanticLandmark>>, [result.landmarks]);
  const R = useMemo(() => Object.fromEntries(result.ratios.map((r) => [r.id, r])), [result.ratios]);
  const raw = result.mesh.raw;
  const S = Math.max(width, height);
  const dot = S / 260;
  const fs = compact ? S / 38 : S / 48;
  const roll = (result.mesh.rollDeg * Math.PI) / 180;
  const ux = Math.cos(roll);
  const uy = Math.sin(roll);
  const P = (id: SemanticLandmarkId): Point | undefined => L[id]?.raw;

  const toSvg = useCallback((e: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.max(0, Math.min(width, pt.x)), y: Math.max(0, Math.min(height, pt.y)) };
  }, [width, height]);

  const value = (id: RatioId) => {
    const r = R[id];
    if (!r || r.availability !== "available" || r.value == null) return `${RATIO_BY_ID[id].abbreviation}: n/a`;
    return `${RATIO_BY_ID[id].abbreviation} ${formatValue(r.value, RATIO_BY_ID[id].unit)}`;
  };

  // --- drawing helpers ------------------------------------------------------
  const line = (a?: Point, b?: Point, color = C.cyan, dash?: string, w = 1.4, key?: string) =>
    a && b ? <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} strokeDasharray={dash} vectorEffect="non-scaling-stroke" strokeLinecap="round" /> : null;
  const poly = (idx: number[], color = C.dim, close = false, w = 1, key?: string) => {
    const pts = idx.map((i) => raw[i]).filter(Boolean);
    if (pts.length < 2) return null;
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
    return <path key={key} d={d} fill="none" stroke={color} strokeWidth={w} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
  };
  const hline = (p: Point | undefined, half: number, color = C.violet, dash = "4 4", key?: string) =>
    p ? line({ x: p.x - ux * half, y: p.y - uy * half }, { x: p.x + ux * half, y: p.y + uy * half }, color, dash, 1.2, key) : null;
  const vline = (p: Point | undefined, half: number, color = C.violet, dash = "4 4", key?: string) =>
    p ? line({ x: p.x + uy * half, y: p.y - ux * half }, { x: p.x - uy * half, y: p.y + ux * half }, color, dash, 1.2, key) : null;
  const label = (p: Point | undefined, text: string, color = C.white, dx = 0, dy = -1.2, key?: string, anchor: "start" | "middle" | "end" = "start") =>
    p ? (
      <text key={key} x={p.x + dx * fs} y={p.y + dy * fs} fontSize={fs} fill={color} textAnchor={anchor} fontFamily="JetBrains Mono Variable, monospace" paintOrder="stroke" stroke="#07080a" strokeWidth={fs / 5} strokeLinejoin="round">
        {text}
      </text>
    ) : null;
  const mid = (a?: Point, b?: Point): Point | undefined => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : undefined);
  /** Point on the aligned vertical through `from` at the aligned height of `to` (for midline heights). */
  const alongVertical = (from?: Point, to?: Point): Point | undefined => {
    if (!from || !to) return undefined;
    const t = (to.x - from.x) * -uy + (to.y - from.y) * ux; // component along the aligned "down" axis
    return { x: from.x - uy * t, y: from.y + ux * t };
  };
  const arc = (center: Point | undefined, a: Point | undefined, b: Point | undefined, radius: number, color = C.amber) => {
    if (!center || !a || !b) return null;
    const a1 = Math.atan2(a.y - center.y, a.x - center.x);
    const a2 = Math.atan2(b.y - center.y, b.x - center.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const p1 = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) };
    const p2 = { x: center.x + radius * Math.cos(a2), y: center.y + radius * Math.sin(a2) };
    return <path d={`M${p1.x},${p1.y} A${radius},${radius} 0 0 ${d > 0 ? 1 : 0} ${p2.x},${p2.y}`} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
  };

  const faceHalf = (() => {
    const a = P("zygion_R");
    const b = P("zygion_L");
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) * 0.62 : S * 0.25;
  })();

  // --- layers ---------------------------------------------------------------
  const layerSvg = (() => {
    switch (layer) {
      case "eyes":
        return (
          <>
            {poly(EYE_RING_R, C.cyan, true, 1, "er")}
            {poly(EYE_RING_L, C.cyan, true, 1, "el")}
            {line(P("pupil_R"), P("pupil_L"), C.accent, undefined, 1.6, "ipd")}
            {line(P("exocanthion_R"), P("endocanthion_R"), C.mint, undefined, 1.6, "pr")}
            {line(P("exocanthion_L"), P("endocanthion_L"), C.mint, undefined, 1.6, "pl")}
            {line(P("palpebrale_sup_R"), P("palpebrale_inf_R"), C.amber, undefined, 1.6, "hr")}
            {line(P("palpebrale_sup_L"), P("palpebrale_inf_L"), C.amber, undefined, 1.6, "hl")}
            {line(P("endocanthion_R"), P("endocanthion_L"), C.violet, "4 4", 1.2, "icd")}
            {hline(P("endocanthion_R"), faceHalf * 0.5, C.dim, "2 4", "refR")}
            {hline(P("endocanthion_L"), faceHalf * 0.5, C.dim, "2 4", "refL")}
            {label(mid(P("pupil_R"), P("pupil_L")), value("ESR"), C.accent, 0, -0.6, "l1", "middle")}
            {label(P("exocanthion_R"), value("CT"), C.mint, -0.5, 1.6, "l2", "end")}
            {label(P("exocanthion_L"), value("EAR"), C.amber, 0.5, 1.6, "l3")}
            {label(mid(P("endocanthion_R"), P("endocanthion_L")), value("ICD"), C.violet, 0, 1.6, "l4", "middle")}
          </>
        );
      case "brows":
        return (
          <>
            {poly(BROW_UPPER_R, C.violet, false, 1, "bur")}
            {poly(BROW_LOWER_R, C.violet, false, 1, "blr")}
            {poly(BROW_UPPER_L, C.violet, false, 1, "bul")}
            {poly(BROW_LOWER_L, C.violet, false, 1, "bll")}
            {line(P("brow_medial_R"), P("brow_lateral_R"), C.cyan, undefined, 1.6, "tr")}
            {line(P("brow_medial_L"), P("brow_lateral_L"), C.cyan, undefined, 1.6, "tl")}
            {hline(P("brow_line"), faceHalf, C.amber, "6 4", "bl")}
            {line(P("pupil_R"), P("brow_lower_mid_R"), C.dim, "2 3", 1, "pr")}
            {line(P("pupil_L"), P("brow_lower_mid_L"), C.dim, "2 3", 1, "pl")}
            {label(P("brow_lateral_R"), value("ET"), C.cyan, -0.3, -0.8, "l1", "end")}
            {label(P("brow_lateral_L"), value("EBL"), C.cyan, 0.3, -0.8, "l2")}
            {label(P("brow_line"), "brow line", C.amber, 0, -0.5, "l3", "middle")}
          </>
        );
      case "midface":
        return (
          <>
            {line(P("zygion_R"), P("zygion_L"), C.accent, undefined, 1.6, "byz")}
            {line(P("nasion"), P("labrale_sup"), C.mint, undefined, 1.6, "mf")}
            {hline(P("brow_line"), faceHalf * 0.5, C.amber, "6 4", "bl")}
            {hline(P("labrale_sup"), faceHalf * 0.5, C.amber, "6 4", "ls")}
            {line(P("pupil_R"), P("stomion"), C.cyan, "4 3", 1.2, "e1")}
            {line(P("pupil_L"), P("stomion"), C.cyan, "4 3", 1.2, "e2")}
            {line(P("pupil_R"), P("pupil_L"), C.cyan, "4 3", 1.2, "e3")}
            {arc(P("stomion"), P("pupil_R"), P("pupil_L"), faceHalf * 0.22, C.cyan)}
            {hline(P("zygion_R"), faceHalf * 0.3, C.violet, "2 3", "cz")}
            {label(mid(P("zygion_R"), P("zygion_L")), value("FWHR"), C.accent, 0, -0.6, "l1", "middle")}
            {label(P("stomion"), value("EME"), C.cyan, 0, 1.8, "l2", "middle")}
            {label(P("nasion"), value("MF"), C.mint, 0.6, 0.3, "l3")}
            {label(P("zygion_R"), value("CBS"), C.violet, 0.3, -0.5, "l4")}
          </>
        );
      case "nose":
        return (
          <>
            {poly(NOSE_LINE, C.dim, false, 1, "nl")}
            {line(P("alare_R"), P("alare_L"), C.amber, undefined, 1.6, "nw")}
            {line(P("nasion"), alongVertical(P("nasion"), P("subnasale")), C.mint, undefined, 1.6, "nh")}
            {line(P("endocanthion_R"), P("endocanthion_L"), C.violet, "4 4", 1.2, "icd")}
            {line(P("zygion_R"), P("zygion_L"), C.accent, "4 4", 1.2, "byz")}
            {label(mid(P("alare_R"), P("alare_L")), value("N_BYZGO"), C.amber, 0, 1.6, "l1", "middle")}
            {label(P("nasion"), value("N_H"), C.mint, 0.6, 0.3, "l2")}
            {label(mid(P("endocanthion_R"), P("endocanthion_L")), value("ICD_N"), C.violet, 0, -0.5, "l3", "middle")}
          </>
        );
      case "mouth":
        return (
          <>
            {poly(LIPS_OUTER, C.rose, true, 1, "lo")}
            {poly(LIPS_INNER, C.rose, true, 1, "li")}
            {line(P("cheilion_R"), P("cheilion_L"), C.cyan, undefined, 1.6, "mw")}
            {line(P("labrale_sup"), P("labrale_inf"), C.amber, undefined, 1.6, "lh")}
            {line(P("subnasale"), P("labrale_sup"), C.mint, "4 3", 1.4, "ph")}
            {line(P("labrale_inf"), P("menton"), C.mint, "4 3", 1.4, "ch")}
            {line(P("alare_R"), P("alare_L"), C.violet, "4 4", 1.2, "nw")}
            {label(P("cheilion_L"), value("M_IPD"), C.cyan, 0.4, 0.3, "l1")}
            {label(P("cheilion_R"), value("LIP_WHR"), C.amber, -0.4, 0.3, "l2", "end")}
            {label(P("labrale_inf"), value("LL_UL"), C.rose, 0.6, 0.9, "l3")}
            {label(mid(P("labrale_inf"), P("menton")), value("C_P"), C.mint, 0.6, 0.3, "l4")}
            {label(mid(P("subnasale"), P("labrale_sup")), value("L3P"), C.mint, 0.6, 0.3, "l5")}
          </>
        );
      case "jaw":
        return (
          <>
            {poly(CONTOUR_R.slice(0, 12), C.dim, false, 1, "cr")}
            {poly(CONTOUR_L.slice(0, 12), C.dim, false, 1, "cl")}
            {line(P("gonion_R"), P("gonion_L"), C.accent, undefined, 1.6, "big")}
            {line(P("frontotemporale_R"), P("frontotemporale_L"), C.violet, undefined, 1.6, "bit")}
            {line(P("zygion_R"), P("zygion_L"), C.cyan, "4 4", 1.2, "byz")}
            {line(P("ramus_upper_R"), P("gonion_R"), C.amber, undefined, 1.4, "r1")}
            {line(P("gonion_R"), P("mandible_body_R"), C.amber, undefined, 1.4, "b1")}
            {line(P("ramus_upper_L"), P("gonion_L"), C.amber, undefined, 1.4, "r2")}
            {line(P("gonion_L"), P("mandible_body_L"), C.amber, undefined, 1.4, "b2")}
            {arc(P("gonion_R"), P("ramus_upper_R"), P("mandible_body_R"), faceHalf * 0.12)}
            {arc(P("gonion_L"), P("ramus_upper_L"), P("mandible_body_L"), faceHalf * 0.12)}
            {line(P("chin_corner_R"), P("chin_corner_L"), C.mint, undefined, 1.4, "chin")}
            {line(P("stomion"), P("menton"), C.rose, "4 3", 1.2, "jh")}
            {edit?.neck || L.neck_R ? line(P("neck_R"), P("neck_L"), C.rose, undefined, 1.4, "neck") : null}
            {label(mid(P("gonion_R"), P("gonion_L")), value("BIG"), C.accent, 0, -0.5, "l1", "middle")}
            {label(mid(P("frontotemporale_R"), P("frontotemporale_L")), value("BIT"), C.violet, 0, -0.5, "l2", "middle")}
            {label(P("gonion_L"), value("GS"), C.amber, 0.5, 0.4, "l3")}
            {label(P("gonion_R"), value("JWHR"), C.rose, -0.5, 0.4, "l4", "end")}
            {label(mid(P("chin_corner_R"), P("chin_corner_L")), value("M_C"), C.mint, 0, 1.4, "l5", "middle")}
          </>
        );
      case "thirds":
        return (
          <>
            {hline(P("trichion"), faceHalf, C.amber, undefined, "t")}
            {hline(P("glabella"), faceHalf, C.amber, undefined, "g")}
            {hline(P("subnasale"), faceHalf, C.amber, undefined, "s")}
            {hline(P("menton"), faceHalf, C.amber, undefined, "m")}
            {[P("zygion_R"), P("exocanthion_R"), P("endocanthion_R"), P("endocanthion_L"), P("exocanthion_L"), P("zygion_L")].map((p, i) => vline(p, faceHalf * 0.6, C.cyan, "3 4", `f${i}`))}
            {label(P("trichion") ? { x: P("trichion")!.x + ux * faceHalf, y: P("trichion")!.y + uy * faceHalf } : undefined, value("FT_U"), C.amber, 0.3, 2.2, "l1")}
            {label(P("glabella") ? { x: P("glabella")!.x + ux * faceHalf, y: P("glabella")!.y + uy * faceHalf } : undefined, value("FT_M"), C.amber, 0.3, 2.2, "l2")}
            {label(P("subnasale") ? { x: P("subnasale")!.x + ux * faceHalf, y: P("subnasale")!.y + uy * faceHalf } : undefined, value("FT_L"), C.amber, 0.3, 2.2, "l3")}
            {!P("trichion") && label(P("forehead_top"), "hairline missing", C.rose, 0, -1.4, "l4", "middle")}
          </>
        );
      case "ratios":
        return (
          <>
            {line(P("pupil_R"), P("pupil_L"), C.accent, undefined, 1.6, "ipd")}
            {line(P("zygion_R"), P("zygion_L"), C.cyan, undefined, 1.6, "byz")}
            {line(P("gonion_R"), P("gonion_L"), C.violet, undefined, 1.6, "big")}
            {line(P("alare_R"), P("alare_L"), C.amber, undefined, 1.6, "nw")}
            {line(P("cheilion_R"), P("cheilion_L"), C.rose, undefined, 1.6, "mw")}
            {line(P("trichion"), P("menton"), C.mint, "5 4", 1.4, "th")}
            {label(mid(P("pupil_R"), P("pupil_L")), "IPD", C.accent, 0, -0.6, "l1", "middle")}
            {label(P("zygion_L"), value("ESR"), C.cyan, 0.4, 0.3, "l2")}
            {label(P("gonion_L"), value("BIG"), C.violet, 0.4, 0.3, "l3")}
            {label(P("alare_L"), value("M_N"), C.amber, 0.4, 0.3, "l4")}
            {label(P("cheilion_L"), value("M_IPD"), C.rose, 0.4, 0.3, "l5")}
            {label(P("menton"), value("TFWHR"), C.mint, 0, 1.6, "l6", "middle")}
          </>
        );
      case "symmetry": {
        const pr = P("pupil_R");
        const pl = P("pupil_L");
        const pivot = result.mesh.pivot;
        const pairs: [SemanticLandmarkId, SemanticLandmarkId][] = [
          ["exocanthion_R", "exocanthion_L"], ["endocanthion_R", "endocanthion_L"], ["brow_apex_R", "brow_apex_L"], ["alare_R", "alare_L"], ["cheilion_R", "cheilion_L"], ["gonion_R", "gonion_L"], ["zygion_R", "zygion_L"], ["chin_corner_R", "chin_corner_L"],
        ];
        // fitted midline (aligned x = mx) expressed in raw space: perpendicular to the pupil line
        const mx = pr && pl ? midlineX(L as LandmarkMap) : null;
        const midRaw = mx == null ? pivot : { x: pivot.x + (mx - pivot.x) * ux, y: pivot.y + (mx - pivot.x) * uy };
        return (
          <>
            {vline(midRaw, S * 0.45, C.cyan, "6 4", "mid")}
            {pairs.map(([a, b], i) => line(P(a), P(b), C.violet, "3 3", 1, `p${i}`))}
            {pairs.map(([a, b], i) => {
              const pb = P(b);
              if (!P(a) || !pb) return null;
              // mirror the left-side point across the midline (pupil-line frame): ghost shows the asymmetry
              const dx = pb.x - midRaw.x;
              const dy = pb.y - midRaw.y;
              const along = dx * ux + dy * uy; // along the pupil line
              const across = -dx * uy + dy * ux; // along the aligned vertical
              const m = { x: midRaw.x - along * ux - across * uy, y: midRaw.y - along * uy + across * ux };
              return <circle key={`m${i}`} cx={m.x} cy={m.y} r={dot * 1.1} fill="none" stroke={C.rose} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
            {label(P("menton"), `symmetry ${result.symmetry.score?.toFixed(0) ?? "—"}`, C.cyan, 0, 1.8, "l1", "middle")}
          </>
        );
      }
      default:
        return (
          <>
            {poly(EYE_RING_R, C.dim, true, 0.8, "er")}
            {poly(EYE_RING_L, C.dim, true, 0.8, "el")}
            {poly(LIPS_OUTER, C.dim, true, 0.8, "lo")}
            {poly(NOSE_LINE, C.dim, false, 0.8, "nl")}
            {poly(BROW_UPPER_R, C.dim, false, 0.8, "br")}
            {poly(BROW_UPPER_L, C.dim, false, 0.8, "bl")}
          </>
        );
    }
  })();

  const visibleLandmarks = useMemo(() => {
    if (layer === "landmarks") return result.landmarks;
    const regions: Record<string, SemanticLandmark["region"][]> = {
      eyes: ["eye"], brows: ["brow"], midface: ["cheek", "nose", "eye", "mouth"], nose: ["nose", "eye"], mouth: ["mouth", "nose", "chin"], jaw: ["jaw", "chin", "cheek", "forehead", "neck"], thirds: ["forehead", "nose", "chin", "midline"], ratios: ["eye", "cheek", "jaw", "nose", "mouth", "forehead", "chin"], symmetry: ["eye", "brow", "nose", "mouth", "jaw", "cheek", "chin"],
    };
    const allow = regions[layer] ?? [];
    return result.landmarks.filter((l) => allow.includes(l.region));
  }, [layer, result.landmarks]);

  // --- editing --------------------------------------------------------------
  const tri = P("trichion") ?? (edit?.trichion ? { x: P("forehead_top")?.x ?? width / 2, y: (P("forehead_top")?.y ?? height * 0.2) - S * 0.06 } : undefined);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!edit) return;
    const p = toSvg(e);
    if (!p) return;
    if (edit.neck && edit.neckPlacing) {
      if (!neckFirst) setNeckFirst(p);
      else {
        const a = neckFirst;
        const b = p;
        const right = a.x < b.x ? a : b; // subject's right appears on the image left for un-mirrored photos
        const left = a.x < b.x ? b : a;
        edit.onNeckChange?.({ right, left });
        setNeckFirst(null);
      }
      return;
    }
    if (edit.trichion && tri) {
      const d = Math.hypot(p.x - tri.x, p.y - tri.y);
      if (d < S * 0.06 || !P("trichion")) {
        setDrag(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        edit.onTrichionChange?.(p);
      }
    }
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toSvg(e);
    if (p) edit?.onTrichionChange?.(p);
  };
  const onPointerUp = () => setDrag(false);

  const hovered = hover ? L[hover] : null;
  const selected = selectedId ? L[selectedId] : null;
  const info = hovered ?? selected;

  return (
    <div className={cn("relative select-none", className)}>
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" width={width} height={height} className="block w-full h-auto rounded-xl" draggable={false} />
      ) : (
        <div className="w-full rounded-xl bg-bg-2 hud-grid" style={{ aspectRatio: `${width} / ${height}` }} aria-hidden />
      )}
      {scanning && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="scan-line" />
        </div>
      )}
      <svg
        ref={svgRef}
        data-testid="landmark-canvas"
        viewBox={`0 0 ${width} ${height}`}
        className={cn("absolute inset-0 w-full h-full", edit?.trichion || edit?.neckPlacing ? "cursor-crosshair touch-none" : "")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {!imageSrc && poly(FACE_OVAL, "#ffffff2e", true, 1, "wire-oval")}
        {(showMesh || !imageSrc) && raw.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={dot * 0.45} fill={C.cyan} opacity={imageSrc ? 0.45 : 0.3} />)}
        {layerSvg}
        {visibleLandmarks.map((l) => {
          const hl = highlight?.includes(l.id) || selectedId === l.id;
          const low = l.precision === "low" || l.source === "estimated";
          return (
            <g key={l.id}>
              <circle
                cx={l.raw.x}
                cy={l.raw.y}
                r={hl ? dot * 1.8 : dot}
                fill={hl ? C.amber : low ? C.violet : l.source === "manual" ? C.rose : C.white}
                stroke="#07080a"
                strokeWidth={dot * 0.35}
                opacity={hl ? 1 : 0.9}
              />
              <circle
                cx={l.raw.x}
                cy={l.raw.y}
                r={dot * 3.2}
                fill="transparent"
                className="cursor-pointer"
                onPointerEnter={() => setHover(l.id)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(selectedId === l.id ? null : l);
                }}
              />
            </g>
          );
        })}
        {edit?.trichion && tri && (
          <g>
            <line x1={tri.x - S * 0.08} y1={tri.y} x2={tri.x + S * 0.08} y2={tri.y} stroke={C.amber} strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            <circle cx={tri.x} cy={tri.y} r={dot * 3} fill="#f5b54733" stroke={C.amber} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="cursor-grab" />
            <circle cx={tri.x} cy={tri.y} r={dot * 0.8} fill={C.amber} />
          </g>
        )}
        {edit?.neckPlacing && neckFirst && <circle cx={neckFirst.x} cy={neckFirst.y} r={dot * 2} fill="#f0506e55" stroke={C.rose} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      {info && !compact && (
        <div className="absolute left-2 bottom-2 max-w-[85%] glass-strong rounded-xl px-3 py-2 text-xs pointer-events-none">
          <div className="font-medium text-fg-0">{landmarkLabel(info.id, lang, info.label)}</div>
          <div className="text-fg-2 font-mono text-[11px] mt-0.5">
            ({info.raw.x.toFixed(0)}, {info.raw.y.toFixed(0)}) px · {info.source} · {info.precision} · conf {(info.confidence * 100).toFixed(0)} %{info.meshIndex != null ? ` · mesh #${info.meshIndex}` : info.meshIndices ? ` · mesh ${info.meshIndices.join("/")}` : ""}
          </div>
          {landmarkNote(info.noteCode, lang, info.note) && <div className="text-fg-3 mt-0.5">{landmarkNote(info.noteCode, lang, info.note)}</div>}
        </div>
      )}
    </div>
  );
}
