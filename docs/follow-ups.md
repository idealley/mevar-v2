# Known gaps and follow-ups

Living list of stuff we know about and have decided to defer, with enough context to pick back up.

## Assets dead on Ghost

**Status**: goal 01 moved every mevar image and PDF off Ghost, except eight that Ghost answers 404 for (2026-09-23). Their links still point at mevar.org and die with it:

- feature image of `le-cavalier-au-cheval-blanc-du-premier-sceau-d-apocalypse`: `https://mevar.org/content/images/2022/12/quatres-cavaliers-de-l'apocalypse.jpg`. The same name with a hyphen for the apostrophe (`quatres-cavaliers-de-l-apocalypse.jpg`) answers 200 and is probably the same image; not used, unconfirmed.
- PDF links, all `https://mevar.org/content/files/2022/12/`:
  - `la_parabole_des_talents_5-=1_2014.pdf` in `la-parabole-des-talents`
  - `JUMEAUX1%20.pdf`, `JUMEAUX%202.pdf`, `JUMEAUX%203.pdf` in `les-freres-jumeaux-du-message-du-temps-de-la-fin-1`, `-2`, `-3`
  - `Bonne%20vision%20de%20la%20sanctification.pdf` in `le-sermon-sur-la-montagne-audio-5`
  - `Un%20peuple%20de%20sacrificateurs.pdf` in `un-peuple-de-sacrificateurs`
  - `LES%20PLEURS%20ET%20LES%20GRINCEMENTS%20DE%20DENTS.pdf` in `des-pleurs-et-des-grincements-de-dents`

Goal 03 removed the seven PDF links from the bodies (with the "Télécharger le document" heading above them): they pointed at a file that no longer exists. `pdf_download` still records each URL.

**Fix**: Samuel finds the files (OneDrive, Ghost admin) and drops them in `images/mevar/` and `files/mevar/`; the PDFs then get `local_pdf` next to `pdf_download`, and the work page shows the PDF button.

## Branham text the restoration could not reach

**Status**: goal 07 put back what the branham.org PDFs say in about 690 sermons. 39 French book names remain in `markdown/branham/`, listed with their context in `manifests/branham-restore-unaligned.json`: the LLM cleanup changed the words around them, so they do not align with the source.

**Fix**: a human pass over the 39, reading each against its PDF (`pdf_url`).

## 65 reads a book name inside a number or a glued prefix

**Status**: 66 and 65b refuse a book name that starts inside a number since goal 07 ("2 John" in "212 John"). 65 still accepts it, and changing that moves 47 French refs: some are wrong today ("1Jean 5:21" is recorded as "Jean 5:21", because "1Jean" is not a variant), and would simply disappear without a variant for the glued form.

**Fix**: add the glued numbered forms ("1Jean", "2Rois", …) to BOOKS_FR, then refuse a digit before a book name, and check the 47.

## French citations 65 wrote canonical, still to restore

**Status**: until goal 07, 65 rewrote every French citation it found into canonical form. Goal 15's `65c` put the source's wording back in `mevar` (from the Ghost export) and `le-scribe` (from the PDFs); what it could not align is in `manifests/french-citations-unaligned.json`. Left: the OneDrive texts (goal 10 measures them against Samuel's `.docx` and asks before its first edit), CMPP (remeasure after `goal-16-cmpp-complete.md` re-crawls its bodies), `local` (no original: Samuel, 2026-09-25, leave it), and the two posts goal 14 edits (`qui-sera-enleve`, `le-jour-du-seigneur-4-et-les-tribulations`, 293 spots).

**Fix**: after goal 14 merges, drop `WAIT` from `65c` and rerun it, then 65, 47 and 50.

## Branham page headers the PDF could not confirm

**Status**: goal 14 (PR #18) removed 11,066 printed page headers from 841 Branham bodies with `65d-strip-branham-furniture.mjs`, and the refs they produced. 135 remain, listed with their context in `manifests/branham-furniture-unaligned.json`: the LLM cleanup changed the words around them, so the PDF cannot confirm the spot (`THE THIRD Exodus 25` in 63-0630M still gives a false `Exodus 25`).

**Fix**: a human pass over the 135, reading each against its PDF (`pdf_url`), like the 39 French names above.

## Le Scribe links resting on the date alone

**Status**: goal 14 linked or explained every Le Scribe summary: 900 of 910 linked, 10 recorded as having no Branham sermon, all answers in `scripts/le-scribe-branham-decided.json`. 49 still links a summary to the only sermon of its day on the date alone (616). An audit read the 60 of those whose two texts share no Scripture chapter, or where one cites none: 55 were right, 5 were wrong and are corrected by an answer. The rest share at least one Scripture chapter with their sermon.

**Fix**: none needed now. A new Le Scribe summary linked by date alone is worth the same check (shared chapters in `bible-refs.json`, then the openings).

## The 404 page's canonical URL names no page

**Status**: `dist/404.html` has `<link rel="canonical" href="https://mevar.org/404/">`, and no `/404/` page is built. Found by goal 14's `check:dist`, which checks our own absolute URLs only when they carry a `#fragment`.

**Fix**: no canonical on the 404 page (or point it at `/`), then let `check:dist` check every absolute `https://mevar.org/` href.

## `100` keeps only the first verse group of a list

**Status**: a ref like `Mark 8:16,35` or `Hebrews 13:12,13` is one canonical string in `bible-refs.json`. `parseRef` in `100-ingest-surrealdb.mjs` reads `(?:,[\d,\-]+)?` and drops it, so the `bible_ref` record covers verse 16 only and its seeded text is incomplete. 952 of 40,602 refs carry a list (goal 07 added the "and" lists, goal 11 the French "versets 12 et 15").

**Fix**: split a list into one `bible_ref` per group at ingest (and a `cites` edge to each), or have 65/66 emit one ref per group. Needs a SurrealDB run to verify; none was available for goal 07.

## `100-ingest-surrealdb.mjs` never deletes an edge

**Symptom**: all eight edge types — `by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on` — go through the same insert-only `inChunks`. Re-ingesting after the corpus changed adds the new edges and leaves the old ones. Against `origin/main`, goal 02 removes 477 (file, reference) pairs from `manifests/bible-refs.json` (impossible chapters, the "you're" misreads, malformed ranges, and the 83 one-chapter refs that change form), so a database ingested before it keeps up to 477 stale `cites` edges; a corrected `original` link leaves both `based_on` edges, since the unique index is on `(in, out)`.

**Fix**: delete a work's outgoing edges of each type before relating the current set, or diff against what is stored. One pass over all eight types, not one type at a time. Until then, a corpus change means rebuilding the database rather than re-ingesting on top.

## Bible-ref false positives from short book names

**Symptom**: 60-odd `Esther <n>` refs in files that never mention Esther.

**Cause**: `Est` is an accepted abbreviation for Esther in `65-normalize-bible.mjs`, and `est` is the French verb. `c'est 11 heures` becomes `Esther 11`. Until goal 15 the old rewrites had also put it in the text ("son cachet c'Esther 1 million"); 65c put the words back, the false ref stays (12 works read `est <n>` today). The same shape hits `Job` (`Jb`), `Ruth`, `Amos`, `Ge`, `Ne`.

**Fix**: drop the variants that collide with common French words, or require a chapter:verse pair (not a bare chapter) for the two-letter variants. The impossible-chapter filter added in goal 02 catches only the ones above the book's chapter count.

## `npm install` fails in `web/`

**Symptom**: `ERESOLVE`: `@vite-pwa/astro@1.2.0` peers `astro@^1 || … || ^5`, the project is on `astro@6.2.2`.

**Fix**: upgrade or drop `@vite-pwa/astro`. Since goal 05, `overrides` in `web/package.json` lets `@vite-pwa/astro` take the project's astro, so `npm ci` works on the Mac and in CI (npm 10 and 11); remove it when a release supports astro 6.

## Two stubborn embedding failures

**Status**: 2 / 3,103 works failed embedding even with reduced truncation. Likely empty or anomalous bodies.

**Fix**: dump the IDs from `manifests/onedrive-llm-stats.json` style (or query `SELECT id FROM work WHERE embedding = NONE`), inspect each, decide whether to remove from corpus or hand-fix.

## chapter-only `bible_ref` records have no text

**Status**: 1,451 / 8,810 refs are chapter-only (e.g. `"Matthieu 24"`). The verse-text seeder skips these because joining all verses inline is too long.

**Fix when surfaced in UI**: lazy-fetch chapter when user hovers/expands a chapter-only citation. Build a helper `getChapterText(book_id, chapter, translation)` that pulls all verses for that chapter and returns them concatenated. Or build a `bible_chapter` materialized view in SurrealDB.

## Strong's not yet seeded

**Status**: `scripts/130-seed-strongs.mjs` exists, `scripts/120-clone-stepbible.sh` is set up.

**Fix**: run them — about 5-10 min total.

```bash
bash scripts/120-clone-stepbible.sh        # ~50 MB sparse clone
node scripts/130-seed-strongs.mjs          # parses TAGNT + TAHOT, merges Strong's into bible_ref.strong
```

## Auth not wired

See [auth.md](auth.md). Schema + skill knowledge in place; needs Logto tenant + the 7 steps documented there.

## Long search queries download megabytes

**Status**: Pagefind loads one index chunk per word. Measured on the full build (goal 05): "Zachée sycomore" costs 226 KiB; a 13-word English sentence full of common words costs 2.7 MB. The chunks are already compressed. Quoting the phrase does not help.

**Fix**: none obvious in Pagefind 1.5 (no stop words). Watch it once there is traffic; the search page is opt-in.

## The first page a reader opens is not kept offline

**Status**: the service worker installs during the first visit, after that page has loaded, so only the pages opened after it are kept in `works-pages`.

**Fix**: if it matters, have the page ask the worker to cache `location.href` once it is active (a few lines in the registration).

## CMPP translations with no Branham link

**Status**: `markdown/cmpp/` holds 107 works with `preacher: "William Branham"`, the CMPP's French translations (1954 to 1965 by frontmatter date, all filed under `cmpp/undated/`; the full Seven Seals series of March 1963 among them). None carries `original:` and no Branham file points back at them, so a reader on the English sermon does not learn that a full French translation exists, and the Branham timeline in `infographics.md` cannot count them per sermon.

**Fix**: goal 16 (`docs/goals/goal-16-cmpp-complete.md`): the same approach as `49-link-le-scribe-branham.mjs`, by date and time of day, then the English title from the booklet's title page, writing `original:` on the translation and a `translation_fr:` twin of `summary_fr` on the sermon; the linked files move out of `undated/` since the work's URL is its path. The same goal rediscovers cmpp.ch (the crawl cache and the PDFs are gone from the Mac; series 6 stops at booklet 5), cleans the three works whose LLM pass failed (`lc56`, `serie1no8`, `serie4no6`, raw bodies today) and folds the 30 layout variants (`_A4`, `_A5`, `_gc`, `_traite`) of 13 texts.

## Cross-language linking

**Idea**: when a French sermon cites `"Matthieu 24:6"` and an English Branham sermon cites `"Matthew 24:6"`, both currently land on different `bible_ref` records (`matthieu_24_6` vs `matthew_24_6`). They should resolve to the same conceptual verse.

**Fix**: collapse on `(book_canon_order, chapter, verse_start, verse_end)` rather than localized canonical string. Would also let us deduplicate the 8,810 refs down to ~5k true verses.

Defer until UX requires it (probably when surface a "verse drilldown" view).

## Series / convention grouping

**Idea**: many Branham sermons are part of named series ("Seven Seals", "Church Ages", "Marriage and Divorce"). Currently no explicit modeling — they're just sermons with similar dates and topics.

**Fix**: add a `series` table and `part_of` edge. Detect series via filename patterns (`63-0317M`, `63-0318M`, `63-0319` … and titles "The Seven Seals — Day 1").

## Annotations / personal notes

Schema has the `annotated` edge with PERMISSIONS clauses ready, but no UI. When wired:

- Anchor format: paragraph number + char offset within paragraph (preserves through edits)
- Search across user's own notes
- Optional: highlight + tag the underlying paragraph itself in their copy
