# GOAL 31: the CMPP's texts from its own HTML pages

**Status:** written 2026-10-06 with Samuel, dispatched the same day
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

(Filled on the branch.)
