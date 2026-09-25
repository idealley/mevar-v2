# GOAL 14: No page furniture in Branham, working footnotes, every Le Scribe summary linked

**Status:** ready to dispatch; runs in parallel with goal 10
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, the bodies of
`markdown/branham/` for item 1 only, two posts in `markdown/mevar/` for
item 2, the frontmatter of `markdown/le-scribe/` and `markdown/branham/`
for item 3, `web/scripts/check-dist.mjs`, `docs/`)
**Depends on:** 12 (merged as PR #14)
**Rules:** [README.md](README.md)

Goal 13 (CMPP complete) edits the `translation_fr` frontmatter of
`markdown/branham/`, this goal its bodies: the same files, other lines.
Whichever merges second merges `main` and reruns 47 and 50.

Three follow-ups from `docs/follow-ups.md`, one commit group each, in
this order: item 2 (two posts and `check-dist`), item 1, item 3. None
touches the OneDrive or PDF texts goal 10 edits. Goal 15 also edits
`markdown/mevar/` bodies: it leaves item 2's two posts alone until this
goal merges. The files several goals regenerate
(`manifests/bible-refs.json`, `index.json`) are rerun after a merge of
`main`, never merged by hand.

## Problem

**1. Printed page furniture is inside the Branham bodies.** The PDF
extractor merged the booklets' running headers and footers into the text.
Measured on `main` after PR #14:
- **Even pages:** the footer with its page number, 5,781 times of the
  5,894 « THE SPOKEN WORD » in 840 files (`grep -rhoE
  '[0-9]{1,3} +THE SPOKEN WORD' markdown/branham`): on a line of its own
  5,423 times, the rest inside a line or wrapped by the extractor in bold
  (`**18 THE SPOKEN WORD**`, 93; `**18** THE SPOKEN WORD`, 38), a heading
  mark (7) or a blockquote (1). All are in scope. The 32 « THE SPOKEN WORD
  IS THE ORIGINAL SEED » are that sermon's title header (odd pages, below);
  the other 81 occurrences are listed and classified before any is
  stripped. `53-0729` reads "…the Eastern is the
  oldest / 18 THE SPOKEN WORD / civilization": the footer, on a line of its
  own, splits the sentence.
- **Odd pages:** the sermon's title in capitals and the page number, 3,573
  times in 554 files ("THE ANGEL OF GOD 19", "THE CHILDREN OF ISRAEL 21").
- **Spaced-out headers:** « QUES TIONS A ND ANSWERS » (159) and « QUES
  TIONS AND ANSWERS » (12), with a page number.

A reader sees them in the middle of a sentence. They also feed `66` false
refs: a header like "AN EXODUS 19" gives `Exodus 19, 21, 23 … 35` in
`56-0615`, and the booklet header of *Questions and Answers on Genesis*
gives eight `Genesis` refs in `53-0729` that the sermon never cites.

**2. Two Ghost posts link to anchors that do not exist.** `check:dist`
checks a link's page, not its `#fragment`. Codex's review of goal 08 found
32 such links, all from Ghost:
- `qui-sera-enleve`: a table of contents of 16 `](#…)` links, 14 of whose
  targets do not match the ids the site gives the headings (one has a
  typo, `…corps-de-christt`);
- `le-jour-du-seigneur-4-et-les-tribulations`: 18 Word footnote links
  (`#_ftn1` …) whose anchors were lost in the Ghost import.

**3. 94 Le Scribe summaries have no Branham sermon.** `49` links 816 of
910; the other 94 are in `manifests/le-scribe-branham-unresolved.json`
with their candidates: 60 ambiguous between sermons of the same day, 10
with no Branham sermon that day, 10 where two summaries claim one sermon,
11 with no date in the id, 3 where Le Scribe's date is known to be wrong
(`530606Demons-physique` is `53-0608A`, `530607Demons-religieux` is
`53-0609A`, `600803Jehova-J` has no Jehovah-Jireh sermon within four days).
The same drift shows in the "claimed twice" rows: `550118Ange` claims
`55-0118 "This Great Warrior, David"`, and more links of the "only sermon
that day" kind may carry it unseen: only a French title set against an
English one reveals it.

## Work items

1. **Strip the furniture, spot by spot, against the PDF.** Stripping at the
   extraction stage would undo goal 07's restoration and the LLM cleanup,
   so a new script removes it from `markdown/branham/`: the three header
   forms above, each with its page number, only where the words either
   side align with the branham.org PDF (goal 07's `65b` method, `lit parse`
   on `pdfs/branham/`; fetch the PDFs with `20-download-pdfs.mjs` if they
   are missing). A header is printed matter, not the preacher's words:
   removing it is a formatting change (AGENTS.md hard rule 1), and only
   the header and its page number go, never a paragraph number or a word of
   the sermon. A spot that does not align is listed in a manifest, not
   guessed. Idempotent. Then rerun `66`, `47`, `50`: every ref that
   disappears must be one a removed header produced.
2. **Working footnotes and table of contents.** Repair the 32 broken links
   in the two posts so each lands on an anchor the built page has (a footnote
   links to its note and back; a table-of-contents entry to its heading's
   id), without changing the text. Then make `check:dist` check the
   `#fragment` of every internal link against the ids of its target page,
   same-page links (`](#…)`, which it skips today) against the page's own
   ids, so it fails on the next such link.
3. **Every Le Scribe summary linked or explained.** Prepare the 94 for
   Samuel, as goal 09 did its uncertain pairs: a committed decisions file
   (`scripts/le-scribe-branham-decided.json`, `{"<le-scribe id>":
   "<branham sermon id>" | "none"}`), and in the PR each summary with its
   French title, its candidates' English titles and dates, and the first
   lines of both. `49` reads the file: an answer links, "none" records that
   the summary has no sermon. The three known ones are proposed filled in.
   Where two summaries answer one sermon (Hébreux 2A/2B), the summaries are
   one sermon's parts: say how `summary_fr` should hold both and ask.

## Stop points

- Item 3: Samuel answers the decisions file on the PR. Nothing is linked
  on a guess; the PR can open with items 1 and 2 done and item 3 waiting.
- Item 1: if more than 5 % of the header spots do not align with the PDF,
  stop and show a sample before stripping any.

## Scope out

- The 39 French book names goal 07 could not align (their own follow-up).
- Any other change to a Branham body: typos, the LLM cleanup's wording.
- Goal 10's texts (OneDrive, PDFs) and goal 15's citation restoration.

## Acceptance evidence

1. **Furniture:** counts of the three header forms before and after (after:
   0, or only the listed unaligned spots); `git diff --word-diff` on
   `markdown/branham/` shows only removed headers and page numbers, twenty
   random removals shown with the words either side as the PDF has them.
2. **Refs:** the `66` refs removed, each traced to a removed header; no ref
   added; Branham files with `bible_refs` before and after.
3. **Footnotes:** `check:dist` with the new fragment check passes on a full
   build, and fails when one of the repaired links is broken on purpose
   (shown, then reverted); the two posts' `--word-diff` changes only link
   markup.
4. **Le Scribe:** the decisions file with Samuel's answers, `49` rerun:
   linked count before and after, and every summary left unlinked has
   "none" in the file. A second run is a no-op.
5. For every script touched or added: a second run is a no-op.
