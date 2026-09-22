# GOAL 02: Close the corpus and pipeline gaps

**Status:** ready to dispatch
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, `markdown/`, `docs/`)
**Rules:** [README.md](README.md)

## Problem

The corpus is good, but the pipeline has traps that already bit once (the
2026-09-20 import of one new Ghost post had to be done by hand in a scratch
copy), and some data the site needs is missing or wrong.

## Work items

1. **Ghost import becomes additive.** `45-process-ghost.mjs` hardcodes
   `mevar.ghost.2026-04-30-20-28-29.json` and deletes `markdown/mevar/` before
   regenerating. Change it to: take the export path as `argv[2]`, default to
   the newest `mevar.ghost.*.json` at the repo root; write only slugs that do
   not exist yet; print the slugs whose Ghost `updated_at` is later than the
   file on disk so a human can decide. Never delete. Until Ghost is retired,
   Ghost remains where new articles are written; existing markdown is ours.
   Same `argv` default for `48-detect-series.mjs`.
2. **Series detection has false positives.** `48-detect-series.mjs` treats
   every Ghost bookmark card as a series edge and takes connected components.
   A "see also" card is not a series. Proof: the series
   `l-eveil-de-l-homme-spirituel-pour-le-combat-spirituel` contains "Nouveau
   site web" (an announcement that links to several articles), and the
   September 2026 post would have joined it as "part 3". Fix the rule (a
   series needs a shared title stem or explicit part markers, not only a
   link), rerun, and review the full list in `manifests/mevar-series.json` by
   eye: every series must be one a reader would recognize. Then give
   `ce-qui-arrive-le-jour-du-seigneur` its correct series fields, if any.
3. **`65-normalize-bible.mjs <target>` destroys `bible-refs.json`.** With a
   target it rewrites the manifest with only the target's refs. Make a
   targeted run merge into the existing file. Same check for `66`.
4. **Impossible Bible references.** "Sophonie 155" style refs come from a
   book name followed by a paragraph number. Hardcode max chapter per book
   (and max verse 176) in `65` and `66`, drop what exceeds it. Report how many
   refs disappear (expected 50 to 100).
5. **English refs coverage.** Only 442 of 1,206 Branham files have refs,
   because `66` ran before the LLM cleanup. Rerun `66`, then `47` to lift the
   refs into frontmatter. Expected: close to 1,200 files with refs.
6. **Le-Scribe to Branham link (missing today).** The `based_on` edge in
   `100-ingest-surrealdb.mjs` only links onedrive duplicates to mevar posts.
   The 910 French Le-Scribe summaries are not linked to the English sermon
   they summarize, despite the architecture diagram. Both ids start with the
   sermon date (`630112aInfluence` and `63-0112`). Measured: 618 Le-Scribe
   files have exactly one Branham sermon that day, 271 share the day with
   others (disambiguate with the a/b/c suffix and "matin / soir" in the
   subtitle against Branham's M/A/E suffix), 21 have no Branham sermon that
   day. Write the link into frontmatter on both sides (`original:
   "branham/1963/63-0112"` on the summary, `summary_fr: "le-scribe/1963/..."`
   on the sermon), and build the `based_on` edge from it. Unresolved cases go
   in a short manifest, not guessed.
7. **Rebuild `index.json`.** It predates the frontmatter lifts (about 2,200
   entries have stale sizes) and misses the newest post. Run `50` last.
8. **Docs tell the truth.** `docs/follow-ups.md` still says "No Astro
   frontend yet"; remove what is done, keep what is open. Replace the Astro
   template text in `web/README.md` with ten lines on how to run and build
   the site. Update the counts in the root `README.md`. Move the Ghost export
   instruction to "drop the export at the repo root".

## Scope out

- Hosted SurrealDB, auth, annotations, Strong's seeding, cross-language
  verse collapsing. They stay in `docs/follow-ups.md`.
- Any LLM re-cleaning of sources.

## Acceptance evidence

- Running `45` on the 2026-09-20 export changes nothing (`git status` clean)
  and prints zero new slugs. Running it on a copy of the export with one fake
  extra post writes exactly one file.
- `manifests/mevar-series.json` no longer contains "nouveau-site-web". The
  PR lists every series with its members for Samuel to skim.
- `node scripts/65-normalize-bible.mjs markdown/mevar/<one file>` leaves the
  key count of `bible-refs.json` unchanged or plus one.
- No ref in `bible-refs.json` has a chapter above its book's maximum.
- Branham files with `bible_refs:` in frontmatter: before and after counts.
- Le-Scribe files with `original:`: count, plus the unresolved list. Ten
  random pairs checked by title and date in the PR.
- `index.json` has one entry per markdown file (3,106 on 2026-09-20).
- For every script touched: second run is a no-op.
