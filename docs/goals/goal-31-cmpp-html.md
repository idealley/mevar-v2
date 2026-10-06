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
  site builds, **396 have a page, 24 have none**:

  | kind | with a page | without |
  | ---- | ----------- | ------- |
  | Branham's translations | 98 | 0 |
  | circular letters | 71 | 0 |
  | monthly summaries | 186 | 1 (`video_01_2008`) |
  | yearly exhortations | 0 | 19 |
  | other | 41 | 4 (`q_r_fevrier_2008_5`, `le_reveil_promis`, `trois_visions`, `aide_au_pliage_du_traite`) |

  The yearly exhortations exist as PDF and epub only. Two pages are not
  their work's text and are refused by hand in `12b`: `video_01_2008.htm`
  is headed « Janvier 2007 » and is that month's summary;
  `questions_et_reponses_bibliques.htm` holds every question and answer
  (42,000 words) where `q_r_fevrier_2008_5` is one of them.
  `le_reveil_promis.htm` and `trois_visions.htm` are in the site's old
  layout (no `<article>`) and are left to their PDF. The name comes before
  the offered PDF because the site's own links slip: `lc41.htm` offers
  `lc40.pdf`. Nine works have a page of another name
  (`bapteme_une_question_importante.htm`,
  `quand_dieu_devint_un_homme.htm`, `info_lettres_circulaires.htm` for
  `paille_et_froment`, and six `_A4` keepers whose page has no suffix).
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
  `turndown`: the `<article>` becomes the body; the download menu, the
  arrows back to a table of contents and the images go; a verse set apart
  (`p.vec`) is a quotation; a table is a line a row. **For all 396 works
  the body's words are the page's words, in the page's order** (checked
  word by word; one page, `serie4no3`, carries a stray `</font>` that is
  dropped). Bold and italics are the page's, written so that markdown can
  say them: runs that touch are one, an empty run (173 of each on the
  pages) is none, a run over several lines is marked line by line, and
  where a run touches a word on a side where it has punctuation
  (« mot.</b>Suite », « 11.25<i>: “En… ») that punctuation is written
  outside it. A markdown parser run over the 396 bodies leaves three
  asterisks as text, the page's own footnote marks in `lc2`; the first
  conversion left 460.
- **Headers.** The header is not in the body. From it: `html_url` (396
  works), `time_of_day` (93: « soir », « matin », « après-midi »,
  « dimanche matin »…), `original_title` (80: « Unveiling of God »),
  `location` (90 changed, all Branham's: 69 « Jeffersonville, Indiana,
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
- **The 98 links** come out the same: `49b` reads `date`, `time_of_day`
  and `original_title` from the frontmatter of a work that has a page, and
  the head of its body for what the header does not print (`7sceaux1`
  prints its day under its introduction). 63 by the English title, 19 as
  the only sermon of their day, 14 by the time of day, 2 decided; 0
  unresolved; no Branham file changed. `7sceaux9`'s page says « soir »
  where it is 63-0324M, linked by its title as before.
- **Against the bodies they replace (item 6).** Share of the old body's
  words found in the new: median 0.994; of the new in the old: 0.999.
  **Six works are under 0.9**: four summaries whose page is longer than
  the PDF's text (`video_06_2010`, `video_06_2011`, `video_12_2013`,
  `video_10_2014`: the old body is within the new at 0.99 to 1.00);
  `savez-vous`, whose PDF has a coupon and a list of brochures the page
  lacks; and **`video_12_2006`, where page
  and PDF are two different texts** (0.55 and 0.61), both headed December
  2006: the page wins, **for Samuel to look at**. Read word by word across
  32 works (11 of Branham's, 11 letters, 10 summaries): what differs is
  what goal 16 fought for. The pages print the abbreviations the old
  bodies had spelled out (« Corinthiens → Cor » 46 times in the sample,
  « Romains → Rom » 41, « Esther → est » 9), capitals without accents
  (« Ésaïe → Esaïe » 19), « coeur », and the signatures the PDF bodies had
  lost (« Br. Frank », « A. Barilier »); the title pages and the running
  heads of the PDFs are gone. The misprints of the PDF that the first pass
  had corrected were not looked for one by one.
- **The layouts.** A keeper now has its page's words and its variants their
  PDF's. Two tracts fell under 83b's body test against their keeper
  (`savez-vous_A4_traite` 0.83, `le_bapteme_une_question_importante_A4_traite`
  0.87): 83b folds a variant its keeper's page offers among the layouts of
  its text. 95 duplicates, as before.
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
- **Idempotent.** A second run of `12`, `12b`, `43`, `67`, `76b`, `49b`,
  `83b`, `65`, `47`, `50` changes nothing, and `12b` fetches nothing;
  `160` rewrites its timestamp.
