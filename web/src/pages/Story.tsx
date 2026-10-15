import { lazy, Suspense, useMemo } from "react";
import { ArrowDown, CheckCircle, Funnel, Scales, CalendarX, ChartLineUp, ShieldCheck, Coins, FileText, MapPin, Clock, Ruler } from "@phosphor-icons/react";
import { Nav } from "../components/Nav";
import { GapBars } from "../components/GapBars";
import { LineChart } from "../components/LineChart";
import { Bezel, Chip, CountUp, Pill, PillLink, Reveal } from "../components/ui";
import { G, R, SNAP_DAY, headlineRange, spotPerGram } from "../lib/data";
import { bps, dt, rupees, SERIES } from "../lib/format";

// GSAP (about 45 kB gzip) is only needed by this below-the-fold section, so it loads on demand.
const ReplayScrub = lazy(() => import("../components/ReplayScrub"));

export default function Story() {
  const { lo, hi } = headlineRange();
  const curve = useMemo(() => G.CONTRACTS.map((c: string) => ({
    label: c, color: SERIES[c],
    pts: R.rows.filter((r: any) => r.symbol === c && !r.thin).sort((a: any, b: any) => a.e - b.e).map((r: any) => ({ x: r.e, y: r.pg })),
  })), []);
  const spot = spotPerGram();
  const front = R.sameExpiry[0];

  return (
    <div className="glow relative overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-full focus:bg-panel focus:px-4 focus:py-2">Skip to content</a>
      <Nav />
      <main id="main" className="relative z-10">
        {/* Hero: the real finding */}
        <section className="mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-12 px-4 pb-16 pt-32 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pt-24">
          <div>
            <Reveal><Chip live>Real MCX Bhavcopy, {dt(SNAP_DAY)}</Chip></Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] md:text-6xl">
                GOLDTEN trades <span className="text-accent-text">{lo} to {hi} bps</span> below GUINEA and PETAL.
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-text-2">Same expiry, same purity, same spot price. The gap lives in the futures, and it is about 5× round-trip costs.</p>
            </Reveal>
            <Reveal delay={0.24} className="mt-9 flex flex-wrap gap-3">
              <PillLink href="/lab">Open the Lab</PillLink>
              <PillLink href="#method" variant="ghost" icon={<ArrowDown size={16} />}>How we test it</PillLink>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <Bezel core="p-6 md:p-8">
              <div className="mb-7 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-medium">Front month, same expiry</h2>
                <span className="num text-xs text-text-2">{front && `${G.fmtExp(front.e).slice(0, 5)} expiry`}</span>
              </div>
              <GapBars />
              <p className="mt-6 border-t border-ring pt-4 text-xs text-text-2">Seen on 2 days, liquidity checked on 1. 13 Oct comes from the previous close, which has prices but no volume.</p>
            </Bezel>
          </Reveal>
        </section>

        {/* Finding: curve + spot */}
        <section id="finding" aria-labelledby="finding-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 md:px-8 md:py-32">
          <Reveal>
            <h2 id="finding-title" className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Two curves where there should be one.</h2>
            <p className="mt-5 max-w-[60ch] text-text-2 leading-relaxed">Every contract normalized to rupees per gram of 999 gold. GUINEA and PETAL sit together, GOLDTEN and GOLDM sit together, about half a percent apart.</p>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-12">
            <Reveal className="lg:col-span-8 lg:row-span-2">
              <Bezel core="p-5 md:p-7" className="h-full">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">Futures curve, ₹ per gram (999)</h3>
                  <span className="text-xs text-text-2">by expiry, liquid contracts</span>
                </div>
                <LineChart aria="Futures curves by expiry for four gold contracts. GUINEA and PETAL sit about half a percent above GOLDTEN and GOLDM."
                  series={curve} height={340} endLabels hoverAll xLabel={(x) => `Expiry ${G.fmtExp(x)}`}
                  yFmt={(v, tip) => (tip ? rupees(v, 2) : rupees(v))} />
              </Bezel>
            </Reveal>
            <Reveal className="lg:col-span-4" delay={0.08}>
              <Bezel core="p-6" className="h-full">
                <h3 className="flex items-center gap-2 font-medium"><Coins size={18} className="text-accent-text" aria-hidden="true" />Spot agrees</h3>
                <ul className="mt-5 grid gap-3">
                  {spot.map((s: any) => (
                    <li key={s.symbol} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-text-2"><i className="size-2 rounded-full" style={{ background: SERIES[s.symbol] }} />{s.symbol}</span>
                      <span className="num">{rupees(s.perGram, 1)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs leading-relaxed text-text-2">MCX spot per gram, 999 basis. TEN and GUINEA are identical, so the gap is in how the futures are priced. Spot file is dated 15 Oct.</p>
              </Bezel>
            </Reveal>
            <Reveal className="lg:col-span-4" delay={0.14}>
              <div className="relative h-full overflow-hidden rounded-[2rem] p-[6px] ring-1 ring-ring" style={{ background: "linear-gradient(140deg, var(--accent-soft), transparent 60%)" }}>
                <div className="flex h-full flex-col justify-between rounded-[calc(2rem-6px)] p-6">
                  <h3 className="font-medium">GOLDM agrees with GOLDTEN</h3>
                  <div>
                    <CountUp value={R.goldm[0].gap} format={(v) => bps(v)} className="num block text-4xl font-medium tracking-tight" />
                    <p className="mt-2 text-xs text-text-2">Near month, after scaling 995 to 999 and adjusting for its earlier expiry with the curve's own carry.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Method */}
        <section id="method" aria-labelledby="method-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 md:px-8 md:py-32">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
            <Reveal className="lg:sticky lg:top-32 lg:self-start">
              <h2 id="method-title" className="text-3xl font-semibold tracking-tight md:text-5xl">How we test it without fooling ourselves.</h2>
              <p className="mt-5 max-w-[46ch] text-text-2 leading-relaxed">Six rules, each one removing a way a backtest can look better than reality.</p>
              <div className="mt-8"><PillLink href="/lab">See it run in the Lab</PillLink></div>
            </Reveal>
            <ol className="grid gap-4">
              {[
                [FileText, "Trust no file blindly", "MCX answers a holiday with an older day. Every file's date must match the request, or it is rejected."],
                [Scales, "One unit for everything", "Close ÷ quote grams × 999 ÷ purity. GOLDM is 995 fine and quoted per 10 g; PETAL per 1 g."],
                [Ruler, "Same expiry on both legs", "Contracts are tracked by expiry date, never as a near-month series, so rolls cannot fake a jump."],
                [Funnel, "The level, then the cost gate", "Primary signal: today's gap against its expected level for that days-to-expiry, fitted on training data. Trade only if the difference beats round-trip costs."],
                [CalendarX, "Out before delivery", "Exit at least one trading day before the 3-day tender window. Delivery on MCX gold is compulsory."],
                [ShieldCheck, "One test, fixed in advance", `GUINEA vs TEN, level signal, one 9-setting grid. Every other result is exploratory; ${G.CONFIGS_TRIED} configurations tried in total.`],
              ].map(([Icon, t, d]: any, i) => (
                <li key={t}><Reveal delay={i * 0.05}>
                  <Bezel tight core="flex gap-5 p-5 md:p-6">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon size={20} aria-hidden="true" /></span>
                    <div><h3 className="font-medium">{t}</h3><p className="mt-1.5 text-sm leading-relaxed text-text-2">{d}</p></div>
                  </Bezel>
                </Reveal></li>
              ))}
            </ol>
          </div>
        </section>

        <Suspense fallback={<div className="min-h-[100dvh]" aria-hidden="true" />}><ReplayScrub /></Suspense>

        {/* Evidence */}
        <section id="evidence" aria-labelledby="evidence-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 md:px-8 md:py-32">
          <Reveal>
            <h2 id="evidence-title" className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Before we call it an edge.</h2>
            <p className="mt-5 max-w-[60ch] text-text-2 leading-relaxed">A gap this stable is more often a contract difference than free money. These are tested first, in this order.</p>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Reveal>
              <Bezel core="p-2 md:p-3">
                <ul className="divide-y divide-ring">
                  {[
                    [Coins, "What each contract delivers", "GUINEA delivers in 8 g units, PETAL in 1 g. Small units can carry a making charge.", "Test first", "warn"],
                    [FileText, "How final settlement is defined", "Read each spec's settlement clause; compare each contract's last close with its settlement price.", "Test first", "warn"],
                    [Clock, "Does it converge before we must exit?", "Gap at entry, at the last allowed exit, and at expiry, for every past expiry.", "Needs history", "neutral"],
                    [MapPin, "Location", "PETAL is priced ex-Mumbai, the others ex-Ahmedabad. GUINEA and PETAL still agree within 10 bps.", "Unlikely", "neutral"],
                  ].map(([Icon, t, d, s, tone]: any) => (
                    <li key={t} className="flex gap-4 p-4 md:p-5">
                      <Icon size={20} className="mt-0.5 shrink-0 text-text-2" aria-hidden="true" />
                      <div className="flex-1"><h3 className="font-medium">{t}</h3><p className="mt-1 text-sm leading-relaxed text-text-2">{d}</p></div>
                      <span className="shrink-0"><Pill tone={tone}>{s}</Pill></span>
                    </li>
                  ))}
                </ul>
              </Bezel>
            </Reveal>
            <Reveal delay={0.1}>
              <Bezel core="flex h-full flex-col gap-6 p-6 md:p-8">
                <h3 className="flex items-center gap-2 font-medium"><CheckCircle size={18} className="text-accent-text" aria-hidden="true" />Pass rule, set before testing</h3>
                <p className="text-2xl font-medium leading-snug tracking-tight">Net Sharpe above zero on every hold-out fold at twice the costs, and the gap must shrink before the last allowed exit.</p>
                <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-ring pt-5 text-sm">
                  <div><dt className="text-text-2">Primary pair</dt><dd className="mt-1 font-medium">GUINEA vs TEN</dd></div>
                  <div><dt className="text-text-2">Round-trip cost</dt><dd className="num mt-1">{R.alerts[0].rt.toFixed(1)} bps</dd></div>
                  <div><dt className="text-text-2">History needed</dt><dd className="num mt-1">from 1 Apr 2025</dd></div>
                  <div><dt className="text-text-2">If it fails</dt><dd className="mt-1">We say so</dd></div>
                </dl>
              </Bezel>
            </Reveal>
          </div>
        </section>

        {/* Action */}
        <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8 md:pb-32">
          <Reveal>
            <Bezel core="flex flex-col items-start gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-14">
              <div>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">Every number on this page is recomputed in the Lab, from the same file.</h2>
                <p className="mt-4 flex items-center gap-2 text-sm text-text-2"><ChartLineUp size={16} aria-hidden="true" />Five steps: ingest, normalize, signal, backtest, calendar.</p>
              </div>
              <PillLink href="/lab">Open the Lab</PillLink>
            </Bezel>
          </Reveal>
        </section>
      </main>
      <footer className="relative z-10 border-t border-ring">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-text-2 md:flex-row md:items-center md:justify-between md:px-8">
          <p>Team Blaze, HackInHills 2026, Track 3: Commodity Derivatives Intelligence.</p>
          <p>Data: <a className="underline decoration-ring-strong underline-offset-4 hover:text-text" href="https://www.mcxindia.com/market-data/bhavcopy" rel="noopener noreferrer" target="_blank">MCX Bhavcopy</a>. Not investment advice.</p>
        </div>
      </footer>
    </div>
  );
}
