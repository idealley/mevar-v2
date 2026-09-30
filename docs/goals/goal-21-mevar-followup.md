# GOAL 21: Mevar follow-up to goal 20

**Status:** PR open
**Repo:** `mevar-v2` (`scripts/65`, `61`, `83`, the batch 01 to 05 entries of
`scripts/mevar-editorial-fixes.json`, `scripts/mevar-duplicates-decided.json`,
`web/src/lib/bible-links.mjs`, the frontmatter of the goal 10 texts, one
OneDrive stub, one OneDrive work removed, `manifests/`, `index.json`, `docs/`)
**Depends on:** 10 (batches 01 to 05), 20
**Rules:** [README.md](README.md)
**Kind:** PIPELINE and goal 10's editorial path (subtitles through 86); no
word of a text changes.

## Problem

Goal 20's PR left Samuel four answers to give and one fault to fix:

- the old cleanup gave many goal 10 texts a subtitle made from the date
  (« Exhortation d'octobre 2011 ») where the PDF opens with how and when
  the text was given (« La Grâce et la Vérité, prêché par le frère M'BRA
  Parfait à Koumassi le dimanche 23 octobre 2011 »);
- the empty « LA GUERRE DE LIBERATION » page (a one-page PDF with no text
  layer) and `sujets-de-prieres-15-16-aout-2014` (a prayer notice, a .docx
  with no PDF) are still works;
- goal 20's aliases in `scripts/bible-books.mjs` find about 1,970 more
  references in the sources goal 10 does not cover, not yet recorded;
- « Matthieu 13 : » followed by a quote whose first verse number is bold
  (« > **41** Le Fils de l'homme… ») is recorded as « Matthieu 13 », the
  chapter, when the quote says which verses.

## Decisions (Samuel, 2026-09-30)

- **Subtitles:** « let's keep it when the PDF is not informative, for the
  others we can follow the PDF, the date should anyhow be in the
  frontmatter ». The texts goal 10 promoted (batches 01 to 05). Where the
  PDF's opening header says more than the subtitle about how and when the
  text was given, the subtitle is the header's words, in sentence case,
  typography only, the way batch 05 wrote `leculte`'s (« Prêché le lundi
  28 septembre 2009 à l'Assemblée de Mamayemo »): not the title, not the
  preacher. Given as the editor's `subtitle` in the fixes file; 86 accepts
  it only if every word is in the PDF's first 80. The date field does not
  change. Every text stays promoted with the same header removed.
- **The stub:** « let's mark it as a duplicate », of
  `mevar/la-guerre-de-liberation-avril-2007`, the way 83 records
  duplicates; nothing builds it, and a rerun of 60 to 64 does not bring it
  back as a work.
- **The prayer notice:** « let's drop it »: its markdown, its manifest
  entry, its index.json entry; no stage recreates it. The original under
  `onedrive/` is untouched.
- **References in the other collections:** « yes, let's be thorough and
  have something clean »: 65 on every French source it covers, measured
  first, a seeded sample checked for false positives; a false positive the
  sample shows is fixed in 65 when its rule is general.
- **A verse number at the head of a quote:** « I trust you to fix it ».

## Work items

1. **Subtitles:** the editor's `subtitle` for each promoted text whose PDF
   header says more; their `editorial_pass` removed, 86 on their batch,
   then 65, 47, 50, 83, 88.
2. **The stub:** 83 applies Samuel's « same » on a pair its shingles cannot
   find (an empty page shares none); the pair goes into
   `scripts/mevar-duplicates-decided.json`.
3. **The prayer notice:** removed from `markdown/`, `manifests/onedrive.json`
   and `index.json`; 61, which converts every .docx under `onedrive/`,
   skips it.
4. **65 on every French source,** measured read-only first (per source),
   a seeded sample of the gained references read against their sentence;
   then 47 and 50.
5. **65: a chapter followed by a colon and a quote** whose first verse
   number is bold records the quote's verses, the first to the last
   numbered one; each range checked against SurrealDB, the Segond ones
   spot-checked. The site links the citation to the verses 65 recorded.

## Scope out

- Any word of a text.
- 85, and batch 06's entries in the three editorial data files, in flight
  in parallel. Batch 06 adds texts that 65 reads: whichever PR merges
  second reruns 65 (all sources), 47 and 50 instead of merging those lines
  by hand.
- The references written « Mat. 24.14 » (chapter, dot, verse: CMPP and some
  OneDrive texts), recorded as the chapter: counted, a question for
  Samuel.

## Acceptance evidence

1. Subtitles before → after for every text changed; 86 on batches 01 to 05
   promotes every text, and « Headers removed » is the same as before.
2. The stub's `duplicate_of`, its group in `manifests/mevar-duplicates.json`,
   and no page for it in `dist/`; a second run of 83 is a no-op.
3. No file, manifest entry or index entry for the prayer notice; 61's
   exclusion.
4. References gained per source, the sample and its verdicts.
5. Before → after for every text the quote rule changes, each range found
   in SurrealDB; a second run of 65, 47 and 50 is a no-op.
6. `npm run build`, `npm run check:dist`; `git status` clean after a
   second run of each script.
