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
   they do. Works with `duplicate_of` are not built (same filter as drafts).
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
   archive; references to the whole chapter come first. A verse cited by
   more than 60 works gets its own page, `/bible/<livre>/<chapitre>/<verset>/`,
   paginated at 60 (John 5:19 alone is cited by about 470: 265 as "John 5:19",
   207 as "Jean 5:19"). No Bible text on these
   pages. In a work's body, the references that the normalizers (65, 66)
   recognise become links to the verse anchor, at build time (a rehype plugin,
   next to `bookmarks.mjs`); the text itself does not change, and a reference
   they do not recognise stays plain.
5. **"Unknown" is not a value.** Eight Branham sermons show "Unknown"
   (`55-1001` among them): the branham.org scrape writes `date: "Unknown"`
   (2) or `location: "Unknown"` (8) into `manifests/branham-*.json`, and the
   stage that writes the frontmatter copies it. That stage omits the field
   instead; regenerate. The template needs no change.

## Scope out

- Deduplication (goal 09), the editorial pass and promotion (goal 10).
- The verse text, Strong's, cross-references. Normalising preacher names
  (`docs/follow-ups.md`).

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
  `/bible/ephesiens/4/#v13`. `/bible/jean/5/19/` exists and is
  paginated. The number of body references linked, and not linked, reported.
- `grep -rl '"Unknown"' markdown/branham` is empty after regeneration, the
  script's second run is a no-op.
- Goal 05's checks on the full build: `check:dist`, `check:limits` (file
  count before and after: the verse pages add about 1,400 files and the
  archive lists some hundreds), Lighthouse on one verse page and one
  category page, performance 90+.
