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
   paragraph breaks; blockquote and bold markup; inserted passages that match
   the Segond text of the announced reference exactly. **Word
   substitutions are never accepted silently**, whatever their edit
   distance: « foi » to « loi » is one letter and changes the sermon. Every
   substituted word goes into a table in the batch PR (before, after, the
   sentence), in two groups: a non-word corrected to a word (a dictionary
   says which), and a word replaced by another word (agreement, homophones:
   « vue » to « vu »). Samuel reads the whole table, not a sample; the
   second group line by line. Anything else is listed per text. A text
   with an unexplained change is not promoted in that batch: it goes back,
   or to Samuel.
5. **References and reruns.** After the pass, each batch reruns stage 65
   on its texts and stage 47 (goal 04's rule 5), so `bible_refs` and
   `manifests/bible-refs.json` match the edited text, with the no-op second
   run; goal 08's verse pages read them. Stage 73 (`73-apply-llm.mjs`)
   rewrites bodies and frontmatter from its cache: it must skip every text
   that has `editorial_pass`, or a rerun would undo the pass and demote the
   text. That change to 73 lands with batch 01, with a test run showing
   promoted texts untouched.
6. **Promotion.** A text that passes gets `editorial_pass: "<date>"` in its
   frontmatter, which is what goal 08 reads. One branch and one PR per batch
   (`goal-10-batch-NN`). The PR names the three texts Samuel should read: two
   chosen at random, and the one with the most changes. **Merging the PR is
   the promotion.**

## Measured before the first run, and Samuel's answers (2026-09-25)

- **Scope:** 166 texts without `duplicate_of`: 165 OneDrive (158 from a
  PDF, 7 from a .docx) and `mevar-pdfs/le_royaume_de_dieu_kadjani`, 1.56
  million words. The originals are Samuel's OneDrive folder
  `Private/mevar-uploads`, byte-identical to `manifests/onedrive-inventory.json`,
  linked as `onedrive/` (gitignored).
- **Source quality:** the words are clean (5.6 non-words per 1,000, the
  published Ghost sermons 7.4); the defect is lost paragraphs (8 texts with
  a paragraph of 2,000 to 7,800 words). 163 of 164 PDFs have a text layer;
  the last is an empty 2 KB file. No OCR.
- **Parser:** LiteParse, local, without OCR: the PDF's own text layer, the
  same words as pdftotext. LlamaParse rebuilds paragraphs, and on five PDFs
  kept every word; on batch 01 it rewrote some ("vends" → "vendis",
  "serviteurs" → "serveurs", "avouait" → "avait était"), which the
  independent review found, so it was dropped (1,854 free credits spent).
  The pass rejoins the lines and paragraphs itself.
- **65's canonical rewrites:** 65 ran before the DeepSeek cleanup, so the
  cleaned text carries them. All 4,407 citations in the 158 OneDrive texts
  that cite Scripture are canonical; in three originals, 726 of 728
  non-canonical citations had been rewritten. Samuel: restore. The pass
  starts from the original (84), so the preacher's forms come back, and the
  DeepSeek cleanup's word changes go through the check too.
- **Model:** a pilot on three texts; `gpt-6-sol` had the fewest changes the
  check refuses and none an added word: about $30 for the goal, $2.60 for a
  batch of 130,000 words.
- **Not in the pass:** `onedrive/pdf/thebath.md` is English;
  `onedrive/pdf/LA GUERRE DE LIBERATION.md` has an empty original.
- **Batches:** `scripts/mevar-editorial-batches.json`. The two books
  (`le_royaume_de_dieu_kadjani`, `les_cinq_ministeres_de_la_parole`, 200,000
  words together) get a batch of their own.

## Stop points

- The cost estimate, before the first paid run (LLM or LlamaParse).
- Before the first edit: how many of the OneDrive texts still carry 65's
  canonical rewrites from before goal 07 ("Math. 24, 6" became "Matthieu
  24:6"), measured against their `.docx` originals (Samuel provides them),
  and a proposal to start the pass from the preacher's form. Samuel
  decides. Goal 14 does the same for the other French sources.
- Every batch: Samuel reads the three texts and merges, or sends it back.
- A sentence the pass cannot make intelligible without rewording: left as
  it is and listed, never rewritten.

## Scope out

Rewriting, cutting, summarising, adding headings; the Branham, Le Scribe
and CMPP sources; merging versions (goal 09 chose one).

## Acceptance evidence (per batch PR)

- The check's output for each text: counts per kind of change, and the
  list of anything it did not accept.
- The word substitution table, both groups, complete.
- Stages 65 and 47 rerun on the batch, second run a no-op.
- `git diff --word-diff` of the three texts Samuel reads, in the PR.
- The Segond references inserted, each with the reference it was looked up
  under.
- Spend so far against the estimate.
- For the goal as a whole, after the last batch: every OneDrive and PDF text
  without `duplicate_of` has `editorial_pass` or is listed with the reason
  it does not.
