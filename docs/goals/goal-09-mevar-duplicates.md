# GOAL 09: Each Mevar text once

**Status:** ready (independent of goal 08; goal 10 waits for it)
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, frontmatter of `markdown/onedrive/` and `markdown/mevar-pdfs/`)
**Rules:** [README.md](README.md)

## Problem

Three sources hold the preaching of the mission: the 331 Ghost posts
(`mevar`), 69 PDFs linked from mevar.org (`mevar-pdfs`) and 339 texts from
OneDrive (`onedrive`). The same sermon is often in two or three of them, as
a transcript of a different quality or a different version. Goal 08 lists
all three as Mevar once goal 10 has promoted them: without this goal, a
reader would see the same sermon twice or three times.

What exists does not settle it:

- `63-dedup-vs-mevar.mjs` compares the first 200 words of four letters or
  more, as a set. 158 OneDrive texts have a `mevar_match`, none above 0.9
  (18 between 0.7 and 0.9, 140 between 0.5 and 0.7), though titles like « Le
  culte de la vierge Marie » (0.745) are plainly the same sermon.
- `81-dedup-mevar-pdfs.mjs` triages the PDFs against OneDrive by file hash,
  file name and a fingerprint, into definite / likely / probable / unique.
  The result is a manifest, never applied to the frontmatter.

## Design

1. **One comparison, full text.** A new script compares every pair across
   the three sources (and within OneDrive, which holds versions of the same
   file) on the whole body: normalised words (case, accents, punctuation),
   shingles of 5 words, containment in both directions (a short version
   inside a long one is a duplicate). Titles are a signal, not the test.
   Output: `manifests/mevar-duplicates.json`, one entry per group with the
   scores.
2. **Three bands, measured before they are fixed.** Print the score
   distribution first and choose the thresholds from it: *same text*
   (applied), *same sermon, different text* (applied, see 3), *uncertain*
   (not applied, listed for Samuel with the first 300 words of each side).
3. **Which one stays.** The Ghost post whenever there is one: its URL is the
   one readers and Google know. Between a PDF and a OneDrive text, the one
   with more of the sermon (containment), then the cleaner one (fewer
   OCR-like tokens); the report says which rule chose. The others get
   `duplicate_of: "<source>/<path>"` in their frontmatter: the keeper's file
   path under `markdown/`, which goal 08's site turns into the 301's target.
   Nothing is deleted: the text stays in `markdown/`, goal 08 does not build
   it.
4. **Idempotent.** A second run changes nothing; Samuel's decisions on the
   uncertain band are read from a committed file, so a rerun keeps them.
   They are his input, not derived: they live in
   `scripts/mevar-duplicates-decided.json`, next to the script, not in
   `manifests/` (which only holds what scripts derive).

## Added by Samuel on the PR (2026-09-25)

- **A duplicate is removed, so goal 10 never edits it.** Six groups were
  held because their keeper was a Ghost draft. Samuel: « flip those six to
  published ». `dieu-veille-sur-sa-parole-pour-lexecuter`,
  `la-toilette-du-chretien`, `le-sort-de-cain`, `le-temoignage-final`,
  `sors-de-ton-lit` and `suivons-le-seigneur` are published in
  `markdown/mevar/` (goal 04 did their editorial pass there); their seven
  OneDrive copies get `duplicate_of`. `sommeil-et-assoupissement-spirituels`
  stays a draft.
- **They are not published in Ghost**, which still holds their text from
  before goal 04: `markdown/` is the source of truth. So a post's status is
  read from its frontmatter, as the site builds it, by
  `scripts/50-build-index.mjs` and `web/scripts/check-dist.mjs` too, not
  from `manifests/mevar.json`, the record of the Ghost import (Samuel:
  « yes please »).
- **`duplicate_of` holds the keeper's path**, not its id: goal 08's site,
  merged meanwhile, builds the 301 from a path, and the two differ for a
  keeper in a subfolder (design item 3).

- **Two published posts of one sermon** (« C'est ici votre heure et la
  puissance des ténèbres », 2006 and 2022): Samuel keeps
  `c-est-ici-votre-heure-et-la-puissance-des-tenebres`, « the better slug ».
  `est-ici-votre-heure-et-la-puissance-des-tenebres` gets `duplicate_of` it,
  by hand (83 writes only the PDF and OneDrive texts), so its URL answers
  301 instead of disappearing; the kept post takes its « Soubré » tag, the
  only one, so `/themes/soubre/` and goal 03's `/soubre/` keep their page.
  `check-dist` does not expect a post with `duplicate_of` at its own URL.

So besides the files below, this goal's diff also touches the six posts'
`status:` line, the two posts above, `scripts/50-build-index.mjs`, `web/scripts/check-dist.mjs`
and `index.json`.

## Stop point

The uncertain band goes to Samuel as a list in the PR (pairs, scores,
excerpts). He answers per pair; the answers are committed; the script is
rerun. Nothing in the uncertain band is applied on a guess.

## Scope out

Merging two versions into one text, the editorial pass (goal 10), any
change to a body.

## Acceptance evidence

- The score distribution, the thresholds chosen and why.
- Counts per band and per source pair; the size of the Mevar set after the
  goal (Ghost posts + PDF and OneDrive texts that are not duplicates).
- Five *same sermon, different text* groups shown with the rule that chose
  the one that stays.
- `git diff --stat` touches only the new script, the decisions file,
  `manifests/mevar-duplicates.json`, and the frontmatter of
  `markdown/onedrive/` and `markdown/mevar-pdfs/` (the `duplicate_of`
  lines); a second run is a no-op.
