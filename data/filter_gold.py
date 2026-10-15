"""Filter MCX Bhavcopy + spot files down to the four gold contracts in the problem
statement and normalize every price to Rs per gram on a 999-purity basis.

Usage:
    python filter_gold.py --bhav BhavCopyDateWise_*.csv --spot SpotMarket_*.xls --out data/

Accepts any number of Bhavcopy files, so daily downloads can be stacked into history.
"""
import argparse
import glob
import re
from pathlib import Path

import numpy as np
import pandas as pd

# Contract specs (MCX product pages). quote_g = grams the quoted price refers to.
SPECS = pd.DataFrame([
    # symbol,      lot_g, quote_g, purity
    ("GOLDM",      100,   10,      995),
    ("GOLDTEN",    10,    10,      999),
    ("GOLDGUINEA", 8,     8,       999),
    ("GOLDPETAL",  1,     1,       999),
], columns=["symbol", "lot_g", "quote_g", "purity"]).set_index("symbol")

BASE_PURITY = 999
# Below this many grams traded, the close is a weak proxy for a tradable price. Measured in grams,
# not lots, because a GOLDM lot is 100x a GOLDPETAL lot.
LOW_VOLUME_G = 5000
MONTH_END = ["GOLDTEN", "GOLDGUINEA", "GOLDPETAL"]  # share expiry dates; GOLDM expires ~5th


def to_per_g_999(price, symbol):
    spec = SPECS.loc[symbol]
    return price / spec.quote_g * (BASE_PURITY / spec.purity)


def _date_in_name(path):
    """DDMMYYYY in the file name, if present (e.g. BhavCopyDateWise_14102026.csv)."""
    m = re.search(r"(\d{2})(\d{2})(\d{4})", Path(path).name)
    return pd.Timestamp(f"{m[3]}-{m[2]}-{m[1]}") if m else None


def _read_one(path):
    df = pd.read_csv(path, dtype=str)
    df.columns = [c.strip() for c in df.columns]
    df = df.apply(lambda s: s.str.strip())
    dates = pd.to_datetime(df["Date"], format="%d %b %Y").unique()
    expected = _date_in_name(path)
    # MCX answers a holiday or bad date with the latest trading day, so a file can carry the wrong day.
    if len(dates) != 1 or (expected is not None and dates[0] != expected):
        print(f"SKIP {Path(path).name}: file dates {[str(d.date()) for d in dates]}, expected {expected.date() if expected is not None else 'one date'}")
        return None
    return df


def load_bhavcopy(paths):
    frames = [f for f in (_read_one(p) for p in paths) if f is not None]
    if not frames:
        raise SystemExit("No Bhavcopy file passed the date check")
    df = pd.concat(frames, ignore_index=True)
    df = df[(df["Instrument Name"] == "FUTCOM") & (df["Symbol"].isin(SPECS.index))].copy()
    before = len(df)
    df = df.drop_duplicates(subset=["Date", "Symbol", "Expiry Date"], keep="first")
    if len(df) < before:
        print(f"Dropped {before - len(df)} duplicate (date, symbol, expiry) rows")

    num = ["Open", "High", "Low", "Close", "Previous Close", "Volume(Lots)", "Value(Lacs)",
           "Open Interest(Lots)"]
    df[num] = df[num].apply(pd.to_numeric, errors="coerce")
    df["date"] = pd.to_datetime(df["Date"], format="%d %b %Y")
    df["expiry"] = pd.to_datetime(df["Expiry Date"], format="%d%b%Y")

    out = pd.DataFrame({
        "date": df["date"].dt.date,
        "symbol": df["Symbol"],
        "expiry": df["expiry"].dt.date,
        "days_to_expiry": (df["expiry"] - df["date"]).dt.days,
        "open": df["Open"], "high": df["High"], "low": df["Low"], "close": df["Close"],
        "prev_close": df["Previous Close"],
        "volume_lots": df["Volume(Lots)"].astype("Int64"),
        "oi_lots": df["Open Interest(Lots)"].astype("Int64"),
        "value_lakh": df["Value(Lacs)"],
    })
    out = out.join(SPECS, on="symbol")
    out["volume_g"] = out["volume_lots"] * out["lot_g"]
    out["close_per_g_999"] = [to_per_g_999(p, s) for p, s in zip(out["close"], out["symbol"])]
    # 1 = nearest expiry for that symbol on that date
    out["contract_rank"] = out.groupby(["date", "symbol"])["expiry"].rank(method="first").astype(int)
    out["traded"] = out["volume_lots"].fillna(0) > 0
    out["low_liquidity"] = out["volume_g"].fillna(0) < LOW_VOLUME_G
    return out.sort_values(["date", "symbol", "expiry"]).reset_index(drop=True)


def load_spot(path):
    # MCX's ".xls" spot download is really an HTML table.
    html = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", html, re.S):
        cells = [re.sub(r"<.*?>", "", c).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if cells and cells[0] in SPECS.index:
            rows.append(cells[:4])
    spot = pd.DataFrame(rows, columns=["symbol", "unit", "location", "spot_price"])
    spot["spot_price"] = pd.to_numeric(spot["spot_price"])
    spot["source_file"] = Path(path).name
    spot["spot_per_g_999"] = [to_per_g_999(p, s) for p, s in zip(spot["spot_price"], spot["symbol"])]
    return spot


def spread_table(fut):
    """Each contract vs GOLDTEN, keyed by expiry date (never by rank).

    GOLDTEN, GOLDGUINEA and GOLDPETAL share month-end expiries, so they compare directly.
    GOLDM expires around the 5th; comparing it with the GOLDTEN of the same rank mixes two
    expiries ~6 days apart, which is carry, not mispricing. GOLDM is therefore compared with
    GOLDTEN log-interpolated to GOLDM's own expiry on the same day.
    """
    same = fut[fut["symbol"].isin(MONTH_END)]
    wide = same.pivot_table(index=["date", "expiry"], columns="symbol", values="close_per_g_999")
    res = wide.copy()
    for sym in ["GOLDGUINEA", "GOLDPETAL"]:
        if sym in wide and "GOLDTEN" in wide:
            res[f"{sym}_minus_GOLDTEN"] = wide[sym] - wide["GOLDTEN"]
            res[f"{sym}_vs_GOLDTEN_bps"] = (wide[sym] / wide["GOLDTEN"] - 1) * 1e4
    res = res.reset_index()

    rows = []
    for (date, _), m in fut[fut["symbol"] == "GOLDM"].groupby(["date", "expiry"]):
        ten = fut[(fut["date"] == date) & (fut["symbol"] == "GOLDTEN")].sort_values("expiry")
        exp_m = pd.Timestamp(m["expiry"].iloc[0])
        t = pd.to_datetime(ten["expiry"])
        before, after = ten[t <= exp_m].tail(1), ten[t > exp_m].head(1)
        if before.empty or after.empty:
            continue
        t0, t1 = pd.Timestamp(before["expiry"].iloc[0]), pd.Timestamp(after["expiry"].iloc[0])
        w = (exp_m - t0).days / (t1 - t0).days
        ten_at_m = np.exp(np.log(before["close_per_g_999"].iloc[0]) * (1 - w) + np.log(after["close_per_g_999"].iloc[0]) * w)
        p = m["close_per_g_999"].iloc[0]
        rows.append({"date": date, "expiry": m["expiry"].iloc[0], "GOLDM": p, "GOLDTEN_interp": ten_at_m,
                     "GOLDM_vs_GOLDTEN_carryadj_bps": (p / ten_at_m - 1) * 1e4})
    goldm = pd.DataFrame(rows)
    return pd.concat([res, goldm], ignore_index=True).round(2).sort_values(["date", "expiry"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bhav", nargs="+", required=True)
    ap.add_argument("--spot", nargs="*", default=[])
    ap.add_argument("--out", default=".")
    a = ap.parse_args()

    bhav = [p for pat in a.bhav for p in glob.glob(pat)]
    if not bhav:
        raise SystemExit(f"No Bhavcopy files matched: {a.bhav}")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    fut = load_bhavcopy(bhav)
    fut.round(2).to_csv(out / "gold_futures.csv", index=False)
    spread_table(fut).to_csv(out / "gold_spreads_vs_goldten.csv", index=False)
    print(f"gold_futures.csv: {len(fut)} rows from {len(bhav)} Bhavcopy file(s)")

    spot_files = [p for pat in a.spot for p in glob.glob(pat)]
    if spot_files:  # stack every file; writing inside the loop kept only the last one
        spot = pd.concat([load_spot(p) for p in spot_files], ignore_index=True)
        spot.round(2).to_csv(out / "gold_spot.csv", index=False)
        print(f"gold_spot.csv: {len(spot)} rows from {len(spot_files)} file(s)")


if __name__ == "__main__":
    main()
