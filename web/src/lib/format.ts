const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toDate = (d: number) => new Date(d * 86400000);

/** Day number (days since epoch, UTC) to "14 Oct 2026". */
export const dt = (d: number) => { const x = toDate(d); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
export const dtShort = (d: number) => { const x = toDate(d); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`; };
export const mon = (d: number) => { const x = toDate(d); return `${MONTHS[x.getUTCMonth()]} ${String(x.getUTCFullYear()).slice(2)}`; };

/** Signed basis points with a true minus sign: "+63.4 bps", "−3.5 bps". */
export const bps = (v: number, dp = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)} bps`;
export const num = (v: number, dp = 2) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const rupees = (v: number, dp = 0) => "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const SERIES: Record<string, string> = { GOLDM: "var(--s1)", GOLDTEN: "var(--s2)", GOLDGUINEA: "var(--s3)", GOLDPETAL: "var(--s4)" };
export const PAIR_LABEL: Record<string, string> = {
  "TEN-PETAL": "GOLDTEN vs GOLDPETAL", "GUINEA-PETAL": "GOLDGUINEA vs GOLDPETAL",
  "TEN-GUINEA": "GOLDTEN vs GOLDGUINEA", "M-TEN": "GOLDM vs GOLDTEN (carry-adjusted)",
};
export const PAIR_SHORT: Record<string, string> = { "TEN-PETAL": "TEN / PETAL", "GUINEA-PETAL": "GUINEA / PETAL", "TEN-GUINEA": "TEN / GUINEA", "M-TEN": "M / TEN" };
export const REAL_LABEL: Record<string, string> = { "TEN-GUINEA": "GUINEA vs TEN", "TEN-PETAL": "PETAL vs TEN", "GUINEA-PETAL": "GUINEA vs PETAL" };
