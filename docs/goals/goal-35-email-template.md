# GOAL 35: the publication email shows the opening of the text

**Status:** in progress on `goal-34-email-template` (2026-10-08; numbered 35 on
2026-10-09, after goal 34's install sheet took 34 first)
**Repo:** `mevar-v2` (`email/`)
**Rules:** [README.md](README.md)

## Problem

Goal 06's email (`email/build.mjs`) shows the title, the byline, the
`summary:` and a button. None of the 341 published Mevar works has a
`summary:` (2026-10-08), so the email a reader receives is a title and a
button, with nothing to make them read. It also predates the design (goal
27) and the logo (goal 30), says « Lire la prédication » under an
exhortation or a study, offers the PDF only from `local_pdf` (not the text
PDF of goal 23) and never offers the recording (75 works have one).

## Samuel's request (2026-10-08)

« Usually we have long sermons, or bible study, maybe we should have a nice
template, where we can share the beginning with read more, download the PDF
etc. » Agreed in chat: the opening of the text, about 200 words, a `--from`
option, a kind label, a « Textes » line, the recording.

## Design

1. **The excerpt is the work's own words** (hard rule 1). Whole blocks
   (paragraphs, quotations) in reading order up to 200 words. The block
   that crosses the limit is cut at a sentence end, unless 120 words are
   already in: then the excerpt ends on the block before. « … » marks a cut.
   Only paragraphs, quotations and verse blocks are read: a heading, a
   list (an audio post's « Sur le même sujet ») or a rule is passed over,
   and a work with no text of its own has no excerpt and « Ouvrir la
   page » for its button. Bold, italics and quotations as the site draws
   them. Plain text part: the same words, quotations indented. The unused
   `summary:` leaves the email; the preheader is the excerpt's opening.
2. **`--from "<phrase>"`** starts the excerpt at the first block that
   holds that phrase, at the phrase itself (apostrophes and spaces
   compared loosely, case kept). Not found: the build stops.
3. **Kind label** above the title, from the site's rule (`deriveKind`):
   « Prédication », « Exhortation », « Étude biblique »…
4. **« Textes »:** the first three `bible_refs`, in the order the work
   cites them (goal 12).
5. **Actions:** « Lire la suite » (the page), « Télécharger le PDF » (the
   PDF the page offers first: `text_pdf`, then `local_pdf`), « Écouter »
   (`local_audio`, on R2).
6. **Look:** the site's light theme (ground, ink, accent), the eagle (PNG:
   mail clients do not show SVG) beside « MEVAR », Georgia for the serif.
   HTML under 40 KB, as before.

## Scope out

- Editorial fixes in the opening of a work (« jevoudrais »): goal 10's pass.
- Dark mode in mail clients, web fonts in the email.
- A summary per work.

## Acceptance evidence

- `node email/build.mjs` on the work of goal 06's acceptance and on
  `markdown/mevar/untitled.md`, with and without `--from`: sizes printed,
  under 40 KB.
- A screenshot at phone width (390 px) attached to the PR.
- `npm test` passes, with a test of the excerpt's cut rules.
