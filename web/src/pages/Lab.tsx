import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { TrayArrowDown, Scales, BellSimple, ChartLineUp, CalendarBlank, ArrowLeft, Moon, Sun } from "@phosphor-icons/react";
import { Chip, EASE } from "../components/ui";
import { Mark } from "../components/Mark";
import { GapBars } from "../components/GapBars";
import { useTheme } from "../lib/hooks";
import { navigate } from "../router";
import { SNAP_DAY, headlineRange } from "../lib/data";
import { dt } from "../lib/format";
import Ingest from "./lab/Ingest";
import Normalize from "./lab/Normalize";

// Steps that need the synthetic walk-forward load on demand, keeping the first paint light.
const Signal = lazy(() => import("./lab/Signal"));
const Backtest = lazy(() => import("./lab/Backtest"));
const Calendar = lazy(() => import("./lab/Calendar"));

const STEPS = [
  { id: "ingest", label: "Ingest", Icon: TrayArrowDown },
  { id: "normalize", label: "Normalize", Icon: Scales },
  { id: "signal", label: "Signal", Icon: BellSimple },
  { id: "backtest", label: "Backtest", Icon: ChartLineUp },
  { id: "calendar", label: "Calendar", Icon: CalendarBlank },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function Skeleton() {
  return <div className="grid gap-4" aria-busy="true" aria-label="Loading">{[60, 90, 75].map((w) => <div key={w} className="h-28 rounded-[1.5rem] bg-panel-2" style={{ width: `${w}%` }} />)}</div>;
}

export default function Lab() {
  const initial = (new URLSearchParams(location.search).get("step") as StepId) || "ingest";
  const [step, setStep] = useState<StepId>(STEPS.some((s) => s.id === initial) ? initial : "ingest");
  const [dir, setDir] = useState(1);
  const [light, setLight] = useTheme();
  const reduce = useReducedMotion();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { lo, hi } = headlineRange();

  useEffect(() => { history.replaceState(null, "", `/lab?step=${step}`); }, [step]);

  const go = (id: StepId, focus = false) => {
    const a = STEPS.findIndex((s) => s.id === step), b = STEPS.findIndex((s) => s.id === id);
    setDir(b >= a ? 1 : -1); setStep(id);
    if (focus) tabs.current[b]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = STEPS.length;
    const j = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (j >= 0) { e.preventDefault(); go(STEPS[j].id, true); }
  };

  return (
    <div className="glow relative min-h-[100dvh] md:grid md:grid-cols-[104px_minmax(0,1fr)]">
      <aside className="glass sticky top-0 z-20 flex items-center gap-2 border-b border-ring bg-ink/85 px-3 py-2 backdrop-blur-xl md:h-[100dvh] md:flex-col md:items-stretch md:border-b-0 md:border-r md:bg-transparent md:px-3 md:py-5 md:backdrop-blur-none">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="mr-1 grid place-items-center md:mb-6 md:mr-0" aria-label="Back to the story">
          <Mark size={36} />
        </a>
        <div role="tablist" aria-label="Pipeline steps" aria-orientation="vertical" className="flex flex-1 gap-1 overflow-x-auto md:flex-none md:flex-col md:overflow-visible">
          {STEPS.map((s, i) => {
            const on = s.id === step;
            return (
              <button key={s.id} ref={(el) => { tabs.current[i] = el; }} role="tab" id={`tab-${s.id}`} aria-selected={on} aria-controls="lab-panel" tabIndex={on ? 0 : -1}
                onClick={() => go(s.id)} onKeyDown={(e) => onKey(e, i)}
                className={`relative grid min-h-14 min-w-16 justify-items-center gap-1 rounded-2xl px-2 py-2.5 text-xs transition-colors duration-300 md:min-h-16 ${on ? "font-semibold text-accent-text" : "text-text-2 hover:text-text"}`}>
                {on && <motion.span layoutId="rail-ind" className="absolute inset-0 rounded-2xl bg-accent-soft ring-1 ring-accent/35" transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }} />}
                <s.Icon size={22} weight={on ? "regular" : "light"} className="relative" aria-hidden="true" />
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 md:mt-auto md:flex-col">
          <button type="button" onClick={() => setLight(!light)} aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
            className="grid size-11 place-items-center rounded-full text-text-2 ring-1 ring-ring transition-colors hover:text-text">
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </aside>

      <div className="relative z-10 min-w-0 px-4 pb-16 md:px-8 lg:px-10">
        <header className="flex flex-wrap items-center gap-3 py-5">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="inline-flex items-center gap-2 text-sm text-text-2 hover:text-text">
            <ArrowLeft size={16} aria-hidden="true" />Story
          </a>
          <h1 className="mr-auto text-lg font-semibold tracking-tight">Gold Spread Lab</h1>
          <Chip live>Real MCX Bhavcopy, {dt(SNAP_DAY)}</Chip>
        </header>

        <section aria-label="Today's finding" className="grid items-center gap-8 border-b border-ring pb-8 pt-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-sm text-text-2">Same expiry, ₹ per gram on a 999 basis</p>
            <p className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-4xl">GOLDTEN trades <span className="text-accent-text">{lo} to {hi} bps</span> below GUINEA and PETAL</p>
            <p className="mt-3 max-w-[60ch] text-text-2">About 5× round-trip costs. The alert stays quiet until history can tell an edge from a contract difference.</p>
          </div>
          <GapBars />
        </section>

        <div id="lab-panel" role="tabpanel" aria-labelledby={`tab-${step}`} tabIndex={0} className="pt-8 outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step}
              initial={reduce ? false : { opacity: 0, y: 14 * dir }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 * dir }}
              transition={{ duration: 0.45, ease: EASE }}>
              <Suspense fallback={<Skeleton />}>
                {step === "ingest" && <Ingest />}
                {step === "normalize" && <Normalize />}
                {step === "signal" && <Signal />}
                {step === "backtest" && <Backtest />}
                {step === "calendar" && <Calendar />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
