import type { ReactNode } from "react";
import { Bezel, CountUp, Reveal } from "../../components/ui";
import { G } from "../../lib/data";
import { PAIR_SHORT } from "../../lib/format";

/** A titled Lab panel (double bezel, tighter radius than the story page). */
export function Panel({ title, sub, children, className = "", delay = 0 }: { title?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} y={16} className={className}>
      <Bezel tight core="p-5 md:p-6" className="h-full">
        {(title || sub) && (
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {title && <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>}
            {sub && <span className="text-[13px] text-text-2">{sub}</span>}
          </div>
        )}
        {children}
      </Bezel>
    </Reveal>
  );
}

export function Kpi({ label, value, note, icon, format }: { label: string; value: number | string; note: string; icon?: ReactNode; format?: (v: number) => string }) {
  return (
    <Panel>
      <div className="flex items-center gap-2 text-[13px] text-text-2">{icon}{label}</div>
      <div className="num mt-2 text-2xl font-medium tracking-tight">
        {typeof value === "number" && format ? <CountUp value={value} format={format} /> : value}
      </div>
      <div className="mt-1 text-xs text-text-3">{note}</div>
    </Panel>
  );
}

/** Scrollable table region (keyboard focusable so it can be scrolled without a mouse). */
export function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-collapse text-sm [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-ring [&_td]:px-2 [&_td]:py-2.5 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-ring-strong [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-text-2 [&_tbody_tr:last-child_td]:border-b-0">
        {children}
      </table>
    </div>
  );
}
export const numCell = "num text-right text-[13px]";

/** Segmented control (aria-pressed buttons). */
export function Seg<T extends string | number>({ legend, value, options, onChange }: { legend: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-text-2">{legend}</legend>
      <div className="inline-flex flex-wrap gap-0.5 rounded-full bg-panel-2 p-1 ring-1 ring-ring">
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}
            className={`min-h-9 min-w-11 rounded-full px-3.5 text-[13px] transition-colors duration-300 active:scale-[0.98] ${o.v === value ? "bg-panel font-semibold text-text ring-1 ring-ring-strong" : "text-text-2 hover:text-text"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PairSeg({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Seg legend="Pair" value={value} onChange={onChange} options={G.PAIRS.map((p: any) => ({ v: p.id, label: PAIR_SHORT[p.id] + (p.id === G.PRIMARY.pair ? " (primary)" : "") }))} />;
}
