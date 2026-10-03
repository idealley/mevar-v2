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
- **Parser:** pdftohtml (poppler), local: the PDF's own text layer, the same
  words as pdftotext and LiteParse, with the preacher's bold, which Samuel
  wants kept (« his intention is to highlight what he feels is important »). LlamaParse rebuilds paragraphs, and on five PDFs
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
  check refuses and none an added word: $2.60 for a batch of 130,000 words.
  Batch 01 cost about $22, redone as the bar rose (LlamaParse's word
  changes, then the preacher's bold); from batch 02, about $4 a batch (the
  pass and a second try of refused texts), about $35 for the 9 left, about
  $57 for the goal. A part OpenAI's content filter stops goes to
  `claude-opus-5` (Samuel, batch 03: `exhortation_2011` quotes 1 Samuel
  18:11, « Je frapperai David contre la paroi »); 86 checks it like the rest.
- **Not in the pass:** `onedrive/pdf/thebath.md` is English;
  `onedrive/pdf/LA GUERRE DE LIBERATION.md` has an empty original (the
  sermon is `onedrive/pdf/exhomai2007-la-guerre-de-liberation.md` since
  batch 03's split; the empty stub still builds a page).
- **Quotes** (Samuel, after batch 01's first PR round): a citation that is
  not in the sentence is its own blockquote, `> …`, with the preacher's bold
  and the reference at the end where he gives it there, as in
  `markdown/mevar/ce-qui-arrive-le-jour-du-seigneur.md` (« Je vis un autre
  ange… (Apocalypse 14:7) »); the site sets it in italics. Verse numbers in
  a quote are bold.
- **Editing pass** (Samuel, after batch 01's bold round: « can you do
  yourself an editing pass ? »): Claude reads each text of a batch against
  its PDF, keeps or reverts every substitution, fixes what the pass missed,
  and resolves the refused changes; the fixes are
  `scripts/mevar-editorial-fixes.json`, applied and checked by 86. The
  model never adds or removes a word; the editor may, for a transcriber's
  slip only (kind `word`, listed apart): a sound that was said and not
  written (« ça été » → « ça a été », « il y des » → « il y a des »), a
  doubled or misheard word (« il n'y a avait », « Quand est-il » → « Qu'en
  est-il », « rendez de vous »). What was not said stays, as oral style: a
  dropped « ne » (« on est pas délivré »), a missing « pas ». Samuel may
  overrule any of them.
- **Headings** (goal 18): after 85, `87-section-headings.mjs <batch>`
  decides the batch's section titles; 86 applies them.
- **Paths** (goal 19): after 86 promotes a batch, `88-mevar-paths.mjs`
  moves its texts to `markdown/mevar/<title>-<year>.md`; the pipeline
  keeps their original path as its key.
- **Personal data** (Samuel, batch 08: « we can remove the phone number »):
  a private phone number or e-mail address does not reach the site. 86
  removes it from a text it promotes, and from the comparison, and counts
  it per text without quoting it (batch 09).
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

Rewriting, cutting, summarising, adding headings (a line that already stands
alone as a section title becomes one: goal 18); the Branham, Le Scribe
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

## Follow-up

- `scripts/64-add-frontmatter.mjs` rewrites a OneDrive text's frontmatter
  from `manifests/onedrive.json`, which has no `editorial_pass`: a rerun
  would demote every promoted text, as 73 would have before batch 01.
  Found by batch 01's fifth review; 64 is not run since the OneDrive
  import, so it is left for the goal that next touches it.
- A split's second work keeps its own header in its body (« LA GUERRE DE
  LIBÉRATION / Prêché à Koumassi… »): 86 moves a header to the frontmatter
  only at the document's start. Found by batch 03's last review.
- The OneDrive subtitles are inconsistent: « Exhortation de Mai 2010 »,
  « Exhortation d'Avril 2009 » beside the editor's « Exhortation de mai
  2007 »; a pass on the subtitles alone would align them.
- depliant's phone number was removed by hand (batch 09): the leaflet is a
  draft without `editorial_pass`, which 73 does not protect, so a rerun of
  73 would put the line back from its cache. Its three columns come out of
  pdftohtml interleaved; a column-aware extraction would let it through
  the editorial path. Found by batch 09's review.
- 86 removes personal data from the texts it promotes; the repository still
  holds some elsewhere: an author's e-mail in `manifests/mevar-authors.json`,
  the drafts and texts not yet promoted, and the OneDrive duplicates of
  promoted books (`le_mariage_et_les_peches_du_sexe`). Found by batch 09's
  reviews.
