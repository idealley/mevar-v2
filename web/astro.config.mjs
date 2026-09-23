// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { rehypeBookmarks } from "./src/lib/bookmarks.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://mevar.org",
  trailingSlash: "always",
  markdown: { rehypePlugins: [rehypeBookmarks] },
  integrations: [
    svelte(),
    sitemap(),
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
          // The shell only. Pages and images are cached when a reader opens
          // them, never in bulk: the full corpus is 3,000+ pages, and our
          // readers are on metered phones.
          globPatterns: ["_astro/*.{js,css}", "index.html", "hors-ligne/index.html", "brand/*.{svg,png}"],
          // The plugin defaults this to "/", which would answer every
          // navigation with the home page once pages are not precached.
          navigateFallback: null,
          runtimeCaching: [
            {
              // Every page a reader opens stays readable offline. A page never
              // opened falls back to /hors-ligne/ when the network is down.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "works-pages",
                expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
                plugins: [
                  { handlerDidError: async () => caches.match("/hors-ligne/", { ignoreSearch: true }) },
                ],
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
