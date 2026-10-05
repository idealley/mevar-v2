# GOAL 16: CMPP complete, and each Branham translation linked to its sermon

**Status:** done, 2026-10-06: items 6 to 9 on 2026-10-05 at Samuel's request (« why is this one "undated" in the path… could we verify all those to make this clean? »), items 1 to 4 and the rest of item 5 the day after (« I approve all of it, you can crawl, correct etc. until everything is clean »). What waits for Samuel is listed in « Measured »
**Repo:** `mevar-v2` (`scripts/12-discover-cmpp.mjs`, `scripts/20-download-pdfs.mjs`,
`scripts/72-llm-fanout-multi.mjs`, `scripts/73-apply-llm.mjs`, a new
`scripts/49b-link-cmpp-branham.mjs`, `manifests/cmpp.json`,
`markdown/cmpp/`, the `translation_fr` field of `markdown/branham/`,
`web/src/components/WorkPage.astro`, `web/src/lib/utils.ts`, `docs/`)
**Depends on:** 09 (the `duplicate_of` convention and its decided-file
pattern), 12 (the refs pipeline this goal reruns)
**Rules:** [README.md](README.md)

## Problem

The CMPP (cmpp.ch, Ewald Frank's French publishing side) is the one source
in the corpus that holds full French translations of William Branham's
sermons, not summaries. `markdown/cmpp/` has 242 works. Measured on `main`,
2026-09-25:

- **107 are Branham sermons in French** (`preacher: "William Branham"`),
  98 of them dated 1954 to 1965 by the LLM pass, 9 undated tracts. They
  include the whole Seven Seals week of March 1963 (`7sceaux1` to
  `7sceaux10`), the Revelation series of December 1960 (`rev01` to
  `rev15`) and five of the six twelve-booklet series (`serie1no1` to
  `serie6no5`). **None is linked to its English original.** No `original:`
  in `markdown/cmpp/`, no Branham file names a translation. A reader on
  `63-0317M` is not told that a French translation exists; the work page
  can only offer the Le-Scribe summary. `docs/infographics.md` (the
  Branham timeline) needs the link to count translations per sermon.
- **The attribution and the dates come from the LLM, unverified.**
  `72-llm-fanout-multi.mjs` asks the model for `preacher` and `date`. Most
  look right (the booklet's title page states both), some do not: `eden`
  ("Le séducteur, Caïn et le péché originel", location Krefeld) is
  attributed to Branham; `serie5no3` carries two dates in its subtitle
  ("21 février 1965, après-midi / 18 avril 1965, soir"); `serie5no10` says
  "Phoenix, Indiana". The 9 undated "Branham" tracts (`savez-vous`,
  `quand_dieu`, `le_bapteme_une_question_importante`, `quel_bapteme`,
  `eden`, and their `_A4_traite` twins) may be Frank's tracts quoting him.
- **The site's list of the source is stale and its cache is gone.**
  `12-discover-cmpp.mjs` builds the manifest from a Firecrawl crawl kept
  in `.firecrawl/` (gitignored); that folder no longer exists on the Mac,
  nor does `pdfs/`. Series 6 stops at booklet 5 where series 1 to 5 have
  12; the circular letters stop at `lc62`; what cmpp.ch publishes today is
  unknown. Note: cmpp.ch fails the TLS handshake from a Linux sandbox
  (2026-09-25); discovery and download run on the Mac.
- **Three works were never cleaned.** `lc56`, `serie1no8`, `serie4no6`
  errored in the LLM pass (`manifests/cmpp-llm-stats.json`: "chunk 5
  failed", "terminated", "chunk 4 failed"). Their bodies are the raw PDF
  extraction (80 to 120 KB each, no `llm_cleaned`), with hand-written
  frontmatter from `76-add-missing-frontmatter.mjs`.
- **Thirty files are layout variants of thirteen texts.** The same
  publication exists as `_A4`, `_A5`, `_gc` (grands caractères) and
  `_traite` (tract) editions: `exhortation_annee_2026` four times,
  `lc1`/`lc1_A5`, `savez-vous`/`savez-vous_A4_traite`, and so on. Each is a
  work today, so a reader finds the same text up to four times and the
  archive counts inflate. 17 duplicates.
- **Every CMPP work is a `bible_study`.** `web/src/lib/utils.ts:26` gives
  the source one kind. A Branham sermon translated is a `sermon`, like its
  original; a circular letter is not a Bible study either.

## Work items

1. **Discover again, on the Mac.** Replace the Firecrawl input of `12` with
   a plain fetch of cmpp.ch's pages (the site is static HTML with links to
   PDFs; if it needs more than fetching its index pages, say so in the PR
   rather than reintroducing Firecrawl, whose key is no longer in `.env`).
   Same output, `manifests/cmpp.json`, same fields. Report, before any
   download: PDFs on the site and not in the manifest (expected: series 6
   booklets 6 to 12, circular letters after 62, anything since the last
   crawl), manifest entries no longer on the site (kept, with the PDF's
   local copy as the source of truth once downloaded).
2. **Download and clean what is new** with the existing stages:
   `20-download-pdfs.mjs manifests/cmpp.json`, extraction, `72` and `73`
   for `cmpp`, `47`, `65`, `50`. New works go through the same LLM pass as
   the existing ones, nothing more. Where the extracted text is poor,
   LlamaParse or LiteParse per the 2026-09-24 decision.
3. **Clean the three errored works.** Rerun the pass on `lc56`,
   `serie1no8` and `serie4no6` with `74-recover-errors.mjs` (smaller chunks;
   it takes `onedrive|le-scribe|branham` today, so add `cmpp` to its
   sources the way `72` and `73` have it, nothing else). It needs
   `DEEPSEEK_API_KEY` in the root `.env`, which is not there today: Samuel
   adds it before dispatch, or the three go through LlamaParse with the
   new works. Their hand-written frontmatter in `76`
   stays authoritative for title, date, preacher; only the body and the
   LLM's `summary`, `tags`, `persons`, `places`, `themes` change.
4. **Fold the layout variants.** For each of the 13 groups, one keeper and
   `duplicate_of: "cmpp/<year>/<id>"` on the others, the goal 09 mechanism
   (the site does not build a duplicate; nothing is deleted). Keeper: the
   id without suffix; between `_A4` and `_A5` only, the `_A4`; `_gc` and
   `_traite` never keep. Confirm each group on the body (goal 09's
   comparison, or a containment check on normalised words: a tract is
   often an excerpt of the full text, which is a `duplicate_of` too, the
   full text keeping). A group whose bodies differ beyond layout is not
   folded: it goes to the report.
5. **Verify the 107 attributions and dates against the PDF.** For each
   work with `preacher: "William Branham"`, read the title page of its PDF
   (the CMPP booklets print the English title, the date, the place and the
   time of day): confirm or correct `preacher`, `date`, `location` in the
   frontmatter, and write the English title in `subtitle` where the
   booklet gives it. A tract that quotes Branham inside Frank's text is
   Frank's. Where the PDF itself is ambiguous (`serie5no3`), the work goes
   to Samuel with the two candidates. No date is set from what a model
   remembers about Branham's ministry.
6. **Link each translation to its sermon.** New
   `scripts/49b-link-cmpp-branham.mjs`, the shape of `49`: index
   `markdown/branham/` by day, resolve by the date, then the time of day
   from the subtitle ("matin", "après-midi", "soir") against the `M`/`A`/`E`
   suffix, then the English title from item 5 against the sermon's title.
   Writes `original: "branham/<year>/<id>"` on the translation and
   `translation_fr: "cmpp/<year>/<id>"` on the sermon, next to
   `summary_fr`. Anything still ambiguous is listed in
   `manifests/cmpp-branham-unresolved.json` with its candidates and never
   guessed; Samuel's answers live in `scripts/cmpp-branham-decided.json`
   (his input, next to the script, as goal 09 does it) and a rerun keeps
   them. Two translations claiming one sermon (a booklet split in two, or
   `rev01`/`rev02` if both are 60-1204), or one booklet covering two
   sermons, stop and go to the report: the schema has one `translation_fr`
   per sermon, and widening it is a decision, not a guess.
7. **The year folder and the URL.** A work's URL is `/works/<path>/`, so a
   dated sermon under `cmpp/undated/` would go live at an `undated` URL.
   The site is not live: the link script moves each linked translation to
   `markdown/cmpp/<year>/` (the sermon's year), updates `local_md` in the
   manifest and every field that names the old path (`duplicate_of`,
   `original`, `translation_fr`), then `47` and `50` rerun. Unlinked works
   stay where they are.
8. **The kind.** `utils.ts`: a CMPP work with `original` (or `preacher:
   "William Branham"`) is a `sermon`; the rest of the source keeps
   `bible_study` (changing that is a display decision for the archive, not
   this goal).
9. **The work page.** `WorkPage.astro` already renders `original` and
   `summary_fr`. On a translation, the sentence says "Traduction de la
   prédication « … » (texte original en anglais)", not "Résumé"; on a
   sermon, a third line "Traduction en français : « … »" next to the
   summary line. Copy rules of `AGENTS.md`.
10. **Docs.** `docs/data-pipeline.md` (12's new input, 49b), `docs/follow-ups.md`
    (drop "CMPP translations with no Branham link"; add what stays
    unresolved), `docs/infographics.md` (the prerequisite is met, the
    counts), this file (status and measured numbers).

## Stop points

- After item 1: the discovery report (new on the site, gone from the
  site), before any download.
- After item 6: the unresolved list and the doubtful attributions of item
  5, as a table in the PR (id, title page transcription, candidates).
  Samuel answers per line; the answers are committed; the script reruns.

## Scope out

- Any change to a body beyond the LLM cleanup of new and errored works
  (hard rule 1). No editorial pass on the translations.
- Ewald Frank's and Alexis Barilier's own works (135): discovered,
  downloaded and folded like the rest, not linked to anything.
- A "CMPP timeline" or any page listing the source: `docs/infographics.md`.
- Widening `translation_fr` to a list: only if item 6 finds the case, and
  then as a decision recorded in the PR, not silently.
- Le-Scribe's 94 unlinked summaries (`follow-ups.md`): a separate pass.

## Acceptance evidence

Each item is shown in the PR with the command run and its output. The
expected values were measured on `main` on 2026-09-25 (242 works, 107
Branham, 13 variant groups, 3 uncleaned, 0 links).

1. **The manifest matches the site.** Count of PDFs on cmpp.ch, of manifest
   entries, of entries added and of entries no longer online; every
   manifest entry has a `local_md` that exists. A second run of `12` is a
   no-op.
2. **Every new PDF is a work.** For each added entry: the PDF in `pdfs/cmpp/`,
   the markdown with frontmatter and `llm_cleaned: true`, `bible_refs` from
   `65`. Count of new works, count with poor extraction and how they were
   parsed.
3. **No raw body remains.** `grep -L 'llm_cleaned: true' markdown/cmpp/*/*.md`
   returns only the files `76` documents as hand-made, if any; `lc56`,
   `serie1no8`, `serie4no6` are cleaned, their `76` frontmatter unchanged.
4. **One work per text.** 13 groups folded (or fewer, with the reason per
   group left out); `duplicate_of` on 17 files; `allWorks()` excludes them;
   the count of CMPP works the site builds equals entries minus duplicates.
5. **Attributions verified.** A table of the 107: id, what the title page
   says (preacher, date, place, time of day, English title), what changed.
   Expected: a handful of corrections, `eden` and the tract twins among the
   candidates; 0 dates from memory.
6. **Links.** Count linked, count unresolved, count decided by Samuel.
   Expected: about 98 candidates, most resolved by date and time of day.
   Each linked pair: `original` on the translation, `translation_fr` on
   the sermon, both paths existing (`check:dist` or a small assertion over
   the corpus). 0 sermons with two `translation_fr`; 0 translations with
   two `original`.
7. **Folders and URLs.** No linked translation under `cmpp/undated/`;
   `git diff --stat` shows the moves as renames (`git mv`), and no field
   anywhere names a path that no longer exists.
8. **The site builds.** `npm run build` on the full corpus; a translation's
   page shows the "Traduction de la prédication" line and links to a
   sermon page that shows "Traduction en français"; a translation is a
   `sermon` in the lists. Ten random pairs shown, with URLs.
9. **Idempotent.** A second run of `12`, `20`, `49b`, `47`, `65`, `50`
   leaves `git status` clean.

## Measured

Items 6 to 9 on the branch `goal-16-cmpp`, 2026-10-05; items 1 to 5 on
`goal-16b-cmpp-rest`, stacked on it, 2026-10-06.

- **Item 1, the discovery.** `12` reads cmpp.ch itself: the home page and
  the sitemap lead to 644 pages (one link of the site is dead,
  `index_temp.htm`), which link **512 PDFs**. The manifest had 242:
  **274 are new**, and **4 are no longer linked** on the site (kept):
  `janvier1974`, `mars1974`, `juillet1974`, `octobre1974`, the same four
  letters the site now names `lc_janvier_1974` and so on. Not what the goal
  expected: series 6 has no booklet after 5 and the circular letters stop
  at 62 on the site too. The 274: 178 monthly « Sommaire des rencontres »
  (`video_MM_YYYY`, 2003 to 2019), 70 A5 or large-print layouts, and 26
  other texts (the yearly exhortations 2007 to 2023, `harry_potter`,
  `honore_tes_parents`, `la_priere`, `quel_amour`, `reflexions`,
  `nouvelle_naissance`, `paille_et_froment`, `quanddieu`,
  `faire_part_alexis_barilier`, and two texts of Parfait M'bra,
  `le_reveil_promis` and `trois_visions`).
- **Item 2, the new works.** All 274 downloaded (`20`), extracted, cleaned
  (`72`, `74`, `73`), each with `llm_cleaned: true` and its `bible_refs`.
  LiteParse extracted 197 as they are. Two kinds of PDF it reads badly, and
  neither went through LlamaParse (it rewrites words, `84` notes it):
  - **14 PDFs whose font maps no apostrophe, dash, quote mark or « œ »**
    (`video_10_2012` to `video_11_2013`, `video_02_2014`): « c est »,
    « s urs ». The letters are the text layer's (pdftotext); the lost signs
    come from an OCR of the pages (Tesseract.js, French), aligned letter by
    letter, and only where the OCR sees the layer's own punctuation plus
    such a sign. Five gaps the OCR could not settle were set by hand from
    the page (four « “… », one « l’enlèvement »).
  - **63 A5 booklets printed two pages a sheet, in printing order**
    (8 pages: 8|1, 2|7, 6|3, 4|5). A page-wide extraction interleaves the
    two pages line by line. Each half-sheet was extracted on its own
    (pdftotext, cropped) and put in reading order; the page number printed
    on each half agrees for 62 and is offset by the two cover pages for
    `ministeres_pasteur_A5`. All 63 are layouts of a text the corpus has,
    and are folded (item 4).

  The clean-up kept the words: for each of the 277, the share of the
  extraction's 5-word shingles found in the cleaned text has a median of
  0.98; the lowest (0.82 to 0.93, six « Sommaire » of 2005 to 2008) are
  PDFs whose kerning cuts words (« v ersé »), which the model rejoined.
  Three texts where it had spelled out the Bible abbreviations (« Gen. » to
  « Genèse ») were run again and keep them.

  The review's first round then read the bodies against their PDFs, and
  what the model or an older step had changed was put back, word by word
  (each cleaned text aligned with its extraction; a word restored only
  where the PDF prints it):
  - `lc56`: 66 references are abbreviated again (« (1 Timothée 1.1) » back
    to « (1 Tim. 1.1) »). They had been spelled out before this goal, in
    the raw body the corpus held (the old `65` wrote citations canonical),
    and the pass kept them. The body now has the PDF's 79 abbreviated
    references.
  - 141 accents are the PDF's again in 14 works, nearly all capitals the
    model had accented (« Église » back to « Eglise », « Éternel » to
    « Eternel »): `le_reveil_promis` (58), `lc5_A5` (32),
    `exhortation_annee_2023_A4_gc` (19), `video_02_2005` (12), `lc56` (6),
    and one to three each in nine others (« précèdera » in three
    « Sommaire »).
  - 20 words: « révèlera », « assemblé », « partagent », « que homme »,
    « Mathieu », and in the A5 duplicates the words the
    model had altered or left cut at a page end (« inimaginables »,
    « deuxièmement », « critiqueuses », « parviennent », « transmutation »).
    A misprint of the PDF is the PDF's and stays (« l’assemblé »,
    « la écompense », « cala »).
  Not restored: « II » for « Il » in two A5 duplicates (the PDF's text has
  two capital I), and what the first pass may have done to the 239 older
  bodies, which nobody has read against their PDFs.

  `local_pdf` is not set on the new works: `96` uploads to R2, and that
  run is Samuel's; their pages link the PDF on cmpp.ch.

  **One new PDF is not a work**: `faire_part_alexis_barilier` is a death
  notice that names a family person by person. It is a draft
  (`status: "draft"`: not built, not listed, not indexed), and the names
  and towns the model had lifted into `persons`, `tags`, `places` and
  `summary` are removed (`76b`). The file and its body stay. **Samuel
  decides** whether it is published at all, or deleted.
- **Item 3, the three errored works.** `lc56`, `serie1no8`, `serie4no6`
  are cleaned; their title, subtitle, date, place and preacher are the
  ones `76` wrote (the model's were left out of the cache before `73`),
  their `local_pdf` was put back as `96` had written it. `lc56` failed
  again in `72` for the reason it failed the first time: its last pages
  hold a coupon, and the model copies the dot leaders until it runs out of
  tokens; `74` now shortens them before the call. No file of
  `markdown/cmpp/` is left without `llm_cleaned: true`.
- **Item 4, the layouts.** `83b-cmpp-variants.mjs`: with the new works the
  13 groups are **75**, and **94 files are duplicates** (27 the corpus
  had, 67 new): 516 works, **421 built** (422 that are no duplicate, less
  the draft). Every variant passes the body check, none is left out: the
  lowest is 0.925 of `exhortation_annee_2025_A5` in its A4. Keepers and
  duplicates are in `manifests/cmpp-variants.json`. Four of the 94 are no
  layouts: `janvier1974`, `mars1974`, `juillet1974`, `octobre1974` are
  the letters cmpp.ch now names `lc_janvier_1974` and so on (0.996 to
  0.999 both ways), a small table in `83b`. Both names were in the corpus
  before this goal; the one the site still links keeps, with its siblings
  of 1972 and 1973. Where the id without a suffix is new
  (`annee_2013`, `nouvelle_naissance`, `paille_et_froment`), the layout
  the corpus had becomes its duplicate and its address redirects.
- **Item 5.** The title page is the head of each text; the PDFs were read
  where the head did not settle a question. Of the 107 works attributed to
  William Branham, 98 print a day, and 96 of them the day their frontmatter
  has; the two others are `serie4no6` (its cover carries the previous
  issue's date, `76`) and `serie5no3` (two dates, below). The nine that
  print no day are `la_profondeur`, `eden` and the eight tracts. Three
  corrections, in `76b-cmpp-title-pages.mjs`, each with its line:

  | id | field | before | after | the text |
  | -- | ----- | ------ | ----- | -------- |
  | `la_profondeur` | `date` | `1954-07-01` | `1954-07` | title page: « Juillet 1954 », « Washington D.C. — U.S.A. » |
  | `islam` | `date` | `2001-01-01` | none (`year: 2001` stays) | « Auteur: Missionnaire Ewald Frank, Krefeld (Allemagne) Copyright © 2001 », and the text speaks of « le 8 octobre 2001 » |
  | `eden` | `preacher` | William Branham | none | « Frère Branham certifie que la révélation qu’il a reçue sur le péché originel est l’entière vérité » : written about him; the tract is unsigned |

  No English title was written into `subtitle`. Left for Samuel, nothing
  changed:
  - `savez-vous` and `quel_bapteme` (and their `_A4_traite` twins, now
    duplicates) still say `preacher: "William Branham"`, and their own
    text says otherwise: « Son nom est: William Marrion Branham. Il s’en est
    allé comme il est venu (1909 – 1965) », « le ministère de Son serviteur
    William Branham ». They are unsigned (the PDF's author field says
    « CMPP »), so no name is put in his place without Samuel.
  - `quand_dieu` and `le_bapteme_une_question_importante` (and twins)
    name no one, neither as author nor in the text.
  - `eden` has `location: "Krefeld"`, the model's; the tract gives only
    the CMPP's address in Lausanne.
  - `serie5no10` says « Phoenix, Indiana, U.S.A. »: so does the booklet
    (« Phoenix — Indiana, U.S.A. »). Not corrected from memory.
  - `serie5no3` prints two dates (« 21 février 1965, après-midi », Parkview
    Junior High School, and « 18 avril 1965, soir », Branham Tabernacle);
    its frontmatter has the second, and it is linked to 65-0418E by its
    English title.
  - The `preacher`, `date` and `location` of the 274 new works are the
    model's, as those of the first 242 were: 264 Ewald Frank, 6 Alexis
    Barilier, 2 Parfait M'bra, 2 none.
  - 50 works dated by their year alone (« Année 2020 », the yearly
    exhortations and their layouts, `christianisme`, `l_indicateur`,
    `information_globale`, `vision_7000`) still have the first of January
    as their date; `rev12` has it rightly (« 1er janvier 1961 »). And four
    have a first of the month their text does not name:
    `la_parole_de_dieu_demeure_eternellement` (« Septembre – Octobre
    1966 »), `lc57` and `grace_verite_A5` (« Printemps 2005 »),
    `tragedie`.
- **A month is not a day.** The first pass and `12` wrote « Janvier 2013 »
  as `2013-01-01`. **314 works now have `YYYY-MM`**: the 187 « Sommaire
  des rencontres », 126 letters and booklets whose file name, subtitle or
  head names the month, and `la_profondeur`. The rule is in `76b`; a work
  whose title page prints the first of the month keeps its day (`rev12`,
  `serie2no1`, `serie2no2`, `serie2no12`). `12` and the prompt of `72`
  write a month as a month from now on, and the work page prints it
  (« janvier 2013 », `formatDateFr`); the lists show the year, as for any
  work without a day.
- **Same texts the suffix rule does not see**, found by comparing every
  CMPP body with the others and with the Mevar sources; not folded, for
  Samuel (the four letters of 1974 are folded, item 4): `quanddieu` is `quand_dieu`
  (0.90); `grace_verite_A4`, `votre_attention_A4` and `paille_et_froment`
  are within `lc57`, `lc55` and `lc56` (0.92 to 0.94 of each);
  `les_70_semaines_de_daniel` and `lc42` share most of their text (0.79,
  0.89); `le_reveil_promis` is `mevar/le-reveil-promis-2006` (0.87, 0.93)
  and `trois_visions` is
  `mevar/trois-grandes-visions-du-message-de-la-fin-des-temps` (0.88, 0.91).
- **Four older works keep an extraction fault**: « sœ ur » for « sœur »
  in `serie6no4`, `serie6no5`, `mariage_frank` and `tragedie`. Their
  bodies are not this goal's to change.
- **Item 6, the links.** 107 translations: 97 linked (60 by the English
  title, 20 as the only sermon of their day, 16 by the time of day, 1
  decided), 1 decided to have no sermon, 9 unresolved. No sermon has two
  translations. All 97 pairs were read, French title against English title.
- **Samuel's answers (2026-10-05)**, in `scripts/cmpp-branham-decided.json`:
  `la_profondeur` is « The Deep Calleth to the Deep » (54-0624, Washington,
  D.C.; the booklet says « juillet 1954 »); `eden` is not a sermon of
  Branham's (« I guess you are right »; its `preacher` is not changed
  here); `les_aigles_de_dieu`, he does not know. Since item 5, `eden` no
  longer names William Branham, and the works attributed to him are 106.
- **Four booklets print another time of day than the archive gives their
  sermon.** The English title decides, and Samuel may want to confirm:
  `serie1no2` (« matin ») is 65-0718E, `serie1no9` (« soir ») is 63-0707M,
  `serie5no2` (« après-midi ») is 65-0221E, `serie5no3` (two dates, « soir »
  and « après-midi ») is 65-0418E. Two more print another day than their
  frontmatter and are settled the same way: `serie4no6` (its cover carries
  the previous issue's date, as `76` notes) and `serie5no3`.
- **Item 7, the folders.** 173 works moved out of `cmpp/undated/`: the
  linked ones to their sermon's year, and 76 others, each to the year of
  its frontmatter when a short line of its title page prints that year
  (« Krefeld, mai 1985 », « Copyright © 1978 »). 30 stay. This is wider
  than the item as written (« unlinked works stay where they are »): Samuel
  asked why a dated text had « undated » in its address, and should
  confirm the 76. Of the 274 new works, 30 moved the same way; 52 works
  are under `cmpp/undated/` today, 17 of them duplicates and one a draft.
- **One booklet may cover two sermons.** `parole_parlee_semence_originelle`
  prints « 18 mars 1962, matin et après-midi » and is linked to 62-0318,
  « The Spoken Word Is The Original Seed 1 », the only sermon the archive
  has for that day. For Samuel to confirm.
- **`local_pdf` did not move.** A moved work keeps the address of its PDF
  on files.mevar.org (`…/cmpp/undated/<id>.pdf`), which still answers. `96`
  names a PDF by its work's path: its next run would upload those PDFs
  again under the new path and leave the old objects. That run is Samuel's.
- **Items 8 and 9.** A CMPP work by William Branham is a `sermon`. A
  translation's page says « Traduction de la prédication » and names the
  Le-Scribe summary of its sermon (Samuel's request); the sermon's page
  says « Traduction en français ». `100-ingest-surrealdb.mjs` still calls
  every CMPP work a `bible_study`: a line in `docs/follow-ups.md`.
- **Idempotent.** A second run of `12`, `20`, `67`, `76b`, `49b`, `83b`,
  `65`, `47` and `50` changes nothing. `160` rewrites its timestamp, as it
  does on `main`. `73` is not in that list: it writes a frontmatter whole
  from its cache (gitignored), so after it `67`, `76b`, `49b`, `83b`, `65`,
  `47`, `50` run again, and `96` for `local_pdf`.

### Still unresolved: 9

Answer in `scripts/cmpp-branham-decided.json`, `"<id>": "<branham id>"` or
`"none"`, then rerun `49b`, `65`, `47`, `50`.

| id | Title | Title page | Why |
| -- | ----- | ---------- | --- |
| `les_aigles_de_dieu` | Les Aigles de Dieu | 4 mars 1960, après-midi, « God's Eagles » | the only sermon the archive has that day is 60-0304, « Thirsting for Life »; Samuel does not know |
| `le_bapteme_une_question_importante` (and `_A4_traite`; the four twins are duplicates since item 4) | Le Baptême ? Une question importante ! | none | a tract, no date |
| `quand_dieu` (and `_A4_traite`) | Quand Dieu devint homme | none | a tract, no date |
| `quel_bapteme` (and `_A4_traite`) | De quel baptême avez-vous donc été baptisé ? | none | a tract, no date |
| `savez-vous` (and `_A4_traite`) | Le savez-vous… ? | none | a tract, no date |

### The LLM pass: the estimate, written before spending (2026-10-06)

- **Works:** 277. The 274 PDFs `12` found on cmpp.ch that the manifest did
  not have, and the three the first pass failed on (`lc56`, `serie1no8`,
  `serie4no6`).
- **Text:** 4,143,583 characters of extracted text for the 274, 290,694
  for the three: 4.43 million characters.
- **Tokens:** at 3 characters a token (a low figure for French, so a high
  count): 1.48 million in, plus the system prompt on each of about 400
  calls (0.18 million): **1.66 million in**. Out, the same text without
  the layout's spaces, and the metadata: **1.5 million out**.
- **Price:** the API lists two models today, `deepseek-flash` and
  `deepseek-v4-pro` (`deepseek-chat`, the script's default, is no longer
  listed). At Flash's peak price (0.30 USD a million in, 1.20 out):
  0.50 + 1.80 = **2.30 USD**, 3.00 USD with a third more for retries. If
  the calls were billed at v4-pro's peak price (1.32 and 3.96): 8.13 USD,
  10.60 USD with the same margin.
- **Limit:** 15 USD (Samuel). Both figures are under it. The first call is
  one small text, to read the usage the API reports and check this
  estimate before the rest runs.

**Spent: 1.52 USD**, read on the account's balance (29.15 USD before the
first call, 27.63 after the last). `deepseek-chat` is still accepted and
is served by `deepseek-flash`. The 277 works as they stand took 1.46
million tokens in and 1.31 million out; the rest is the first pass on the
63 booklets before their extraction was redone, the retries of five failed
works and of the three with spelled-out abbreviations.
