# GOAL 18: Section headings: a line that stands alone becomes ## or ###

**Status:** in progress
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, the bodies of
`markdown/onedrive/`, `markdown/mevar-pdfs/`, `markdown/le-scribe/`,
`markdown/cmpp/`, `markdown/local/`, one line of `markdown/mevar/`;
`web/src/` for the heading styles; `docs/`)
**Depends on:** 10 (batch 03 merged as PR #24), 17
**Rules:** [README.md](README.md)
**Kind:** EDITORIAL, on layout only: no word changes, the case of a
heading's words does, and its bold goes (the heading is styled).

## Problem

Samuel (2026-09-29), reading batch 03: « POURQUOI LA CONFESSION ET LA
REPENTANCE ? » is a section title typed in capitals in the PDF, stored as a
bold paragraph. It should be `## Pourquoi la confession et la repentance ?`:
a heading the markdown renders as `<h2>`, in normal casing, styled by CSS.
Site-wide.

The Ghost posts already do this (293 `##`, 472 `###`, sentence case:
« Le chant du coq »). The PDF texts and the archive do not. Measured on
`main` after PR #23, paragraphs of one line:

| source | in capitals | short and wholly bold (≤ 10 words) |
| - | -: | -: |
| `onedrive` | 188 | 350 |
| `mevar-pdfs` | 178 | 15 |
| `cmpp` | 738 | 7 |
| `le-scribe` | 108 | 193 |
| `local` | 71 | 0 |
| `mevar` (Ghost) | 1 | 125 |

(`onedrive` also holds 991 `#` lines the old DeepSeek cleanup added to texts
goal 10 has not reached; goal 10's pass replaces those bodies.)

## The rule (Samuel, 2026-09-29), added to goals 04 and 10

A line that stands alone in the text (its own paragraph) and reads as a
section title becomes a heading: `##` by default, `###` only where the
structure shows a sub-section (« Sujets de prière » then « Sujets de prière
pour la famille »). Its words stay, in sentence case with the capitals the
house style keeps (names, « Jésus-Christ », « la Bible », « Message » for
the end-time Message); its bold goes. Capitals for emphasis inside a
paragraph (« IL FAUT QUE LE SIÈGE SOIT DÉGAGÉ ! ») stay: that is the
preacher speaking. Nothing else becomes a heading: no heading is invented.

A heading already in the text but in capitals (`## LA CHUTE DANS LE PECHE`)
is recased the same way and keeps its level (Samuel, on PR #25: « we can
add this in this PR »); the Ghost posts' own headings stay Samuel's.

A line in capitals is a candidate; a short bold line is a candidate too, and
may be the preacher's emphasis on a sentence (« **La victoire est pour
nous** ! »): each is decided and listed. A line that repeats the work's
title is left as it is.

## Work items

1. **The rules**: goal 04's « No section headings inside a sermon » and
   goal 10's scope-out « adding headings » give way to the rule above.
2. **`87-section-headings.mjs`**: finds the candidates in every French
   work, asks the model for each one (heading or not, its level, its words
   in sentence case) with the paragraphs around it, and records the
   decisions in `manifests/section-headings.json`, reviewed data like
   `mevar-editorial-fixes.json`. A decision whose words differ from the
   line's by more than case and accents is refused. It writes the headings
   into the texts goal 10 does not check (`le-scribe`, `cmpp`, `local`,
   `mevar`); a second run is a no-op.
3. **86** applies the same decisions to goal 10's texts before it compares,
   and accepts a heading only there: batches 01 to 03 are promoted again
   with their headings; later batches get theirs from 87 run on the pass.
4. **The site**: `h2` and `h3` styled for reading, in both themes.
5. **A reading page** for Samuel: every heading, before and after, by
   source; the short bold lines kept as emphasis listed apart.

## Scope out

- Branham (English), the Ghost posts' own headings and bold lines (Samuel's
  layout in Ghost); the one Ghost line in capitals is in.
- Any word change; any heading not on a line that stands alone.

## Acceptance evidence

1. Per source: candidates, headings (`##`, `###`), lines kept, refused.
2. `git diff --word-diff` on the bodies: only `##`/`###`, case, and the
   heading's `**`; 86 on batches 01 to 03 promotes them all again.
3. Every script touched: a second run is a no-op.
4. `npm run build` and `check:dist`; the reading page.
