import { CheckCircle, Warning, XCircle, Rows, Clock } from "@phosphor-icons/react";
import { Pill } from "../../components/ui";
import { G, R } from "../../lib/data";
import { dt, rupees } from "../../lib/format";
import { Kpi, Panel, Table } from "./shared";

export default function Ingest() {
  const passed = R.checks.filter((c: any) => c.ok).length;
  const thin = R.rows.filter((r: any) => r.thin).length;
  const front = Math.min(...R.rows.filter((x: any) => x.symbol === "GOLDGUINEA").map((x: any) => x.e));
  const r0 = R.rows.find((r: any) => r.symbol === "GOLDGUINEA" && r.e === front);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Rows in today's file" value={R.rows.length} format={(v) => String(Math.round(v))} note="Gold only, filtered from the Bhavcopy" icon={<Rows size={16} aria-hidden="true" />} />
        <Kpi label="Checks passed" value={`${passed} / ${R.checks.length}`} note="One flagged, one failed: listed below" icon={<CheckCircle size={16} className="text-good" aria-hidden="true" />} />
        <Kpi label="Thin rows" value={thin} format={(v) => String(Math.round(v))} note="Under 5 kg traded: costed higher" icon={<Warning size={16} className="text-warn" aria-hidden="true" />} />
        <Kpi label="History available" value="2 days" note="Liquidity checked on 1" icon={<Clock size={16} className="text-bad" aria-hidden="true" />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Validation of today's file" sub={`Real MCX Bhavcopy, ${dt(R.rows[0].d)}`} delay={0.05}>
          <Table label="Validation checks">
            <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
            <tbody>
              {R.checks.map((c: any) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.ok ? (c.warn ? <Pill tone="warn" icon={<Warning size={13} aria-hidden="true" />}>Flagged</Pill> : <Pill tone="good" icon={<CheckCircle size={13} aria-hidden="true" />}>Pass</Pill>) : <Pill tone="bad" icon={<XCircle size={13} aria-hidden="true" />}>Fail</Pill>}</td>
                  <td className="!whitespace-normal text-text-2">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-4 text-xs text-text-3">A failed check never passes silently: the row or file is excluded and the reason is logged.</p>
        </Panel>
        <Panel title="One real row, parsed" delay={0.1}>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 text-sm">
            {[
              ["Date", `${dt(r0.d)}`, "must equal the date requested"],
              ["Symbol", `"GOLDGUINEA   "`, "trimmed"],
              ["Expiry", G.fmtExp(r0.e), "key: (symbol, expiry)"],
              ["Close", `${r0.close} per 8 g`, `${rupees(r0.pg, 2)} per g, 999`],
              ["Volume", `${r0.volume_lots} lots`, `${(r0.vol_g / 1000).toFixed(1)} kg traded, ${r0.thin ? "thin" : "liquid"}`],
            ].map(([k, raw, out]) => (
              <div key={k} className="contents">
                <dt className="text-xs font-medium text-text-2">{k}</dt>
                <dd className="m-0"><code className="num whitespace-pre rounded-md bg-panel-2 px-1.5 py-0.5 text-[13px]">{raw}</code> <span className="text-accent-text" aria-hidden="true">→</span> <span className="text-text-2">{out}</span></dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-text-3">Close is MCX's settlement (last 30-minute weighted average), not a fill price. Volume is not market depth.</p>
        </Panel>
      </div>
    </div>
  );
}
