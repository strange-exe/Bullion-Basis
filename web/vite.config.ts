import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The same security headers Cloudflare Pages serves (public/_headers), applied to `vite preview`
// so local tests run under the production CSP.
const headers = Object.fromEntries(
  readFileSync(new URL("./public/_headers", import.meta.url), "utf8")
    .split(/\r?\n/).slice(1).map((l) => l.trim()).filter((l) => l && !l.startsWith("/"))
    .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])
    .filter(([k]) => k !== "Cache-Control"),
);

// Production (SECURITY.md section 4): no public source maps, opaque hashed asset names, console and
// debugger stripped. Vite 8 options: build.rolldownOptions and Oxc's compress.drop* (vite.dev/guide/migration).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { headers },
  build: {
    sourcemap: false,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        entryFileNames: "a/[hash].js",
        chunkFileNames: "a/[hash].js",
        assetFileNames: "a/[hash][extname]",
        minify: { compress: { dropConsole: true, dropDebugger: true } },
      },
    },
  },
});
