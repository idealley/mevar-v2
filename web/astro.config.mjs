// @ts-check
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { slug } from "github-slugger";
import fs from "node:fs";
import { rehypeBibleLinks } from "./src/lib/bible-links.mjs";
import { rehypeBookmarks } from "./src/lib/bookmarks.mjs";
import { rehypeBodyImages } from "./src/lib/body-images.mjs";
import { rehypeFrenchTypography } from "./src/lib/french-typography.mjs";

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
        const text = fs.readFileSync(`../markdown/${rel}`, "utf8");
        const frontmatter = text.slice(0, text.indexOf("\n---\n", 4));
        const target = frontmatter.match(/^duplicate_of: ["']?([^"'\n]+)["']?$/m)?.[1];
        // A draft is not built and nothing leads to it: no rule from a draft, none to one.
        const draft = (t) => /^status: ["']?draft["']?$/m.test(t.slice(0, t.indexOf("\n---\n", 4)));
        if (target && !draft(text) && !draft(fs.readFileSync(`../markdown/${target}.md`, "utf8"))) rules.push(`${workUrl(rel.slice(0, -".md".length))}  ${workUrl(target)}  301`);
      }
      fs.appendFileSync(new URL("_redirects", dir), `\n# ─── Duplicates (goal 09), generated at build ───\n${rules.join("\n")}\n`);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: "https://mevar.org",
  trailingSlash: "always",
  markdown: { rehypePlugins: [rehypeBookmarks, rehypeBodyImages, rehypeBibleLinks, rehypeFrenchTypography] },
  integrations: [
    duplicateRedirects,
    sitemap(),
    AstroPWA({
      registerType: "autoUpdate",
      // What every page shows. The manifest icons are fetched by the browser
      // when a reader installs the app, not precached (icon-512 is 85 KB).
      includeAssets: ["favicon.svg", "favicon.ico", "brand/logo.svg", "brand/logo-white.svg"],
        manifest: {
          name: "Mevar",
          short_name: "Mevar",
          description: "Étude de la Parole pour le temps de la fin",
          // the app is the site at this address, whatever page it starts on
          id: "/",
          start_url: "/",
          display: "standalone",
          background_color: "#fbfaf8",
          theme_color: "#141110",
          lang: "fr",
          icons: [
            { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
            // Android crops this one to its own shape: the eagle keeps to the
            // middle 60%, inside the circle every shape leaves
            { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          // the home page, shown by the browser when it offers the installation
          screenshots: [
            { src: "/brand/screenshot-narrow.jpg", sizes: "780x1688", type: "image/jpeg", label: "La page d’accueil" },
            { src: "/brand/screenshot-wide.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "La page d’accueil" },
          ],
        },
        workbox: {
          // The shell only: the stylesheet, the few small scripts a page
          // loads (a text's reading tools, « Mes lectures »), the home page,
          // and « Mes lectures », where the offline page sends the reader.
          // Pages and images are cached when a reader opens them, never in
          // bulk: the full corpus is 3,000+ pages, and our readers are on
          // metered phones.
          globPatterns: ["_astro/*.{css,js}", "index.html", "hors-ligne/index.html", "mes-lectures/index.html"],
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
              // The three typefaces, each kept once a page has used it
              urlPattern: ({ url }) => url.pathname.startsWith("/fonts/"),
              handler: "CacheFirst",
              options: { cacheName: "fonts" },
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
