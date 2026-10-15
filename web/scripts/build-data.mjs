// Reads the filtered MCX CSVs (output of data/filter_gold.py) and writes src/lib/real-data.json.
// Run by `npm run build`; re-run after stacking more Bhavcopy days. Usage: node scripts/build-data.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../../data");

function readCsv(file) {
  const lines = fs.readFileSync(path.join(dataDir, file), "utf8").trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    if (cells.length !== head.length) throw new Error(`${file}: unexpected column count in "${l}"`);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

const NUM = ["days_to_expiry", "open", "high", "low", "close", "prev_close", "volume_lots", "oi_lots", "value_lakh", "lot_g", "quote_g", "purity"];
const futures = readCsv("gold_futures.csv").map((r) => {
  const o = { date: r.date, symbol: r.symbol.trim(), expiry: r.expiry };
  for (const k of NUM) {
    const v = Number(r[k]);
    if (!Number.isFinite(v)) throw new Error(`gold_futures.csv: ${k} is not a number for ${r.symbol} ${r.expiry}`);
    o[k] = v;
  }
  return o;
});
const spot = readCsv("gold_spot.csv").map((r) => ({
  symbol: r.symbol.trim(), unit: r.unit, location: r.location, spot_price: Number(r.spot_price), source_file: r.source_file,
}));

const out = path.resolve(here, "../src/lib/real-data.json");
fs.writeFileSync(out, JSON.stringify({ futures, spot }));
console.log(`real-data.json: ${futures.length} futures rows, ${spot.length} spot rows`);
