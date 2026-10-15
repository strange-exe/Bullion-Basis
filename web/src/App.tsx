import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { usePath } from "./router";
import Story from "./pages/Story";

const Lab = lazy(() => import("./pages/Lab"));

export default function App() {
  const path = usePath();
  return (
    // "user": every Motion animation follows the viewer's reduced-motion setting.
    <MotionConfig reducedMotion="user">
      {path.startsWith("/lab")
        ? <Suspense fallback={<div className="min-h-[100dvh] bg-ink" aria-busy="true" />}><Lab /></Suspense>
        : <Story />}
    </MotionConfig>
  );
}
