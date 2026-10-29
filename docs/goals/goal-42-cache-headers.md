# GOAL 42: a file that cannot change is kept

**Status:** not started.
**Repo:** `mevar-v2` (`web/public/_headers`, new)
**Rules:** [README.md](README.md)

## Problem

On 2026-10-29 the zone answered 37,008 requests. The static files a page
loads were never served from the edge cache, and phones were asked to check
them again every four hours:

| Requests | What | `cf-cache-status` |
| -------- | ---- | ----------------- |
| 13,526 | HTML pages | `DYNAMIC` (expected; Pages serves them) |
| 9,916 | Cloudflare's own Early Hints lookups, answered 504 | `MISS` |
| 5,975 | Pagefind's index, fragment and filter files, 260 MB | `DYNAMIC` |
| 3,898 | CSS, JS, fonts, images | `REVALIDATED` |
| 47 | everything else | `HIT` |

Two causes:

- **Pages sends `Cache-Control: public, max-age=0, must-revalidate` for
  every file.** The edge keeps the file but asks Pages again on each
  request (`REVALIDATED`, three times in a row for
  `/fonts/inter-tight.woff2`). The zone's Browser Cache TTL raises it to
  four hours for the browser, so a phone asks again every four hours for a
  stylesheet whose name changes when its content does.
- **Cloudflare caches by file extension, and `.pf_index`, `.pf_fragment`,
  `.pf_filter`, `.pf_meta` and `.pagefind` are not on its list.** Every
  search downloads its index files from Pages again. Samuel's cache rule
  (below) makes them cacheable; this goal says for how long.

## Design

1. **`web/public/_headers`**, copied to `dist/` by the build:

   | Path | `Cache-Control` | Why |
   | ---- | --------------- | --- |
   | `/_astro/*` | `public, max-age=31536000, immutable` | Vite puts a content hash in each name. |
   | `/pagefind/index/*`, `/pagefind/fragment/*`, `/pagefind/filter/*`, `/pagefind/pagefind.*.pf_meta` | `public, max-age=31536000, immutable` | Pagefind names these by a hash of their content. |
   | `/fonts/*` | `public, max-age=604800` | Stable names; they change about once a year. |
   | `/images/*`, `/brand/*` | `public, max-age=86400` | Stable names: a replaced image is seen within a day. |

   Everything else keeps Pages' default: HTML, `sw.js`, `registerSW.js`,
   `manifest.webmanifest`, `pagefind.js`, `pagefind-entry.json`,
   `wasm.*.pagefind` and the Pagefind UI files. Their names do not change
   with their content.
2. **Check the hash claim before relying on it.** For Pagefind, from its
   source or documentation: a fragment, index, filter or meta file's name
   is derived from its content, so a name never stands for two contents.
   Two builds of the same corpus: every name present in both has the same
   bytes in both.
3. **Check the `_headers` syntax against the Pages documentation**, in
   particular a splat in the middle of `/pagefind/pagefind.*.pf_meta`, and
   that no other rule adds a second `Cache-Control` to the same path (Pages
   joins them).

## Samuel's part, outside the repo

The zone cache rules, one ruleset in the `http_request_cache_settings`
phase (`cf rulesets account-rulesets phases update`, or Caching → Cache
Rules in the dashboard):

- `files.mevar.org`: eligible for cache, edge TTL 30 days, browser TTL
  1 day.
- `mevar.org` paths starting with `/pagefind/`: eligible for cache, edge
  and browser TTL from the origin, which is this goal's `_headers`.

The second rule is safe before this goal merges: with Pages' default
headers the edge only revalidates.

## Scope out

- **HTML in the zone cache.** A deploy does not purge the zone cache, so a
  reader would see a page from before the deploy. Unlock event: a purge
  step in `deploy.yml`, with its own goal.
- **Early Hints.** The 9,916 lookups are Cloudflare's own, cost a reader
  nothing and only lower the dashboard's percentage. The HTML has no
  `preload` link for Pages to turn into a hint.
- **`files.mevar.org`'s headers.** R2 objects; the cache rule covers them.
- The service worker's caching (`astro.config.mjs`), which keeps a
  reader's opened pages offline and is unchanged.

## Acceptance evidence

- Item 2's two checks: the source or documentation line, and the count of
  common names whose bytes differ (0).
- `npm run build`, then `dist/_headers` exists, and `npm run check:dist`
  and `npm run check:limits` pass.
- On the branch preview (`<branch>.mevar.pages.dev`), `curl -sI` of one
  file per row of the table shows its `Cache-Control`, and `/`, `/sw.js`,
  `/pagefind/pagefind.js` and `/pagefind/pagefind-entry.json` still show
  `max-age=0, must-revalidate`.
- After the merge (a landing check): on `mevar.org`, the second request of
  a CSS file, a font and a `.pf_index` file answers `cf-cache-status: HIT`
  (the last one needs Samuel's rule). The next full day's request count by
  `cacheStatus`, from the zone's GraphQL analytics, in the Status line next
  to the table above.

## Stop points

- A Pagefind name that stands for two contents across two builds: stop
  and report; its row leaves the table.
- `_headers` in `dist/` changes a header of a page or of `sw.js`: stop.
- The zone's cache rules are Samuel's; this goal changes none.
