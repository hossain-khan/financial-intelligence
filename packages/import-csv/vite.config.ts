import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: new URL("./src/worker.ts", import.meta.url).pathname,
      output: {
        entryFileNames: "csv-import-worker.js",
      },
    },
  },
});
