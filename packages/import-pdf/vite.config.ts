import { defineConfig } from "vite";

/**
 * The worker bundle contains only our own code. pdfjs-dist is intentionally left external and
 * dynamically imported at runtime (`load-pdfjs.ts`), so the vendored PDF.js source — which contains
 * `fetch`/`eval`/`Worker` strings even when configured off — never enters this bundle and the
 * forbidden-string budget check can stay meaningful over code we control.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: new URL("./src/worker.ts", import.meta.url).pathname,
      external: [/^pdfjs-dist(\/.*)?$/u],
      output: {
        entryFileNames: "pdf-import-worker.js",
      },
    },
  },
});
