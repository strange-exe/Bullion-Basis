import { useEffect, useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, animate } from "motion/react";
import { ArrowUpRight, Warning } from "@phosphor-icons/react";
import { navigate } from "../router";

export const EASE = [0.32, 0.72, 0, 1] as const;

/** Machined double-bezel panel: outer shell + inner core with concentric radii. */
export function Bezel({ children, className = "", core = "", tight = false, as: Tag = "div" }: {
  children: ReactNode; className?: string; core?: string; tight?: boolean; as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`bezel ${tight ? "tight" : ""} ${className}`}>
      <div className={`core ${core}`}>{children}</div>
    </Tag>
  );
}

/** Pill CTA with the trailing icon in its own circle ("button-in-button"). Internal links route client-side. */
export function PillLink({ href, children, variant = "primary", icon }: {
  href: string; children: ReactNode; variant?: "primary" | "ghost"; icon?: ReactNode;
}) {
  const primary = variant === "primary";
  return (
    <a
      href={href}
      onClick={(e) => { if (href.startsWith("/") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate(href); } }}
      className={`group inline-flex min-h-12 items-center gap-3 rounded-full py-2 pl-6 pr-2 text-[15px] font-medium transition-transform duration-500 ease-glide active:scale-[0.98] ${
        primary ? "bg-accent text-accent-ink" : "text-text ring-1 ring-ring hover:ring-ring-strong"}`}
    >
      <span className="whitespace-nowrap">{children}</span>
      <span className={`grid size-8 place-items-center rounded-full transition-transform duration-500 ease-glide group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105 ${
        primary ? "bg-black/10" : "bg-white/5"}`} aria-hidden="true">
        {icon ?? <ArrowUpRight size={16} weight="regular" />}
      </span>
    </a>
  );
}

/** Heavy, soft entrance as the element enters the viewport. Static under reduced motion. */
export function Reveal({ children, delay = 0, className = "", y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`min-w-0 ${className}`}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Counts a figure up once when it scrolls into view; renders the final text for screen readers and no-JS. */
export function CountUp({ value, format, className = "" }: { value: number; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const c = animate(0, value, { duration: 1.1, ease: EASE, onUpdate: (v) => { el.textContent = format(v); } });
    return () => c.stop();
  }, [inView, reduce, value, format]);
  return <span ref={ref} className={className}>{format(value)}</span>;
}

export function Chip({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-text-2 ring-1 ring-ring">
      {live && <span className="breathe size-2 rounded-full bg-good" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Pill({ tone, children, icon }: { tone: "good" | "warn" | "bad" | "neutral"; children: ReactNode; icon?: ReactNode }) {
  const t = { good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", neutral: "bg-panel-2 text-text-2 ring-1 ring-ring" }[tone];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{icon}{children}</span>;
}

export function SynthBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-text ring-1 ring-warn/40">
      <Warning size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
      <p><b className="font-semibold">Synthetic history.</b> {children}</p>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; kind?: "line" | "box" | "dot" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-2">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={i.kind === "box" ? "size-3 rounded-[3px]" : i.kind === "dot" ? "size-2.5 rounded-full" : "h-[3px] w-3.5 rounded"} style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
