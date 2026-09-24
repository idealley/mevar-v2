# GOAL 10: The OneDrive and PDF texts get goal 04's pass, batch by batch

**Status:** ready after goal 09 (only texts without `duplicate_of`)
**Repo:** `mevar-v2` (`markdown/onedrive/`, `markdown/mevar-pdfs/`, `scripts/`)
**Rules:** [README.md](README.md), and goal 04's rules, which this goal adopts
**Kind:** EDITORIAL at scale: a script does the pass, a check verifies it,
Samuel reads a sample of each batch.

## Problem

Samuel decided (2026-09-24) that the OneDrive and PDF texts are Mevar once
they look like the published sermons. Today they do not: they had the LLM
cleanup (scripts 70 to 74; 336 of 339 OneDrive texts, 69 of 69 PDFs), not
the editorial pass goal 04 gave the seven drafts. Until they have it, goal
08 lists them in the archive.

Size: about 2.96 million words in OneDrive and 570,000 in the PDFs, minus
the duplicates goal 09 marks. Goal 04 did 62,000 words by hand, one commit
and one read per sermon. This goal cannot be that; it is the same pass with
the verification done by a script and by sampling.

## Design

1. **The rules are goal 04's**, section "The house style" and "Rules (this
   goal only)", unchanged: the preacher's words do not change; Scripture
   readings become blockquotes from the Segond text seeded by
   `scripts/110-seed-bible-text.mjs`, never from model memory; titles in
   sentence case with French typography.
2. **Source text first.** Where a PDF's extracted text is poor (measure it:
   OCR-like tokens, broken words, lost paragraphs, on a sample), re-parse the
   PDF before the pass. Samuel named LlamaParse (hosted) and LiteParse
   (local, open source) as options: try both on five bad PDFs, compare, and
   state the cost before parsing more.
3. **The pass**, a script over one batch of about 20 texts: an LLM applies
   the rules one text at a time; Scripture it inserts is looked up in the
   Segond data by the script, not written by the model. Cost estimated for
   the whole goal and per batch before the first run.
4. **The check, the gate that replaces reading every word.** A script
   compares each text before and after, word by word, and accepts only the
   kinds of change goal 04 allows: whitespace, punctuation and typography;
   one-word corrections within a small edit distance (spelling, agreement);
   paragraph breaks; blockquote and bold markup; inserted passages that match
   the Segond text of the announced reference exactly. Anything else is
   listed per text. A text with an unexplained change is not promoted in
   that batch: it goes back, or to Samuel.
5. **Promotion.** A text that passes gets `editorial_pass: "<date>"` in its
   frontmatter, which is what goal 08 reads. One branch and one PR per batch
   (`goal-10-batch-NN`). The PR names the three texts Samuel should read: two
   chosen at random, and the one with the most changes. **Merging the PR is
   the promotion.**

## Stop points

- The cost estimate, before the first paid run (LLM or LlamaParse).
- Every batch: Samuel reads the three texts and merges, or sends it back.
- A sentence the pass cannot make intelligible without rewording: left as
  it is and listed, never rewritten.

## Scope out

Rewriting, cutting, summarising, adding headings; the Branham, Le Scribe
and CMPP sources; merging versions (goal 09 chose one).

## Acceptance evidence (per batch PR)

- The check's output for each text: counts per kind of change, and the
  list of anything it did not accept.
- `git diff --word-diff` of the three texts Samuel reads, in the PR.
- The Segond references inserted, each with the reference it was looked up
  under.
- Spend so far against the estimate.
- For the goal as a whole, after the last batch: every OneDrive and PDF text
  without `duplicate_of` has `editorial_pass` or is listed with the reason
  it does not.
