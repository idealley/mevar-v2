# GOAL 33: a song in a sermon is shown as a song

## Problem

branham.org sets a song, a poem or lines quoted inside a sermon as an
indented block, and the corpus keeps that indentation
(`markdown/branham/1961/61-0730E.md`, line 851: « I'm bound for that
beautiful City »). Markdown reads four spaces or more as a code block, and
the site drew it as one: a dark box, a fixed-width face, lines running out
of the column. 733 built pages hold 3,375 such blocks (2026-10-06): 2,926
of Branham's, 413 of the local volumes, 28 of Le Scribe, 8 of the CMPP. Not
all are songs: 2,155 are a single line, and 664 of Branham's are the label
« Copyright Notice » (377, 34 of them « Copyright notice ») or « ENGLISH »
(287).

## Samuel's request (2026-10-06)

A screenshot of that song: « I found one thing that is not nice the song
could have a nicer layout ».

## Decisions (mine, for Samuel to overturn)

- **At display only.** The corpus keeps its indentation (hard rule 1: the
  words, their lines and their order do not move).
- **No highlighter.** No work holds code, so Astro's highlighter is turned
  off; an indented block is a plain `<pre>`.
- **Styled as verse**: the body's face, size and colour, indented like a
  quotation without its rule, each line break of the source kept, long
  lines wrapping. Runs of spaces collapse, so a block's inner indentation
  (an aside one space to the left of the song) is not shown.

- **A word longer than the column breaks, anywhere in a body.** The
  highlighter gave each block its own sideways scroll; without it, a rule
  of 53 underscores widened two Le Scribe pages on a phone. One of them,
  `620623perseverant`, has the same rule in a paragraph too, and was 411px
  wide at 390px on the site as deployed (`mevar.pages.dev`, 2026-10-06). So
  the declaration is on the body, not on the block: wider than the song,
  and the same defect.

## Work items

1. `markdown.syntaxHighlight: false` in `web/astro.config.mjs`.
2. `.prose-reader pre` in `web/src/styles/global.css`.
3. `overflow-wrap: break-word` on `.prose-reader`.

## Acceptance evidence

- The song of 61-0730E at 1440px and at 390px, light and dark: no box, no
  line out of the column.
- `620623perseverant` and `620714son-confus` at 320px and 390px: the page
  is as wide as the screen.
- No `astro-code` and no inline colour left in `dist/`.
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.

## Stop points

None.

## Left

- Branham's 664 labels (« Copyright Notice », « ENGLISH ») and some
  indented narrative are shown as indented lines of the body. Whether the
  labels belong on the page is a corpus question.
- The local volumes hold prose cut at about 72 columns inside such blocks
  (308 in volume 2). Keeping each break while wrapping gives a full line,
  then a short one, on a phone. Rejoining them is a corpus pass on two
  works.
- Some indented blocks are not songs but what an extraction left: a page
  number, « www.cmpp.ch », a rule of underscores (Le Scribe, the Mevar
  PDFs, the local volumes). They were code boxes and are now quiet lines;
  removing them is a corpus pass.
- `rehypeFrenchTypography` skips `<pre>`: a French song keeps an ordinary
  space before « ! » and « ? ».
