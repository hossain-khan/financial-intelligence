import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// A stable per-build identifier. Uses the CI commit SHA when present so the running build is
// traceable; otherwise a coarse date bucket keeps local builds distinguishable without embedding a
// changing value into every dev reload. Never contains user data.
const buildId =
  process.env.GITHUB_SHA?.slice(0, 12) ??
  process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) ??
  `local-${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,webmanifest,png,svg}"],
      },
      manifest: {
        name: "Financial Intelligence",
        short_name: "Fin Intelligence",
        description: "Private, offline-first personal financial analysis.",
        theme_color: "#0d3b35",
        background_color: "#f3f1e8",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2023",
    sourcemap: true,
  },
});
