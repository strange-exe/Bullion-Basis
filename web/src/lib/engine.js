/*
 * Bullion Basis - analysis engine.
 *
 * analyzeReal(): the REAL MCX Bhavcopy snapshot (validation, normalization, same-expiry gaps, costs).
 * build() + walkForward(): the method on SYNTHETIC history until stacked Bhavcopy history is loaded:
 *   ingest + validate -> normalize to Rs/g (999) -> same-expiry spreads ->
 *   level signal (primary) or z-score (exploratory), cost-gated -> walk-forward -> attribution.
 * Numbers from build() are illustrative and are always labelled synthetic in the UI.
 */

// ---------- contract specs (config-driven; confirm against MCX spec PDFs) ----------
// quoteGrams: price is quoted per this many grams. purity: fineness of the quote basis.
// tick: Rs per quote unit.
const SPECS = {
  GOLDM:      { lotGrams: 100, quoteGrams: 10, purity: 995, tick: 1, expiry: "d5" },
  GOLDTEN:    { lotGrams: 10,  quoteGrams: 10, purity: 999, tick: 1, expiry: "eom", listFrom: "2025-04-01" },
  GOLDGUINEA: { lotGrams: 8,   quoteGrams: 8,  purity: 999, tick: 1, expiry: "eom" },
  GOLDPETAL:  { lotGrams: 1,   quoteGrams: 1,  purity: 999, tick: 1, expiry: "eom" },
};
const CONTRACTS = Object.keys(SPECS);

// Same-expiry pairs are pure relative value. GOLDM expires ~25 days earlier in the
// cycle (3rd-5th), so its pair is carry-adjusted using the curve's implied rate.
// grams: gram-matched notional per leg (lots must be whole numbers on both legs).
const PAIRS = [
  { id: "TEN-PETAL",    a: "GOLDTEN",    b: "GOLDPETAL", grams: 100 },
  { id: "GUINEA-PETAL", a: "GOLDGUINEA", b: "GOLDPETAL", grams: 40 },
  { id: "TEN-GUINEA",   a: "GOLDTEN",    b: "GOLDGUINEA", grams: 40 },
  { id: "M-TEN",        a: "GOLDM",      b: "GOLDTEN",   grams: 100, carryAdjusted: true },
];

// Cost model, per leg per side, in basis points of turnover unless noted.
// Statutory rates checked against official sources on 2026-10-15; slippage values are assumptions.
const COSTS = {
  exchangeBps: 0.21,      // MCX: Rs 2.10 per lakh turnover (circular 631/2024)
  cttSellBps: 1.0,        // CTT 0.01% on non-agri futures, seller (Finance Act 2013 s.117)
  stampBuyBps: 0.2,       // stamp duty 0.002% on futures, buyer
  sebiBps: 0.01,          // SEBI fee Rs 10 per crore (confirm current rate)
  gstRate: 0.18,          // on brokerage + exchange + SEBI
  brokeragePerOrder: 20,  // Rs flat per executed order
  slipBps: 1.5,           // settlement != fill haircut, liquid day
  thinSlipBps: 6,         // extra haircut on a thin day
};

const TENDER_BIZDAYS = 3;   // MCX spec (Jul/Aug 2026 onwards): staggered delivery over the last 3 trading days
const THIN_LOTS = { GOLDM: 1500, GOLDTEN: 400, GOLDGUINEA: 250, GOLDPETAL: 4000 };

// ---------- helpers ----------
const DAY = 86400000;
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const fromIso = (s) => Math.round(Date.parse(s + "T00:00:00Z") / DAY);
const dow = (d) => new Date(d * DAY).getUTCDay();
const isWeekday = (d) => dow(d) !== 0 && dow(d) !== 6;
const pad2 = (n) => String(n).padStart(2, "0");
function ymd(d) { const x = new Date(d * DAY); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; }
const fmtReq = (d) => { const [y, m, dd] = ymd(d); return `${pad2(dd)}/${pad2(m + 1)}/${y}`; };      // DD/MM/YYYY
const fmtResp = (d) => { const [y, m, dd] = ymd(d); return `${pad2(m + 1)}/${pad2(dd)}/${y}`; };     // MM/DD/YYYY
const fmtExp = (d) => { const [y, m, dd] = ymd(d); return `${pad2(dd)}${MON[m]}${y}`; };             // 04SEP2026
function parseResp(s) { const [m, d, y] = s.split("/").map(Number); return fromIso(`${y}-${pad2(m)}-${pad2(d)}`); }
function parseExp(s) { const t = s.trim(); return fromIso(`${t.slice(5, 9)}-${pad2(MON.indexOf(t.slice(2, 5)) + 1)}-${t.slice(0, 2)}`); }

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function sd(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; }
function quantile(a, q) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
function corr(x, y) {
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

// ---------- synthetic market ----------
const START = fromIso("2025-01-01"), END = fromIso("2026-09-30");
const HOLIDAYS = ["2025-02-26", "2025-03-14", "2025-04-18", "2025-08-15", "2025-10-02", "2025-10-21",
  "2025-11-05", "2025-12-25", "2026-01-26", "2026-03-04", "2026-04-03", "2026-08-28"].map(fromIso);
const EMPTY_DAYS = [fromIso("2025-09-09")];       // exchange returned no rows
const DUP = { day: fromIso("2025-06-12"), c: "GOLDPETAL" };
const OUTLIER = { day: fromIso("2025-11-18"), c: "GOLDGUINEA", factor: 1.009 };

function tradingDays() {
  const out = [];
  for (let d = START; d <= END; d++) if (isWeekday(d) && !HOLIDAYS.includes(d)) out.push(d);
  return out;
}
function prevBiz(d, set) { while (!set.has(d)) d--; return d; }
function expiries(days) {
  const set = new Set(days), eom = [], d5 = [];
  for (let y = 2025; y <= 2027; y++) for (let m = 0; m < 12; m++) {
    const last = fromIso(`${y}-${pad2(m + 1)}-01`) + new Date(Date.UTC(y, m + 1, 0)).getUTCDate() - 1;
    const fifth = fromIso(`${y}-${pad2(m + 1)}-05`);
    // Beyond the generated range, fall back to weekday adjustment only.
    eom.push(last <= END ? prevBiz(last, set) : (() => { let x = last; while (!isWeekday(x)) x--; return x; })());
    d5.push(fifth <= END ? prevBiz(fifth, set) : (() => { let x = fifth; while (!isWeekday(x)) x--; return x; })());
  }
  return { eom, d5 };
}

function generate(seed = 7) {
  const r = rng(seed);
  const days = tradingDays();
  const exp = expiries(days);
  const carry = 0.065;                       // annual cost of carry built into futures
  const theta = { GOLDM: 0.22, GOLDTEN: 0.2, GOLDGUINEA: 0.18, GOLDPETAL: 0.22 };
  const mu = { GOLDM: 0, GOLDTEN: 1.5, GOLDGUINEA: -4, GOLDPETAL: 5 };
  const sig = { GOLDM: 2.2, GOLDTEN: 4.2, GOLDGUINEA: 5.2, GOLDPETAL: 4.0 };
  const baseVol = { GOLDM: 9000, GOLDTEN: 2600, GOLDGUINEA: 900, GOLDPETAL: 26000 };
  const dev = { GOLDM: 0, GOLDTEN: 1.5, GOLDGUINEA: -4, GOLDPETAL: 5 };
  let spot = 8350;                             // Rs per gram, 999 basis (synthetic level)
  const spotByDay = new Map();
  const rows = new Map();                      // day -> raw bhavcopy rows

  for (const d of days) {
    spot *= Math.exp(0.24 / 252 + 0.13 / Math.sqrt(252) * gauss(r));
    spotByDay.set(d, spot);
    for (const c of CONTRACTS) dev[c] += theta[c] * (mu[c] - dev[c]) + sig[c] * gauss(r);
    const out = [];
    for (const c of CONTRACTS) {
      const s = SPECS[c];
      if (s.listFrom && d < fromIso(s.listFrom)) continue;
      const list = s.expiry === "d5" ? exp.d5 : exp.eom;
      const live = list.filter((e) => e >= d && e - d <= 100);
      live.forEach((e, idx) => {
        const tau = (e - d) / 365;
        const bizToExp = days.filter((x) => x > d && x <= e).length;
        let share = idx === 0 ? 0.78 : idx === 1 ? 0.2 : 0.02;
        if (idx === 0 && bizToExp < TENDER_BIZDAYS) share = 0.12;
        if (idx === 1 && live.length && days.filter((x) => x > d && x <= live[0]).length < TENDER_BIZDAYS) share = 0.8;
        let ramp = 1;
        if (s.listFrom) ramp = Math.min(1, 0.15 + (d - fromIso(s.listFrom)) / 240);
        const vol = Math.max(0, Math.round(baseVol[c] * ramp * share * Math.exp(0.45 * gauss(r))));
        const thin = vol < THIN_LOTS[c];
        const noise = gauss(r) * (thin ? 7 : 0.8) + (idx > 0 ? gauss(r) * 1.5 : 0);
        const pg999 = spot * Math.exp(carry * tau) * (1 + (dev[c] + noise) / 1e4);
        let settle = Math.round(pg999 * s.quoteGrams * (s.purity / 999) / s.tick) * s.tick;
        if (d === OUTLIER.day && c === OUTLIER.c && idx === 0) settle = Math.round(settle * OUTLIER.factor);
        const o = Math.round(settle * (1 + gauss(r) * 0.003));
        const hi = Math.max(o, settle) + Math.round(Math.abs(gauss(r)) * settle * 0.002);
        const lo = Math.min(o, settle) - Math.round(Math.abs(gauss(r)) * settle * 0.002);
        out.push({
          Symbol: c.padEnd(12, " "), Date: fmtResp(d), ExpiryDate: fmtExp(e),
          Open: o, High: hi, Low: lo, Close: settle, Volume: vol,
          OpenInterest: Math.round(vol * (1.5 + r() * 2)),
        });
      });
    }
    rows.set(d, out);
  }
  return { days, exp, rows, spotByDay };
}

// ---------- ingestion + validation (mirrors what MCX actually returns) ----------
function ingest(market) {
  const log = [];                 // one entry per requested weekday
  const panel = new Map();        // day -> Map(key "C|exp") -> rec
  const dayset = new Set(market.days);
  const quarantined = [];
  for (let d = START; d <= END; d++) {
    if (!isWeekday(d)) continue;
    const requested = fmtReq(d);
    // MCX returns the most recent trading day for a holiday request: emulate that.
    const servedDay = dayset.has(d) ? d : prevBiz(d - 1, dayset);
    let raw = EMPTY_DAYS.includes(d) ? [] : (market.rows.get(servedDay) || []).map((x) => ({ ...x }));
    if (d === DUP.day) raw.push({ ...raw.find((x) => x.Symbol.trim() === DUP.c) });
    if (!raw.length) { log.push({ day: d, requested, status: "empty", note: "No rows returned" }); continue; }
    const returned = parseResp(raw[0].Date);
    if (returned !== d) {
      log.push({ day: d, requested, status: "rejected", note: `Asked ${requested}, got ${raw[0].Date} (MM/DD). Holiday: rejected` });
      continue;
    }
    const recs = new Map(); let dups = 0;
    for (const x of raw) {
      const c = x.Symbol.trim();
      if (!SPECS[c]) continue;
      const e = parseExp(x.ExpiryDate);
      const key = `${c}|${e}`;
      if (recs.has(key)) { dups++; continue; }
      const s = SPECS[c];
      recs.set(key, {
        c, e, settle: x.Close, vol: x.Volume, oi: x.OpenInterest,
        pq: x.Close / s.quoteGrams,                       // Rs per gram as quoted (contract's own purity)
        pg: (x.Close / s.quoteGrams) * (999 / s.purity),  // Rs per gram, 999 basis
        thin: x.Volume < THIN_LOTS[c],
      });
    }
    // Cross-sectional outlier check: same expiry month, compare against the other contracts.
    let outliers = 0;
    const byExp = new Map();
    for (const v of recs.values()) if (SPECS[v.c].expiry === "eom") (byExp.get(v.e) || byExp.set(v.e, []).get(v.e)).push(v);
    for (const grp of byExp.values()) {
      if (grp.length < 3) continue;
      for (const v of grp) {
        const peers = grp.filter((g) => g !== v).map((g) => g.pg);
        const devBps = 1e4 * Math.log(v.pg / median(peers));
        if (Math.abs(devBps) > 50) {
          v.quarantined = true; outliers++;
          quarantined.push({ day: d, c: v.c, e: v.e, devBps });
        }
      }
    }
    for (const [k, v] of recs) if (v.quarantined) recs.delete(k);
    panel.set(d, recs);
    const notes = [];
    if (dups) notes.push(`${dups} duplicate row dropped`);
    if (outliers) notes.push(`${outliers} price quarantined (>${50} bps from peers)`);
    log.push({ day: d, requested, status: notes.length ? "flagged" : "ok", note: notes.join("; ") || "Validated" });
  }
  return { log, panel, quarantined };
}

// ---------- spreads ----------
function bizBetween(days, a, b) { let n = 0; for (const x of days) if (x > a && x <= b) n++; return n; }

function spreadSeries(ctx, pair) {
  const { days, panel, exp } = ctx;
  const out = [];
  for (const d of days) {
    const recs = panel.get(d);
    if (!recs) continue;
    // Trade the front month-end expiry until it enters the tender window, then the next one.
    const E = exp.eom.find((e) => e >= d && bizBetween(days, d, e) >= TENDER_BIZDAYS + 1);
    if (E === undefined) continue;
    let A, B = recs.get(`${pair.b}|${E}`), adj = 0;
    if (pair.carryAdjusted) {
      // GOLDM expiring on the 5th just after E; carry from GOLDM's own curve (near vs next).
      const em = exp.d5.find((x) => x > E);
      A = recs.get(`GOLDM|${em}`);
      const em2 = exp.d5.find((x) => x > em);
      const A2 = recs.get(`GOLDM|${em2}`);
      if (!A || !A2 || !B) continue;
      const rate = Math.log(A2.pg / A.pg) / ((em2 - em) / 365);
      adj = 1e4 * rate * ((em - E) / 365);
      out.push({ d, E, s: 1e4 * Math.log(A.pg / B.pg) - adj, raw: 1e4 * Math.log(A.pg / B.pg), A, B, rate });
      continue;
    }
    A = recs.get(`${pair.a}|${E}`);
    if (!A || !B) continue;
    out.push({ d, E, s: 1e4 * Math.log(A.pg / B.pg), A, B });
  }
  return out;
}

// ---------- costs ----------
function legCostRs(price, grams, side, lots, thin, mult) {
  const turnover = price * grams;
  const c = COSTS;
  const exch = turnover * c.exchangeBps / 1e4, sebi = turnover * c.sebiBps / 1e4;
  const brokerage = c.brokeragePerOrder;
  const tax = side === "sell" ? turnover * c.cttSellBps / 1e4 : turnover * c.stampBuyBps / 1e4;
  const gst = c.gstRate * (exch + sebi + brokerage);
  const slip = turnover * (c.slipBps + (thin ? c.thinSlipBps : 0)) / 1e4;
  return mult * (exch + sebi + brokerage + tax + gst + slip);
}
// Round-trip cost of the pair in bps of one leg's notional (used by the signal's cost gate).
function roundTripBps(pt, pair, mult) {
  const g = pair.grams;
  const rs = legCostRs(pt.A.pq, g, "buy", 0, pt.A.thin, mult) + legCostRs(pt.A.pq, g, "sell", 0, pt.A.thin, mult)
    + legCostRs(pt.B.pq, g, "buy", 0, pt.B.thin, mult) + legCostRs(pt.B.pq, g, "sell", 0, pt.B.thin, mult);
  return 1e4 * rs / (pt.B.pq * g);
}

// ---------- strategy (day-by-day replay, decide at t settle, execute at t+1 settle) ----------
const DEFAULT_PARAMS = { W: 40, k: 2.0, costMult: 1, costGate: true, maxHold: 6, exitZ: 0.3 };

function runStrategy(ctx, pair, series, params, from, to, randomPlan) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const trades = [], daily = [];
  let pos = null;
  const idxFrom = series.findIndex((x) => x.d >= from);
  if (idxFrom < 0) return { trades, daily, signals: [] };
  const signals = [];
  const level = p.signal === "level";
  for (let i = Math.max(idxFrom, level ? 0 : p.W); i < series.length - 1; i++) {
    const pt = series[i], nx = series[i + 1];
    if (pt.d > to) break;
    let m, sdv;
    if (level) {
      // expected gap at this days-to-expiry, estimated on TRAINING data only (see levelModel)
      m = p.levelModel(pt.E - pt.d); sdv = p.levelSd || 1;
    } else {
      const hist = series.slice(i - p.W, i).map((x) => x.s);   // strictly before t
      m = mean(hist); sdv = sd(hist) || 1;
    }
    const z = (pt.s - m) / sdv;
    const rtBps = roundTripBps(pt, p.pair || pair, p.costMult);
    const bizToTender = bizBetween(ctx.days, pt.d, pt.E) - TENDER_BIZDAYS;
    const liquid = !pt.A.thin && !pt.B.thin;
    signals.push({ d: pt.d, s: pt.s, m, sdv, z, rtBps, liquid });

    // mark to market the open position with the prices of the contracts actually held
    if (pos) {
      const a = ctx.panel.get(pt.d)?.get(pos.keyA), b = ctx.panel.get(pt.d)?.get(pos.keyB);
      if (a && b && pos.lastA) {
        const pnl = pos.dir * (-(a.pq - pos.lastA.pq) * pos.gramsA + (b.pq - pos.lastB.pq) * pos.gramsB);
        daily.push({ d: pt.d, pnl, cost: 0 });
        pos.gross += pnl; pos.lastA = a; pos.lastB = b;
      }
      pos.held++;
      const exitNow = Math.abs(z) < p.exitZ || pos.held >= pos.maxHold || bizToTender <= 1 || nx.E !== pos.E || pt.d >= to;
      if (exitNow) {
        // exit at next settlement of the SAME contracts
        const a2 = ctx.panel.get(nx.d)?.get(pos.keyA) || pos.lastA, b2 = ctx.panel.get(nx.d)?.get(pos.keyB) || pos.lastB;
        const pnl = pos.dir * (-(a2.pq - pos.lastA.pq) * pos.gramsA + (b2.pq - pos.lastB.pq) * pos.gramsB);
        const cost = legCostRs(a2.pq, pos.gramsA, pos.dir > 0 ? "buy" : "sell", 0, a2.thin, p.costMult)
          + legCostRs(b2.pq, pos.gramsB, pos.dir > 0 ? "sell" : "buy", 0, b2.thin, p.costMult);
        daily.push({ d: nx.d, pnl, cost });
        pos.gross += pnl; pos.cost += cost;
        trades.push({ ...pos, exitDecision: pt.d, exitDay: nx.d, exitS: nx.s, net: pos.gross - pos.cost });
        pos = null;
        i++;                       // the exit day is consumed
        continue;
      }
      continue;
    }

    // entry
    let want = false, dir = 0, hold = p.maxHold;
    if (randomPlan) {
      const plan = randomPlan.get(pt.d);
      if (plan && liquid && bizToTender > plan.hold + 1 && nx.E === pt.E) { want = true; dir = plan.dir; hold = plan.hold; }
    } else if ((level ? Math.abs(pt.s - m) > rtBps * p.k : Math.abs(z) > p.k) && liquid && bizToTender > p.maxHold + 1 && nx.E === pt.E && pt.d < to) {
      const edge = Math.abs(pt.s - m);
      if (!p.costGate || edge > rtBps) { want = true; dir = Math.sign(z); }
    }
    if (!want) continue;
    // dir = +1: spread rich -> short A, long B
    const keyA = `${pt.A.c}|${pt.A.e}`, keyB = `${pt.B.c}|${pt.B.e}`;
    const a = ctx.panel.get(nx.d)?.get(keyA), b = ctx.panel.get(nx.d)?.get(keyB);
    if (!a || !b) continue;
    const g = pair.grams;
    const cost = legCostRs(a.pq, g, dir > 0 ? "sell" : "buy", 0, a.thin, p.costMult)
      + legCostRs(b.pq, g, dir > 0 ? "buy" : "sell", 0, b.thin, p.costMult);
    daily.push({ d: nx.d, pnl: 0, cost });
    pos = {
      entryDecision: pt.d, entryDay: nx.d, entryS: nx.s, z, dir, E: pt.E, keyA, keyB,
      lotsA: g / SPECS[pt.A.c].lotGrams, lotsB: g / SPECS[pt.B.c].lotGrams,
      gramsA: g, gramsB: g, lastA: a, lastB: b, gross: 0, cost, held: 0, maxHold: hold,
      notional: b.pq * g,
    };
    i++;                           // the entry day is consumed
  }
  return { trades, daily, signals };
}

// ---------- metrics + attribution ----------
function metrics(ctx, pair, run, from, to, notional) {
  const inWin = ctx.days.filter((d) => d >= from && d <= to);
  const byDay = new Map(inWin.map((d) => [d, { pnl: 0, cost: 0 }]));
  for (const x of run.daily) if (byDay.has(x.d)) { const o = byDay.get(x.d); o.pnl += x.pnl; o.cost += x.cost; }
  const ret = [], gross = [], gold = [];
  let prevSpot = null;
  for (const d of inWin) {
    const o = byDay.get(d);
    ret.push(1e4 * (o.pnl - o.cost) / notional);
    gross.push(1e4 * o.pnl / notional);
    const sp = ctx.spotByDay.get(d);
    gold.push(prevSpot ? 1e4 * Math.log(sp / prevSpot) : 0);
    prevSpot = sp;
  }
  let eq = 0, peak = 0, mdd = 0;
  const curve = inWin.map((d, i) => { eq += ret[i]; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak); return { d, v: eq }; });
  const s = sd(ret);
  const trades = run.trades.filter((t) => t.entryDay >= from && t.entryDay <= to);
  const beta = (() => { const mg = mean(gold), mr = mean(ret); let c = 0, v = 0; for (let i = 0; i < ret.length; i++) { c += (gold[i] - mg) * (ret[i] - mr); v += (gold[i] - mg) ** 2; } return v ? c / v : 0; })();
  const goldPart = gold.reduce((acc, g) => acc + beta * g, 0);
  const grossSum = gross.reduce((a, b) => a + b, 0);
  const netSum = ret.reduce((a, b) => a + b, 0);
  return {
    net: netSum, gross: grossSum, costs: grossSum - netSum, goldPart, alpha: netSum - goldPart,
    sharpe: s ? (mean(ret) / s) * Math.sqrt(252) : 0,
    mdd, trades: trades.length,
    hit: trades.length ? trades.filter((t) => t.net > 0).length / trades.length : 0,
    corrGold: corr(ret, gold), beta, curve,
  };
}

// ---------- walk-forward ----------
const FOLDS = [
  { name: "Fold 1", trainFrom: "2025-01-01", testFrom: "2026-01-01", testTo: "2026-03-31" },
  { name: "Fold 2", trainFrom: "2025-01-01", testFrom: "2026-04-01", testTo: "2026-06-30" },
  { name: "Hold-out", trainFrom: "2025-01-01", testFrom: "2026-07-01", testTo: "2026-09-30", holdout: true },
].map((f) => ({ ...f, trainFrom: fromIso(f.trainFrom), testFrom: fromIso(f.testFrom), testTo: fromIso(f.testTo) }));
const GRID = [];
for (const W of [20, 40, 60]) for (const k of [1.0, 1.5, 2.0]) GRID.push({ W, k });
// Level signal: bucket width in days-to-expiry x entry threshold as a multiple of round-trip cost.
const LEVEL_GRID = [];
for (const bucket of [5, 10, 15]) for (const k of [1.0, 1.25, 1.5]) LEVEL_GRID.push({ bucket, k });

// Pre-registered before any hold-out run (plan review items 2, 5, 7): one pair, one signal, one grid.
const PRIMARY = { pair: "TEN-GUINEA", signal: "level" };

/** Expected gap by days-to-expiry, from rows dated on or before trainTo only. */
function levelModel(series, trainTo, bucket) {
  const tr = series.filter((x) => x.d <= trainTo);
  const all = mean(tr.map((x) => x.s)), sdAll = sd(tr.map((x) => x.s)) || 1;
  const by = new Map();
  for (const x of tr) { const k = Math.floor((x.E - x.d) / bucket); (by.get(k) || by.set(k, []).get(k)).push(x.s); }
  const tbl = new Map([...by].map(([k, v]) => [k, v.length >= 5 ? mean(v) : all]));
  return {
    f: (dte) => { const k = Math.floor(dte / bucket); return tbl.has(k) ? tbl.get(k) : all; },
    sd: sdAll,
    table: [...tbl].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ dte: k * bucket, gap: v })),
  };
}

/**
 * Plan review item 1: for each expiry, the gap at entry (first day traded), at the last allowed exit
 * (one trading day before the tender window) and at expiry. Tradable only if it shrinks by more than
 * round-trip costs BEFORE the last allowed exit.
 */
function convergence(ctx, pair, series) {
  if (pair.carryAdjusted) return [];
  const byE = new Map();
  for (const x of series) (byE.get(x.E) || byE.set(x.E, []).get(x.E)).push(x);
  const out = [];
  for (const [E, pts] of byE) {
    if (pts.length < 5) continue;
    const first = pts[0], last = pts[pts.length - 1];
    let atExp = null;
    for (const d of ctx.days.filter((x) => x > last.d && x <= E).reverse()) {
      const A = ctx.panel.get(d)?.get(`${pair.a}|${E}`), B = ctx.panel.get(d)?.get(`${pair.b}|${E}`);
      if (A && B) { atExp = 1e4 * Math.log(A.pg / B.pg); break; }
    }
    const rt = roundTripBps(first, pair, 1);
    const shrinkToExit = Math.abs(first.s) - Math.abs(last.s);
    out.push({ E, entry: first.s, lastExit: last.s, expiry: atExp, rt, shrinkToExit, tradable: shrinkToExit > rt });
  }
  return out;
}

function randomRuns(ctx, pair, series, params, from, to, nTrades, holds, draws, seed, notional) {
  const r = rng(seed);
  const cand = series.filter((x) => x.d >= from && x.d <= to).map((x) => x.d);
  const res = [];
  for (let k = 0; k < draws; k++) {
    const plan = new Map();
    for (let j = 0; j < nTrades * 2 && cand.length; j++) {
      const d = cand[Math.floor(r() * cand.length)];
      plan.set(d, { dir: r() < 0.5 ? -1 : 1, hold: holds.length ? holds[Math.floor(r() * holds.length)] : 4 });
    }
    const run = runStrategy(ctx, pair, series, { ...params, maxHold: 30 }, from, to, plan);
    run.trades = run.trades.slice(0, nTrades);
    const keep = new Set(run.trades.flatMap((t) => [t.entryDay, t.exitDay]));
    const last = run.trades.length ? run.trades[run.trades.length - 1].exitDay : from - 1;
    run.daily = run.daily.filter((x) => x.d <= last || keep.has(x.d));
    res.push(metrics(ctx, pair, run, from, to, notional));
  }
  return res;
}

function walkForward(ctx, pair, series, costMult = 1, signal = "z") {
  const notional = (series.find((x) => x.d >= FOLDS[0].testFrom) || series[0]).B.pq * pair.grams;
  return FOLDS.map((f, fi) => {
    // choose params on TRAIN only; the level model is also fitted on train rows only
    const grid = signal === "level"
      ? LEVEL_GRID.map((g) => { const lm = levelModel(series, f.testFrom - 1, g.bucket); return { ...g, signal, levelModel: lm.f, levelSd: lm.sd, levelTable: lm.table }; })
      : GRID;
    let best = null;
    for (const g of grid) {
      const run = runStrategy(ctx, pair, series, { ...g, costMult: 1 }, f.trainFrom, f.testFrom - 1);
      const m = metrics(ctx, pair, run, f.trainFrom, f.testFrom - 1, notional);
      const score = m.trades >= 5 ? m.sharpe : -99;
      if (!best || score > best.score) best = { g, score, m };
    }
    const params = { ...best.g };
    const at = (mult, extra = {}) => {
      const run = runStrategy(ctx, pair, series, { ...params, costMult: mult, ...extra }, f.testFrom, f.testTo);
      return { run, m: metrics(ctx, pair, run, f.testFrom, f.testTo, notional) };
    };
    const base = at(costMult);
    const noGate = at(costMult, { costGate: false });
    const holds = base.run.trades.map((t) => t.held);
    const rnd = randomRuns(ctx, pair, series, { ...params, costMult }, f.testFrom, f.testTo, Math.max(1, base.m.trades), holds, 60, 101 + fi, notional);
    return {
      fold: f, params, trainSharpe: best.m.sharpe,
      strat: base, noGate: noGate.m,
      random: { net: median(rnd.map((x) => x.net)), sharpe: median(rnd.map((x) => x.sharpe)), p95: quantile(rnd.map((x) => x.sharpe), 0.95), mdd: median(rnd.map((x) => x.mdd)), hit: median(rnd.map((x) => x.hit)), corrGold: median(rnd.map((x) => x.corrGold)), trades: base.m.trades },
      stress: [1, 2, 3].map((k) => ({ mult: k, m: at(k).m })),
    };
  });
}

function verdict(wf) {
  const at2 = wf.map((f) => f.stress[1].m.sharpe);
  const pass = at2.every((s) => s > 0);
  return { pass, at2, failing: wf.filter((f) => f.stress[1].m.sharpe <= 0).map((f) => f.fold.name) };
}

function build(seed) {
  const market = generate(seed);
  const ing = ingest(market);
  const ctx = { days: market.days, exp: market.exp, spotByDay: market.spotByDay, panel: ing.panel };
  const series = Object.fromEntries(PAIRS.map((p) => [p.id, spreadSeries(ctx, p)]));
  return { market, ing, ctx, series };
}

// ---------- real MCX snapshot (filtered Bhavcopy rows) ----------
// A row is thin when its day volume is under 5 kg of gold: comparable across lot sizes.
const REAL_THIN_GRAMS = 5000;
const REAL_PAIRS = [
  { id: "TEN-GUINEA", a: "GOLDGUINEA", b: "GOLDTEN", grams: 40 },
  { id: "TEN-PETAL", a: "GOLDPETAL", b: "GOLDTEN", grams: 100 },
  { id: "GUINEA-PETAL", a: "GOLDGUINEA", b: "GOLDPETAL", grams: 40 },
];

function analyzeReal(data, need = DEFAULT_PARAMS.W) {
  const rows = data.futures.map((r) => {
    const s = SPECS[r.symbol];
    const pq = r.close / s.quoteGrams, pqPrev = r.prev_close / s.quoteGrams;
    const vol_g = r.volume_lots * s.lotGrams;
    return {
      ...r, e: fromIso(r.expiry), d: fromIso(r.date),
      pq, pg: pq * 999 / s.purity, pgPrev: pqPrev * 999 / s.purity,
      vol_g, thin: vol_g < REAL_THIN_GRAMS, quote_ok: r.lot_g === s.lotGrams && r.quote_g === s.quoteGrams && r.purity === s.purity,
    };
  });
  const dates = [...new Set(rows.map((r) => r.date))];
  const keys = rows.map((r) => `${r.symbol}|${r.expiry}`);
  const checks = [
    { name: "One trading date per file", ok: dates.length === 1, detail: dates.join(", ") },
    { name: "Only the four gold contracts", ok: rows.every((r) => SPECS[r.symbol]), detail: [...new Set(rows.map((r) => r.symbol))].join(", ") },
    { name: "Lot, quote and purity match the spec", ok: rows.every((r) => r.quote_ok), detail: "Against MCX contract PDFs" },
    { name: "No duplicate (symbol, expiry)", ok: new Set(keys).size === keys.length, detail: `${keys.length} rows, ${new Set(keys).size} unique` },
    { name: "Prices consistent (Low ≤ Close ≤ High)", ok: rows.every((r) => r.low <= r.close && r.close <= r.high && r.close > 0), detail: "Every row" },
    { name: "Thin rows flagged (< 5 kg traded)", ok: true, warn: rows.some((r) => r.thin), detail: rows.filter((r) => r.thin).map((r) => `${r.symbol} ${fmtExp(r.e)}`).join(", ") || "None" },
  ];
  const spotFiles = [...new Set(data.spot.map((s) => s.source_file))];
  const spotDate = (() => { const m = /_(\d{2})(\d{2})(\d{4})_/.exec(spotFiles[0] || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; })();
  checks.push({ name: "Spot file from the same day", ok: spotDate === dates[0], detail: spotDate ? `Spot ${spotDate} vs futures ${dates[0]}: not compared` : "No spot file" });

  // same-expiry gaps (bps), both days
  const byExp = new Map();
  for (const r of rows) (byExp.get(r.e) || byExp.set(r.e, {}).get(r.e))[r.symbol] = r;
  const gap = (a, b, f) => 1e4 * Math.log(a[f] / b[f]);
  const sameExpiry = [...byExp.entries()].filter(([, g]) => g.GOLDTEN).sort((x, y) => x[0] - y[0]).map(([e, g]) => ({
    e, rows: g,
    pairs: REAL_PAIRS.map((p) => g[p.a] && g[p.b] ? {
      id: p.id, today: gap(g[p.a], g[p.b], "pg"), prev: gap(g[p.a], g[p.b], "pgPrev"),
      thin: g[p.a].thin || g[p.b].thin,
      rt: roundTripBps({ A: g[p.a], B: g[p.b] }, p, 1),
    } : null),
  }));
  // GOLDM against GOLDTEN interpolated to GOLDM's expiry (carry from the GOLDTEN curve itself)
  const ten = rows.filter((r) => r.symbol === "GOLDTEN").sort((a, b) => a.e - b.e);
  const goldm = rows.filter((r) => r.symbol === "GOLDM").sort((a, b) => a.e - b.e).map((m) => {
    const i = ten.findIndex((t) => t.e > m.e);
    if (i < 1) return { e: m.e, row: m, gap: null };
    const a = ten[i - 1], b = ten[i], w = (m.e - a.e) / (b.e - a.e);
    const interp = Math.exp(Math.log(a.pg) + w * (Math.log(b.pg) - Math.log(a.pg)));
    return { e: m.e, row: m, gap: 1e4 * Math.log(m.pg / interp), thin: m.thin || a.thin || b.thin };
  });
  const carry = Object.fromEntries(CONTRACTS.map((c) => {
    const cs = rows.filter((r) => r.symbol === c && !r.thin).sort((a, b) => a.e - b.e);
    const a = cs[0], b = cs[cs.length - 1];
    return [c, a && b && b.e > a.e ? Math.log(b.pg / a.pg) / ((b.e - a.e) / 365) : null];
  }));
  const front = sameExpiry[0];
  const alerts = REAL_PAIRS.map((p, i) => {
    const x = front.pairs[i];
    return { pair: p, gap: x.today, prev: x.prev, rt: x.rt, history: 2, need,
      status: Math.abs(x.today) > x.rt ? "quiet-history" : "quiet-cost" };
  });
  return { date: dates[0], rows, checks, sameExpiry, goldm, carry, alerts, spot: data.spot, spotDate, REAL_PAIRS };
}

// Every configuration the backtest tries, so the report can state it (plan review item 5).
const CONFIGS_TRIED = PAIRS.length * (GRID.length + LEVEL_GRID.length);

export const G = {
  SPECS, CONTRACTS, PAIRS, COSTS, FOLDS, GRID, LEVEL_GRID, PRIMARY, CONFIGS_TRIED, THIN_LOTS, TENDER_BIZDAYS, DEFAULT_PARAMS, REAL_THIN_GRAMS,
  build, runStrategy, metrics, walkForward, verdict, roundTripBps, bizBetween, analyzeReal, levelModel, convergence,
  iso, fromIso, fmtReq, fmtResp, fmtExp, mean, sd,
};
