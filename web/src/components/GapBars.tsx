import { motion, useReducedMotion } from "motion/react";
import { R } from "../lib/data";
import { bps, REAL_LABEL } from "../lib/format";
import { CountUp, EASE } from "./ui";

/** Real front-month gaps, each growing past a marker at its round-trip cost. */
export function GapBars() {
  const reduce = useReducedMotion();
  const rows = R.alerts.map((a: any) => ({ k: REAL_LABEL[a.pair.id], v: a.gap as number, rt: a.rt as number }))
    .concat([{ k: "GOLDM vs TEN", v: R.goldm[0].gap as number, rt: R.alerts[0].rt as number }]);
  const max = Math.max(...rows.map((r: any) => Math.abs(r.v))) * 1.08;
  return (
    <div>
      <ul className="grid gap-5" aria-label="Front-month gap against round-trip cost">
        {rows.map((r: any, i: number) => (
          <li key={r.k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2"
            aria-label={`${r.k}: ${bps(r.v)}, round-trip cost ${r.rt.toFixed(0)} bps`}>
            <span className="text-sm text-text-2">{r.k}</span>
            <CountUp value={r.v} format={(v) => bps(v)} className="num text-right text-[15px] font-medium" />
            <span className="relative col-span-2 h-2.5 rounded-full bg-white/5" aria-hidden="true">
              <motion.span
                className={`absolute inset-y-0 left-0 origin-left rounded-full ${r.v < 0 ? "bg-train" : "bg-accent"}`}
                style={{ width: `${(Math.abs(r.v) / max) * 100}%` }}
                initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                transition={{ duration: 1.1, delay: 0.35 + i * 0.1, ease: EASE }} />
              <span className="absolute -inset-y-1.5 w-0.5 rounded bg-marker" style={{ left: `${(r.rt / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
        <span className="inline-flex items-center gap-2"><i className="h-1.5 w-4 rounded-full bg-accent" />gap, 14 Oct</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-0.5 bg-marker" />round-trip cost</span>
        <span>GOLDM is carry-adjusted</span>
      </div>
    </div>
  );
}
