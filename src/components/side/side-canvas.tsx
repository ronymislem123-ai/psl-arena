"use client";
/**
 * SVG overlay for the side-view module: the profile photo (or a neutral background),
 * the 16 placed landmarks and the construction lines of one measurement.
 * In edit mode the user places/drags points; a loupe shows a magnified window
 * around the pointer so that points can be set to the pixel.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { SIDE_BY_ID, SIDE_LANDMARK_ORDER, faceHeightOf, formatSideValue, type SideLandmarkId, type SideMeasurementId, type SidePoints, type SideViewResult } from "@/engine/side-view";
import { intersectLines } from "@/engine/geometry";
import type { Point } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { sideLandmarkText } from "@/lib/i18n/side-texts";
import { cn } from "@/lib/utils";

export interface SideEditProps {
  /** landmark that the next background click places */
  current: SideLandmarkId | null;
  selected: SideLandmarkId | null;
  onPlace: (id: SideLandmarkId, p: Point) => void;
  onSelect: (id: SideLandmarkId | null) => void;
  /** optional extra point (soft-tissue orbitale for the Frankfort horizontal) placed by the next click while active */
  extra?: { active: boolean; onPlace: (p: Point) => void };
}

interface Props {
  src: string | null;
  width: number;
  height: number;
  points: Partial<SidePoints>;
  result?: SideViewResult | null;
  highlight?: SideMeasurementId | null;
  edit?: SideEditProps;
  loupe?: boolean;
  className?: string;
  /** reference axis for the live preview (defaults to the axis stored in `result`) */
  reference?: { tiltDeg: number; orbitale?: Point | null } | null;
}

const C = { accent: "#4f7cff", cyan: "#22d3ee", violet: "#a78bfa", mint: "#34d399", amber: "#f5b547", rose: "#f0506e", white: "#eef0f3", dim: "#ffffff66" };
const LOUPE_CSS = 168;
const LOUPE_ZOOM = 3;

export function SideCanvas({ src, width, height, points, result, highlight, edit, loupe = true, className, reference }: Props) {
  const { lang } = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [drag, setDrag] = useState<{ id: SideLandmarkId; moved: boolean } | null>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const [cssScale, setCssScale] = useState(1);

  const S = Math.max(width, height);
  const dot = S / 230;
  const fs = S / 46;
  const faceH = faceHeightOf(points) || S * 0.4;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => setCssScale(el.getBoundingClientRect().width / width || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const toSvg = useCallback(
    (e: { clientX: number; clientY: number }): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const x = ((e.clientX - r.left) / r.width) * width;
      const y = ((e.clientY - r.top) / r.height) * height;
      return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) };
    },
    [width, height],
  );

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toSvg(e);
    setHover(p);
    if (drag && edit && p) {
      if (!drag.moved) setDrag({ ...drag, moved: true });
      edit.onPlace(drag.id, { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    }
  };

  const onBackgroundDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!edit) return;
    pressRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!edit) return;
    if (drag) {
      if (!drag.moved) edit.onSelect(drag.id);
      setDrag(null);
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
      return;
    }
    const press = pressRef.current;
    pressRef.current = null;
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) return;
    const p = toSvg(e);
    if (!p) return;
    const q = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    if (edit.extra?.active) edit.extra.onPlace(q);
    else if (edit.current) edit.onPlace(edit.current, q);
  };

  const onPointDown = (id: SideLandmarkId) => (e: RPointerEvent<SVGCircleElement>) => {
    if (!edit) return;
    e.stopPropagation();
    pressRef.current = null;
    setDrag({ id, moved: false });
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onKeyDown = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (!edit || !edit.selected) return;
    const p = points[edit.selected];
    if (!p) return;
    const step = e.shiftKey ? 5 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    edit.onPlace(edit.selected, { x: Math.max(0, Math.min(width, p.x + d[0])), y: Math.max(0, Math.min(height, p.y + d[1])) });
  };

  const value = (id: SideMeasurementId) => formatSideValue(id, result?.measurements.find((m) => m.id === id)?.value);

  // --- drawing helpers ------------------------------------------------------
  const line = (a: Point | undefined, b: Point | undefined, color: string, dash?: string, w = 1.5, key?: string) =>
    a && b ? <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} strokeDasharray={dash} vectorEffect="non-scaling-stroke" /> : null;
  const extended = (a: Point | undefined, b: Point | undefined, color: string, key: string, dash = "6 4") => {
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const ext = faceH * 0.35;
    return line({ x: a.x - ux * ext, y: a.y - uy * ext }, { x: b.x + ux * ext, y: b.y + uy * ext }, color, dash, 1.2, key);
  };
  const arc = (center: Point | undefined, a: Point | undefined, b: Point | undefined, color: string, key: string, radius = faceH * 0.1) => {
    if (!center || !a || !b) return null;
    const a1 = Math.atan2(a.y - center.y, a.x - center.x);
    const a2 = Math.atan2(b.y - center.y, b.x - center.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const p1 = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) };
    const p2 = { x: center.x + radius * Math.cos(a2), y: center.y + radius * Math.sin(a2) };
    return <path key={key} d={`M${p1.x},${p1.y} A${radius},${radius} 0 0 ${d > 0 ? 1 : 0} ${p2.x},${p2.y}`} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
  };
  const label = (p: Point | undefined, text: string, color: string, dx = 0, dy = 0, key?: string, anchor: "start" | "middle" | "end" = "start") =>
    p ? (
      <text key={key} x={p.x + dx * fs} y={p.y + dy * fs} fontSize={fs} fill={color} textAnchor={anchor} fontFamily="JetBrains Mono Variable, ui-monospace, monospace" paintOrder="stroke" stroke="#07080a" strokeWidth={fs * 0.22} strokeLinejoin="round">
        {text}
      </text>
    ) : null;

  const P = points;
  // anatomical reference frame: h = horizontal (tilt + = clockwise on screen), vd = "down"
  const tiltDeg = reference?.tiltDeg ?? result?.reference?.tiltDeg ?? 0;
  const orbitale = reference ? (reference.orbitale ?? undefined) : result?.reference?.orbitale;
  const tr = (tiltDeg * Math.PI) / 180;
  const h = { x: Math.cos(tr), y: Math.sin(tr) };
  const vd = { x: -Math.sin(tr), y: Math.cos(tr) };
  const along = (o: Point, d: Point, t: number): Point => ({ x: o.x + d.x * t, y: o.y + d.y * t });
  const dot2 = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
  const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
  /** projection of q onto the reference vertical through o */
  const onVertical = (q: Point | undefined, o: Point | undefined) => (q && o ? along(o, vd, dot2(sub(q, o), vd)) : undefined);
  const hTick = (q: Point | undefined, color: string, key: string, half = faceH * 0.12) => (q ? line(along(q, h, -half), along(q, h, half), color, undefined, 1.4, key) : null);
  const ax = result ? (result.facing === "left" ? -1 : 1) : P.pronasale && P.tragion ? (dot2(sub(P.pronasale, P.tragion), h) < 0 ? -1 : 1) : 1;
  const foot = (p: Point | undefined, a: Point | undefined, b: Point | undefined): Point | undefined => {
    if (!p || !a || !b) return undefined;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  };

  const construction = (() => {
    if (!highlight) return null;
    const v = value(highlight);
    switch (highlight) {
      case "GA":
        return [line(P.gonion, P.tragion, C.cyan, undefined, 1.6, "a"), line(P.gonion, P.menton, C.cyan, undefined, 1.6, "b"), arc(P.gonion, P.tragion, P.menton, C.amber, "c"), label(P.gonion, v, C.amber, -ax * 0.6, 1.4, "l", ax > 0 ? "end" : "start")];
      case "CMA":
        return [line(P.cervical, P.menton, C.cyan, undefined, 1.6, "a"), line(P.cervical, P.neck, C.cyan, undefined, 1.6, "b"), arc(P.cervical, P.menton, P.neck, C.amber, "c"), label(P.cervical, v, C.amber, ax * 0.6, 1.2, "l", ax > 0 ? "start" : "end")];
      case "NFA":
        return [line(P.nasion, P.glabella, C.cyan, undefined, 1.6, "a"), line(P.nasion, P.pronasale, C.cyan, undefined, 1.6, "b"), arc(P.nasion, P.glabella, P.pronasale, C.amber, "c"), label(P.nasion, v, C.amber, ax * 1.2, 0.2, "l", ax > 0 ? "start" : "end")];
      case "NMA":
        return [line(P.pronasale, P.nasion, C.cyan, undefined, 1.6, "a"), line(P.pronasale, P.pogonion, C.cyan, undefined, 1.6, "b"), arc(P.pronasale, P.nasion, P.pogonion, C.amber, "c"), label(P.pronasale, v, C.amber, ax * 0.6, 0.4, "l", ax > 0 ? "start" : "end")];
      case "NLA":
        return [line(P.subnasale, P.pronasale, C.cyan, undefined, 1.6, "a"), line(P.subnasale, P.labrale_sup, C.cyan, undefined, 1.6, "b"), arc(P.subnasale, P.pronasale, P.labrale_sup, C.amber, "c", faceH * 0.06), label(P.subnasale, v, C.amber, ax * 1, 0.3, "l", ax > 0 ? "start" : "end")];
      case "MLA":
        return [line(P.labiomental, P.labrale_inf, C.cyan, undefined, 1.6, "a"), line(P.labiomental, P.pogonion, C.cyan, undefined, 1.6, "b"), arc(P.labiomental, P.labrale_inf, P.pogonion, C.amber, "c", faceH * 0.06), label(P.labiomental, v, C.amber, -ax * 0.6, 0.3, "l", ax > 0 ? "end" : "start")];
      case "FCA":
        return [line(P.subnasale, P.glabella, C.cyan, undefined, 1.6, "a"), line(P.subnasale, P.pogonion, C.cyan, undefined, 1.6, "b"), arc(P.subnasale, P.glabella, P.pogonion, C.amber, "c", faceH * 0.08), label(P.subnasale, v, C.amber, -ax * 0.8, 0.3, "l", ax > 0 ? "end" : "start")];
      case "HANG":
        return [line(P.pogonion, P.nasion, C.cyan, undefined, 1.6, "a"), line(P.pogonion, P.labrale_sup, C.cyan, undefined, 1.6, "b"), arc(P.pogonion, P.nasion, P.labrale_sup, C.amber, "c", faceH * 0.2), label(P.pogonion, v, C.amber, ax * 0.6, -0.6, "l", ax > 0 ? "start" : "end")];
      case "MCA": {
        const x = P.glabella && P.pogonion && P.menton && P.cervical ? intersectLines({ p: P.glabella, d: { x: P.pogonion.x - P.glabella.x, y: P.pogonion.y - P.glabella.y } }, { p: P.menton, d: { x: P.cervical.x - P.menton.x, y: P.cervical.y - P.menton.y } }) : null;
        return [extended(P.glabella, P.pogonion, C.cyan, "a"), extended(P.menton, P.cervical, C.cyan, "b"), x ? arc(x, P.glabella, P.cervical, C.amber, "c", faceH * 0.1) : null, label(x ?? P.menton, v, C.amber, ax * 0.6, 1.2, "l", ax > 0 ? "start" : "end")];
      }
      case "NFC": {
        const x = P.glabella && P.pogonion && P.nasion && P.pronasale ? intersectLines({ p: P.glabella, d: { x: P.pogonion.x - P.glabella.x, y: P.pogonion.y - P.glabella.y } }, { p: P.nasion, d: { x: P.pronasale.x - P.nasion.x, y: P.pronasale.y - P.nasion.y } }) : null;
        return [extended(P.glabella, P.pogonion, C.cyan, "a"), extended(P.nasion, P.pronasale, C.cyan, "b"), x && P.pogonion && P.pronasale ? arc(x, P.pogonion, P.pronasale, C.amber, "c", faceH * 0.12) : null, label(P.pronasale, v, C.amber, ax * 0.6, -0.6, "l", ax > 0 ? "start" : "end")];
      }
      case "ZANG": {
        const lip = P.labrale_sup && P.labrale_inf ? (ax * dot2(P.labrale_sup, h) >= ax * dot2(P.labrale_inf, h) ? P.labrale_sup : P.labrale_inf) : undefined;
        const back = lip ? along(lip, h, -ax * faceH * 0.3) : undefined;
        return [extended(lip, P.pogonion, C.cyan, "a", undefined), line(lip, back, C.dim, "4 4", 1.2, "h"), lip && back ? arc(lip, back, P.pogonion, C.amber, "c", faceH * 0.1) : null, label(lip, v, C.amber, -ax * 1.2, 1.4, "l", ax > 0 ? "end" : "start")];
      }
      case "LFH": {
        const o = P.pronasale ? along(P.pronasale, h, ax * faceH * 0.12) : undefined;
        const g = onVertical(P.glabella, o), sn = onVertical(P.subnasale, o), me = onVertical(P.menton, o);
        return [hTick(g, C.cyan, "t1"), hTick(sn, C.amber, "t2"), hTick(me, C.cyan, "t3"), line(g, me, C.cyan, undefined, 1.4, "v"), sn && me ? label({ x: (sn.x + me.x) / 2, y: (sn.y + me.y) / 2 }, v, C.amber, ax * 0.4, 0.3, "l", ax > 0 ? "start" : "end") : null];
      }
      case "LCR": {
        const o = P.pronasale ? along(P.pronasale, h, ax * faceH * 0.12) : undefined;
        const sn = onVertical(P.subnasale, o), st = onVertical(P.stomion, o), me = onVertical(P.menton, o);
        return [hTick(sn, C.cyan, "t1"), hTick(st, C.amber, "t2"), hTick(me, C.cyan, "t3"), line(sn, me, C.cyan, undefined, 1.4, "v"), st && me ? label({ x: (st.x + me.x) / 2, y: (st.y + me.y) / 2 }, v, C.amber, ax * 0.4, 0.3, "l", ax > 0 ? "start" : "end") : null];
      }
      case "GOODE": {
        const f = foot(P.pronasale, P.nasion, P.alar_crease);
        return [extended(P.nasion, P.alar_crease, C.cyan, "a"), line(P.nasion, P.pronasale, C.dim, "4 4", 1.2, "n"), line(P.pronasale, f, C.amber, undefined, 1.6, "p"), label(P.pronasale, v, C.amber, ax * 0.6, 0.3, "l", ax > 0 ? "start" : "end")];
      }
      case "DORSUM": {
        const f = foot(P.rhinion, P.nasion, P.pronasale);
        return [line(P.nasion, P.pronasale, C.cyan, "4 4", 1.4, "n"), line(P.rhinion, f, C.amber, undefined, 1.6, "p"), label(P.rhinion, v, C.amber, -ax * 0.6, -0.4, "l", ax > 0 ? "end" : "start")];
      }
      case "CHIN_MERIDIAN": {
        const top = onVertical(P.glabella, P.nasion);
        const bottom = P.menton && P.nasion ? along(onVertical(P.menton, P.nasion)!, vd, faceH * 0.05) : undefined;
        return [line(top, bottom, C.cyan, "6 4", 1.4, "v"), line(onVertical(P.pogonion, P.nasion), P.pogonion, C.amber, undefined, 1.6, "h"), label(P.pogonion, v, C.amber, ax * 0.6, 0.3, "l", ax > 0 ? "start" : "end")];
      }
      default:
        return null;
    }
  })();

  const hlSet = new Set<SideLandmarkId>(highlight ? SIDE_BY_ID[highlight].landmarks : []);
  const placed = SIDE_LANDMARK_ORDER.filter((id) => P[id]);

  // loupe window (image px) around the hover point
  const loupeWin = LOUPE_CSS / (cssScale * LOUPE_ZOOM);
  const showLoupe = !!edit && loupe && hover != null;
  const loupeRight = hover ? hover.x < width / 2 : true;

  const midline: SideLandmarkId[] = ["glabella", "nasion", "rhinion", "pronasale", "subnasale", "labrale_sup", "stomion", "labrale_inf", "labiomental", "pogonion", "menton", "cervical", "neck"];
  const silhouette = midline.map((id) => P[id]).filter((p): p is Point => !!p);

  const pointsSvg = (scaleDots: number) =>
    placed.map((id) => {
      const p = P[id]!;
      const isCurrent = edit?.current === id;
      const isSel = edit?.selected === id;
      const hl = hlSet.has(id);
      const r = dot * scaleDots * (hl || isSel ? 1.5 : 1.1);
      const fill = hl ? C.amber : isSel ? C.mint : isCurrent ? C.accent : C.cyan;
      const n = SIDE_LANDMARK_ORDER.indexOf(id) + 1;
      return (
        <g key={id} data-testid={`side-point-${id}`}>
          {(isSel || isCurrent) && <circle cx={p.x} cy={p.y} r={r * 2.2} fill="none" stroke={fill} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.8} />}
          <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#07080a" strokeWidth={0.8} vectorEffect="non-scaling-stroke" style={{ cursor: edit ? "grab" : "default" }} onPointerDown={onPointDown(id)}>
            <title>{sideLandmarkText(id, lang).name}</title>
          </circle>
          {!highlight && label({ x: p.x, y: p.y }, String(n), hl ? C.amber : C.white, 0.5 * scaleDots, -0.4 * scaleDots, "n")}
        </g>
      );
    });

  return (
    <div className={cn("relative select-none", className)} tabIndex={edit ? 0 : -1} onKeyDown={onKeyDown} data-testid="side-canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("block w-full h-auto rounded-xl border border-line bg-bg-2", edit && "cursor-crosshair")}
        style={edit ? { touchAction: "none" } : undefined}
        data-testid="side-canvas"
        onPointerMove={onPointerMove}
        onPointerDown={onBackgroundDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          pressRef.current = null;
        }}
      >
        {src ? <image href={src} x={0} y={0} width={width} height={height} preserveAspectRatio="none" /> : <rect x={0} y={0} width={width} height={height} fill="#0c0e12" />}
        {!src && silhouette.length > 1 && <polyline points={silhouette.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={C.dim} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />}
        {!src && P.gonion && P.tragion && line(P.gonion, P.tragion, C.dim, "3 3", 1, "gt")}
        {!src && P.gonion && P.menton && line(P.gonion, P.menton, C.dim, "3 3", 1, "gm")}
        {P.tragion && (tiltDeg !== 0 || orbitale || reference) && (
          <g data-testid="side-reference-axis" data-tilt={tiltDeg.toFixed(1)} opacity={0.85}>
            {line(along(P.tragion, h, -faceH * 0.25), along(P.tragion, h, faceH * 1.25 * ax), C.violet, "8 5", 1.3, "ah")}
            {P.nasion && line(along(P.nasion, vd, -faceH * 0.35), along(P.nasion, vd, faceH * 1.25), C.violet, "8 5", 1, "av")}
            {label(along(P.tragion, h, faceH * 1.1 * ax), orbitale ? "FH" : "H", C.violet, 0, -0.5, "al", "middle")}
          </g>
        )}
        {orbitale && <circle cx={orbitale.x} cy={orbitale.y} r={dot * 1.2} fill={C.violet} stroke="#07080a" strokeWidth={0.8} vectorEffect="non-scaling-stroke" data-testid="side-point-orbitale" />}
        {construction}
        {pointsSvg(1)}
        {edit && hover && !drag && edit.current && <circle cx={hover.x} cy={hover.y} r={dot * 1.4} fill="none" stroke={C.accent} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6} />}
      </svg>
      {showLoupe && hover && (
        <div
          className={cn("pointer-events-none absolute top-3 overflow-hidden rounded-full border-2 border-accent/70 shadow-glow bg-bg-2", loupeRight ? "right-3" : "left-3")}
          style={{ width: LOUPE_CSS, height: LOUPE_CSS }}
          data-testid="side-loupe"
        >
          <svg viewBox={`${hover.x - loupeWin / 2} ${hover.y - loupeWin / 2} ${loupeWin} ${loupeWin}`} width={LOUPE_CSS} height={LOUPE_CSS}>
            {src ? <image href={src} x={0} y={0} width={width} height={height} preserveAspectRatio="none" /> : <rect x={0} y={0} width={width} height={height} fill="#0c0e12" />}
            {pointsSvg(1 / LOUPE_ZOOM)}
            <line x1={hover.x - loupeWin / 2} y1={hover.y} x2={hover.x + loupeWin / 2} y2={hover.y} stroke={C.amber} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.8} />
            <line x1={hover.x} y1={hover.y - loupeWin / 2} x2={hover.x} y2={hover.y + loupeWin / 2} stroke={C.amber} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.8} />
          </svg>
          <div className="absolute bottom-1 inset-x-0 text-center font-mono text-[10px] text-fg-1">{LOUPE_ZOOM}×</div>
        </div>
      )}
    </div>
  );
}
