# Architecture

## Data layers

### 1. Raw assets (gitignored, regenerable)

| Layer            | Origin                        | Format                  | Size  |
| ---------------- | ----------------------------- | ----------------------- | ----- |
| `pdfs/`          | Branham CDN, le-scribe, cmpp, mevar CDN | original PDFs | ~370 MB |
| `audio/`         | personal collection           | .ogg, .mp3, .m4a        | ~1.8 GB |
| `onedrive/`      | personal archive              | PDF + DOCX              | ~62 MB |
| `mevar.ghost.*.json` | Ghost CMS export          | JSON                    | ~38 MB |
| `bible-data/`    | getbible, Beblia, STEPBible   | JSON + XML + TSV        | ~150 MB |
| `.llm-cache*/`   | DeepSeek API responses        | JSON                    | ~140 MB |

### 2. Cleaned markdown (committed)

`markdown/<source>/<...>/<doc>.md` — every doc has YAML frontmatter:

```yaml
---
source: "mevar"
sermon_id: "le-royaume-de-dieu"
title: "Le royaume de Dieu"
date: "2022-05-01"
year: 2022
location: "Koumassi"
preacher: "M'BRA Parfait"
summary: "..."
tags: [Prédications, 2022]
persons: [Abraham, Moïse, Jésus, ...]
places: [Koumassi, Abidjan, ...]
themes: [Royaume de Dieu, gloire, ...]
local_image: "images/mevar/le-royaume-de-dieu.webp"
llm_cleaned: true
---

(body — clean markdown, paragraph-numbered for Branham, Bible refs canonicalised)
```

### 3. Manifests (committed)

`manifests/<source>.json` — per-source structured metadata aligned with the markdown frontmatter. Used as the join layer when ingesting into SurrealDB.

`manifests/bible-refs.json` — `{ <markdown-path>: ["Matthieu 24:6", ...] }` extracted by the bible normalizer (FR + EN). Used to build the `cites` edges.

`manifests/*-llm-stats.json` — per-source LLM cleanup outcomes (errors, applied counts).

### 4. Knowledge graph (SurrealDB)

The graph is the queryable surface. See [data-pipeline.md](data-pipeline.md) for how it's built.

## Schema model

```
                    ┌──────────────┐
                    │ bible_book   │ (66, seeded)
                    └──────┬───────┘
                           │ TYPE record<bible_book>
                    ┌──────▼───────┐
                    │  bible_ref   │ (8,810 — verse-level)
                    │ + text {LSG, │
                    │   Darby, Ost,│
                    │   KJV}       │
                    │ + strong[]   │
                    └──────▲───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
        cites edge      based_on        contains
            │              │              │
       ┌────┴───┐    ┌─────┴────┐   ┌─────┴────┐
       │  work  │◀──▶│   work   │   │ work     │
       │ (3103) │    │ (le-scribe│   │ (book    │
       │        │    │  → branham│   │ → chapters)│
       └─┬──┬───┘    │  pairs)   │   └──────────┘
         │  │        └──────────┘
         │  │  by edge (preacher / author)
         │  ▼
         │  person  (2,136 — biblical | preacher | other)
         │
         │  mentions, mentions_place, has_theme, has_tag
         ▼
        place, theme, tag

        user ─bookmarked / completed / annotated→ work
```

## Design decisions

### Why one `work` table with `kind` discriminator instead of separate tables

- 80% of fields are common across kinds (title, body, year, embedding, NER fields, citations)
- Cross-kind queries dominate ("anything that cites Revelation 6, regardless of whether it's a sermon or a book")
- Edges only need to point at one type
- The `kind` enum (`sermon | exhortation | bible_study | book | chapter | article | testimony | communique`) drives UI rendering decisions in the front end

Trade-off: SurrealDB's SCHEMAFULL can't enforce "if `kind = 'sermon'` then `preached_at` is required". Application-layer validation handles that.

### Why one `bible_ref` per verse-range, not per verse

A canonical reference like `"Matthieu 24:5-7"` is its own record. Verse-level granularity would explode the graph (`Matthieu 24:5`, `:6`, `:7` all separate, then needing additional aggregation when a sermon cites the range).

The trade-off: the same physical verse `Matthieu 24:6` appears in two records (`24:6` and `24:5-7`). Both get verse text seeded; both get edge incoming. Counting "how many times was 24:6 cited" needs:

```surql
SELECT count() FROM cites
WHERE out IN (SELECT id FROM bible_ref WHERE chapter = 24
              AND verse_start <= 6 AND (verse_end >= 6 OR (verse_end = NONE AND verse_start = 6)));
```

If this becomes a hot query, materialise a per-verse summary table.

### Why embedding cache decoupled from work IDs

Re-running `100-ingest-surrealdb.mjs` may change `work` record IDs (we control the slug function). To avoid orphaning expensive embeddings:

- `work.content_hash` = `sha256(body)` — stable across re-ingests
- Separate `embedding_cache` table keyed by `(content_hash, model)` UNIQUE
- Embed script: `cache.get(hash, model) ?? (call API; cache.put(hash, model, vector))`
- Re-ingest deliberately excludes `embedding`/`embedding_model` from the `ON DUPLICATE KEY UPDATE` list — values survive

Same pattern protects against renaming sources or changing tokenization. The cache is also dumped to `bible-data/embedding-cache.jsonl` for portable backup.

### Why Logto for auth (not SurrealDB-native)

SurrealDB v3 ships record-level auth via `DEFINE ACCESS … TYPE RECORD WITH JWT`, but you'd still build:

- Sign-in UI, password reset, email verification flows
- Social/OAuth connectors
- MFA, account recovery, audit logs

Logto provides all of that as an open-source, OIDC-compliant IdP (cloud free tier or self-host). SurrealDB consumes the JWT it issues. See [auth.md](auth.md) for the current state and wiring steps.

### Why text-embedding-3-small (1536-d) and not larger

- Multilingual (FR + EN, our content split)
- ~$0.02 / 1M tokens — full corpus = ~$0.62
- 1536-d HNSW index is ~24 MB on 3k records, fits comfortably in RAM
- Quality on this corpus is solid (verified by the smoke test in [queries.md](queries.md))

If specific accuracy needs to improve later, swap to `text-embedding-3-large` (3072-d) or Voyage-3 — the cache layer makes this a single migration, not a re-embed of the whole corpus (only `model` key differs).
