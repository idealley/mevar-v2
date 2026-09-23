# GOAL 03: Nothing that works on Ghost today breaks

**Status:** ready after goal 01
**Repo:** `mevar-v2/web`
**Rules:** [README.md](README.md)

## Problem

The new site cannot replace Ghost yet, because the URLs people and Google
know would 404:

- `web/public/_redirects` says the 326 published posts keep their root URL
  (`mevar.org/<slug>/`) through `src/pages/[mevarslug].astro`, marked TODO.
  The file does not exist. Posts only render at `/works/mevar/<slug>/`.
- Post bodies contain about 1,350 absolute links to `https://mevar.org/<slug>/`.
- About 75 redirect rules point to `/themes/<slug>/`, `/auteurs/<slug>/` and
  `/annees/<year>/`. None of those pages exist, and on `/themes/` the tags
  are plain text, not links.
- The 7 drafts are built like published posts.
- No sitemap (but `/sitemap/` redirects to `/sitemap.xml`). `icon-192.png`,
  `apple-touch-icon.png` and `favicon.ico` are SVG text with the wrong
  extension.

## Design

1. **One canonical URL per work.** Ghost posts live at the root:
   `/<slug>/`. Every other source lives at `/works/<source>/<path>/`. Do not
   render mevar posts twice: `/works/mevar/<slug>/` is not generated. The
   work page template is shared (extract it from `works/[...slug].astro`,
   that is a reuse that exists today, not a speculative one).
   `a-propos` and `courage-soldat-de-christ` already have explicit pages and
   win over the dynamic route. Ghost pages `about` and `authors` are covered
   by redirects. `newsletter` renders as a normal page at `/newsletter/`; goal
   06 puts the signup form on it.
2. **Drafts.** `status: "draft"` is never built, anywhere (work pages, lists,
   counts, sitemap, search). One filter in `src/lib/works.ts`.
3. **Internal links.** Rewrite `https://mevar.org/<slug>/` (and the `www.`
   and `http://` variants) to root-relative links in the markdown, in the
   corpus, not at render time. Links to slugs that do not exist are listed in
   the PR, not silently dropped.
4. **Taxonomy pages.** `/themes/<slug>/`, `/auteurs/<slug>/`,
   `/annees/<year>/`, each a plain list of WorkCards, newest first. Slugs come
   from `manifests/mevar-tags.json` and `mevar-authors.json` so they match
   the redirect targets. Tags on `/themes/` and badges on work pages become
   links. Year and place tags stay out of `/themes/` but keep their pages.
5. **Bookmark cards.** Ghost "bookmark" cards were flattened by the import
   into one long link whose text is title plus excerpt glued together (see
   the last lines of `markdown/mevar/ce-qui-arrive-le-jour-du-seigneur.md`).
   Render internal ones as a compact "À lire aussi" card with the target's
   real title and summary. Fix it in the corpus (a clean link) and let the
   template do the card.
6. **Series and originals.** A work page that has `series:` shows the ordered
   list of parts with previous and next. A Le-Scribe summary links to its
   English original and back, if goal 02 has merged (if not, leave it out).
7. **RSS.** Ghost serves a feed at `/rss/` and readers subscribe to it. Keep
   the URL: `@astrojs/rss` at `/rss/`, the 30 newest published Ghost-source
   works, title plus summary plus link. Add "`dist/rss/index.xml` or the
   route Astro emits for `/rss/` exists and validates" to the check script.
8. **Local PDFs.** Goal 01 left the templates alone. The PDF button in
   `works/[...slug].astro` reads `pdf_url`, still mevar.org for the 69
   `mevar-pdfs` works: read `local_pdf` first (goal 01 set it next to every
   downloaded `pdf_url` and `pdf_download`).
9. **Housekeeping.** `@astrojs/sitemap`. Real PNG and ICO icons generated
   from `public/brand/logo.svg`. `og:image` from `local_image`. Canonical
   link tag on every page.

## Scope out

- Search (goal 05). Visual redesign. Any pedagogical layer ("start here"
  paths): that is v1.1 and deserves its own discussion with Samuel.
- Verse popovers, annotations, auth.

## Acceptance evidence

- A check script, committed, run against `web/dist/` after a full build:
  - every published Ghost post slug in `manifests/mevar.json` has
    `dist/<slug>/index.html`, and no draft slug does;
  - every target in `public/_redirects` exists in `dist/`;
  - every internal `href` in every built page resolves to a file in `dist/`
    (zero broken internal links, the number of links checked is printed).
- `grep -r "https\?://\(www\.\)\?mevar\.org/" markdown/mevar --include=*.md`
  only matches frontmatter provenance fields (`url:`, `stream_url:`,
  `feature_image:`, `pdf_url:`, `pdf_download:`).
- `dist/sitemap-index.xml` exists and lists no draft and no `/works/mevar/`.
- `file web/public/brand/icon-192.png` says PNG.
- Build time and peak memory of the full-corpus build, reported. They are
  inputs for goal 05.
