# Data pipeline

Scripts are numbered by stage. Re-running any stage is safe (idempotent or skips work via cache).

## Stage 1 — Discovery + scraping

Find which docs exist on each source and collect their URLs.

| Script                                  | Source       | Output                                  |
| --------------------------------------- | ------------ | --------------------------------------- |
| `10-discover-branham.mjs`               | branham.org  | `manifests/branham-<year>.json`         |
| `13b-branham-interact.js`               | branham.org  | one-shot all-years via Playwright       |
| `11-discover-le-scribe.mjs`             | le-scribe.org | `manifests/le-scribe.json`             |
| `12-discover-cmpp.mjs`                  | cmpp.ch      | `manifests/cmpp.json`                   |
| `40-process-mevar.mjs`                  | firecrawl crawl → `markdown/mevar/` (later replaced by Ghost)   |
| `45-process-ghost.mjs`                  | mevar Ghost export → final `markdown/mevar/` + tags + authors    |
| `60-onedrive-inventory.mjs`             | onedrive/    | `manifests/onedrive-inventory.json` (sha1 dedup) |
| `80-download-mevar-pdfs.mjs`            | mevar CDN    | `manifests/mevar-pdfs.json`             |
| `81-dedup-mevar-pdfs.mjs`               | content fingerprint vs onedrive | `manifests/mevar-pdfs-triage.json` |
| `82-prepare-mevar-pdfs.mjs`             | filter to non-dup PDFs | `manifests/mevar-pdfs-corpus.json` |

## Stage 2 — Download + parse

| Script                            | Action                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `20-download-pdfs.mjs <manifest>` | curl PDFs into `pdfs/<source>/<year>/`                          |
| `lit batch-parse pdfs/ markdown/` | (npm `@llamaindex/liteparse`) PDFs → text                       |
| `61-parse-docx.mjs`               | mammoth converts onedrive .docx → md                            |

After parse, `.txt` files are renamed to `.md` and live under `markdown/<source>/...`.

## Stage 3 — LLM cleanup + NER (DeepSeek V3)

| Script                                   | Action                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `62-extract-metadata.mjs`                | regex-based first-pass title/subtitle/date/location/preacher                |
| `63-dedup-vs-mevar.mjs`                  | Jaccard fingerprint cross-source dup detection                              |
| `64-add-frontmatter.mjs`                 | YAML frontmatter into each md                                               |
| `71-llm-fanout.mjs`                      | onedrive: clean + structured NER via DeepSeek                              |
| `72-llm-fanout-multi.mjs <source>`       | le-scribe / branham (English prompt) / mevar-pdfs                           |
| `74-recover-errors.mjs <source>`         | retry with smaller chunks (default 25k chars) for stubborn fails            |
| `73-apply-llm.mjs <source>`              | apply LLM cache → markdown body + manifest fields; the model's "Unknown" is no value |
| `76-add-missing-frontmatter.mjs`         | frontmatter for the ten works that had none (hand-read table) and their manifest entries, `manifests/local.json` for the two volumes; run 47, 49, 50 after |
| `77-branham-date-location.mjs`          | Branham `date` and `year` from the sermon id, `location` from branham.org's year listing (cached in `.firecrawl/`), in manifests and frontmatter; run 50 after |
| `67-normalize-preachers.mjs`             | every `preacher` to its display name in `scripts/preachers.mjs` (frontmatter + manifests); fails on an unknown spelling. Run after 73 |

Cost across all sources: ~$15-25 actual (DeepSeek's prompt caching keeps it well below the $66 paper budget).

## Stage 4 — Bible reference normalization

| Script                          | Languages          | Output                                   |
| ------------------------------- | ------------------ | ---------------------------------------- |
| `65-normalize-bible.mjs`        | French — LSG style | records refs as `Matthieu 24:6`, spoken ones ("Luc chapitre 18 verset 9", "le chapitre 24 de Matthieu") included; every French source, `mevar-pdfs` included; not `branham/` |
| `65b-restore-branham-from-source.mjs` | English | puts the branham.org wording back where old runs rewrote it |
| `66-normalize-bible-en.mjs`     | English — KJV style | records refs as `Matthew 24:6`, spoken ones ("Saint John the 4th chapter") included |

Neither normalizer changes the text: the preacher's words stay as written and
only the recorded ref is canonical. Both export `citations()`, which the site
uses to link each recorded reference in a body to its verse page
(`web/src/lib/bible-links.mjs`); the verse pages read `manifests/bible-refs.json`.

The book tables live in `scripts/bible-books.mjs`. Both normalizers merge into
`manifests/bible-refs.json`, keyed by markdown path. 65b needs the Branham PDFs
first (`20-download-pdfs.mjs manifests/branham-<year>.json`, 152 MB, gitignored)
and lists the French names it cannot align in
`manifests/branham-restore-unaligned.json`.

## Stage 5 — Index assembly

`50-build-index.mjs` reads all manifests, walks `markdown/`, emits `index.json` (one row per doc with all fields needed for ingest).

## Stage 6 — Mevar assets off Ghost

Everything mevar links on `mevar.org/content/` and the DigitalOcean CDN is
committed and served from our domain (`web/public/images`, `web/public/files`).

| Script                              | Action                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| `90-download-mevar-images.mjs`      | feature images to `images/mevar/<slug>.<ext>`          |
| `91-patch-mevar-frontmatter.mjs`    | adds `local_image:` field to each mevar md frontmatter |
| `92-download-mevar-assets.mjs`      | body images to `images/mevar/content/`, PDFs to `files/mevar/`; body links root-relative, `local_pdf:` next to `pdf_download:` / `pdf_url:` |
| `93-optimize-images.mjs`            | `images/` to WebP, under 80 KB a file where it can     |
| `94-relink-mevar-urls.mjs`          | body links to `mevar.org` root-relative; Ghost bookmark cards to a clean link |
| `check-local-assets.mjs`            | every local `images/` and `files/` link in `markdown/` resolves |

## Stage 7 — SurrealDB ingest

`100-ingest-surrealdb.mjs` is the consolidator:

1. Apply `surreal/schema.surql` (idempotent via OVERWRITE)
2. Seed `bible_book` (66 rows — `INSERT IGNORE`)
3. Build `bible_ref` records from `manifests/bible-refs.json` — parses canonical strings, writes one record per unique reference. Hash suffix on token collision.
4. Dedupe persons/places/themes/tags from `index.json` NER fields → seed entity tables.
5. Insert `work` records (3,103) — body content read from each markdown file. Computes `content_hash = sha256(body)` per work for embedding cache stability. `ON DUPLICATE KEY UPDATE` excludes `embedding`/`embedding_model` so re-ingests preserve them.
6. Build edges (`by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on`).

## Stage 8 — Bible verse text

`110-seed-bible-text.mjs` — pulls 4 translations from `bible-data/` (LSG, Darby, Ostervald JSON/XML; KJV JSON), maps each `bible_ref` (canon_order + chapter + verse range) to the source verses, joins multi-verse ranges with " ", merges `text = {lsg, darby, ost, kjv}` into the record. Coverage: 84% (chapter-only refs are skipped — too long inline).

## Stage 9 — Strong's tags

`120-clone-stepbible.sh` (one-time, sparse — ~50 MB)
`130-seed-strongs.mjs` — parses STEPBible TAGNT (Greek NT) + TAHOT (Hebrew OT) tagged TSV files, builds `{canon_order.chapter.verse}` → set of Strong's tokens, unions across each `bible_ref` verse range, merges `bible_ref.strong = ["G2316", "H0430", ...]`.

## Stage 10 — Embeddings

`140-embed-works.mjs`:

- Pulls all `work` records that lack an embedding for the chosen model.
- Pre-loads existing `embedding_cache` rows for those `content_hash + model` pairs.
- For each work: cache hit fast path; on miss calls OpenAI text-embedding-3-small, writes to `embedding_cache`, copies vector to `work.embedding` + `work.embedding_model`.
- Builds `DEFINE INDEX work_embedding ON work FIELDS embedding HNSW DIMENSION 1536 TYPE F32 DIST COSINE` after the run.
- Dumps cache to `bible-data/embedding-cache.jsonl` for portable backup.

## Re-running the full pipeline

Each stage is idempotent. To rebuild from scratch:

```bash
pkill surreal
rm -rf db && mkdir db
surreal start --bind 127.0.0.1:8000 --user root --pass root rocksdb://./db &
node scripts/100-ingest-surrealdb.mjs
node scripts/110-seed-bible-text.mjs
node scripts/130-seed-strongs.mjs
node scripts/140-embed-works.mjs    # fast — hits cache for existing content_hashes
```

Total cold-rebuild time: ~10 min wall, with embedding cache hot.
