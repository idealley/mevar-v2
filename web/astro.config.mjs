// @ts-check
import { defineConfig } from "astro/config";

import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://mevar.org",
  trailingSlash: "always",
  integrations: [
    svelte(),
    AstroPWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.ico", "brand/logo.svg", "brand/icon-192.png", "brand/icon-512.png"],
        manifest: {
          name: "Mevar",
          short_name: "Mevar",
          description: "Étude de la Parole pour le temps de la fin",
          start_url: "/",
          display: "standalone",
          background_color: "#fafaf9",
          theme_color: "#1c1917",
          lang: "fr",
          icons: [
            { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              // Markdown work pages — cache-first for offline reading after first visit
              urlPattern: ({ url }) => url.pathname.startsWith("/works/"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "works-pages",
                expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              // Mevar feature images
              urlPattern: ({ url }) => url.pathname.startsWith("/images/"),
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 },
              },
            },
          ],
        },
      }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
