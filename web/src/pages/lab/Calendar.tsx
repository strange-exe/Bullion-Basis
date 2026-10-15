import { CheckCircle, XCircle, LockSimple } from "@phosphor-icons/react";
import { useWidth } from "../../lib/hooks";
import { Legend, Pill } from "../../components/ui";
import { G, R, SNAP_DAY } from "../../lib/data";
import { dt, dtShort, mon, SERIES } from "../../lib/format";
import { Panel, Table, numCell } from "./shared";

// Business days skip weekends only here; the production pipeline uses the MCX holiday calendar.
const isWeekday = (d: number) => { const w = new Date(d * 86400000).getUTCDay(); return w !== 0 && w !== 6; };
const weekdaysBetween = (a: number, b: number) => { let n = 0; for (let d = a + 1; d <= b; d++) if (isWeekday(d)) n++; return n; };
function backWeekdays(d: number, n: number) { while (n > 0) { d--; if (isWeekday(d)) n--; } return d; }

function Gantt({ rows }: { rows: any[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const today = SNAP_DAY, to = Math.max(...rows.map((r) => r.e)) + 4;
  const W = Math.max(760, width), rowH = 24, top = 28, left = 150, right = 76, H = top + rows.length * rowH + 8;
  const X = (d: number) => left + ((d - today) / (to - today)) * (W - left - right);
  const months: number[] = []; { const a = new Date(today * 86400000); let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1; for (;;) { const d = Math.round(Date.UTC(y, m, 1) / 86400000); if (d > to) break; months.push(d); m++; if (m > 11) { m = 0; y++; } } }
  return (
    <div ref={ref} className="overflow-x-auto" tabIndex={0} role="region" aria-label="Contract lifecycle chart">
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${rows.length} listed gold contracts from ${dt(today)} to expiry, with tender windows and volume`}>
          <defs>
            <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--panel)" /><rect width="2" height="5" fill="var(--accent)" />
            </pattern>
          </defs>
          {months.map((d) => <g key={d}><line x1={X(d)} x2={X(d)} y1={top - 8} y2={H} stroke="var(--grid)" /><text x={X(d) + 4} y={14} fontSize={11} className="num" fill="var(--text-2)">{mon(d)}</text></g>)}
          {rows.map((r, i) => {
            const y = top + i * rowH, tender = backWeekdays(r.e, G.TENDER_BIZDAYS - 1), newGroup = i > 0 && rows[i - 1].symbol !== r.symbol;
            return (
              <g key={`${r.symbol}${r.e}`}>
                {newGroup && <line x1={0} x2={W} y1={y - 1} y2={y - 1} stroke="var(--ring)" />}
                <circle cx={6} cy={y + 11} r={4} fill={SERIES[r.symbol]} />
                <text x={16} y={y + 15} fontSize={12} className="num" fill="var(--text)">{r.symbol} {G.fmtExp(r.e).slice(0, 5)}{G.fmtExp(r.e).slice(7)}</text>
                <rect x={X(today)} y={y + 5} width={Math.max(2, X(tender) - X(today))} height={13} rx={3}
                  fill={`color-mix(in srgb, var(--train) ${r.thin ? 18 : 55}%, var(--panel))`} stroke={r.thin ? "var(--ring-strong)" : "none"} />
                <rect x={X(tender)} y={y + 5} width={Math.max(3, X(r.e + 1) - X(tender))} height={13} fill="url(#hatch)" stroke="var(--accent)" />
                <text x={W - 4} y={y + 15} textAnchor="end" fontSize={11} className="num" fill={r.thin ? "var(--warn)" : "var(--text-2)"}>{(r.vol_g / 1000).toFixed(1)} kg</text>
              </g>
            );
          })}
          <line x1={X(today)} x2={X(today)} y1={top - 8} y2={H} stroke="var(--accent)" strokeWidth={1.5} />
        </svg>
      )}
    </div>
  );
}

export default function Calendar() {
  const hold = G.DEFAULT_PARAMS.maxHold;
  const rows = G.CONTRACTS.flatMap((c: string) => R.rows.filter((r: any) => r.symbol === c).sort((a: any, b: any) => a.e - b.e));
  const plan = rows.filter((r: any) => !r.thin).sort((a: any, b: any) => a.e - b.e).slice(0, 8).map((r: any) => {
    const tender = backWeekdays(r.e, G.TENDER_BIZDAYS - 1);
    const lastExit = backWeekdays(tender, 1), lastEntry = backWeekdays(tender, hold + 1);
    return { r, tender, lastExit, lastEntry, left: weekdaysBetween(SNAP_DAY, r.e), open: lastEntry >= SNAP_DAY };
  });
  return (
    <div className="grid gap-5">
      <Panel>
        <p className="flex items-start gap-2 text-sm text-text-2"><LockSimple size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
          Enter at least {hold + 1} trading days before the tender window. Exit by the last allowed exit date, one trading day before it. Never hold into compulsory delivery.</p>
      </Panel>
      <Panel title="Every listed gold contract, from today to expiry" sub={`Real Bhavcopy, ${dt(SNAP_DAY)}`}>
        <div className="mb-3"><Legend items={[{ color: "color-mix(in srgb, var(--train) 55%, var(--panel))", label: "Liquid (5 kg or more traded)", kind: "box" }, { color: "color-mix(in srgb, var(--train) 18%, var(--panel))", label: "Thin", kind: "box" }, { color: "var(--accent)", label: `Tender window, last ${G.TENDER_BIZDAYS} trading days`, kind: "box" }]} /></div>
        <Gantt rows={rows} />
      </Panel>
      <Panel title="Entry windows, liquid contracts" sub={`For a ${hold}-day maximum hold`}>
        <Table label="Entry windows">
          <thead><tr><th>Contract</th><th>Expiry</th><th className="!text-right">Trading days left</th><th>Last entry</th><th>Last allowed exit</th><th>Tender starts</th><th className="!text-right">Traded today</th><th>Status</th></tr></thead>
          <tbody>{plan.map((p: any) => (
            <tr key={`${p.r.symbol}${p.r.e}`}>
              <td><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: SERIES[p.r.symbol] }} />{p.r.symbol}</span></td>
              <td className="num text-[13px]">{G.fmtExp(p.r.e)}</td><td className={numCell}>{p.left}</td>
              <td>{dtShort(p.lastEntry)}</td><td>{dtShort(p.lastExit)}</td><td>{dtShort(p.tender)}</td>
              <td className={numCell}>{(p.r.vol_g / 1000).toFixed(1)} kg</td>
              <td>{p.open ? <Pill tone="good" icon={<CheckCircle size={13} aria-hidden="true" />}>Open</Pill> : <Pill tone="bad" icon={<XCircle size={13} aria-hidden="true" />}>Closed</Pill>}</td>
            </tr>))}</tbody>
        </Table>
        <p className="mt-3 text-xs text-text-3">Dates skip weekends only. The production pipeline uses the MCX holiday calendar. Tender rule: MCX gold contract specifications, Jul/Aug 2026 onwards.</p>
      </Panel>
    </div>
  );
}
