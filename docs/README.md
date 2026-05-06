# Revelation — technical docs

This corpus + knowledge graph powers a study tool, a static-with-dynamic publishing site, and a research interface for end-time message content.

## Doc index

| File                                   | Topic                                                           |
| -------------------------------------- | --------------------------------------------------------------- |
| [architecture.md](architecture.md)     | System layers, data model, design decisions                     |
| [data-pipeline.md](data-pipeline.md)   | Script-by-script flow from raw PDFs to queryable graph          |
| [operations.md](operations.md)         | How to run, recover, and reset; environment + commands          |
| [queries.md](queries.md)               | Useful SurrealQL recipes (vector search, graph traversal, FTS)  |
| [auth.md](auth.md)                     | Logto + SurrealDB v3 wiring — current state + next steps        |
| [follow-ups.md](follow-ups.md)         | Known gaps, technical debt, decisions deferred                  |

## High-level architecture

```
   Raw assets                          Cleaned markdown              Knowledge graph
─────────────────                  ─────────────────────         ──────────────────────
  pdfs/         scripts/10-…         markdown/<source>/            SurrealDB v3
  onedrive/    ──────────▶          (per-doc .md with        ──▶  works ─cites→ bible_ref
  audio/        scripts/4x-…         YAML frontmatter)             works ─by   → person
  ghost.json   ──────────▶                                         works ─cites← work (etc.)
                LLM cleanup
                (DeepSeek)            manifests/*.json              + verse text (4 translations)
                                      (per-source structured        + Strong's H/G tags
                                       metadata)                    + 1536-d embeddings (HNSW)


     Front end                              Auth                    Search
   ─────────────                       ────────────            ─────────────
   Astro + Svelte islands  ◀─JWT─▶  Logto Cloud   ─JWKS─▶  SurrealDB
                                    (login UI)               BM25 + HNSW + graph
```

## Quick start

```bash
# 1. Boot SurrealDB
brew install surrealdb/tap/surreal     # if not installed
mkdir -p db
surreal start --bind 127.0.0.1:8000 --user root --pass root rocksdb://./db &

# 2. Install JS deps + ingest
npm install
node scripts/100-ingest-surrealdb.mjs       # schema + corpus
node scripts/110-seed-bible-text.mjs        # 4 translations
node scripts/130-seed-strongs.mjs           # Hebrew/Greek tags
node scripts/140-embed-works.mjs            # OpenAI embeddings + HNSW index

# 3. Sanity check
surreal sql --endpoint http://localhost:8000 --user root --pass root --ns revelation --db main
```

## Stats snapshot

| Metric            | Count                                         |
| ----------------- | --------------------------------------------- |
| Sources           | 6 (mevar, branham, le-scribe, cmpp, onedrive, mevar-pdfs, local) |
| Markdown files    | 3,105 (2,502 LLM-cleaned with full NER)       |
| Works in graph    | 3,103                                         |
| Bible refs        | 8,810 (84% with verse text in 4 translations) |
| Edges             | ~108k (cites, mentions, by, contains, …)      |
| Embeddings        | 99.4% (1,536-d via OpenAI text-embedding-3-small) |
| Coverage          | 1947 → 2024+                                  |
