# GOAL 43: every redirect is served

**Status:** not started.
**Repo:** `mevar-v2` (`web/public/_redirects`, `web/scripts/check-dist.mjs`)
**Rules:** [README.md](README.md)

## Problem

276 of the 380 rules in `dist/_redirects` are not served. Pages allows 100
dynamic redirects (a placeholder or a splat) and 2,000 static ones, and
"static redirects should appear before dynamic redirects"
(`pages/configuration/redirects.mdx`): every rule below the first dynamic
one counts as dynamic. The fifth rule of `web/public/_redirects` is
dynamic:

```
/authors/:slug/        /auteurs/:slug/           301
```

so rules 5 to 104 are served and 105 to 380 are dropped. Those are goal
09's duplicate redirects, which the build appends (`astro.config.mjs`,
`duplicateRedirects`): URLs public since goal 05 that now answer 404. On
`mevar.pages.dev`, 2026-10-30:

| Rule | Path | Status |
| ---- | ---- | ------ |
| 104 | `/works/mevar-pdfs/exhortation_fin_mars_2022_la_peur_de_satan/` | 301 |
| 105 | `/works/mevar-pdfs/exhortation_septembre_2019_braver_la_grande_foule/` | 404 |
| 200 | `/works/cmpp/undated/quanddieu/` | 404 |
| 380 | `/works/onedrive/pdf/publication-verified/zele/` | 404 |

`wrangler pages dev` says it: "Maximum number of dynamic rules supported is
100. Skipping remaining 277 lines of file." `check:dist` checks that every
target exists, not that Pages serves the rule. Found by goal 42's review;
`docs/follow-ups.md` « Most of `_redirects` is not served ».

## Design

1. **No dynamic rule.** `/authors/:slug/` becomes one static rule per Ghost
   author, the six of `manifests/mevar-authors.json` (`parfait-mbra`,
   `samuel`, `stephane-pouyt`, `andre-kadjany`, `pierre-kouadio`, `irie`),
   each `/authors/<slug>/  /auteurs/<slug>/  301`. Ghost has no new author
   before it is switched off. 385 static rules, under the 2,000.
2. **`check:dist` fails when Pages would drop a rule:** more than 100 rules
   from the first one whose source has `:` or `*`, counted as Pages counts
   them. Its `:slug` expansion of the targets (`authors`, the `flatMap`)
   then has no use and goes.
3. Remove the follow-up entry from `docs/follow-ups.md` (added by PR #58)
   once it is on `main`.

## Scope out

- `scripts/94-relink-mevar-urls.mjs` reads `_redirects` with a `:slug`
  branch; it has run, and static rules still match it. Unchanged.
- Moving the duplicates to Bulk Redirects or a Function: 385 rules are far
  from the limit.

## Acceptance evidence

- The new `check:dist` rule on `main`'s `dist/` (before the fix): fails,
  naming the count. On the branch: passes.
- `npm run build`, `npm run check:dist`, `npm run check:limits` pass.
- `wrangler pages dev dist` prints no "Skipping".
- On the branch preview (`<branch>.mevar.pages.dev`), `curl` of the source
  of every rule in `dist/_redirects`: each answers its status (301, or 200
  for `/rss/`) and its target; 0 answer 404. The six `/authors/<slug>/`
  answer 301 to `/auteurs/<slug>/`.

## Stop points

- A rule whose target `check:dist` reports missing: stop and report, do not
  delete it.
