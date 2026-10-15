import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { PillLink, EASE } from "./ui";
import { useTheme } from "../lib/hooks";
import { Mark } from "./Mark";

const LINKS = [["Finding", "#finding"], ["Method", "#method"], ["Evidence", "#evidence"]] as const;

/** Floating glass pill (the only blurred element), and a full-screen menu on small screens. */
export function Nav() {
  const [open, setOpen] = useState(false);
  const [light, setLight] = useTheme();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-30 flex justify-center px-4 md:top-6">
        <nav aria-label="Main" className="glass flex w-full max-w-3xl items-center gap-2 rounded-full bg-panel/70 py-2 pl-4 pr-2 ring-1 ring-ring backdrop-blur-xl md:w-max md:gap-6">
          <a href="/" className="mr-auto flex items-center gap-2.5 text-[15px] font-semibold tracking-tight md:mr-0">
            <Mark size={26} />Bullion Basis
          </a>
          <ul className="hidden items-center gap-6 text-sm text-text-2 md:flex">
            {LINKS.map(([l, h]) => <li key={h}><a href={h} className="transition-colors duration-300 hover:text-text">{l}</a></li>)}
          </ul>
          <button type="button" onClick={() => setLight(!light)} aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
            className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:text-text">
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <span className="hidden md:inline-flex"><PillLink href="/lab">Open the Lab</PillLink></span>
          <button type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)} className="relative grid size-11 place-items-center rounded-full ring-1 ring-ring md:hidden">
            <span className={`absolute h-px w-4 bg-text transition-transform duration-500 ease-glide ${open ? "rotate-45" : "-translate-y-[3px]"}`} />
            <span className={`absolute h-px w-4 bg-text transition-transform duration-500 ease-glide ${open ? "-rotate-45" : "translate-y-[3px]"}`} />
          </button>
        </nav>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div id="mobile-menu" className="glass fixed inset-0 z-20 bg-ink/90 px-6 pt-28 backdrop-blur-2xl md:hidden"
            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
            <ul className="grid gap-6">
              {LINKS.map(([l, h], i) => (
                <motion.li key={h} initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.08 + i * 0.06, ease: EASE }}>
                  <a href={h} onClick={() => setOpen(false)} className="text-4xl font-semibold tracking-tight">{l}</a>
                </motion.li>
              ))}
              <motion.li initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: EASE }}>
                <PillLink href="/lab">Open the Lab</PillLink>
              </motion.li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
