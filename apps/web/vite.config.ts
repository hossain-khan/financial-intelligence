import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,webmanifest}"],
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
      },
    }),
  ],
  build: {
    target: "es2023",
    sourcemap: true,
  },
});
