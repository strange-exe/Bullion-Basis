import { useEffect, useRef, useState } from "react";

/** Width of an element, kept current with ResizeObserver (charts redraw on resize). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Theme stored per viewer; dark unless they chose light. */
export function useTheme() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === "light");
  useEffect(() => {
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("gsl-theme", light ? "light" : "dark"); } catch { /* storage blocked */ }
  }, [light]);
  return [light, setLight] as const;
}
