# GOAL 20: Mevar clean-up after goal 10's first batches

**Status:** PR open
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, `index.json`, the frontmatter
of `markdown/onedrive/`, `markdown/mevar-pdfs/` and the `markdown/mevar/`
files with `source_path`, the bodies of three split works, `docs/`)
**Depends on:** 10 (batches 01 to 04), 18, 19
**Rules:** [README.md](README.md)
**Kind:** PIPELINE: frontmatter, derived files and 86's header rule; no word
of a text changes.

## Problem

Reading batches 01 to 04 on the site, Samuel found four things left over:

- the subtitles are in title case (« Exhortation de Juin 2011 »,
  « Exhortation Fin Mai 2011 ») while goal 18 wrote the titles in sentence
  case;
- a work split from another (goal 10's `split`) opens with its own title
  as a bold line under the page's title (« **LA GUERRE DE LIBÉRATION** »,
  « **Prêché à Koumassi le dimanche 22 avril 2007** »): 86 removes a first
  work's header, not a second work's;
- the texts write « Mathieu », « Hébr », « 1 Pier »… which 65 does not
  recognise, so those references are neither linked nor on a verse page;
- two strays: an empty « LA GUERRE DE LIBERATION » page, and
  `sujets-de-prieres-15-16-aout-2014`, which has no PDF.

## Decisions (Samuel, 2026-09-30)

- **Subtitles** in sentence case: the month names and the words after
  « Exhortation » (fin, mi, début, spéciale, du mois…) in lower case; the
  first word and proper nouns keep their capital. Frontmatter only, the
  Mevar texts goal 10 covers, promoted or not; not the Ghost posts, CMPP,
  Branham, Le Scribe or local.
- **A split's second work** loses its opening header the way a first work
  does: inside 86, only lines holding its title, subtitle, date or place,
  listed under « Headers removed ».
- **65's aliases:** the unambiguous spellings, measured first; « Pier »
  never inside a word or a name.
- **The strays** are questions for Samuel, not deletions.

## Work items

1. **`89-subtitle-case.mjs`** writes the subtitles of the goal 10 texts in
   sentence case, in their frontmatter and in `manifests/onedrive.json` and
   `manifests/mevar-pdfs-corpus.json`; 50 rebuilds `index.json`. A second
   run is a no-op. 86 still accepts the editor's subtitles, and batches 01
   to 04 still promote.
2. **86: a split's second work** loses its opening lines when every word of
   them is its title, subtitle, date, place, preacher or a header's own word
   and they hold its title or subtitle; listed. The three split texts whose
   second work opens that way are promoted again (their first work's
   `editorial_pass` removed, 86 on their batch, then 65, 47, 50, 83, 88).
3. **65's aliases:** the spellings a read-only scan of the goal 10 texts
   finds and 65 misses, added to `scripts/bible-books.mjs`; 65 on the goal
   10 texts, 47, 50.
4. **The strays:** what each is and where it came from, with a
   recommendation, in the PR.

## Scope out

- Any word of a text; the Ghost posts, CMPP, Branham, Le Scribe, local.
- 85, and the texts of batch 05 (in flight in parallel).
- 65 on the sources goal 10 does not cover (the new aliases find references
  there too: a question for Samuel in the PR).

## Acceptance evidence

1. Subtitles before → after, with counts; a second run of 89 is a no-op.
2. The headers 86 removes from the three second works; `git diff
   --word-diff` on their bodies shows only those lines gone.
3. The scan's counts per spelling, the aliases added, the references
   gained per text.
4. 86 on batches 01 to 04 promotes every text; 65, 47, 50, 83, 88 and 89:
   a second run is a no-op.
5. `npm run build`, `npm run check:dist`.
