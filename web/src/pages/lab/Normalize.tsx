import { Fragment, useMemo } from "react";
import { Warning } from "@phosphor-icons/react";
import { LineChart } from "../../components/LineChart";
import { Pill } from "../../components/ui";
import { G, R, curveFit, spotPerGram } from "../../lib/data";
import { bps, rupees, SERIES } from "../../lib/format";
import { Panel, Table, numCell } from "./shared";

/** Curve-fit model: each contract's level vs GOLDTEN with ±2 standard-error whiskers. */
function CurveFitPanel() {
  const fit = useMemo(curveFit, []);
  const max = Math.max(...fit.levels.map((l) => Math.abs(l.bps) + 2 * l.se)) * 1.1;
  const W = 400, X = (v: number) => 20 + ((v + max) / (2 * max)) * (W - 40);
  return (
    <Panel title="Curve-fit model, real data" sub={`${fit.n} liquid contracts, 14 Oct`} delay={0.05}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <div>
          <svg viewBox={`0 0 ${W} ${fit.levels.length * 44 + 30}`} width="100%" className="max-w-[460px]" role="img"
            aria-label={fit.levels.map((l) => `${l.symbol} ${bps(l.bps)} plus or minus ${(2 * l.se).toFixed(1)}`).join(", ") + " versus GOLDTEN"}>
            <line x1={X(0)} x2={X(0)} y1={4} y2={fit.levels.length * 44 + 8} stroke="var(--ring-strong)" />
            <text x={X(0)} y={fit.levels.length * 44 + 24} textAnchor="middle" fontSize={11} fill="var(--text-2)">GOLDTEN level</text>
            {fit.levels.map((l, i) => {
              const y = 22 + i * 44;
              return (
                <g key={l.symbol}>
                  <text x={20} y={y - 10} fontSize={11.5} fill="var(--text)">{l.symbol}</text>
                  <line x1={X(l.bps - 2 * l.se)} x2={X(l.bps + 2 * l.se)} y1={y} y2={y} stroke={SERIES[l.symbol]} strokeWidth={2} strokeLinecap="round" />
                  <circle cx={X(l.bps)} cy={y} r={5.5} fill={SERIES[l.symbol]} stroke="var(--panel)" strokeWidth={2} />
                  <text x={W - 20} y={y - 10} textAnchor="end" fontSize={11.5} className="num" fill="var(--text)">{bps(l.bps)} ± {(2 * l.se).toFixed(1)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-text-2">Shared carry</dt><dd className="num mt-1 text-lg">{(fit.carry * 100).toFixed(1)}% a year</dd></div>
          <div><dt className="text-xs text-text-2">Typical miss</dt><dd className="num mt-1 text-lg">{fit.residBps.toFixed(1)} bps</dd></div>
        </dl>
          <p className="mt-4 text-xs leading-relaxed text-text-2">
            ln(₹/g) = contract level + carry × years to expiry. All four curves rise at the same rate; GUINEA and PETAL sit on a curve about 50 bps above GOLDTEN, about 10 standard errors away. Whiskers are ±2 standard errors. One day of data: structural on this day, not yet tradable evidence.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export default function Normalize() {
  const curve = useMemo(() => G.CONTRACTS.map((c: string) => ({
    label: c, color: SERIES[c],
    pts: R.rows.filter((r: any) => r.symbol === c && !r.thin).sort((a: any, b: any) => a.e - b.e).map((r: any) => ({ x: r.e, y: r.pg })),
  })), []);
  const gap = (p: any) => p ? (
    <td className={numCell}>
      <span className="inline-flex items-center gap-1">{p.thin && <Warning size={13} className="text-warn" aria-label="Thin" />}<b className="font-medium">{bps(p.today, 0)}</b></span>
      <span className="block text-xs text-text-3">{bps(p.prev, 0)}</span>
    </td>) : <td className={numCell}>-</td>;
  const goldmFor = (e: number) => R.goldm.find((g: any) => g.e > e && g.e - e < 12);

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title="Four contracts, one price: ₹ per gram (999)" sub="Real closes by expiry">
          <LineChart aria="Futures curves by expiry; GUINEA and PETAL sit about half a percent above GOLDTEN and GOLDM." series={curve} height={320}
            endLabels hoverAll xLabel={(x) => `Expiry ${G.fmtExp(x)}`} yFmt={(v, tip) => (tip ? rupees(v, 2) : rupees(v))} />
          <p className="mt-3 text-xs text-text-3">Fitted carry is {(curveFit().carry * 100).toFixed(1)}% a year, shared by every contract. Thin contracts (under 5 kg traded) are left off.</p>
        </Panel>
        <div className="grid gap-5">
          <Panel title="Normalization" delay={0.05}>
            <p className="num rounded-xl bg-panel-2 px-3 py-2.5 text-[13px] ring-1 ring-ring"><b className="text-accent-text">₹/g (999)</b> = Close ÷ quote grams × 999 ÷ purity</p>
            <Table label="Contract specifications">
              <thead><tr><th>Contract</th><th className="!text-right">Lot</th><th className="!text-right">Quote</th><th className="!text-right">Purity</th></tr></thead>
              <tbody>{G.CONTRACTS.map((c: string) => { const s = (G.SPECS as any)[c]; return (
                <tr key={c}><td><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: SERIES[c] }} />{c}</span></td>
                  <td className={numCell}>{s.lotGrams} g</td><td className={numCell}>{s.quoteGrams} g</td><td className={numCell}>{s.purity}</td></tr>); })}</tbody>
            </Table>
          </Panel>
          <Panel title="Spot agrees" sub="MCX spot, 15 Oct" delay={0.1}>
            <ul className="grid gap-2 text-sm">{spotPerGram().map((s: any) => (
              <li key={s.symbol} className="flex justify-between"><span className="text-text-2">{s.symbol} <span className="text-xs">({s.location.toLowerCase()})</span></span><span className="num">{rupees(s.perGram, 1)}</span></li>))}
            </ul>
            <p className="mt-3 text-xs text-text-3">TEN and GUINEA spot are identical per gram, so the gap is in futures pricing.</p>
          </Panel>
        </div>
      </div>
      <CurveFitPanel />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title="Same-expiry gaps, basis points" sub="Bold: 14 Oct. Grey: 13 Oct, prices only">
          <Table label="Same-expiry gaps">
            <thead><tr><th>Expiry</th><th className="!text-right">GUINEA vs TEN</th><th className="!text-right">PETAL vs TEN</th><th className="!text-right">GUINEA vs PETAL</th><th className="!text-right">GOLDM vs TEN</th><th className="!text-right">Round trip</th></tr></thead>
            <tbody>{R.sameExpiry.map((s: any) => { const m = goldmFor(s.e); return (
              <tr key={s.e}><td className="num text-[13px]">{G.fmtExp(s.e)}</td>{s.pairs.map((p: any, i: number) => <Fragment key={i}>{gap(p)}</Fragment>)}
                <td className={numCell}>{m && m.gap !== null ? <><b className="font-medium">{bps(m.gap, 0)}</b><span className="block text-xs text-text-3">carry-adj.</span></> : "-"}</td>
                <td className={numCell}>{s.pairs[0].rt.toFixed(0)} bps</td></tr>); })}</tbody>
          </Table>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-3"><Warning size={13} className="text-warn" aria-hidden="true" />A leg traded under 5 kg that day, so its close is a weak price.</p>
        </Panel>
        <Panel title="Before calling it an edge" delay={0.05}>
          <ol className="grid list-decimal gap-4 pl-5 text-sm leading-relaxed">
            <li><b className="font-medium">Delivery.</b> GUINEA delivers in 8 g units, PETAL in 1 g; small units can carry a making charge. <span className="mt-1 block"><Pill tone="warn">Test first</Pill></span></li>
            <li><b className="font-medium">Final settlement.</b> Compare each contract's settlement clause and its last close with its settlement price. <span className="mt-1 block"><Pill tone="warn">Test first</Pill></span></li>
            <li><b className="font-medium">Convergence.</b> The gap must shrink before the last allowed exit, not only at expiry. <span className="mt-1 block"><Pill tone="neutral">Needs history</Pill></span></li>
            <li><b className="font-medium">Location.</b> PETAL is ex-Mumbai; GUINEA and PETAL still agree within ~10 bps. <span className="mt-1 block"><Pill tone="neutral">Unlikely</Pill></span></li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
