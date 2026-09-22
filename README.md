# Revelation Corpus

A unified corpus of Christian end-time-message preaching content (William Branham message and French-speaking followers), normalized into clean markdown with rich frontmatter and structured metadata.

## Sources

| Source       | Count | Type                                                    | Cleanup        |
| ------------ | ----- | ------------------------------------------------------- | -------------- |
| `branham`    | 1206  | William Branham sermon transcripts (English, 1947–1965) | LLM cleaned    |
| `le-scribe`  | 910   | Le-Scribe.org French summaries of Branham sermons       | LLM cleaned    |
| `mevar`      | 338   | mevar.org Ghost CMS posts (French)                      | Native (Ghost) |
| `mevar-pdfs` | 69    | mevar.org CDN PDFs not in onedrive (2021–2022 sermons)  | LLM cleaned    |
| `onedrive`   | 339   | Personal collection of sermons + exhortations (PDF/docx) | LLM cleaned    |
| `cmpp`       | 242   | cmpp.ch publications (French)                           | Raw            |
| `local`      | 2     | Two volumes from repo root                              | Raw            |
| **Total**    | **3106** |                                                      | **2741 LLM-cleaned** |

## Directory Layout

```
markdown/
  branham/<year>/<sermon-id>.md
  le-scribe/<year>/<sermon-id>.md
  mevar/<post-slug>.md
  mevar-pdfs/<filename>.md
  onedrive/pdf/<...>/<file>.md
  cmpp/<year>/<file>.md
  local/<file>.md

manifests/
  <source>.json                 # per-source structured metadata
  bible-refs.json               # all normalized bible references (31k French + 5k English)
  mevar-tags.json               # tag taxonomy
  mevar-authors.json            # author roster
  mevar-pdfs-corpus.json        # subset of mevar PDFs not duplicate of onedrive
  mevar-series.json             # mevar article series
  le-scribe-branham-unresolved.json  # summaries with no certain Branham sermon
  onedrive-mevar-overlap.json   # cross-source duplicate report

images/mevar/                   # downloaded mevar feature images (110 files)

scripts/                        # all pipeline scripts (numbered by stage)
index.json                      # master index across all sources
```

## Frontmatter

Every cleaned markdown file has YAML frontmatter with these fields (where applicable):

```yaml
source: "branham" | "mevar" | "le-scribe" | "mevar-pdfs" | "onedrive" | ...
sermon_id: "<unique-id>"
title: "..."
subtitle: "..."             # exhortation series, partie N, English original
date: "YYYY-MM-DD"
year: 2018
location: "Koumassi"        # extracted from sermon header
preacher: "M'BRA Parfait"   # or "William Branham", etc.
summary: "..."              # 2-3 sentence LLM-generated summary
tags: [...]                 # mevar-style tags
persons: [...]              # NER: Bible characters + historical
places: [...]               # NER: places mentioned
themes: [...]               # NER: thematic concepts
feature_image: "https://..."  # remote URL (mevar)
local_image: "images/mevar/<slug>.<ext>"  # local file
series: "Le jour du Seigneur"  # mevar article series, with series_id / series_part / series_total
original: "branham/1963/63-0112"      # le-scribe: the English sermon summarized
summary_fr: "le-scribe/1963/630112aInfluence"  # branham: the French summary
llm_cleaned: true
```

## Pipeline (regen from raw)

```bash
# 1. Extraction
node scripts/10-discover-branham.mjs <year>           # branham listing pages
node scripts/13b-branham-interact.js                  # all-years (Playwright via firecrawl)
node scripts/11-discover-le-scribe.mjs                # le-scribe.org
node scripts/12-discover-cmpp.mjs                     # cmpp.ch
node scripts/45-process-ghost.mjs                     # drop the export at the repo root as mevar.ghost.<date>.json
node scripts/61-parse-docx.mjs                        # docx → markdown via mammoth

# 2. PDF download + parse
node scripts/20-download-pdfs.mjs <manifest>          # download PDFs
./node_modules/.bin/lit batch-parse pdfs/ markdown/ --recursive --extension ".pdf" --no-ocr

# 3. Onedrive ingestion
node scripts/60-onedrive-inventory.mjs                # hash + dedup
node scripts/40-process-mevar.mjs                     # firecrawl crawl results → md
node scripts/62-extract-metadata.mjs                  # regex-based metadata
node scripts/63-dedup-vs-mevar.mjs                    # cross-source dedup
node scripts/64-add-frontmatter.mjs                   # YAML frontmatter

# 4. LLM cleanup (DeepSeek V3, ~$15-25 total)
node scripts/71-llm-fanout.mjs                        # onedrive
node scripts/72-llm-fanout-multi.mjs <source>         # le-scribe | branham | mevar-pdfs
node scripts/74-recover-errors.mjs <source>           # smaller-chunk recovery
node scripts/73-apply-llm.mjs <source>                # apply cache → markdown

# 5. Bible reference normalization
node scripts/65-normalize-bible.mjs                   # French (a path argument limits it, and merges)
node scripts/66-normalize-bible-en.mjs                # English (branham)
node scripts/47-lift-manifest-fields.mjs              # bible_refs + urls into frontmatter

# 6. Mevar PDFs (truly-new content not in onedrive)
node scripts/80-download-mevar-pdfs.mjs               # download from CDN
node scripts/81-dedup-mevar-pdfs.mjs                  # triage vs onedrive
node scripts/82-prepare-mevar-pdfs.mjs                # build corpus manifest

# 7. Images
node scripts/90-download-mevar-images.mjs             # download feature_images
node scripts/91-patch-mevar-frontmatter.mjs           # add local_image to frontmatter

# 8. Links between sources
node scripts/48-detect-series.mjs                     # mevar article series
node scripts/49-link-le-scribe-branham.mjs            # French summary ↔ English sermon

# 9. Index
node scripts/50-build-index.mjs                       # build master index.json, run last
```

## Sources gitignored (regenerable)

- `pdfs/` — all original PDFs (227 MB downloaded; regenerable from manifests)
- `onedrive/` — original OneDrive collection (62 MB)
- `audio/` — sermon audio (1.8 GB)
- `mevar.ghost.*.json` — Ghost export (38 MB)
- `.llm-cache*/` — LLM response cache (~140 MB; regenerable from PDFs + API)
- `.firecrawl/` — firecrawl scratch
- `node_modules/`
- `.env`

## Statistics

- **3,106 markdown files** (~174 MB)
- **2,741 LLM-cleaned** with full NER (persons / places / themes / summary)
- **36,328 normalized Bible references** (31,220 French + 5,108 English), 9,414 distinct
- **799 of 910 Le-Scribe summaries** linked to the English sermon they summarize
- **70 unique tags** on mevar (Prédications 208×, Exhortations 109×, Etudes Bibliques 47×, year tags, etc.)
- **6 authors** (Parfait M'bra, Samuel Pouyt, Stéphane Pouyt, André Kadjany, Pierre Kouadio, Irié Anderson)
- **Coverage**: 1947 (Branham) to 2024+ (mevar)

## Books in corpus

- **Le Royaume de Dieu** (Kadjany André, 2022) — full book, ~6100 lines, LLM-cleaned
- **Les Cinq Ministères de la Parole** (M'BRA Parfait) — combined PDF + 14 chapter PDFs
- Plus ~5 mid-form ministry/kingdom-themed books

## Known issues

- 1 onedrive doc (`Un peuple de sacrificateurs.docx`) failed LLM cleanup due to mammoth-escaped chars — has mevar Ghost twin.
- 1 mevar-pdf removed (`la-grande-trompette-qui-sonne` PDF had bad font encoding) — mevar Ghost twin available with clean content.
