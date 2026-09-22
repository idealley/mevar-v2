# GOAL 05: Search, Cloudflare Pages, and a page weight fit for Africa

**Status:** ready after goals 01 and 03
**Repo:** `mevar-v2` (`web/`, `.github/workflows/`)
**Rules:** [README.md](README.md)
**Reference:** `~/projects/firstprinciple/.github/workflows/deploy.yml` and
`DEPLOY.md` there. Same method (GitHub Actions builds, `wrangler pages deploy`
pushes `dist/`), copied and reduced to one site. Nothing is shared between the
two repos.

## Problem

The site builds only on Samuel's Mac, search is a placeholder page, and
nothing has been measured against the readers we actually have: most visits
come from Africa, on phones, on slow and metered connections.

One existing setting is dangerous for them. `astro.config.mjs` gives Workbox
`globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"]`. With the full
corpus that precaches every one of the 3,000+ HTML pages and every image on a
visitor's first visit: hundreds of megabytes pulled in the background on a
metered phone.

## Design

1. **PWA precache is the shell only.** Precache CSS, JS, icons, the home page
   and the offline fallback. Pages and images stay on the runtime caches that
   are already configured (`works-pages`, `images`), extended to the root post
   URLs from goal 03. Offline reading then means "what you opened stays
   readable", which is the right promise.
2. **Pagefind.** Index at build time (`pagefind --site dist`), French
   stemming from `<html lang="fr">` (English Branham pages get
   `lang="en"` on the article element so they are indexed as English).
   Index only the article body plus title, preacher, year, source as
   filters. `/recherche/` loads the Pagefind UI on interaction, not on page
   load. Drafts are not in `dist/`, so they are not indexed.
3. **Budget, measured on the built site.**
   - A sermon page over the wire, first visit: under 150 KB excluding the
     feature image, zero blocking third-party requests, no web fonts (already
     true, keep it).
   - JS on a reading page: only what the PWA registration needs. Svelte
     islands load on the pages that use them.
   - Home and category pages: lists are paginated or capped so no list page
     ships more than 60 cards of HTML. `/predications/` with 2,000+ sermons in
     one page is not acceptable.
   - Images: `loading="lazy"`, explicit `width` and `height`, WebP from
     goal 01.
4. **Cloudflare Pages limits, checked by script after the build:** fewer than
   20,000 files in `dist/` (free plan limit; pages plus Pagefind fragments
   will be the bulk), no file over 25 MiB. If the file count is over, first
   lever is Pagefind's fragment settings, second is excluding a source from
   search, and it goes back to Samuel before anything is dropped.
5. **Deploy workflow.** `.github/workflows/deploy.yml`: on push to `main`
   touching `web/**`, `markdown/**`, `images/**`, `files/**`; Node 22;
   `npm ci` and `npm run build` in `web/`; Pagefind; the limit check; then
   `wrangler pages deploy dist --project-name=mevar`. Secrets:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. The build needs an 8 GB
   heap today and a private-repo GitHub runner has about 7 GB of RAM: measure
   first. If it does not fit after the obvious fix (goal 03 removes the
   duplicate mevar pages; scope the content collection to frontmatter where
   lists only need frontmatter), the v1 deploy is
   `npm run deploy` from the Mac and the workflow waits. Do not build a
   sharded build system.
6. **`DEPLOY.md`** at the repo root: the one-time Cloudflare setup (Pages
   project `mevar`, API token scope, the two GitHub secrets), the cutover
   checklist below, and the rollback (point DNS back to Ghost).

## Cutover checklist (written by the agent, executed by Samuel)

1. Preview deployment on `mevar.pages.dev` is green and passes goal 03's
   link check run against the live preview URL.
2. Final Ghost export imported with the additive script (goal 02); assets
   downloaded (goal 01).
3. Custom domain `mevar.org` and `www` added to the Pages project, DNS
   switched.
4. Spot check ten old URLs from Google results, the RSS or newsletter links
   in recent emails, and one PDF link.
5. Ghost stays up but unlinked for 30 days, then is cancelled.

Ghost also sends the newsletter. Decided 2026-09-20: it moves to Resend
([goal 06](goal-06-email-on-resend.md)). Step 5 does not start until goal
06's cutover order is complete: form live, members imported, first broadcast
sent from Resend.

## Scope out

- Hosted SurrealDB, semantic search, auth. Analytics (decide separately;
  if any, Cloudflare Web Analytics, which needs no cookie banner).
- The pedagogical layer ("par où commencer", guided series): next discussion.

## Acceptance evidence

- Workbox precache manifest in `dist/sw.js`: entry count and total size
  reported, under 1 MB.
- `/recherche/` finds a French sermon by a phrase from its body, a Branham
  sermon by an English phrase, and filters by preacher. Size of
  `dist/pagefind/` reported.
- Lighthouse mobile (simulated slow 4G) on the home page, one Ghost post, one
  Branham sermon: performance 90+, the three reports attached. Transfer size
  per page reported.
- Limit check output: file count and largest file.
- A deploy from a branch produces a working `*.mevar.pages.dev` preview, or
  the report states why CI cannot build yet and shows the Mac deploy working.
- `DEPLOY.md` exists and a person who has never seen the repo could follow it.

## Stop points

Creating the Pages project, creating the API token, adding GitHub secrets,
adding the custom domain, DNS, and anything about Ghost billing or members:
Samuel. Prepare, document the exact clicks, stop.
