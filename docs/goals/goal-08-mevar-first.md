# GOAL 08: Mevar first, the archive below, and every work that cites a verse

**Status:** ready after goal 05 (PR #5 merged)
**Repo:** `mevar-v2` (`web/`, one pipeline script for item 5)
**Rules:** [README.md](README.md)

## Problem

The site treats the whole corpus as one pile. `/predications/` lists about
1,206 Branham sermons, 905 Le Scribe summaries, 88 OneDrive texts and 208
Mevar posts, newest first: the preaching of the mission, which is what
mevar.org is today, is lost among texts that are context and history. Search
does the same. And a reader who meets "(Éphésiens 4:13)" in a sermon has no
way to see what else in the library preaches on that verse, although 2,856
works already carry their references in `bible_refs`.

Decided by Samuel (2026-09-24):

- **Mevar** is what mevar.org publishes (source `mevar`, the Ghost posts)
  plus the texts of source `mevar-pdfs` and `onedrive` once they have had
  goal 04's editorial pass (goal 10) and are not a duplicate (goal 09).
  Everything else is the **archive**: Branham, Le Scribe, CMPP, the two
  `local` volumes, and the OneDrive and PDF texts not yet promoted.
- Mevar first on every list, the archive **below, on the same page**.
- Search shows Mevar by default; the archive is one click away.
- Verse pages list the works; they do **not** show the verse text.

## Design

1. **One predicate.** `isMevar(entry)` in `src/lib/works.ts`: source `mevar`,
   or source `mevar-pdfs` / `onedrive` with an `editorial_pass` field (a date,
   set by goal 10) and no `duplicate_of` (set by goal 09). Until goals 09 and
   10 land, Mevar is the Ghost posts; nothing else in the design changes when
   they do. Works with `duplicate_of` are not built (same filter as drafts),
   but their URL has been public since goal 05: each gets a 301 to the work
   it duplicates, generated from `duplicate_of` at build time into
   `_redirects` next to goal 03's rules (Pages allows 2,000 static rules;
   there are 75 today). `check:dist` checks that every target exists.
2. **Category pages.** `/predications/`, `/exhortations/`,
   `/etudes-bibliques/`, `/publications/` list the Mevar works, 60 cards a
   page (`PAGE_SIZE`). Below the list, on every page of it, a short block
   « Archives » gives the count per source and links to
   `/<category>/archives/<source>/`, paginated at 60 the same way. The home
   page counts and « Récemment publié » count and show Mevar only. The
   theme, author and year pages are Ghost-only today; they follow `isMevar`.
3. **Search.** A `collection` filter on every work (`Mevar` or `Archives`,
   from `isMevar`). `/recherche/` applies `collection: Mevar` when the UI
   loads (`PagefindUI.triggerFilters`, it exists in Pagefind 1.5) and shows a
   checkbox « Inclure les archives (Branham, Le Scribe, CMPP…) » that removes
   it. One index, as goal 05 built it; nothing more to download.
4. **Verse pages.** `/bible/<livre>/<chapitre>/`, one per chapter cited by a
   built work (1,391 chapters in today's `bible_refs`). The key is the book's
   position in `scripts/bible-books.mjs`, whose `BOOKS_FR` and `BOOKS_EN` are
   in the same order, so "Jean 5:19" and "John 5:19" are the same verse; the
   slug is the French canonical name. A chapter page lists, verse by verse
   (anchor `#v19`), the works that cite the verse, Mevar first, then the
   archive; references to the whole chapter come first. No section of the
   page lists more than 60 works: a verse cited by more gets its own page,
   `/bible/<livre>/<chapitre>/<verset>/`, and the whole-chapter references,
   when there are more than 60, get `/bible/<livre>/<chapitre>/tout/`, both
   paginated at 60; the chapter page shows the first entries and the count
   with a link. Whole-chapter references alone exceed 60 today (Jean 5:
   about 157, Matthieu 24: about 206) (John 5:19 alone is cited by about 470: 265 as "John 5:19",
   207 as "Jean 5:19"). No Bible text on these
   pages. In a work's body, the references that the normalizers (65, 66)
   recognise become links to the verse anchor, at build time (a rehype plugin,
   next to `bookmarks.mjs`); the text itself does not change, and a reference
   they do not recognise stays plain.
5. **"Unknown" is not a value.** Ten Branham sermons show "Unknown"
   (`55-1001` among them): `date: "Unknown"` (2) or `location: "Unknown"`
   (8). It comes from the LLM cleanup: `scripts/73-apply-llm.mjs` takes the
   model's `date` and `location` when they are non-empty (its loop over
   title, subtitle, date, location, preacher, summary), and the model wrote
   "Unknown". Fix 73 to treat "Unknown" (and its variants) as empty. Do not
   rerun 73 to clean up: it rewrites bodies from its cache, over goal 07's
   restoration. Remove the ten values from `manifests/branham-*.json` and
   from the frontmatter with a targeted, idempotent script, and check that
   nothing downstream (`index.json`, stage 50) still holds them.

6. **One name per preacher.** The `preacher` field and the Ghost `authors`
   hold 43 spellings of 13 people today (619 works for the founder alone,
   13 spellings). The field is metadata, not the preacher's words: it is
   rewritten; the bodies are not touched. `scripts/preachers.mjs`, edited by
   hand like `scripts/bible-books.mjs` (`manifests/` is only what scripts
   derive), gives each person a display name, a slug
   and the variants seen; a pipeline step rewrites `preacher` from it
   (idempotent, and a new import's variants are caught on the next run;
   an unknown spelling fails the step instead of passing through). Titles
   ("Fr", "Fr.", "Frère", "Pasteur") are not part of a name. Decided by
   Samuel: given name first, as on the Ghost author pages.

   | Display name | Variants seen (examples) |
   | ------------ | ------------------------ |
   | Parfait M'bra | M'BRA Parfait, Fr M'BRA Parfait, Frère M'BRA Parfait, Parfait M’BRA, Pasteur M'BRA Parfait, Parfait MBRA, M'Bra Parfait |
   | William Branham | William Marrion Branham (81, CMPP) |
   | André Kadjany | Fr. KADJANY André, Kadjany André, KADJANY YOBOUET ANDRE, frère KADJANY (Samuel, 2026-09-24) |
   | Irié Anderson | IRIE ANDERSON, Frère IRIE Anderson, Anderson Irié |
   | Pierre Kouadio | KOUADIO Pierre |
   | Samuel Pouyt | Pouyt Samuel |
   | Richard Schwéry | Richard SCHWERY, Fr. Richard SCHWERY |
   | Ewald Frank, Alexis Barilier, Stéphane Pouyt, Christian Kayenga Kalubi, Nandy Noël Gbaha | unchanged |
   | Frère Doubbin, Rigobert de Cotonou | « Frère DOUBBIN », « Rigobert de Cotonou »: full names unknown (Samuel, 2026-09-24); kept as the texts name them, casing fixed, until someone knows |

   **Author pages.** `/auteurs/` lists the Mevar preachers first, then under
   « Archives » William Branham, Ewald Frank and Alexis Barilier, each with
   `/auteurs/<slug>/` paginated at 60. The Ghost authors keep their slugs
   (goal 03's redirects land on them). The search `preacher` filter reads the
   same display names. Delete the follow-up « The same preacher under
   several names » (added by goal 05) from `docs/follow-ups.md`.

## Added by Samuel on the PR (2026-09-24)

- **Categories as on mevar.org.** A Ghost post is listed under every
  category tag it carries (33 are both « Prédications » and « Etudes
  Bibliques »), not under one derived kind; Études bibliques showed 8
  works where mevar.org shows 47.
- **The follow-up « Markdown files with no frontmatter » is done here.**
  The ten works (5 Le Scribe, 3 CMPP, the 2 local volumes) get their
  frontmatter from their title pages (`scripts/76-add-missing-frontmatter.mjs`),
  then 47, 49 and 50 run. So `markdown/` also gains those ten frontmatter
  blocks and what 47 and 49 derive from them, besides the `preacher:` lines
  and the "Unknown" fields.
- **The PDF texts on the verse pages** (from Codex's second opinion, which
  read design item 4 as every built work): 65 scans `mevar-pdfs` too, and 47
  adds a `bible_refs` block to 61 of the 69 PDF texts' frontmatter.

## Added by Samuel on the PR (2026-09-25)

- **A Ghost post with no category tag is in no category**, as on
  mevar.org: the nine (« Chaîne de prière » months, two audio posts,
  « Nouveau site web », two from 2014-2015) leave Publications.
- **Branham dates and places from their source**, not the LLM:
  `scripts/77-branham-date-location.mjs` sets `date` and `year` from the
  sermon id and `location` from branham.org's year listing, in the
  manifests and the frontmatter of `markdown/branham/`.

## Scope out

- Deduplication (goal 09), the editorial pass and promotion (goal 10).
- The verse text, Strong's, cross-references.

## Acceptance evidence

- `/predications/` page 1: 60 cards, all Mevar; the « Archives » block with
  the counts; `/predications/archives/branham/` exists and is paginated.
  Same check for the other three categories.
- `/recherche/`: a phrase from a Branham sermon finds nothing with the
  default filter and finds the sermon with « Inclure les archives »; a phrase
  from a Ghost post is found in both.
- `/bible/ephesiens/4/` lists the works citing Éphésiens 4:13; in a work
  whose body quotes the verse followed by « (Éphésiens 4:13) » (the case
  Samuel reported, 2026-09-24), the reference links to
  `/bible/ephesiens/4/#v13`. `/bible/jean/5/19/` and `/bible/jean/5/tout/`
  exist and are paginated; no verse page section lists more than 60 works. The number of body references linked, and not linked, reported.
- Every `preacher` value in `markdown/` is a display name of
  `scripts/preachers.mjs` (a one-liner prints the distinct values: 13
  or fewer, plus any Samuel adds); bodies untouched (`git diff` on
  `markdown/` changes only `preacher:` lines and the "Unknown" fields).
- A duplicate's old URL (once goal 09 has marked one) answers 301 to the
  work it duplicates.
  The search filter lists the same names. `/auteurs/` shows the archive
  preachers; `/auteurs/william-branham/` is paginated.
- `grep -rl '"Unknown"' markdown/branham` is empty after regeneration, the
  script's second run is a no-op.
- Goal 05's checks on the full build: `check:dist`, `check:limits` (file
  count before and after: the verse pages add about 1,400 files and the
  archive lists some hundreds), Lighthouse on one verse page and one
  category page, performance 90+.
