# GOAL 16: CMPP complete, and each Branham translation linked to its sermon

**Status:** proposed (written 2026-09-25 with Samuel, not dispatched)
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

(Filled on the branch.)

## Follow-up

(Filled at the landing check.)
