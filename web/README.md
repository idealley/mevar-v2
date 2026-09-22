# mevar.org — the site

Astro, static output. Every page is built from `markdown/` at the repo root;
there is no database and no server at request time. Most visits come from
Africa, so pages stay light and cache well.

## Run it

```sh
npm install          # in this directory, not at the repo root
npm run dev          # localhost:4321, mevar posts only (fast)
npm run dev:all      # the full corpus, about 3,100 works — slow to start
npm run build        # static site into ./dist/
npm run preview      # serve ./dist/ as it will be served in production
```

`npm run dev` sets `CONTENT_SOURCES=mevar`; `npm run build` raises Node's heap
to 8 GB because the full corpus does not fit in the default.

## Where things are

- `src/pages/` — one file per route, plus `works/` for the corpus itself
- `src/components/`, `src/layouts/` — Astro and Svelte components
- `src/content.config.ts` — how `markdown/` is loaded into content collections
- `public/` — static assets served as-is

A change to the corpus means rerunning the pipeline scripts at the repo root,
not editing anything here.
