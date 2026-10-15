import { useEffect, useMemo, useRef, useState } from "react";
import { BellSimple, MinusCircle, LockSimple, Play, Pause } from "@phosphor-icons/react";
import { LineChart } from "../../components/LineChart";
import { Legend, Pill, SynthBanner } from "../../components/ui";
import { G, R, synthetic } from "../../lib/data";
import { bps, dt, dtShort, num, PAIR_LABEL, REAL_LABEL, SERIES } from "../../lib/format";
import { Panel, PairSeg, Seg } from "./shared";

type Cls = { k: "sig" | "quiet" | "cost" | "thin" | "life"; t: string; d: string };

export default function Signal() {
  const { M } = synthetic();
  const [pairId, setPair] = useState<string>(G.PRIMARY.pair);
  const [signal, setSignal] = useState<"level" | "z">("level");
  const [k, setK] = useState(1.25);
  const [costMult, setCost] = useState(1);
  const [at, setAt] = useState<number | null>(null);   // replay index, null = not replaying
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const view = useMemo(() => {
    const pair = G.PAIRS.find((p: any) => p.id === pairId)!;
    const series = M.series[pair.id];
    const days = M.ctx.days, to = days[days.length - 1], from = to - 270;
    const lm = G.levelModel(series, from - 1, 10);
    const params = signal === "level" ? { signal, levelModel: lm.f, levelSd: lm.sd, k, costMult } : { W: 40, k: k + 0.75, costMult };
    const run = G.runStrategy(M.ctx, pair, series, params, from, to);
    const sig = run.signals.filter((s: any) => s.d >= from);
    const markers = run.trades.flatMap((t: any) => {
      const a = series.find((x: any) => x.d === t.entryDay), b = series.find((x: any) => x.d === t.exitDay);
      return [a && { x: a.d, y: a.s, shape: t.dir > 0 ? "down" : "up", color: "var(--accent)" }, b && { x: b.d, y: b.s, shape: "circle", color: "var(--train)" }].filter(Boolean);
    });
    const thr = signal === "level" ? (s: any) => s.rtBps * k : (s: any) => (k + 0.75) * s.sdv;
    const cls = (s: any): Cls => {
      const open = run.trades.find((t: any) => t.entryDecision === s.d), gap = Math.abs(s.s - s.m);
      if (open) return { k: "sig", t: `Signal: ${open.dir > 0 ? "short" : "long"} ${pair.a.replace("GOLD", "")}, ${open.dir > 0 ? "long" : "short"} ${pair.b.replace("GOLD", "")}`, d: `gap ${gap.toFixed(1)} bps from expected, costs ${s.rtBps.toFixed(1)}` };
      if (gap <= thr(s)) return { k: "quiet", t: "Quiet", d: signal === "level" ? `${gap.toFixed(1)} bps from expected, inside the threshold` : `|z| ${Math.abs(s.z).toFixed(2)} inside ±${(k + 0.75).toFixed(2)}` };
      if (!s.liquid) return { k: "thin", t: "Blocked: thin day", d: "A leg traded under its liquidity floor" };
      if (gap <= s.rtBps) return { k: "cost", t: "Blocked: gap below costs", d: `${gap.toFixed(1)} ≤ ${s.rtBps.toFixed(1)} bps` };
      return { k: "life", t: "Blocked: contract calendar", d: "Too close to the tender window, or a position is open" };
    };
    return { pair, sig, markers, run, all: sig.map(cls), thr };
  }, [M, pairId, signal, k, costMult]);

  // Replay: one trading day every 45 ms; the future stays veiled. Stops on any parameter change.
  useEffect(() => { cancelAnimationFrame(raf.current); setPlaying(false); setAt(null); }, [view]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (t: number) => {
      if (t - last >= 45) {
        last = t;
        setAt((i) => { const n = (i ?? -1) + 1; if (n >= view.sig.length - 1) { setPlaying(false); return null; } return n; });
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, view.sig.length]);

  const upto = at ?? view.sig.length - 1;
  const seen = view.all.slice(0, upto + 1);
  const count = (x: Cls["k"]) => seen.filter((c: Cls) => c.k === x).length;
  const recent = view.sig.slice(Math.max(0, upto - 7), upto + 1).map((s: any, i: number, arr: any[]) => ({ s, c: view.all[upto - (arr.length - 1) + i] })).reverse();

  return (
    <div className="grid gap-5">
      <Panel title="Today's alerts, real data" sub={`Front month, ${dt(R.rows[0].d)}`}>
        <div className="grid gap-3 md:grid-cols-3">
          {R.alerts.map((a: any) => (
            <div key={a.pair.id} className="rounded-2xl bg-panel-2 p-4 ring-1 ring-ring">
              <h3 className="text-sm font-medium">{REAL_LABEL[a.pair.id]}</h3>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <div><dt className="text-xs text-text-2">gap</dt><dd className="num text-lg">{bps(a.gap, 0)}</dd></div>
                <div><dt className="text-xs text-text-2">round trip</dt><dd className="num text-lg">{a.rt.toFixed(0)} bps</dd></div>
                <div><dt className="text-xs text-text-2">history</dt><dd className="num text-lg">{a.history} / {a.need} days</dd></div>
              </dl>
              <div className="mt-3"><Pill tone="neutral" icon={<MinusCircle size={13} aria-hidden="true" />}>{a.status === "quiet-history" ? "Quiet: beats costs, too little history" : "Quiet: inside the cost zone"}</Pill></div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-3">An alert fires only when the gap is unusual against its expected level, larger than costs, both legs liquid, and the contract calendar allows it.</p>
      </Panel>

      <SynthBanner>The explorer below runs the rules on 21 months of generated data. Stacking the daily Bhavcopy files replaces it with real history.</SynthBanner>

      <Panel>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <PairSeg value={pairId} onChange={setPair} />
          <Seg legend="Signal" value={signal} onChange={setSignal} options={[{ v: "level", label: "Level (primary)" }, { v: "z", label: "z-score" }]} />
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-text-2">{signal === "level" ? "Entry: gap beyond costs ×" : "Entry: |z| beyond"}</span>
            <span className="flex items-center gap-3">
              <input type="range" min={1} max={2} step={0.05} value={k} onChange={(e) => setK(+e.target.value)} className="h-9 w-40 accent-[var(--accent)]" />
              <output className="num w-12 text-sm">{signal === "level" ? k.toFixed(2) : (k + 0.75).toFixed(2)}</output>
            </span>
          </label>
          <Seg legend="Cost stress" value={costMult} onChange={setCost} options={[1, 2, 3].map((v) => ({ v, label: `${v}×` }))} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title={PAIR_LABEL[view.pair.id]} sub={<span className="num">{at != null ? dt(view.sig[at].d) : "Last 9 months"}</span>}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Legend items={[{ color: SERIES[view.pair.a], label: "Spread" }, { color: "var(--text-3)", label: signal === "level" ? "Expected level (train)" : "Rolling mean (past only)" }, { color: "var(--band-cost)", label: "Inside costs: quiet", kind: "box" }, { color: "var(--accent)", label: "Entry", kind: "dot" }, { color: "var(--train)", label: "Exit", kind: "dot" }]} />
            <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-ring-strong transition-transform duration-300 active:scale-[0.98]">
              {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {playing ? "Pause" : at != null ? "Resume" : "Replay day by day"}
            </button>
          </div>
          <LineChart aria={`Synthetic ${PAIR_LABEL[view.pair.id]} spread with ${view.run.trades.length} trades`} height={320} veilAt={at != null ? view.sig[at].d : null}
            bands={[{ fill: "var(--band-cost)", pts: view.sig.map((s: any) => ({ x: s.d, lo: s.m - s.rtBps, hi: s.m + s.rtBps })) }]}
            series={[{ label: "Spread", color: SERIES[view.pair.a], pts: view.sig.map((s: any) => ({ x: s.d, y: s.s })) }, { label: "Expected", color: "var(--text-3)", width: 1.25, pts: view.sig.map((s: any) => ({ x: s.d, y: s.m })) }]}
            markers={view.markers} yFmt={(v, tip) => (tip ? bps(v) : String(v))}
            tipExtra={(d) => { const s = view.sig.find((x: any) => x.d === d); return s && <div className="mt-1 flex justify-between gap-3"><span className="text-text-2">z-score</span><b className="num font-medium">{num(s.z)}</b></div>; }} />
          <p className="mt-3 text-xs text-text-3">Decided on day t's close and executed at t+1's close on the same expiry. The expected level is fitted on data before this window only.</p>
        </Panel>
        <Panel title="Alert feed" sub={at != null ? "Replaying" : "Last 8 trading days"}>
          <dl className="mb-4 grid grid-cols-2 gap-2">
            {([["Quiet", count("quiet")], ["Blocked: cost", count("cost")], ["Blocked: liquidity or calendar", count("thin") + count("life")], ["Signals", count("sig")]] as const).map(([l, v]) => (
              <div key={l} className="flex flex-col-reverse rounded-xl bg-panel-2 px-3 py-2 ring-1 ring-ring"><dt className="text-xs text-text-2">{l}</dt><dd className="num text-lg">{v}</dd></div>
            ))}
          </dl>
          <ul className="grid gap-1.5" aria-live="off">
            {recent.map(({ s, c }: any) => (
              <li key={s.d} className={`grid grid-cols-[52px_18px_minmax(0,1fr)] items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${c.k === "sig" ? "bg-accent-soft ring-accent/50" : "ring-ring"}`}>
                <span className="num pt-0.5 text-xs text-text-2">{dtShort(s.d)}</span>
                {c.k === "sig" ? <BellSimple size={16} className="mt-0.5 text-accent-text" aria-hidden="true" /> : c.k === "quiet" ? <MinusCircle size={16} className="mt-0.5 text-text-3" aria-hidden="true" /> : <LockSimple size={16} className="mt-0.5 text-warn" aria-hidden="true" />}
                <span><b className="font-medium">{c.t}</b><span className="block text-xs text-text-2">{c.d}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
