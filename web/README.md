# Gold Spread Lab (web)

Team Blaze, HackInHills 2026, Track 3: Commodity Derivatives Intelligence.

MCX lists gold futures in four lot sizes. Normalized to one price per gram (999), GOLDTEN trades about 50 bps below
GUINEA and PETAL at the same expiry, while their spot prices match. This app shows the finding on real MCX Bhavcopy
data and the method (validation, normalization, a cost-gated level signal, walk-forward testing) used to decide
whether that gap is a tradable edge.

- `/`: the story (finding, method, scroll-driven replay, evidence).
- `/lab`: the Lab (Ingest, Normalize, Signal, Backtest, Calendar). `?step=` deep-links a step.

**Data honesty.** Headline numbers come from the real Bhavcopy (`../data/gold_futures.csv`). The walk-forward runs on
seeded synthetic history until stacked daily files are loaded; every synthetic panel is labelled.

## Run

```bash
npm ci
npm run build      # regenerates src/lib/real-data.json from ../data, type-checks, builds dist/
npm run preview    # http://127.0.0.1:5318 with the production security headers
```

To use more history, stack daily Bhavcopy CSVs with `python ../data/filter_gold.py --bhav "../data/raw/*.csv" --out ../data`
and rebuild.

## Deploy (Cloudflare Pages)

```bash
npx wrangler pages project create gold-spread-lab --production-branch main
npx wrangler pages deploy dist --project-name gold-spread-lab --branch main
```

`public/_headers` sets a strict CSP (no inline script or style), `nosniff`, `frame-ancestors 'none'` and immutable
caching for hashed assets. Pages serves `index.html` for unknown paths, so `/lab` deep links work.

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Motion (UI motion), GSAP ScrollTrigger (the pinned replay only, loaded
on demand), Phosphor icons, Geist and JetBrains Mono (self-hosted). The analysis engine is `src/lib/engine.js`.
