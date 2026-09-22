# GOAL 07: The Branham text says what branham.org says, and every citation is found

**Status:** in progress (dispatched 2026-09-22 by Samuel, on PR #1: "we can
restore it using branham.org", "we can do one PR")
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, `markdown/branham/`, `docs/`)
**Depends on:** 02 (this branch is stacked on `goal-02-corpus-gaps`)
**Rules:** [README.md](README.md)

## Problem

Two old normalizer runs damaged the English Branham transcripts, and the
citations Branham speaks aloud are never found.

- **French names inside English sermons.** Before goal 02, `65` (the French
  normalizer) also ran over `markdown/branham/`. It read English words as book
  abbreviations and rewrote them: "The Bible says it is. 65 He's here" became
  "The Bible says it Ésaïe 65 He's here". Measured on 2026-09-22: 681 spots
  (`Ésaïe`, `Sophonie`, `Hébreux`, `Actes`, `Habacuc`, `Marc`, `Juges`), in
  377 files. A reader sees them.
- **English words turned into citations by `66`.** A book name that ends a
  sentence, followed by the paragraph number, became a reference: "the book of
  Revelation. 12 And" became "Revelation 12 And"; "that's my job. 9" became
  "Job 9"; "I am. 14" became "Amos 14". 118 such spots align with the source.
  They are false refs, and the swallowed period changes the text.
- **Spoken citations are invisible.** Branham reads his text aloud: "Saint John
  the 4th chapter", "In the 20th chapter of Numbers". 2,948 + 614 occurrences,
  none in `bible-refs.json`. 181 Branham files have no refs at all.

The damage cannot be undone from our text alone: the regex swallowed an
optional period, so "is. 65" and "is 65" both became "Ésaïe 65". The source
can. Every Branham file carries its branham.org PDF in `pdf_url`, and
`20-download-pdfs.mjs` fetches them (1,206 PDFs, 152 MB, gitignored `pdfs/`).
Aligned on the words around each spot, the PDF gives the original back: 5 of 5
in the pilot, 633 of 681 French-name spots in the full measurement.

## Work items

1. **Restore from the source.** A script between 65 and 66 that, for each
   `<book name> <number>` in a Branham body, finds the same spot in the PDF text
   (`lit parse`, already a dependency) by the words before and after, and puts
   the PDF's word(s) back in place of the book name when the spot aligns
   exactly once and the book name is either French or the PDF word ends a
   sentence (ends with "."). Only the book-name token changes. Spots that do
   not align are listed in a short manifest, not guessed. Idempotent.
2. **66 stops creating it.** Measured on the branham.org text: a real citation
   never uses a lowercase book name and never has a period between book and
   chapter. So a book token that is lowercase, or followed by a period, is not
   a citation.
3. **Spoken citations in 66.** Two patterns: `<Book>,? the <N>th chapter(,? the
   <M>th verse)?` and `the <N>th chapter of <Book>`, with "Saint" allowed before
   the book. Recorded in `bible-refs.json`; **the text is not rewritten** (the
   preacher's words stay, AGENTS.md hard rule 1).
4. **Regenerate**: 66, then 47, then 50.
5. **Docs**: `docs/data-pipeline.md` gets the new stage, `docs/follow-ups.md`
   drops the two closed items.

## Scope out

- Page furniture (`THE SPOKEN WORD` footers, running headers), its own follow-up.
- Wording the LLM cleanup changed ("Saint John the 5th chapter: Jesus" became
  "John 5: Jesus"): 159 "Saint John" spots differ from the source. Not damage
  from this pipeline; a question for Samuel below.
- The French sources and `65`.

## Question for Samuel (does not block)

`65` and `66` rewrite every citation in the body to canonical form: "First
Corinthians 13" becomes "1 Corinthians 13", "Saint John 5" becomes "John 5".
That changes how the preacher said it. Keep canonical text, or leave the text
as spoken and only record the canonical ref (as item 3 does)?

## Acceptance evidence

- No French book name followed by a number in `markdown/branham/`, except the
  spots listed in the unaligned manifest.
- `git diff --word-diff` on the bodies shows only book-name tokens replaced by
  the source's words. Twenty random changes checked against the PDF in the PR.
- Running 66 after the restoration leaves the restored words alone (no
  "Isaiah 65" from "is. 65").
- Branham files with `bible_refs`: before and after. Spoken refs added: count,
  and twenty random ones checked by hand.
- For every script touched: a second run is a no-op.
