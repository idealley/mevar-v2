# GOAL 15: The French citations read as the preacher wrote them

**Status:** merged as PR #17 (2026-09-25). Goal 14's two `markdown/mevar/`
posts (`qui-sera-enleve`, `le-jour-du-seigneur-4-et-les-tribulations`)
wait until goal 14 merges: see `docs/follow-ups.md`
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, the bodies of
`markdown/mevar/`, `markdown/le-scribe/` and, if a source is found,
`markdown/local/`; `docs/`)
**Depends on:** 07 (65 no longer rewrites), 12 (merged as PR #14)
**Rules:** [README.md](README.md)
**Kind:** RESTORATION, as goal 07's `65b`: the text goes back to the
source's own wording where a script changed it. Only a citation's wording
changes, and only to what the source has (AGENTS.md hard rule 1: the
preacher's words stay; these are his words, the canonical form was 65's).

## Problem

Until goal 07, `65` rewrote every French citation it found into canonical
form: "Math. 24, 6" became "Matthieu 24:6", "2 Sam 18" became "2 Samuel
18", even "Esaïe 35" became "Ésaïe 35". It no longer does, and Samuel's
rule (2026-09-22) is that the preacher's words stay: the canonical form
belongs in `bible-refs.json`, not in the text. The text it already
rewrote still reads canonical.

Measured on `main` after PR #14, citations whose text is exactly the
canonical form 65 wrote (an upper bound: a preacher may write that form
himself):

| source | canonical in the text | files | original |
| - | -: | -: | - |
| `mevar` | 4,789 | 269 | the Ghost export, `manifests/mevar.ghost.2026-09-20-19-24-38.json` (gitignored) |
| `le-scribe` | 14,051 | 904 | the PDF in each work's `pdf_url` (le-scribe.org) |
| `cmpp` | 8,807 | 236 | not here: goal 16 (CMPP complete) re-crawls and rewrites these bodies; remeasure after it |
| `local` | 151 | 2 | unknown: ask Samuel |

For `mevar` the rewrites are measured, not estimated: of the 4,789, 1,535
read differently in the Ghost export ("Et quand vous lisez Esaïe 35",
"(2 Sam 18)"); the other 3,254 are as written.

`mevar-pdfs` was never rewritten (65 only reads it since goal 08). The
OneDrive texts were, and their originals are the `.docx` files Samuel
keeps: they are goal 10's texts, and goal 10 measures them and asks Samuel
before its first edit (its stop points). Not this goal.

## Work items

1. **A restoration script, `65c`, on `65b`'s method.** For each citation
   whose text is the canonical form, find the spot in the source by the
   words before and after it; where it aligns exactly once, put back the
   source's wording of the citation, and nothing else. A spot that does
   not align is listed in a manifest with its context, never guessed.
   Idempotent. Sources:
   - `mevar`: the Ghost export's post `html`, by slug. The markdown has
     other, legitimate differences from Ghost (goal 04's editorial pass on
     seven posts, goals 01 and 03's links): the alignment is on words, not
     on markup, and only the citation changes.
   - `le-scribe`: the PDFs, fetched with `20-download-pdfs.mjs`
     into the gitignored `pdfs/`, parsed with `lit parse`.
   - `local`: only if Samuel names a source.
2. **Refs unchanged.** Rerun `65`, `47`, `50`. 65 reads the restored forms
   (its variants cover "Math.", "2 Sam", "Esaïe"): the refs per file are
   expected identical, in the same order. A ref that changes is a form 65
   does not read; list them and stop, do not "fix" 65 here.
3. **Docs**: `docs/data-pipeline.md` names `65c`; `docs/follow-ups.md`
   drops "The French sources still carry 65's canonical rewrites" and
   says where OneDrive is handled (goal 10).

## Stop points

- Before fetching: the PDF count and size for Le Scribe; if the site does
  not answer, say so and stop.
- `local`: ask Samuel for the source of the two volumes.
- More than 10 % of a source's spots unaligned: stop and show a sample.

## Scope out

- OneDrive and `mevar-pdfs` (goal 10), CMPP (after goal 16), Branham (goal
  07's `65b`).
- Any change to a text other than a citation's wording.
- What 65 recognises.

## Acceptance evidence

1. Per source: citations restored, spots already as written, spots
   unaligned (listed in the manifest with context).
2. `git diff --word-diff` on the bodies changes only citations; twenty
   random restorations shown with the words either side, as the source
   has them.
3. `manifests/bible-refs.json`: identical per file and in order, or each
   difference listed with the restored form 65 does not read.
4. For every script touched or added: a second run is a no-op.
