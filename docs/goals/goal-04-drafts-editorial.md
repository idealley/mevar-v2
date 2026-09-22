# GOAL 04: The 7 drafts become publishable

**Status:** ready after goal 02 (additive Ghost import, so the edits survive)
**Repo:** `mevar-v2/markdown/mevar`
**Rules:** [README.md](README.md), with the exception below
**Kind:** EDITORIAL, not a build. No code, no script, no template change.

## Problem

Seven sermons are `status: "draft"` because nobody did the editorial pass.
They are raw transcripts, 7,000 to 13,700 words each, about 62,000 words in
total. They could be published once they look like the published sermons.

| File | Title |
| ---- | ----- |
| `dieu-veille-sur-sa-parole-pour-lexecuter.md` | Dieu veille sur sa parole pour l'exécuter |
| `la-toilette-du-chretien.md` | La toilette du chrétien |
| `le-sort-de-cain.md` | Le sort de Caïn |
| `le-temoignage-final.md` | Le témoignage final |
| `sommeil-et-assoupissement-spirituels.md` | Sommeil et Assoupissement Spirituels |
| `sors-de-ton-lit.md` | Sors de ton lit! |
| `suivons-le-seigneur.md` | Suivons le Seigneur |

What is wrong, measured: none of the seven has a single blockquote. Scripture
readings are inline or missing altogether (in `le-sort-de-cain.md` the
preacher says "Genèse chapitre 4 à partir du premier verset :" and the text
that was read is simply not there). Titles and subtitles are irregular
("Sors de ton lit!" without the French space, mixed capitalization in
"Sommeil et Assoupissement Spirituels").

## The house style (reference: `ketura-et-ses-enfants-ou-la-foi-qui-prospere.md`)

- A Scripture reading is a blockquote, in italics, with bold verse numbers:
  `> _**1**Abraham prit encore une femme... **2**Elle lui enfanta..._`
  followed by nothing else in the quote. The reference goes in the sentence
  that introduces the reading, in canonical form ("Genèse 25:1-10").
- Short inline quotations stay inline, in « guillemets ».
- No section headings inside a sermon. The preacher's key sentences may be
  bold; do not add bold that a reader of the other sermons would not expect.
- Titles: sentence case, French typography (espace insécable before ! ? : ;),
  curly apostrophes as in the published titles.

## Rules (this goal only)

1. **The preacher's words do not change.** Allowed: typos, spelling,
   agreement slips of the transcriber ("Dieu a vue" becomes "Dieu a vu"),
   punctuation, spacing, paragraph breaks, quotation layout. Not allowed:
   rephrasing, cutting repetitions or "Amen !", smoothing oral style,
   adding headings or summaries. If a sentence is unintelligible, leave it
   and list it in the report.
2. **Scripture text comes from the data, never from model memory.** Use the
   Louis Segond text seeded by `scripts/110-seed-bible-text.mjs` (the
   translation the published sermons use; confirm on two published posts
   before starting). Where a reading is missing, insert the passage the
   preacher announces. Where the preacher paraphrases, it is not a quotation:
   leave it inline.
3. **One commit per sermon**, so each diff reads on its own:
   `content(mevar): editorial pass, <title>`.
4. **`status:` stays `"draft"`.** Flipping it to `"published"` is Samuel's
   gate, one sermon at a time, after he has read it. Same for the title
   changes: propose them in the PR table, apply them in frontmatter, he
   confirms.
5. After the last sermon: rerun `65-normalize-bible.mjs` on the seven files
   (targeted run, safe after goal 02) and `47` so `bible_refs:` is lifted.

## Acceptance evidence

- Per sermon, in the PR: word count before and after (the difference must be
  explained by inserted Scripture only), number of blockquotes added, list of
  corrected typos, list of passages left untouched because unclear.
- `git diff --word-diff` on any sermon shows no change inside the preacher's
  sentences other than the allowed kinds. The reviewer samples three
  passages per sermon.
- Every inserted reading matches the seeded Segond text character for
  character (script or query shown in the PR).
- `npm run build` in `web/` passes. With goal 03 merged, the drafts are still
  absent from `dist/`.

## Human gate

Samuel reads each sermon in `npm run preview` (temporarily with drafts
visible, not committed) or in the PR, then flips `status:` himself or says
"publish". The same seven posts must then be updated or published in Ghost
only if Ghost is still live at that date; after the cutover, markdown is the
only copy that matters.
