# Bullion Basis

**Live:** https://gold-spread-lab.pages.dev

Team Blaze, HackInHills 2026, Track 3: Commodity Derivatives Intelligence.

MCX lists gold futures in four lot sizes: GOLDM (100 g), GOLDTEN (10 g), GOLDGUINEA (8 g) and GOLDPETAL (1 g). We
normalize every contract to one price, rupees per gram of 999 gold, and ask whether the gaps that remain are a tradable
edge after costs or just contract differences.

## What the real data shows

From the MCX Bhavcopy of 14 Oct 2026, comparing contracts with the same expiry:

| | Result |
|---|---|
| GUINEA vs GOLDTEN | **+63 bps** in the front month; curve-fit level **+55.7 ± 5.0 bps** |
| PETAL vs GOLDTEN | **+58 bps**; curve-fit level **+49.1 ± 4.6 bps** |
| Spot, per gram (15 Oct) | TEN and GUINEA identical; PETAL −4.5 bps (Mumbai) |
| At the 30 Sep 2026 expiry (DDR) | GUINEA vs TEN **0.0 bps**, PETAL −1.1 bps (secondary source, verify) |
| Shared carry (curve fit) | 10.9% a year on all four contracts |
| Round-trip cost, gram-matched pair | about 10-11 bps |

The gap is a futures pricing gap: spot prices match, all curves share one carry rate, and the gap closes by expiry.
Whether it closes **before** a trader must exit (one trading day before the 3-day tender window) needs history, which
is the next step. We have one day of real data, so we make no claim of an edge yet.

## Method

1. **Ingest and validate.** Reject files whose date doesn't match the request (MCX serves an older day for a
   holiday), trim symbols, drop duplicates, and flag thin rows (under 5 kg traded).
2. **Normalize.** Close ÷ quote grams × 999 ÷ purity. Track contracts by expiry, never as a near-month series.
3. **Signal.** The primary signal is the **level signal**: the gap against its expected level for that
   days-to-expiry, fitted on training data, gated by round-trip costs. The z-score signal is exploratory.
4. **Walk-forward backtest.** Decide at t's close and trade at t+1. Expanding training window, 3-month test folds and
   a frozen hold-out. Costs at 1×, 2× and 3×, compared against no-cost-filter and random-entry baselines. P&L is
   reported net of gold exposure.
5. **Contract calendar.** Exit before the tender window; never hold into compulsory delivery.

**Pre-registered primary test:** GUINEA vs TEN, level signal, one 9-setting grid. An edge is claimed only if net
Sharpe > 0 on every hold-out fold at 2× costs **and** the gap closes before the last allowed exit. 72 configurations
are tried in total; everything outside the primary test is reported as exploratory.

## Repository

| Path | Contents |
|---|---|
| `web/` | The app: story page and five-step Lab (React 19, TypeScript, Vite 8, Tailwind 4, Motion, GSAP). See `web/README.md`. |
| `web/src/lib/engine.js` | Analysis engine: validation, normalization, spreads, signals, walk-forward, attribution |
| `data/filter_gold.py` | Filters MCX Bhavcopy CSVs to the four gold contracts and normalizes them |
| `data/*.csv` | Filtered 14 Oct 2026 Bhavcopy, MCX spot, same-expiry spreads, known DDRs, data sources |
| `docs/` | Implementation plan (with the plan-review fixes) and the design system |

The Lab's walk-forward runs on seeded **synthetic** history until daily Bhavcopy files from 1 Apr 2025 are stacked;
every synthetic panel is labelled.

## Run locally

```bash
cd web
npm ci
npm run build
npm run preview
```

Add history: put daily Bhavcopy CSVs in `data/raw/`, then run
`python data/filter_gold.py --bhav "data/raw/*.csv" --out data` and rebuild.

## Sources

MCX gold contract specifications (Jul/Aug 2026 onwards), MCX Bhavcopy and spot prices (mcxindia.com), MCX circular
MCX/TRD/134/2025 (GOLDTEN launch), MCX circular MCX/F&A/631/2024 (transaction fees), Finance Act 2013 s.117 (CTT),
SEBI stamp-duty FAQ (2020). Full list: `data/data_sources.csv`. This is a research prototype, not investment advice.

## Licence

MIT. See `LICENSE`.
