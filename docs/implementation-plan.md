# Bullion Basis: implementation plan (v2, after plan review)

**One-line pitch:** We put all four MCX gold contracts on one ₹/g (999) basis. On real data, GOLDTEN trades ~50 bps
below GUINEA and PETAL at every expiry, while their **spot** prices match. Our pipeline tests whether that futures gap
is a tradable edge after costs, or a contract difference, and it stays quiet until it knows.

**Primary test, fixed before any hold-out run** (review items 2, 5, 7):
- Pair: **GUINEA vs TEN** (both 999 purity, both month-end expiry, most liquid same-expiry pair).
- Signal: the **level signal** (below). The z-score signal is secondary and exploratory.
- Grid: one 3×3 grid, chosen on training data only.
- Pass rule: net Sharpe > 0 on every hold-out fold at 2× costs, **and** the gap shrinks by more than round-trip costs
  before the last allowed exit date. Everything else is reported as exploratory, with the total number of
  configurations tried.

If it fails, we say so. The problem statement counts that as a valid result.

---

## What the real data already shows

Bhavcopy 14 Oct 2026, same expiry, ₹/g (999). 13 Oct is rebuilt from `prev_close`, so it has **prices only, no
volume**. Wherever the 13 Oct numbers appear, we write "seen on 2 days, liquidity checked on 1" (review item 8).

| | Gap | Note |
|---|---|---|
| GUINEA vs TEN | +46 to +66 bps | every expiry, both days |
| PETAL vs TEN | +44 to +58 bps | every expiry, both days |
| GUINEA vs PETAL | within about ±13 bps | these two agree |
| GOLDM vs TEN, carry-adjusted | −3.5 bps (near month) | these two agree |
| Round-trip cost, gram-matched pair | ~10-11 bps liquid, 23-35 bps thin | |

**Spot says the gap is in the futures, not the metal** (review item 3). In the MCX spot file, GOLDTEN and GUINEA both
work out to ₹14,609.6 per gram (999), and PETAL (Mumbai) to ₹14,603. The spot file is from 15 Oct while the futures are
from 14 Oct, so the levels aren't compared directly. But the spot basis is the same for TEN and GUINEA, so the ~50 bps
lives in how the futures are priced.

---

## Plan, in order (review item 10)

Order: **1 history → 2 explain the gap → 6 deck → 3-4 signal and backtest → 5 dashboard**. Checkpoint: if the history
isn't loaded by the agreed time, switch to manual CSV download straight away. A finished step 2 is a presentable
result on its own.

### 1. Build the history (about 3 h)

We need daily rows from **1 Apr 2025** (GOLDTEN listing, MCX circular MCX/TRD/134/2025, 18 Mar 2025) to today.

- **Check the terms first** (review item 4). Plain requests get HTTP 403, which signals automated access isn't
  welcome. Read the MCX website terms of use before writing any download script.
- **Default: manual download.** Download the date-wise Bhavcopy CSVs by hand and split the date range between
  teammates. Save them to `data/raw/` and stack them with `python data/filter_gold.py --bhav "data/raw/*.csv"`.
- Record the source and download dates on the limitations slide.
- Download the real **13 Oct** file too, so that day gets its volume.
- Validation is already in `filter_gold.py`: it skips a file whose `Date` doesn't match its file name (MCX serves an
  older day for a holiday), trims `Symbol`, drops duplicates and non-gold rows, and flags thin rows (< 5 kg traded).

### 2. Explain the 50 bps gap (about 2 h; this is the strongest slide)

Test the most likely causes first:

| # | Hypothesis | Test | If true |
|---|---|---|---|
| a | **What each contract delivers.** Coins or small bars may carry a making charge | Read the delivery section of each MCX spec PDF (GUINEA: 8 g coin, PETAL: 1 g, TEN: 10 g) | The gap is a delivery premium: real, but not mispricing |
| b | **How final settlement is defined** | Read each spec's final settlement (DDR) clause. Compare each contract's last close with its final settlement price on past expiries | If the DDRs differ, the gap is structural |
| c | **Convergence at expiry** | For every past expiry, record the gap on three days: entry, the **last allowed exit** (one trading day before the tender window), and expiry | Edge only if it shrinks by more than costs **before** the last allowed exit |
| d | Quote basis or purity misread | Re-read the quote basis in the spec PDFs | Fix the normalization |
| e | Location (PETAL ex-Mumbai, T+2) | GUINEA vs PETAL already agree within ~10 bps | Not the main driver |

Track **futures minus spot** for each contract every day. If GUINEA/PETAL sit ~50 bps above GOLDTEN while spot
matches, the difference is in how the futures are priced.

If the gap closes only inside the tender window, the result is "**real, but not tradable under our rules**". That is
still a valid result (review item 1).

### 3. Signal

- **Primary, the level signal:** on training data only, estimate the expected gap at each days-to-expiry (a small
  table or a linear fit). Trade when today's gap differs from that expectation by more than round-trip costs.
- **Secondary, the z-score signal** (exploratory): trailing window, using only days before t.
- Decide at t's close and execute at **t+1's close**, on the same expiry.
- Gates: liquidity (both legs ≥ 5 kg traded), the contract calendar (exit by the last allowed exit date, never hold
  into delivery), and gap > costs.

### 4. Walk-forward backtest

- Expanding train window, 3-month test windows, and a frozen final hold-out. **Report the trade count for every fold.**
- P&L uses the prices of the contracts actually held, with gram-matched lots (5 GUINEA = 4 TEN = 40 g).
- **Gold exposure** (review item 7): the primary pair is 999 vs 999, so pure-gold grams match. For any GOLDM pair,
  count the leftover ~0.4% exposure (99.5 g vs 99.9 g of fine gold per 100 g) in beta and net ex-gold.
- Costs per leg per side: MCX fee ₹2.10/lakh, CTT 0.01% on the sell side, stamp duty 0.002%, SEBI ₹10/crore, GST 18%
  on fees, ₹20 brokerage per order, and a 1.5 bps settlement-to-fill haircut (+6 bps on thin days). Stress the costs
  at 1×, 2× and 3×.
- Baselines: the same rule with no cost filter, and random entries with the same trade count.
- Under ~10 trades per fold, write "too few to conclude".

### 5. Dashboard (built: `web/`, deployed to Cloudflare Pages)

The story page and the Lab read the same filtered data. Swapping in the stacked history means regenerating the data
file. The engine is unchanged.

### 6. Deck

- Slide 6: real-data screenshots only. Never put synthetic numbers in the results table.
- New slide: "The 50 bps question", with the gap table, the spot comparison, and the convergence chart from step 2.
- Fix in the deck: GOLDM expires on the 5th (preceding working day if a holiday), and the tender period is the last 3
  trading days.

---

## Sources (review item 9)

| Claim | Source |
|---|---|
| Specs, purity, expiry rule, **tender = staggered delivery over the last 3 trading days**, DDR | MCX contract specification PDFs, Jul/Aug 2026 contracts onwards, linked from https://www.mcxindia.com/products/bullion/gold (GOLDM: `gold-mini-august-2026-contract-onwards…pdf`; GOLDTEN, GUINEA, PETAL: `gold-…-july-2026-contract-onwards.pdf`) |
| GOLDTEN launch 1 Apr 2025 | MCX circular MCX/TRD/134/2025, 18 Mar 2025 |
| **MCX transaction fee ₹2.10 per lakh**, from 1 Oct 2024 | MCX circular MCX/F&A/631/2024 (Sep 2024), mcxindia.com circulars section |
| CTT 0.01% on non-agri commodity futures, seller | Finance Act 2013, s.117 (incometaxindia.gov.in) |
| Stamp duty 0.002% on futures | SEBI FAQ, Jun 2020 (sebi.gov.in) |
| SEBI fee ₹10 per crore | SEBI Board memo, Jul 2020. Confirm the current rate |

Re-download each PDF before the final submission and quote its circular number and date. **If a claim can't be
verified, remove it from the deck.**

## Housekeeping (review item 6)

Keep one shared copy: put `data/filter_gold.py` (the fixed version), `web/` and `deliverables/` in a GitHub repository.
Re-run the script on the 14 Oct file and confirm it still gives 24 rows. Delete the old copies so nobody runs the buggy
version.

## Risks

| Risk | Mitigation |
|---|---|
| Manual history download is slow | Split the dates between teammates, and set a checkpoint time |
| The gap is a delivery or settlement artefact | That is the finding: show it with sources and the convergence chart |
| Too few trades | Report counts and say "inconclusive". The pre-registered primary test prevents overclaiming |
| Settlement ≠ fill | Haircut every fill and stress costs to 3×. Volume is not depth: say so on the limitations slide |
