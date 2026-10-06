# GOAL 31: the CMPP's texts from its own HTML pages

**Status:** done on the branch `goal-31-cmpp-html`, 2026-10-06; what is left is in « Measured »
**Depends on:** 16 (the manifest of cmpp.ch, the links to Branham's sermons,
the folded layouts)
**Rules:** [README.md](README.md)

## Problem

Every CMPP text in the corpus was read out of a PDF: extracted, then
cleaned by a model. Goal 16 showed what that costs. Words joined or cut by
the layout, Bible abbreviations spelled out by an old script, scanned
booklets whose text layer reads « taire » for « faire », a place and an
author the model supplied, and two days spent putting the PDF's words back
one by one, with 114 differences still waiting for someone to look at a
page image.

cmpp.ch publishes the same texts as HTML pages
(`http://www.cmpp.ch/brochures.htm#branham`, `#frank`, the circular
letters, the monthly summaries). Measured on 2026-10-06:

- `serie1no6.htm` is the publisher's own text: a `<header>` with the French
  title, the English one (« (Unveiling of God) ») and « 14 juin 1964,
  matin / Branham Tabernacle / Jeffersonville — Indiana, U.S.A. », then an
  `<article>` of 308 `<p>` with the CMPP's own `<b>` and `<i>`. UTF-8,
  static, no script needed to read it.
- All 98 Branham translations have a page of their own name. Of the 420
  CMPP works the site builds, at least 196 are linked from six index pages
  under their id, and pages not linked there answer too
  (`video_03_2010.htm`, `lc56.htm`, `lc_janvier_1974.htm`). Some works have
  none (`annee_2015.htm`, `quand_dieu.htm` answer 404); some pages have
  another name than their PDF (`bapteme_une_question_importante.htm`).
- Three books are spread over several pages with a chapter menu
  (`apocalypse/`, `christianisme/`, `conseil_de_dieu/`).

## Samuel's request (2026-10-06)

« they have .htm file for each text, we could use that for the site and
keep the pdf untouched? it has a "header" in html with the location, dates
etc. same thing for Frank… We could use those as well ». Then: « yes you
can write the goal for html import/extraction and start ».

## Decisions (Samuel's, and mine for him to overturn)

- **The HTML is the text, the PDF is the document.** A work that has an
  HTML page takes its body from it; its `pdf_url` and `local_pdf` do not
  change, and the page still offers the PDF.
- **Where the two editions differ, nothing is reconciled.** The HTML wins
  and the difference is reported (share of words in common, per work).
- **No model.** The conversion is a script. No LLM pass on an HTML body,
  no summary or tags rewritten: the existing `summary`, `tags`, `persons`,
  `places`, `themes` stay as they are.
- **The header goes to the frontmatter, not into the body.** The body
  starts with the text. `date`, the time of day, `location` and the English
  title come from the header when it prints them, and replace what a model
  or a rule had set; `49b` reads them there.
- **Plain fetch, not Firecrawl**: the pages are static and its key is not
  in `.env`. If a page needs more, say so.
- **A work without an HTML page keeps its body**, as goal 16 left it.

## Work items

1. **Find each work's page.** From cmpp.ch's index pages, where a text's
   `.htm`, `.pdf` and `.epub` links stand side by side, pair each manifest
   entry with its HTML page (by the PDF's name, then by the page's own
   link); try `<id>.htm` for the rest. Record `html_url` in
   `manifests/cmpp.json`. Report: works with a page, without, pages that
   belong to no work, the three multi-page books.
2. **Fetch once.** The pages go to a gitignored cache, like `pdfs/`. A
   second run fetches nothing.
3. **Convert.** `<header>` to fields; `<article>` to markdown: paragraphs,
   `<b>`, `<i>`, headings, quotations and lists as the page has them; the
   site's own navigation, images and menus out. Letter-spaced capitals
   (`<span class="f7">D</span>IEU DEVOILE`) are one word. `turndown` is
   already a root dependency.
4. **Replace the body** of every work that has a page, and set the
   frontmatter from its header. A layout duplicate (`_A5`, `_gc`,
   `_traite`) has no page of its own and keeps its body; its keeper takes
   the page.
5. **The multi-page books**: one work each, the chapters in order, if the
   corpus has the book. Report first what the corpus has.
6. **Compare** each new body with the one it replaces (words in common)
   and list the works under 0.9: another edition, a truncated PDF, a
   conversion fault. Read at least thirty by eye, across Branham, the
   letters and the summaries.
7. **Run what depends on a body again**: `49b` (from the frontmatter now),
   `83b`, `65`, `47`, `50`, `160`; `scripts/mevar-section-headings.json`
   names CMPP headings by path and line: say what becomes of it.
8. **The older-bodies pass** (`goal-16c-cmpp-older`, 3,994 words put back
   from the PDFs) is needed only for works that have no HTML page. Say how
   many those are, and whether that branch should merge, shrink or be
   dropped.
9. **Docs**: `docs/data-pipeline.md`, `docs/follow-ups.md`, this file's
   « Measured ».

## Stop points

- None on the import itself: Samuel asked for it.
- Not in this goal: uploading anything to R2, a new LLM pass, publishing
  the death notice.

## Acceptance evidence

1. **Coverage.** Works with an HTML page, without, by kind (Branham, the
   circular letters, the summaries, the rest).
2. **Fidelity.** For ten works, three paragraphs each, the page and the
   body side by side: every word, the bold and the italics.
3. **Headers.** How many works took their date, time of day, place and
   English title from the header; every one that changed, before and
   after. The 98 Branham links are unchanged, or each change is explained.
4. **No model.** `git log` shows no LLM pass; `summary` and `tags` are
   byte-identical for every work.
5. **Idempotent.** A second run of the fetch, the conversion and the chain
   changes nothing.
6. **The site builds**, `check:dist`, `check:limits`, `npm test`; three
   pages opened and read: a Branham translation, a circular letter, a
   monthly summary.

## Measured

On the branch `goal-31-cmpp-html`, stacked on `goal-16b-cmpp-rest`,
2026-10-06. No model was run.

- **Coverage (items 1 and 2).** `12b-pair-cmpp-pages.mjs` reads the 641
  pages of cmpp.ch once into `.html-cache/cmpp/` (gitignored; 31
  addresses the site answers 404 for are remembered) and pairs each work
  with its page: by its name first, then by the page that offers its PDF,
  then by the page that offers a duplicate's PDF. Of the 420 works the
  site builds, **392 take their text from their page, 28 keep their PDF's**:

  | kind | with a page | without |
  | ---- | ----------- | ------- |
  | Branham's translations | 98 | 0 |
  | circular letters | 71 | 0 |
  | monthly summaries | 182 | 5 (`video_01_2008`, `video_12_2006`, `video_06_2010`, `video_06_2011`, `video_10_2014`) |
  | yearly exhortations | 0 | 19 |
  | other | 41 | 4 (`q_r_fevrier_2008_5`, `le_reveil_promis`, `trois_visions`, `aide_au_pliage_du_traite`) |

  The yearly exhortations exist as PDF and epub only. **Six pages are not
  their work's text and are refused by hand in `12b`**, each with its
  evidence: `video_01_2008.htm` is headed « Janvier 2007 » and is that
  month's summary; `video_12_2006.htm` is headed « Décembre 2006 » and
  carries December 2007's text (3 % of its 4-word sequences are in its own
  PDF, 98 % in `video_12_2007.pdf`); `video_06_2011.htm`,
  `video_06_2010.htm` and `video_10_2014.htm` end on a paragraph of another
  month their PDF does not have (373 words of `video_04_2011.pdf`, 271 of
  `video_06_2009.pdf`, 235 of `video_11_2014.pdf`), so the page is no
  faithful witness of that month; `questions_et_reponses_bibliques.htm`
  holds every question and answer (42,000 words) where
  `q_r_fevrier_2008_5` is one of them. **For Samuel**: these five summaries
  are on the site with the wrong text or a foreign paragraph; the CMPP may
  want to know. The same fault was looked for on every page (a paragraph
  of 40 words or more that its own PDF lacks): beside those four
  summaries, `questions_reponses_ef` has two paragraphs (47 and 76 words)
  that are in `commencement.pdf` and not in its own, and `la_priere` one
  of 161 words no PDF has. Those two keep their page.
  `le_reveil_promis.htm` and `trois_visions.htm` are in the site's old
  layout (no `<article>`) and are left to their PDF. The name comes before
  the offered PDF because the site's own links slip: `lc41.htm` offers
  `lc40.pdf`. Eight works have a page of another name
  (`bapteme_une_question_importante.htm`,
  `quand_dieu_devint_un_homme.htm`, `info_lettres_circulaires.htm` for
  `paille_et_froment`, and five `_A4` keepers whose page has no suffix).
  The 95 duplicates and the draft have no page and keep their body.
- **Pages no work claims.** 100 text pages: four books spread over several
  pages, not three, **none of which the corpus has** (they have no PDF, « En
  cours »): « L’Apocalypse — un livre scellé de sept sceaux? »
  (`apocalypse/`, 25 pages), « Le Christianisme Traditionnel — Vérité ou
  tromperie? » (`christianisme/`, 30), « Le Conseil de Dieu »
  (`conseil_de_dieu/`, 29) and « Le défi de la théologie et plus… »
  (`le_defi/`, 34); and `halloween.htm`, the `real_*.htm` pages (questions and
  answers by book of the Bible), `liens.htm`, `nous_contacter.htm`. Item 5
  is therefore not done: importing the four books would add works the
  manifest does not have. **For Samuel.**
- **Conversion (items 3 and 4).** `43-import-cmpp-html.mjs`, with
  `turndown`: what `<main>` holds beyond a circular letter's number and
  month, then the `<article>`, become the body (a first version took the
  article alone and lost the opening of 14 texts, 1,300 words: `eden`'s
  introduction, the addressees of `lettre_ouverte`); the download menu, the
  arrows back to a table of contents and the images go; a verse set apart
  (`p.vec`) is a quotation; a table is a markdown table (`7sceaux4`: `| **V** | **I** | **C** | A |
  R | …`, a rule row, then `| 5 | \+ 1 | \+ 100 | …`); a heading of two
  lines is one heading; the page's own numbering (« 1) Actes 2.38 »,
  « 39. ») is text, and a markdown parser finds no ordered list in the
  392 bodies. **Every word of the 392 pages, header, main and article
  (3,478,263, navigation out), is in the body, in the page's order, or in
  a frontmatter field**, but two things taken out on purpose: « Tel que je
  suis », the caption of an audio player in `le_chemin_qui_mene_a_dieu`,
  with the label that opens its transcription; and, in six works, the
  narrow-screen copy of a block the page also sets as a table. The page's
  own `<style>` hides that copy at full width (`#tab600{ display:none; }`,
  `.responsive-table .stacked-table`, `#img600`), and 43 leaves out what
  it hides; the first import printed both copies: `lc39` (853 words
  twice), `lc47` (436), `lc54` (41), `7sceaux4` and `antichrist` (29
  each), `lc22` (9). No other page hides at full width anything that was
  in a body. A « < » the page prints is escaped (`lc2`: « dites:
  <Amen>…» », which markdown read as a tag), and a parser finds no raw
  HTML in the 392 bodies; `serie4no3`'s page prints a stray « </font> »
  as text, and so does its body. Underlining has no markdown: the 119
  words the pages underline (mostly « Question N / Réponse » in
  `questions_reponses_ef`) are there, not underlined. Of the 3,956 line breaks of the pages 3,680 are line
  breaks in the bodies; 51 are doubled and make a paragraph, 107 close a
  block, 41 are inside a heading and are a space; the rest are in table
  cells. Bold and italics are the page's, written so that markdown can
  say them: runs that touch are one, an empty run (173 of each on the
  pages) is none, a run over several lines is marked line by line, and
  where a run touches a word on a side where it has punctuation
  (« mot.</b>Suite », « 11.25<i>: “En… ») that punctuation is written
  outside it. A markdown parser run over the 392 bodies leaves three
  asterisks as text, the page's own footnote marks in `lc2`; the first
  conversion left 460.
- **Headers.** The header is not in the body. `title_page` holds its lines
  as printed, all of them (a circular letter's motto and its « LETTRE
  CIRCULAIRE N° 56 », a book's « Titre original de l’ouvrage »), so no word
  of it is lost. From it: `html_url` (392
  works), `time_of_day` (96: « soir », « matin », « après-midi »,
  « dimanche matin »…), `original_title` (82: « Unveiling of God »),
  `location` (93 changed against the branch this one starts from, all
  Branham's: 69 « Jeffersonville, Indiana,
  U.S.A. » are « Branham Tabernacle, Jeffersonville — Indiana, U.S.A. » as
  printed, the others gain the hall the page prints, « Life Tabernacle,
  Shreveport — Louisiane, U.S.A. », « Parkview Junior High School
  Auditorium… »), `date` (2 changed: `lc56` had none and is `2005-01`;
  `lc55` was `2004-02`, as its PDF prints, and is `2004-01`, as its page
  prints: the two editions disagree and the page wins). `title` and
  `subtitle` are not touched: a first version wrote the date line into
  `subtitle` and lost « Premier Sceau »; the time of day has its own
  field. `serie5no3`'s page prints one date, « 18 avril 1965, soir », which
  settles the booklet's two. `serie5no10`'s page prints « Phoenix —
  Indiana » like the booklet, and `serie6no3` « Assemblée de Dieu de
  Grantway, Phoenix — Arizona » where the frontmatter said Tucson. The
  date of `les_aigles_de_dieu` stays 1960-04-03 against its header's « 4
  mars 1960 » (goal 16). `76b` loses its entry for `la_profondeur` (the
  header prints « Juillet 1954 ») and no longer applies its PDF rules for
  date and place to a work that has a page.
- 17 of Branham's 98 lack a header field because their header does not
  print it: the fifteen of « La Révélation de Jésus-Christ » (`rev01` to
  `rev15`) print no English title, `7sceaux1` prints neither day, place
  nor English title, `la_profondeur` a month and no time of day.
- **The 98 links** come out the same: `49b` reads `date`, `time_of_day`
  and `original_title` from the frontmatter of a work that has a page, and
  the head of its body for what the header does not print (`7sceaux1`
  prints its day under its introduction). 63 by the English title, 19 as
  the only sermon of their day, 14 by the time of day, 2 decided; 0
  unresolved; no Branham file changed. `7sceaux9`'s page says « soir »
  where it is 63-0324M, linked by its title as before.
- **Against the bodies they replace (item 6).** Share of the old body's
  words found in the new: median 0.994; of the new in the old: 0.999.
  **Six works were under 0.9** in the first import. Five were
  the site's fault and keep their PDF body (above): `video_12_2006`
  (another year's text) and three summaries that end on a foreign
  paragraph; a first reading took these for « the page is longer », which
  was wrong. `video_12_2013` and `savez-vous` remain: the first has a
  closing passage its PDF lacks and no other PDF has, the second a PDF
  with a coupon and a list of brochures the page lacks. Read word by word across
  32 works (11 of Branham's, 11 letters, 10 summaries): what differs is
  what goal 16 fought for. The pages print the abbreviations the old
  bodies had spelled out (« Corinthiens → Cor » 46 times in the sample,
  « Romains → Rom » 41, « Esther → est » 9), capitals without accents
  (« Ésaïe → Esaïe » 19), « coeur », and the signatures the PDF bodies had
  lost (« Br. Frank », « A. Barilier »); the title pages and the running
  heads of the PDFs are gone. The misprints of the PDF that the first pass
  had corrected were not looked for one by one.
- **The layouts.** A keeper now has its page's words and its variants their
  PDF's. One tract is under 83b's body test against its keeper
  (`savez-vous_A4_traite`, 0.834): 83b folds a variant its keeper's page
  offers among the layouts of its text. 95 duplicates, as before.
- **`scripts/mevar-section-headings.json`** (goal 18) holds 1,086
  decisions for 200 of the works that now have a page. They name lines of
  the old bodies and are not applied: they would write « Église » where
  the page prints « EGLISE ». The 609 headings of the new bodies are as
  the pages print them, mostly in capitals. The file is not changed; 87
  can decide the new headings, and it asks a model. **For Samuel**:
  sentence case for these headings again, or the page's capitals.
- **What depends on a body** was run again: `49b`, `83b`, `65` (the
  `bible_refs` of 125 works move), `47`, `50`, `160`. `73` and `75` skip
  a work that has a page. A header's motto (« Jésus-Christ est le même
  hier, aujourd’hui, et éternellement » (Hébreux 13.8), on every circular
  letter) is in no body any more, so that reference left their
  `bible_refs`.
- **No model.** `summary`, `tags`, `persons`, `places`, `themes`, `title`,
  `subtitle`, `preacher`, `pdf_url` and `local_pdf` are byte-identical for
  all 516 works; `llm_cleaned: true` stays in the frontmatter of a work
  whose body is no longer a clean-up's, because 72 reads it to leave the
  work alone.
- **Goal 16c (item 8).** Of the 207 works `goal-16c-cmpp-older` restored
  words in, 177 now take their text from their page, which already prints
  what that pass put back. 30 have no page: 26 are duplicates the site
  does not build, 4 are built (`annee_2020`, `exhortation_annee_2025_A4`,
  `exhortation_annee_2026_A4`, `q_r_fevrier_2008_5`; 37 lines). That
  branch should be dropped, or shrunk to those four.
- **Pages the site no longer builds.** 4,567 against 4,568 before this
  goal: `/bible/1-chroniques/16/`, `/bible/2-samuel/2/` and the tenth page
  of `/bible/hebreux/13/8/` went (no body cites the first two any more;
  the motto of the circular letters, « (Hébreux 13.8) », is in
  `title_page` and no longer in a body, so 65 does not record it), and
  `/bible/jean/15/tout/` came with a second page. Samuel has since answered that a
  reference on a title page counts as cited (below). (The page lost by goal
  16's fourth-review fix was `/auteurs/ewald-frank/6/`: 54 works fewer are
  his.)
- **For Samuel: nothing reads `title_page`.** The words of the title
  pages of 392 works (a letter's motto, « Titre original de l’ouvrage »,
  the hall and the day as printed) are kept in the frontmatter and shown
  nowhere on the site.
- **Idempotent.** A second run of `12`, `12b`, `43`, `67`, `76b`, `49b`,
  `83b`, `65`, `47`, `50` changes nothing, and `12b` fetches nothing;
  `160` rewrites its timestamp.

### The headings in sentence case: the estimate, written before the first call (2026-10-06)

Samuel: « We can launch the pass to fix the texts capitals ». `87 --pages`,
goal 18's script and model (`gpt-6-sol`), on the headings the pages print
in capitals; no other line.

- **Works and headings:** the 392 bodies have 641 headings, 615 of them in
  capitals. 211 are lines goal 18 had already decided, word for word, and
  cost nothing. **404 headings in 71 works** go to the model.
- **Tokens:** one call a work. The instructions are about 900 tokens a
  call (64,000 in all); a heading goes with 160 characters before and
  after it, about 110 tokens (44,000). **About 110,000 tokens in.** Out: a
  line a heading, about 5,000 tokens; if the model reasons before it
  answers, up to 4,000 more a call, 284,000 at the very most.
- **Price** (2 USD a million in, 10 out, as 87 counts): 0.22 USD in, 0.05
  out: **about 0.30 USD**; 3.10 USD at the very most.
- **Limit:** 15 USD (Samuel). Under it.

### Samuel's answers of 2026-10-06, applied

- **Headings in sentence case (A).** `87 --pages`: **404 headings in 71
  works decided, 69,837 tokens in and 10,205 out, 0.24 USD** (estimate
  0.30). With the 211 goal 18 had already decided, 615 of the 642 headings
  of the 392 bodies change, in 100 works. Checked heading by heading
  against the bodies as they were: 614 keep their letters and their level,
  case, accents and « œ » aside; the other one, `## **LE PECHE
  ORIGINEL**`, loses its bold, as goal 18 says. Goal 18's rule puts the
  accents on the capitals: 364 headings gain an accent or a ligature the
  page does not print (« EGLISE » → « Église », « OEUVRE » → « œuvre »).
  **Of the 82,302 lines that are not headings, none changes.** 87 now
  takes an answer at the line's own level (`#` and `####` as well as
  `##` and `###`) and keeps a body's last line end. One decision is
  corrected by hand against the work's own subtitle: `7sceaux1`, « Dieu
  caché et révélé dans la simplicité » (the model had read two verbs,
  « cache et révèle »). Left as the page prints: 8 lines the model left
  alone, and `serie1no2`'s « ##### DIEU EST SON PROPRE INTERPRETE », a
  fifth level 87 does not read. Doubtful, for Samuel: « sa Parole » where
  the capitals do not say whether the page means « Sa Parole » (three
  headings); a page's slips kept in lower case (« L a vraie Église »,
  « La la foi biblique », « Lles soixante-dix semaines »); headings that
  were several lines of a title, read as one phrase (« Baptême repas du
  Seigneur lavage des pieds », « Au commencement était la Parole pas
  l’interprétation », « Appendice le rétablissement du quatrième
  empire »).
- **A title page's reference counts as cited (B).** 65 reads
  `title_page` before the body. 71 works gain a reference: Hébreux 13:8
  for 70 (the circular letters' motto) and Actes 19:3 for one; none loses
  one. `/bible/hebreux/13/8/` has its tenth page again and lists 108 CMPP
  works.
- **The four books (C)**: a goal of their own; what is known is in
  `docs/follow-ups.md`.
- **Authors (D).** The 50 yearly exhortations are drafts until their
  author is verified (51 CMPP drafts with the death notice; 31 of the 50
  were already duplicates): **401 CMPP works are built, 420 before**, 392
  of them from their page. `duplicateRedirects` writes no rule from a
  draft nor to one: 385 targets in `_redirects`, 416 before. In the built
  site no page, no redirect, no sitemap entry and no Pagefind fragment
  names one of the 50. `ministeres_pasteur_A4`, `_A4_gc`, `_A5` and
  `reflexions` have the author « CMPP » (`/auteurs/cmpp/`, two pages
  built, the two others being layouts). The 21 works given to Ewald Frank
  that no page signs are unchanged.
- **Pages.** 4,543 built, 4,567 before: the 19 exhortations that had a
  page, and seven Bible pages that no longer have enough works without them (`/bible/2-samuel/22/`,
  `/bible/psaumes/112/`, `/bible/psaumes/145/`, `/bible/actes/1/8/` and
  its second page, `/bible/matthieu/24/14/` and its second page) are
  gone; `/auteurs/cmpp/` and `/bible/hebreux/13/8/10/` are new. 3,007
  pages indexed, 3,026 before.
