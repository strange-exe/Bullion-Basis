import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useWidth } from "../lib/hooks";
import { dt, mon } from "../lib/format";
import { EASE } from "./ui";

export type Pt = { x: number; y: number; k?: number };
export type Series = { label: string; color: string; pts: Pt[]; width?: number; breakOnKey?: boolean; dim?: boolean };
export type Band = { fill: string; pts: { x: number; lo: number; hi: number }[] };
export type Marker = { x: number; y: number; shape: "up" | "down" | "circle"; color: string };

type Props = {
  aria: string;
  series: Series[];
  bands?: Band[];
  markers?: Marker[];
  hlines?: number[];
  vlines?: { x: number; label?: string }[];
  height?: number;
  endLabels?: boolean;
  yFmt?: (v: number, tip?: boolean) => string;
  xLabel?: (x: number) => string;
  hoverAll?: boolean;
  yInclude?: number[];
  veilAt?: number | null;       // replay: everything right of this x is veiled
  draw?: boolean;               // draw lines left to right on first mount
  tipExtra?: (x: number) => ReactNode;
};

function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function monthTicks(x0: number, x1: number, maxN: number) {
  const t: number[] = []; const a = new Date(x0 * 86400000);
  let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
  for (;;) { const d = Math.round(Date.UTC(y, m, 1) / 86400000); if (d > x1) break; t.push(d); m++; if (m > 11) { m = 0; y++; } }
  const step = Math.max(1, Math.ceil(t.length / Math.max(1, maxN)));
  return t.filter((_, i) => i % step === 0);
}

/** One y-axis, hairline grid, direct end labels, crosshair tooltip. Colours are CSS variables. */
export function LineChart(p: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const W = Math.max(280, width), H = p.height ?? 260;
  const m = { l: 52, r: p.endLabels ? 96 : 16, t: 12, b: 26 };

  const geo = useMemo(() => {
    const xs: number[] = [], ys: number[] = [...(p.yInclude ?? [])];
    p.series.forEach((s) => s.pts.forEach((q) => { xs.push(q.x); ys.push(q.y); }));
    (p.bands ?? []).forEach((b) => b.pts.forEach((q) => { xs.push(q.x); ys.push(q.lo, q.hi); }));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.08 || 1; y0 -= pad; y1 += pad;
    const X = (v: number) => m.l + ((v - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
    const Y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const base = p.hoverAll ? [...new Set(xs)].sort((a, b) => a - b) : p.series[0].pts.map((q) => q.x);
    return { x0, x1, y0, y1, X, Y, base };
  }, [p.series, p.bands, p.yInclude, p.hoverAll, W, H, m.l, m.r, m.t, m.b]);
  const { X, Y } = geo;

  const path = (s: Series) => {
    let d = "", prev: Pt | null = null;
    for (const q of s.pts) { d += `${prev && !(s.breakOnKey && prev.k !== q.k) ? "L" : "M"}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`; prev = q; }
    return d;
  };
  const labels = p.endLabels
    ? p.series.filter((s) => s.pts.length).map((s) => ({ s, y: Y(s.pts[s.pts.length - 1].y), x: X(s.pts[s.pts.length - 1].x) })).sort((a, b) => a.y - b.y)
    : [];
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const xv = geo.x0 + ((px - m.l) / (W - m.l - m.r)) * (geo.x1 - geo.x0);
    let best = geo.base[0]; for (const x of geo.base) if (Math.abs(x - xv) < Math.abs(best - xv)) best = x;
    setHover(best);
  };
  const animateDraw = p.draw !== false && !reduce;

  return (
    <div ref={ref} className="relative w-full" role="img" aria-label={p.aria}>
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" className="block overflow-visible">
          {niceTicks(geo.y0, geo.y1, 5).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" />
              <text x={m.l - 8} y={Y(v) + 4} textAnchor="end" className="num" fontSize={10.5} fill="var(--text-2)">{p.yFmt ? p.yFmt(v) : v}</text>
            </g>
          ))}
          {monthTicks(geo.x0, geo.x1, Math.floor((W - m.l - m.r) / 70)).map((d) => (
            <text key={d} x={X(d)} y={H - 6} textAnchor="middle" className="num" fontSize={10.5} fill="var(--text-2)">{mon(d)}</text>
          ))}
          <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--axis)" />
          {(p.bands ?? []).map((b, i) => b.pts.length > 0 && (
            <motion.polygon key={i} fill={b.fill}
              points={b.pts.map((q) => `${X(q.x)},${Y(q.hi)}`).concat(b.pts.slice().reverse().map((q) => `${X(q.x)},${Y(q.lo)}`)).join(" ")}
              initial={animateDraw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }} />
          ))}
          {(p.hlines ?? []).map((y) => <line key={y} x1={m.l} x2={W - m.r} y1={Y(y)} y2={Y(y)} stroke="var(--axis)" />)}
          {(p.vlines ?? []).map((v) => (
            <g key={v.x}>
              <line x1={X(v.x)} x2={X(v.x)} y1={m.t} y2={H - m.b} stroke="var(--ring-strong)" />
              {v.label && <text x={X(v.x) + 4} y={m.t + 10} className="num" fontSize={10.5} fill="var(--text-2)">{v.label}</text>}
            </g>
          ))}
          {p.series.map((s, i) => (
            <motion.path key={s.label} d={path(s)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeLinejoin="round" strokeLinecap="round"
              opacity={s.dim ? 0.7 : 1}
              initial={animateDraw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.15 + i * 0.14, ease: EASE }} />
          ))}
          {labels.map(({ s, x, y }) => (
            <g key={s.label}>
              <circle cx={x} cy={Y(s.pts[s.pts.length - 1].y)} r={3} fill={s.color} />
              <text x={x + 8} y={y + 4} fontSize={11} fontWeight={600} className="num" fill="var(--text)">{s.label}</text>
            </g>
          ))}
          {(p.markers ?? []).map((mk, i) => {
            const cx = X(mk.x), cy = Y(mk.y), s = 7;
            const hidden = p.veilAt != null && mk.x > p.veilAt;
            if (hidden) return null;
            return mk.shape === "circle"
              ? <circle key={i} cx={cx} cy={cy} r={5} fill={mk.color} stroke="var(--panel)" strokeWidth={2} />
              : <path key={i} fill={mk.color} stroke="var(--panel)" strokeWidth={2}
                  d={mk.shape === "up" ? `M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7}Z` : `M${cx},${cy + s} L${cx + s},${cy - s * 0.7} L${cx - s},${cy - s * 0.7}Z`} />;
          })}
          {p.veilAt != null && (
            <g>
              <rect x={X(p.veilAt)} y={m.t} width={Math.max(0, W - m.r - X(p.veilAt))} height={H - m.t - m.b} fill="var(--veil)" />
              <line x1={X(p.veilAt)} x2={X(p.veilAt)} y1={m.t} y2={H - m.b} stroke="var(--accent)" strokeWidth={1.5} />
            </g>
          )}
          {hover != null && <line x1={X(hover)} x2={X(hover)} y1={m.t} y2={H - m.b} stroke="var(--text-3)" />}
          <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover != null && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl bg-panel-2 px-3 py-2 text-xs ring-1 ring-ring-strong"
          style={{ left: Math.min(Math.max(0, (X(hover) / W) * width + 12), width - 180) }}>
          <div className="mb-1 font-semibold">{p.xLabel ? p.xLabel(hover) : dt(hover)}</div>
          {p.series.map((s) => { const q = s.pts.find((z) => z.x === hover); return q && (
            <div key={s.label} className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-text-2"><i className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <b className="num font-medium">{p.yFmt ? p.yFmt(q.y, true) : q.y.toFixed(2)}</b>
            </div>); })}
          {p.tipExtra?.(hover)}
        </div>
      )}
    </div>
  );
}
