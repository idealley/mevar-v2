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

## 65 does not read "<Livre>, chapitre N"

**Status**: goal 07 taught 66 the spoken English forms ("Saint John the 4th chapter"); 65 has no French equivalent. "Nous allons lire dans 2 Corinthiens, chapitre 3" records nothing. Measured 2026-09-24: 1,560 such spots in 479 French files, about 1,000 with no matching ref. The landing check of goal 07 made one visible: `le-ministere-de-lesprit` had `2 Corinthiens 3` only because a Ghost bookmark card quoted it, and lost it when goal 03 removed the card.

**Fix**: a spoken pattern in 65 (`<Livre>,? (au )?chapitre <N>(, (au )?verset <M>)?`), recorded without rewriting the text, as in 66.

## Running headers are recorded as refs

**Status**: the printed page header "AN EXODUS 19" (with the page number) gives `Exodus 19, 21, 23 … 35` in `56-0615.md`; `GENESIS`, `JOB`, `EXODUS` headers elsewhere the same. 66 matches case-insensitively and its prose rule only refuses a lowercase book name. Since goal 07 the headers are back in capitals in the text, so an all-capitals rule would now catch them. Part of the page-furniture item below.

## The French sources still carry 65's canonical rewrites

**Status**: until goal 07, 65 rewrote every French citation it found into canonical form ("Math. 24, 6" became "Matthieu 24:6", "1Cor 5:20" became "1 Corinthiens 5:20"). It no longer does, and Samuel's rule is that the preacher's words stay; but the text already rewritten in `mevar`, `onedrive`, `le-scribe`, `cmpp` and `local` still reads canonical.

**Fix**: the same approach as 65b, against each source's original: the Ghost export for `mevar` (at the repo root), the `pdf_url` PDFs for `le-scribe` and `cmpp`, the OneDrive originals for `onedrive`. Its own goal.

## Printed page furniture is inside the sermon bodies

**Status**: the PDF extractor merged the booklet's running headers and footers into the text. `THE SPOKEN WORD` appears **5,894** times across **840** Branham files, and `QUES TIONS A ND ANSWERS ON` (a spaced-out running header) 23 times. A reader sees it: `53-0729` reads "…and now we're 18 THE SPOKEN WORD at the eye age".

It also feeds the bible-ref normalizer false positives, because the page number sits right after a book name: the 8 `Genesis 19 / 21 / 23 … / 33` refs in `53-0729` are all the page numbers of the booklet *Questions and Answers on Genesis*, and none of those chapters is cited anywhere in the sermon.

**Fix**: strip the furniture at the extraction stage, then rerun 66. Doing it in the normalizer would clean the manifest and leave the visible text broken.

## Footnote links to anchors that do not exist

**Status**: `check:dist` checks a link's page, not its `#fragment`. Codex's review of goal 08 found 32 fragments with no anchor, all from Ghost: 14 in `/qui-sera-enleve/` and 18 footnote links in `/le-jour-du-seigneur-4-et-les-tribulations/`. They predate goal 08.

**Fix**: check fragments in `check:dist` against the target page's ids, then repair the two posts' footnote anchors (the text stays).

## `47` truncates `bible_refs` alphabetically at 50

**Status**: 94 files have more than 50 references and `47-lift-manifest-fields.mjs` keeps the first 50. Since the list is sorted alphabetically, that keeps `1 John` … `Genesis` and drops `Revelation` and `Zechariah` — 4,225 references in all (goal 08 counts, with the PDF texts). `manifests/bible-refs.json` and the SurrealDB `cites` edges are complete; only the frontmatter is cut.

**Fix**: decide what the page should show, then either lift the cap or keep the references in order of appearance rather than alphabetically. The normalizer sorts them, so order of appearance is not recoverable today.

## `100` keeps only the first verse group of a list

**Status**: a ref like `Mark 8:16,35` or `Hebrews 13:12,13` is one canonical string in `bible-refs.json`. `parseRef` in `100-ingest-surrealdb.mjs` reads `(?:,[\d,\-]+)?` and drops it, so the `bible_ref` record covers verse 16 only and its seeded text is incomplete. 875 of 38,118 refs carry a list (goal 07 added the "and" lists).

**Fix**: split a list into one `bible_ref` per group at ingest (and a `cites` edge to each), or have 65/66 emit one ref per group. Needs a SurrealDB run to verify; none was available for goal 07.

## `100-ingest-surrealdb.mjs` never deletes an edge

**Symptom**: all eight edge types — `by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on` — go through the same insert-only `inChunks`. Re-ingesting after the corpus changed adds the new edges and leaves the old ones. Against `origin/main`, goal 02 removes 477 (file, reference) pairs from `manifests/bible-refs.json` (impossible chapters, the "you're" misreads, malformed ranges, and the 83 one-chapter refs that change form), so a database ingested before it keeps up to 477 stale `cites` edges; a corrected `original` link leaves both `based_on` edges, since the unique index is on `(in, out)`.

**Fix**: delete a work's outgoing edges of each type before relating the current set, or diff against what is stored. One pass over all eight types, not one type at a time. Until then, a corpus change means rebuilding the database rather than re-ingesting on top.

## Bible-ref false positives from short book names

**Symptom**: 60-odd `Esther <n>` refs in files that never mention Esther.

**Cause**: `Est` is an accepted abbreviation for Esther in `65-normalize-bible.mjs`, and `est` is the French verb. `c'est 11 heures` becomes `Esther 11`. The same shape hits `Job` (`Jb`), `Ruth`, `Amos`, `Ge`, `Ne`.

**Fix**: drop the variants that collide with common French words, or require a chapter:verse pair (not a bare chapter) for the two-letter variants. The impossible-chapter filter added in goal 02 catches only the ones above the book's chapter count.

## Le-Scribe summaries with no Branham link

**Status**: 816 of 910 linked by `49-link-le-scribe-branham.mjs`. The other 94 are in `manifests/le-scribe-branham-unresolved.json` with their candidates: 60 still ambiguous between sermons the same day, 10 with no Branham sermon that day, 10 where two summaries claim one sermon (Hébreux 2A/2B and Semence 1re/2e parts are one sermon split in two summaries — the schema has one `summary_fr` per sermon), 11 with no date in the id (`wmbch15`, `59xxxxDiacres`, `5003xxDon&appel`), and 3 where Le-Scribe's date is known to be wrong.

Those 3 are the place to start, because the right sermon is already known: `530606Demons-physique` is `53-0608A "Demonology, Physical Realm"`, `530607Demons-religieux` is `53-0609A "Demonology, Religious Realm"`; `600803Jehova-J` has no Jehovah-Jireh sermon within four days. The same drift shows in the "claimed twice" rows: `550118Ange` claims `55-0118 "This Great Warrior, David"`. More links of the "only sermon that day" kind may carry it unseen; nothing but a French title against an English one reveals it.

**Fix**: a human pass over the 97, or model the summary→sermon relation as many-to-one on both sides.

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
