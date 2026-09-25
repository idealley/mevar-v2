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

## The French sources still carry 65's canonical rewrites

**Status**: goal 14, [`docs/goals/goal-14-french-citations-as-written.md`](goals/goal-14-french-citations-as-written.md), ready to dispatch (Mevar posts, Le Scribe, CMPP). The OneDrive texts are goal 10's (its stop points).

**Dispatch text**, to paste as the opening message of a fresh session started in `~/projects/mevar-v2`:

```
Read AGENTS.md, VISION.md, DELIVERY.md, docs/goals/README.md, then the goal
file named below, in that order. Follow DELIVERY.md exactly: worktree from
origin/main, npm install on this Mac at the root and in web/, atomic
Conventional Commits, the gates for what you touch, the independent
subagent review with the prompt given there, then a non-draft PR with
`gh pr create` whose description opens with the problem and lists every
acceptance item with the command you ran and its output. Do not merge. Stop
at the stop points. End with the report DELIVERY.md asks for.

Goal file: docs/goals/goal-14-french-citations-as-written.md. Branch:
goal-14-french-citations-as-written.

Goal 10 runs at the same time on the OneDrive and PDF texts: never touch
them. If main moves, merge it and rerun the scripts that write
manifests/bible-refs.json and index.json; never hand-merge those files.

The Ghost export is manifests/mevar.ghost.2026-09-20-19-24-38.json
(gitignored, in the main checkout).

After the independent review says ACCEPT, run the codex-second-opinion
skill (.claude/skills/codex-second-opinion): gpt-6-astra on 65c,
gpt-6-sol on the data with the goal's acceptance commands.
```
## Printed page furniture is inside the sermon bodies

**Status**: goal 13, [`docs/goals/goal-13-furniture-footnotes-le-scribe.md`](goals/goal-13-furniture-footnotes-le-scribe.md), ready to dispatch in parallel with goal 10. Its three items: this furniture (and the running headers 66 records as refs), the broken footnote links of two Ghost posts, and the 94 Le Scribe summaries with no Branham link.

**Dispatch text**, to paste as the opening message of a fresh session started in `~/projects/mevar-v2`:

```
Read AGENTS.md, VISION.md, DELIVERY.md, docs/goals/README.md, then the goal
file named below, in that order. Follow DELIVERY.md exactly: worktree from
origin/main, npm install on this Mac at the root and in web/, atomic
Conventional Commits, the gates for what you touch, the independent
subagent review with the prompt given there, then a non-draft PR with
`gh pr create` whose description opens with the problem and lists every
acceptance item with the command you ran and its output. Do not merge. Stop
at the stop points. End with the report DELIVERY.md asks for.

Goal file: docs/goals/goal-13-furniture-footnotes-le-scribe.md. Branch:
goal-13-furniture-footnotes-le-scribe.

Goal 10 runs at the same time on the OneDrive and PDF texts: never touch
them. If main moves, merge it and rerun the scripts that write
manifests/bible-refs.json and index.json; never hand-merge those files.

Order of work: item 2 first (two posts and check-dist), then item 1, then
item 3's decisions file. The Branham PDFs are in pdfs/branham/ of the
goal-07 worktree, or fetch them with 20-download-pdfs.mjs. The furniture
diff touches hundreds of Branham files: never read it file by file; prove
it with the counts and the word-diff sample the goal asks for.

After the independent review says ACCEPT, run the codex-second-opinion
skill (.claude/skills/codex-second-opinion): gpt-6-astra on the stripping
script, gpt-6-sol on the data with the goal's acceptance commands.
```
## `100` keeps only the first verse group of a list

**Status**: a ref like `Mark 8:16,35` or `Hebrews 13:12,13` is one canonical string in `bible-refs.json`. `parseRef` in `100-ingest-surrealdb.mjs` reads `(?:,[\d,\-]+)?` and drops it, so the `bible_ref` record covers verse 16 only and its seeded text is incomplete. 952 of 40,602 refs carry a list (goal 07 added the "and" lists, goal 11 the French "versets 12 et 15").

**Fix**: split a list into one `bible_ref` per group at ingest (and a `cites` edge to each), or have 65/66 emit one ref per group. Needs a SurrealDB run to verify; none was available for goal 07.

## `100-ingest-surrealdb.mjs` never deletes an edge

**Symptom**: all eight edge types — `by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on` — go through the same insert-only `inChunks`. Re-ingesting after the corpus changed adds the new edges and leaves the old ones. Against `origin/main`, goal 02 removes 477 (file, reference) pairs from `manifests/bible-refs.json` (impossible chapters, the "you're" misreads, malformed ranges, and the 83 one-chapter refs that change form), so a database ingested before it keeps up to 477 stale `cites` edges; a corrected `original` link leaves both `based_on` edges, since the unique index is on `(in, out)`.

**Fix**: delete a work's outgoing edges of each type before relating the current set, or diff against what is stored. One pass over all eight types, not one type at a time. Until then, a corpus change means rebuilding the database rather than re-ingesting on top.

## Bible-ref false positives from short book names

**Symptom**: 60-odd `Esther <n>` refs in files that never mention Esther.

**Cause**: `Est` is an accepted abbreviation for Esther in `65-normalize-bible.mjs`, and `est` is the French verb. `c'est 11 heures` becomes `Esther 11`. The same shape hits `Job` (`Jb`), `Ruth`, `Amos`, `Ge`, `Ne`.

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
