import { G } from "./engine.js";
import real from "./real-data.json";

/** The real MCX snapshot, analysed once at startup (24 rows: cheap). */
export const R = G.analyzeReal(real);
export const SNAP_DAY = G.fromIso(R.date) as number;

/** Headline range: GUINEA and PETAL vs TEN at liquid expiries only. */
export function headlineRange() {
  const liquid = R.sameExpiry.filter((s: any) => s.pairs.every((p: any) => p && !p.thin));
  const gaps = liquid.flatMap((s: any) => [s.pairs[0].today, s.pairs[1].today]) as number[];
  return { lo: Math.round(Math.min(...gaps)), hi: Math.round(Math.max(...gaps)), expiries: liquid.length };
}

/**
 * Curve-fit model on the real snapshot: ln(₹/g) = level[contract] + carry × years-to-expiry,
 * one carry shared by all contracts, liquid rows only (≥ 5 kg traded). Ordinary least squares;
 * standard errors from the residual variance. Returns each contract's level vs GOLDTEN in bps.
 */
export function curveFit() {
  const rows = R.rows.filter((r: any) => !r.thin);
  const C: string[] = [...new Set<string>(rows.map((r: any) => r.symbol))].sort();
  const k = C.length + 1;
  const X = rows.map((r: any) => [...C.map((c) => (r.symbol === c ? 1 : 0)), r.days_to_expiry / 365]);
  const y = rows.map((r: any) => Math.log(r.pg));
  // normal equations (X'X) b = X'y, solved by Gauss-Jordan; also yields (X'X)^-1 for the covariance
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s: number, x: number[]) => s + x[i] * x[j], 0)));
  const v = Array.from({ length: k }, (_, i) => X.reduce((s: number, x: number[], n: number) => s + x[i] * y[n], 0));
  const inv = A.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)), v[i]]);
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(inv[r][c]) > Math.abs(inv[p][c])) p = r;
    [inv[c], inv[p]] = [inv[p], inv[c]];
    const d = inv[c][c]; for (let j = 0; j < inv[c].length; j++) inv[c][j] /= d;
    for (let r = 0; r < k; r++) if (r !== c) { const f = inv[r][c]; for (let j = 0; j < inv[r].length; j++) inv[r][j] -= f * inv[c][j]; }
  }
  const b = inv.map((row) => row[2 * k]);
  const XtXi = inv.map((row) => row.slice(k, 2 * k));
  const resid = y.map((yy: number, n: number) => yy - X[n].reduce((s: number, x: number, i: number) => s + x * b[i], 0));
  const s2 = resid.reduce((s: number, e: number) => s + e * e, 0) / (rows.length - k);
  const t = C.indexOf("GOLDTEN");
  const levels = C.filter((c) => c !== "GOLDTEN").map((c) => {
    const j = C.indexOf(c);
    return { symbol: c, bps: (b[j] - b[t]) * 1e4, se: Math.sqrt(s2 * (XtXi[j][j] + XtXi[t][t] - 2 * XtXi[j][t])) * 1e4 };
  }).sort((a, z) => z.bps - a.bps);
  return { n: rows.length, carry: b[k - 1], residBps: Math.sqrt(s2) * 1e4, levels };
}

/** Spot per gram on a 999 basis, from the MCX spot file. */
export function spotPerGram() {
  return R.spot.map((s: any) => {
    const sp = (G.SPECS as any)[s.symbol];
    return { symbol: s.symbol as string, location: s.location as string, perGram: (s.spot_price / sp.quoteGrams) * (999 / sp.purity) };
  });
}

/** Synthetic history and every walk-forward, computed lazily (about 0.6 s) the first time the Lab needs it. */
let cache: any = null, market: any = null;
/** Synthetic market only (about 0.12 s): enough for the story page's replay. */
export function syntheticMarket() {
  if (!market) market = G.build(7);
  return market;
}
export function synthetic() {
  if (cache) return cache;
  const M = syntheticMarket();
  const WF: Record<string, any> = {}, WFZ: Record<string, any> = {}, VERD: Record<string, any> = {};
  for (const p of G.PAIRS) {
    WF[p.id] = G.walkForward(M.ctx, p, M.series[p.id], 1, "level");
    WFZ[p.id] = G.walkForward(M.ctx, p, M.series[p.id], 1, "z");
    VERD[p.id] = G.verdict(WF[p.id]);
  }
  cache = { M, WF, WFZ, VERD };
  return cache;
}

export { G };
