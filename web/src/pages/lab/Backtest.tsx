import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle, XCircle, Warning, ShieldCheck } from "@phosphor-icons/react";
import { LineChart } from "../../components/LineChart";
import { EASE, Legend, Pill, SynthBanner } from "../../components/ui";
import { G, synthetic } from "../../lib/data";
import { bps, dt, num, pct, PAIR_LABEL, PAIR_SHORT } from "../../lib/format";
import { Panel, PairSeg, Seg, Table, numCell } from "./shared";

function Waterfall({ m }: { m: any }) {
  const reduce = useReducedMotion();
  const steps = [
    { label: "Gross spread P&L", v: m.gross, total: true },
    { label: "Costs", v: -m.costs },
    { label: "Gold exposure", v: -m.goldPart },
    { label: "Net, ex-gold", v: m.alpha, total: true, accent: true },
  ];
  let run = 0;
  const bars = steps.map((s) => { if (s.total) { run = s.v; return [0, s.v]; } const b = [run, run + s.v]; run += s.v; return b; });
  const vals = bars.flat().concat(0); let y0 = Math.min(...vals), y1 = Math.max(...vals); const pad = (y1 - y0) * 0.18 || 5; y0 -= pad; y1 += pad;
  const H = 220, Y = (v: number) => 14 + (1 - (v - y0) / (y1 - y0)) * (H - 50);
  return (
    <div role="img" aria-label={steps.map((s) => `${s.label} ${bps(s.v)}`).join(", ")}>
      <svg viewBox={`0 0 400 ${H}`} width="100%" height={H} aria-hidden="true">
        <line x1={0} x2={400} y1={Y(0)} y2={Y(0)} stroke="var(--axis)" />
        {steps.map((s, i) => {
          const [a, b] = bars[i], x = 18 + i * 96, top = Y(Math.max(a, b)), h = Math.max(2, Math.abs(Y(a) - Y(b)));
          return (
            <g key={s.label}>
              <motion.rect x={x} y={top} width={60} height={h} rx={6} fill={s.accent ? "var(--accent)" : s.total ? "var(--train)" : "var(--text-3)"}
                style={{ transformOrigin: `${x + 30}px ${Y(0)}px` }} initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE }} />
              <text x={x + 30} y={top - 7} textAnchor="middle" fontSize={11} className="num" fill="var(--text)">{bps(s.v)}</text>
              <text x={x + 30} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--text-2)">{s.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Backtest() {
  const { M, WF, WFZ, VERD } = synthetic();
  const [pairId, setPair] = useState<string>(G.PRIMARY.pair);
  const [signal, setSignal] = useState<"level" | "z">("level");
  const pair = G.PAIRS.find((p: any) => p.id === pairId)!;
  const wf = (signal === "level" ? WF : WFZ)[pairId];
  const ho = wf[wf.length - 1], S = ho.strat.m, NG = ho.noGate, RND = ho.random;
  const primary = WF[G.PRIMARY.pair], pv = VERD[G.PRIMARY.pair];
  const conv = useMemo(() => G.convergence(M.ctx, pair, M.series[pairId]).slice(-6), [M, pair, pairId]);

  const curve = useMemo(() => {
    const notional = (M.series[pairId].find((x: any) => x.d >= G.FOLDS[0].testFrom) || M.series[pairId][0]).B.pq * pair.grams;
    const g: any[] = [], n: any[] = []; let a = 0, b = 0;
    for (const f of wf) {
      const daily = new Map<number, { p: number; c: number }>();
      for (const x of f.strat.run.daily) { const o = daily.get(x.d) || { p: 0, c: 0 }; o.p += x.pnl; o.c += x.cost; daily.set(x.d, o); }
      for (const pt of f.strat.m.curve) { const o = daily.get(pt.d) || { p: 0, c: 0 }; a += 1e4 * o.p / notional; b += 1e4 * (o.p - o.c) / notional; g.push({ x: pt.d, y: a }); n.push({ x: pt.d, y: b }); }
    }
    return { g, n };
  }, [M, wf, pair, pairId]);

  const row = (label: string, a: number, b: number, c: number, f: (v: number) => string) => (
    <tr key={label}><td>{label}</td><td className={`${numCell} font-semibold`}>{f(a)}</td><td className={numCell}>{f(b)}</td><td className={numCell}>{f(c)}</td></tr>
  );

  return (
    <div className="grid gap-5">
      <SynthBanner>Real data covers 2 days, so the walk-forward runs on generated history to show the method end to end. Every number on this step is illustrative, not a result.</SynthBanner>

      <Panel title={<span className="inline-flex items-center gap-2"><ShieldCheck size={20} className="text-accent-text" aria-hidden="true" />Primary test, fixed before any hold-out run</span>}
        sub={`GUINEA vs TEN, level signal, ${G.LEVEL_GRID.length} settings. ${G.CONFIGS_TRIED} configurations tried in total.`}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="grid grid-cols-3 gap-3">
            {primary.map((f: any) => { const s = f.stress[1].m, ok = s.trades > 0 && s.sharpe > 0; return (
              <div key={f.fold.name} className="rounded-2xl bg-panel-2 p-4 ring-1 ring-ring">
                <div className="text-xs text-text-2">{f.fold.name}</div>
                <div className="num mt-1 text-lg">{s.trades ? num(s.sharpe) : "no trades"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill tone={ok ? "good" : "bad"} icon={ok ? <CheckCircle size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}>{ok ? "Pass" : "Fail"}</Pill>
                  <span className="text-xs text-text-3">{f.strat.m.trades} trades at 1×</span>
                </div>
              </div>); })}
          </div>
          <div className="rounded-2xl p-5 ring-1 ring-ring md:w-64">
            <div className="text-xs text-text-2">Verdict at 2× costs</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{pv.pass ? "Edge survives" : "No persistent edge"}</div>
            <p className="mt-2 text-xs text-text-3">Rule: net Sharpe above 0 on every fold at 2× costs.</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <PairSeg value={pairId} onChange={setPair} />
          <Seg legend="Signal" value={signal} onChange={setSignal} options={[{ v: "level", label: "Level (primary)" }, { v: "z", label: "z-score (exploratory)" }]} />
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-text-2">Walk-forward folds</span>
            <svg viewBox="0 0 300 56" width="300" height="56" className="max-w-full" role="img" aria-label="Expanding training window, then a 3-month test window; the last fold is the untouched hold-out">
              {wf.map((f: any, i: number) => {
                const x0 = G.FOLDS[0].trainFrom, x1 = G.FOLDS[G.FOLDS.length - 1].testTo, X = (d: number) => 64 + ((d - x0) / (x1 - x0)) * 232;
                return (<g key={f.fold.name}><text x={0} y={i * 18 + 12} fontSize={10.5} fill="var(--text-2)">{f.fold.name}</text>
                  <rect x={X(f.fold.trainFrom)} y={i * 18 + 3} width={X(f.fold.testFrom) - X(f.fold.trainFrom) - 2} height={12} rx={3} fill="var(--train)" />
                  <rect x={X(f.fold.testFrom)} y={i * 18 + 3} width={X(f.fold.testTo) - X(f.fold.testFrom)} height={12} rx={3} fill="var(--accent)" /></g>);
              })}
            </svg>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Hold-out results, net of costs" sub={`${PAIR_SHORT[pairId]}${pairId === G.PRIMARY.pair && signal === "level" ? " (primary)" : " (exploratory)"}, ${dt(ho.fold.testFrom)} to ${dt(ho.fold.testTo)}`}>
          <Table label="Hold-out results">
            <thead><tr><th>Metric</th><th className="!text-right">Strategy</th><th className="!text-right">No cost filter</th><th className="!text-right">Random entry</th></tr></thead>
            <tbody>
              {row("Net return", S.net, NG.net, RND.net, (v) => bps(v))}
              {row("Sharpe (net, annualised)", S.sharpe, NG.sharpe, RND.sharpe, (v) => num(v))}
              {row("Max drawdown", S.mdd, NG.mdd, RND.mdd, (v) => bps(v))}
              {row("Trades", S.trades, NG.trades, RND.trades, (v) => String(v))}
              {row("Hit rate", S.hit, NG.hit, RND.hit, pct)}
              {row("Correlation with gold", S.corrGold, NG.corrGold, RND.corrGold, (v) => num(v))}
            </tbody>
          </Table>
          {S.trades < 10 && <p className="mt-3 flex items-center gap-2 text-sm text-warn"><Warning size={16} aria-hidden="true" />Only {S.trades} trades: too few to conclude either way.</p>}
        </Panel>
        <Panel title="Where the P&L came from" sub="Hold-out, prices of the contracts actually held" delay={0.05}>
          <Waterfall m={S} />
          <p className="mt-2 text-xs text-text-3">Gold exposure is beta to the gold price times gold's move. GOLDM pairs carry about 0.4% leftover exposure (995 vs 999 fine gold).</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Cumulative P&L on unseen data" sub="Test folds joined, 1× costs">
          <Legend items={[{ color: "var(--text-3)", label: "Gross" }, { color: "var(--accent)", label: "Net of costs" }]} />
          <div className="mt-2"><LineChart aria={`Cumulative gross and net P&L for ${PAIR_LABEL[pairId]}`} height={240} yInclude={[0]} hlines={[0]}
            vlines={G.FOLDS.slice(1).map((f: any) => ({ x: f.testFrom, label: f.name }))}
            series={[{ label: "Net", color: "var(--accent)", pts: curve.n }, { label: "Gross", color: "var(--text-3)", width: 1.5, pts: curve.g }]} yFmt={(v, tip) => (tip ? bps(v) : String(v))} /></div>
        </Panel>
        <Panel title="Pass rule matrix, 2× costs" sub="Only the primary row decides the verdict" delay={0.05}>
          <Table label="Pass rule by pair and fold">
            <thead><tr><th>Pair</th>{G.FOLDS.map((f: any) => <th key={f.name} className="!text-center">{f.name}</th>)}</tr></thead>
            <tbody>{G.PAIRS.map((p: any) => (
              <tr key={p.id} className={p.id === G.PRIMARY.pair ? "bg-panel-2" : ""}>
                <td className="font-medium">{PAIR_SHORT[p.id]}{p.id === G.PRIMARY.pair && <span className="ml-2 text-xs text-accent-text">primary</span>}</td>
                {WF[p.id].map((f: any) => { const m = f.stress[1].m, ok = m.sharpe > 0 && m.trades > 0; return (
                  <td key={f.fold.name} className="text-center"><Pill tone={ok ? "good" : "bad"} icon={ok ? <CheckCircle size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}>{m.trades ? num(m.sharpe) : "no trades"}</Pill></td>); })}
              </tr>))}</tbody>
          </Table>
          <h3 className="mb-2 mt-6 text-sm font-medium">Cost stress, hold-out</h3>
          <Table label="Cost stress">
            <thead><tr><th>Costs</th><th className="!text-right">Trades</th><th className="!text-right">Net return</th><th className="!text-right">Sharpe</th></tr></thead>
            <tbody>{ho.stress.map((s: any) => <tr key={s.mult}><td>{s.mult}×</td><td className={numCell}>{s.m.trades}</td><td className={numCell}>{bps(s.m.net)}</td><td className={numCell}>{num(s.m.sharpe)}</td></tr>)}</tbody>
          </Table>
        </Panel>
      </div>

      {conv.length > 0 && (
        <Panel title="Convergence check, per expiry" sub="Does the gap shrink before we must exit?">
          <Table label="Gap at entry, last allowed exit and expiry">
            <thead><tr><th>Expiry</th><th className="!text-right">At entry</th><th className="!text-right">Last allowed exit</th><th className="!text-right">At expiry</th><th className="!text-right">Round trip</th><th>Tradable under our rules</th></tr></thead>
            <tbody>{conv.map((c: any) => (
              <tr key={c.E}><td className="num text-[13px]">{G.fmtExp(c.E)}</td><td className={numCell}>{bps(c.entry)}</td><td className={numCell}>{bps(c.lastExit)}</td>
                <td className={numCell}>{c.expiry == null ? "-" : bps(c.expiry)}</td><td className={numCell}>{c.rt.toFixed(1)} bps</td>
                <td>{c.tradable ? <Pill tone="good" icon={<CheckCircle size={13} aria-hidden="true" />}>Shrinks in time</Pill> : <Pill tone="neutral">Not before exit</Pill>}</td></tr>))}</tbody>
          </Table>
          <p className="mt-3 text-xs text-text-3">If a gap closes only inside the tender window, it is real but not tradable under our rules. That is still a valid result.</p>
        </Panel>
      )}
    </div>
  );
}
