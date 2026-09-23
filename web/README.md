# mevar.org: the site

Astro, static output, built from `markdown/` at the repo root. No database, no server at request time.

```sh
npm install        # in this directory
npm run dev        # localhost:4321, mevar posts only (fast)
npm run dev:all    # the full corpus, about 3,100 works (slow)
npm run build      # ./dist/, full corpus, 8 GB heap: the gate
npm run preview    # serve ./dist/ as production will
```

Routes are in `src/pages/`; `src/content.config.ts` loads `markdown/`. To change the corpus, rerun the pipeline scripts at the repo root; nothing here.
