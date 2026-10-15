import { useEffect, useState } from "react";

/** Two routes ("/" and "/lab"); Cloudflare Pages serves index.html for unknown paths (SPA fallback). */
export function navigate(to: string) {
  if (to === location.pathname + location.search + location.hash) return;
  history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return path;
}
