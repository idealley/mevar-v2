# GOAL 07: The Branham text says what branham.org says, and every citation is found

**Status:** done (dispatched 2026-09-22 by Samuel, on PR #1: "we can
restore it using branham.org", "we can do one PR"; merged as PR #2,
2026-09-23; landing check on `main` 2026-09-24)
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, `markdown/branham/`, `docs/`)
**Depends on:** 02 (merged as PR #1, 2026-09-23)
**Rules:** [README.md](README.md)

## Problem

Two old normalizer runs damaged the English Branham transcripts, and the
citations Branham speaks aloud are never found.

- **French names inside English sermons.** Before goal 02, `65` (the French
  normalizer) also ran over `markdown/branham/`. It read English words as book
  abbreviations and rewrote them: "The Bible says it is. 65 He's here" became
  "The Bible says it Ésaïe 65 He's here". Measured on 2026-09-22: 560 spots
  (`Ésaïe` 358, `Sophonie` 154, `Hébreux` 39, `Actes`, `Habacuc`, `Marc`,
  `Juges`), in 377 files. A reader sees them.
- **English words turned into citations by `66`.** A book name that ends a
  sentence, followed by the paragraph number, became a reference: "the book of
  Revelation. 12 And" became "Revelation 12 And"; "that's my job. 9" became
  "Job 9"; "I am. 14" became "Amos 14". About 120 such spots align with the source.
  The text was damaged; the manifest held only one of them as a ref (the
  chapter caps had dropped the others).
- **Spoken citations are invisible.** Branham reads his text aloud: "Saint John
  the 4th chapter", "In the 20th chapter of Numbers". About 2,000 of them,
  none in `bible-refs.json`. 181 Branham files have no refs at all.

The damage cannot be undone from our text alone: the regex swallowed an
optional period, so "is. 65" and "is 65" both became "Ésaïe 65". The source
can. Every Branham file carries its branham.org PDF in `pdf_url`, and
`20-download-pdfs.mjs` fetches them (1,206 PDFs, 152 MB, gitignored `pdfs/`).
Aligned on the words around each spot, the PDF gives the original back: 5 of 5
in the pilot, and over 90% of the French-name spots in the full measurement.

## Work items

1. **Restore from the source.** A script between 65 and 66 that finds each
   spot in the PDF text (`lit parse`, already a dependency) by the words before
   and after it, and puts back what the PDF says when the spot aligns exactly
   once: a book name that is French or ends a sentence goes back to the PDF's
   word(s); a citation in the canonical form 66 used to write ("John 5:24")
   goes back to how it was said ("Saint John 5:24"). Nothing else changes.
   French names that do not align are listed in a short manifest, not guessed.
   Idempotent.
2. **66 stops creating it.** Measured on the branham.org text: a real citation
   never uses a lowercase book name and never has a period between book and
   chapter. So a book token that is lowercase, or followed by a period, is not
   a citation.
3. **Spoken citations in 66.** Two patterns: `<Book>,? the <N>th chapter(,? the
   <M>th verse)?` and `the <N>th chapter of <Book>`, with "Saint" allowed before
   the book. Recorded in `bible-refs.json`; **the text is not rewritten** (the
   preacher's words stay, AGENTS.md hard rule 1).
4. **65 and 66 never rewrite the text** (Samuel, 2026-09-22: "keep the
   preacher's word and map it to the correct canonical ref"). They record the
   canonical ref in `bible-refs.json` and leave the body as written.
5. **Regenerate**: 65b, 66, then 47, 49, 50.
6. **Docs**: `docs/data-pipeline.md` gets the new stage, `docs/follow-ups.md`
   drops the two closed items and gains the French sources.

## Scope out

- Page furniture (`THE SPOKEN WORD` footers, running headers), its own follow-up.
- Wording the LLM cleanup changed ("Saint John the 5th chapter: Jesus" became
  "John 5: Jesus"). Not damage from the normalizers.
- Restoring the French sources' text. `65` stops rewriting it here, but the
  text it already rewrote ("Math. 24, 6" became "Matthieu 24:6") needs each
  source's original, which is a goal of its own.

## Decided

`65` and `66` rewrote every citation in the body to canonical form: 923
Branham spots read "John" where branham.org has "Saint John", 138 "1
Corinthians" where it has "First Corinthians". Samuel, 2026-09-22: keep the
preacher's word and map it to the correct canonical ref. Items 1 and 4.

## Acceptance evidence

- No French book name followed by a number in `markdown/branham/`, except the
  spots listed in the unaligned manifest.
- `git diff --word-diff` on the bodies changes only citation spots, and every
  restored spot, with the words either side, reads as the PDF. Twenty random
  changes shown in the PR.
- Running 66 after the restoration leaves the restored words alone (no
  "Isaiah 65" from "is. 65").
- Branham files with `bible_refs`: before and after. Spoken refs added: count,
  and twenty random ones checked by hand.
- For every script touched: a second run is a no-op.

## Follow-up

Landing check against `main`, 2026-09-24: the chain (65, 65b, 66, 47, 49,
50) was not a no-op. Goal 03's relinks removed Ghost bookmark-card excerpts
from 14 mevar posts without a rerun, so their refs were stale. Regenerated;
a second run is a no-op.
