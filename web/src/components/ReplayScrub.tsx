import { useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "motion/react";
import { G, syntheticMarket } from "../lib/data";
import { bps, dt } from "../lib/format";
import { Bezel, Legend, SynthBanner } from "./ui";
import { LineChart } from "./LineChart";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Pinned scroll replay (GSAP leaf; it only moves its own overlay, never Motion-owned nodes).
 * Storytelling: as you scroll, a playhead walks the spread day by day and the future stays veiled,
 * which shows "no look-ahead" instead of claiming it.
 */
export default function ReplayScrub() {
  const wrap = useRef<HTMLElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const day = useRef<HTMLSpanElement>(null);
  const seen = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  const data = useMemo(() => {
    const M = syntheticMarket();
    const pair = G.PAIRS.find((p: any) => p.id === G.PRIMARY.pair)!;
    const series = M.series[pair.id];
    const to = M.ctx.days[M.ctx.days.length - 1], from = to - 270;
    const lm = G.levelModel(series, from - 1, 10);
    const run = G.runStrategy(M.ctx, pair, series, { signal: "level", levelModel: lm.f, levelSd: lm.sd, k: 1.25 }, from, to);
    const sig = run.signals.filter((s: any) => s.d >= from);
    const markers = run.trades.flatMap((t: any) => {
      const a = series.find((x: any) => x.d === t.entryDay), b = series.find((x: any) => x.d === t.exitDay);
      return [a && { x: a.d, y: a.s, shape: t.dir > 0 ? "down" : "up", color: "var(--accent)" }, b && { x: b.d, y: b.s, shape: "circle", color: "var(--train)" }].filter(Boolean);
    });
    return { sig, markers, trades: run.trades };
  }, []);

  useGSAP(() => {
    if (reduce || !wrap.current) return;
    // ScrollTrigger measures positions once; fonts and the content above can still change the page
    // height after this lazy section mounts, so re-measure whenever the document grows or shrinks.
    let t = 0;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 120); });
    ro.observe(document.body);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    if (document.readyState !== "complete") window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    const n = data.sig.length;
    ScrollTrigger.create({
      trigger: wrap.current, start: "top top", end: "+=1800", pin: true, scrub: 0.6, invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress, i = Math.min(n - 1, Math.round(p * (n - 1)));
        gsap.set(veil.current, { scaleX: 1 - p });
        gsap.set(head.current, { xPercent: p * 100 });
        if (day.current) day.current.textContent = dt(data.sig[i].d);
        if (seen.current) seen.current.textContent = String(data.trades.filter((tr: any) => tr.entryDecision <= data.sig[i].d).length);
      },
    });
    return () => { ro.disconnect(); clearTimeout(t); };
  }, { scope: wrap, dependencies: [reduce, data] });

  return (
    <section ref={wrap} aria-labelledby="replay-title" className="relative">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center gap-8 px-4 py-24 md:px-8 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:items-center lg:gap-12">
        <div className="max-w-md">
          <h2 id="replay-title" className="text-3xl font-semibold tracking-tight md:text-5xl">No look-ahead, shown.</h2>
          <p className="mt-5 text-text-2 leading-relaxed">The signal decides on day t's close and trades at t+1. Scroll, and the replay walks one trading day at a time while the future stays hidden.</p>
          <dl className="mt-8 grid grid-cols-2 gap-6">
            <div><dt className="text-xs text-text-2">Replay day</dt><dd className="num mt-1 text-lg"><span ref={day}>{reduce ? dt(data.sig[data.sig.length - 1].d) : dt(data.sig[0].d)}</span></dd></div>
            <div><dt className="text-xs text-text-2">Signals so far</dt><dd className="num mt-1 text-lg"><span ref={seen}>{reduce ? data.trades.length : 0}</span></dd></div>
          </dl>
          <div className="mt-8"><SynthBanner>The method runs on generated history until the stacked Bhavcopy files are loaded.</SynthBanner></div>
        </div>
        <Bezel core="p-5 md:p-7">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">GOLDTEN vs GOLDGUINEA, level signal</h3>
            <span className="text-xs text-text-2">gap from its expected level, bps</span>
          </div>
          <Legend items={[{ color: "var(--s2)", label: "Spread" }, { color: "var(--text-3)", label: "Expected level (train only)" }, { color: "var(--band-cost)", label: "Inside costs: stay quiet", kind: "box" }]} />
          <div className="relative mt-3">
            <LineChart aria={`Synthetic GOLDTEN vs GOLDGUINEA spread over nine months with ${data.trades.length} trades`} height={300} draw={false}
              bands={[{ fill: "var(--band-cost)", pts: data.sig.map((s: any) => ({ x: s.d, lo: s.m - s.rtBps, hi: s.m + s.rtBps })) }]}
              series={[{ label: "Spread", color: "var(--s2)", pts: data.sig.map((s: any) => ({ x: s.d, y: s.s })) }, { label: "Expected", color: "var(--text-3)", width: 1.25, pts: data.sig.map((s: any) => ({ x: s.d, y: s.m })) }]}
              markers={data.markers} yFmt={(v, tip) => (tip ? bps(v) : String(v))} />
            {!reduce && (
              <div className="pointer-events-none absolute overflow-hidden" style={{ left: 52, right: 16, top: 12, bottom: 26 }} aria-hidden="true">
                <div ref={veil} className="absolute inset-0 origin-right" style={{ background: "var(--veil)" }} />
                <div ref={head} className="absolute inset-0"><div className="h-full w-[1.5px] bg-accent" /></div>
              </div>
            )}
          </div>
        </Bezel>
      </div>
    </section>
  );
}
