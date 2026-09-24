// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { slug } from "github-slugger";
import fs from "node:fs";
import { rehypeBookmarks } from "./src/lib/bookmarks.mjs";
import { rehypeBodyImages } from "./src/lib/body-images.mjs";

// A duplicate (goal 09: `duplicate_of: "<source>/<path>"`) is not built; its
// URL, public since goal 05, answers 301 to the work it duplicates. The rules
// go after goal 03's in dist/_redirects; check-dist checks every target.
// A work's URL is its path slugged segment by segment, as Astro's glob loader
// makes the entry id (src/lib/works.ts, workUrl).
const workUrl = (p) =>
  p.startsWith("mevar/") ? `/${p.slice("mevar/".length)}/` : `/works/${p.split("/").map((s) => slug(s)).join("/")}/`;
const duplicateRedirects = {
  name: "duplicate-redirects",
  hooks: {
    "astro:build:done": ({ dir }) => {
      const rules = [];
      for (const rel of fs.readdirSync("../markdown", { recursive: true })) {
        if (!rel.endsWith(".md")) continue;
        const target = fs.readFileSync(`../markdown/${rel}`, "utf8").match(/^duplicate_of: "(.+)"$/m)?.[1];
        if (target) rules.push(`${workUrl(rel.slice(0, -".md".length))}  ${workUrl(target)}  301`);
      }
      fs.appendFileSync(new URL("_redirects", dir), `\n# ─── Duplicates (goal 09), generated at build ───\n${rules.join("\n")}\n`);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: "https://mevar.org",
  trailingSlash: "always",
  markdown: { rehypePlugins: [rehypeBookmarks, rehypeBodyImages] },
  integrations: [
    duplicateRedirects,
    svelte(),
    sitemap(),
    AstroPWA({
      registerType: "autoUpdate",
      // What every page shows. The manifest icons are fetched by the browser
      // when a reader installs the app, not precached (icon-512 is 85 KB).
      includeAssets: ["favicon.svg", "favicon.ico", "brand/logo.svg"],
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
          // The shell only, and no JS: no page loads an island today, and an
          // island's JS comes with the page that uses it. Pages and images
          // are cached when a reader opens
          // them, never in bulk: the full corpus is 3,000+ pages, and our
          // readers are on metered phones.
          globPatterns: ["_astro/*.css", "index.html", "hors-ligne/index.html"],
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
