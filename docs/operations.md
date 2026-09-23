# Operations

## Environment

`.env` (gitignored — never commit):

```bash
# LLM (cleanup + extraction)
DEEPSEEK_API_KEY=sk-...

# Embeddings
OPENAI_API_KEY=sk-...

# Optional alternatives
ANTHROPIC_API_KEY=sk-ant-...
MOONSHOT_AI_API_KEY=...

# Firecrawl (content scraping)
FIRECRAWL_API_KEY=...
```

`.env` keys are loaded by Node scripts via `import "dotenv/config"`.

## SurrealDB local ops

```bash
# Start (persistent, default ports)
mkdir -p db
surreal start --bind 127.0.0.1:8000 --user root --pass root rocksdb://./db &

# Connect via SQL shell
surreal sql --endpoint http://localhost:8000 --user root --pass root --ns revelation --db main

# Health check
curl -sf http://localhost:8000/health && echo OK

# Stop
pkill -f "surreal start"

# Wipe (data only — keeps installed binary)
rm -rf db && mkdir db
```

## Common queries from the SQL shell

See [queries.md](queries.md) for a full set.

## Backup / restore

### Full DB export (SurrealDB native)

```bash
# Export
surreal export --endpoint http://localhost:8000 --user root --pass root \
  --ns revelation --db main backup-$(date +%Y%m%d).surql

# Import
surreal import --endpoint http://localhost:8000 --user root --pass root \
  --ns revelation --db main backup-20260506.surql
```

### Embeddings-only backup

`bible-data/embedding-cache.jsonl` is auto-dumped at end of each `140-embed-works.mjs` run. To restore embeddings into a fresh DB:

```bash
node -e '
import("dotenv/config").then(async () => {
  const fs = await import("fs");
  const { Surreal } = await import("surrealdb");
  const db = new Surreal();
  await db.connect("ws://localhost:8000/rpc");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "revelation", database: "main" });
  const lines = fs.readFileSync("bible-data/embedding-cache.jsonl", "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const { hash, model, vector } = JSON.parse(line);
    await db.query(
      `INSERT INTO embedding_cache $row ON DUPLICATE KEY UPDATE vector = $input.vector`,
      { row: { content_hash: hash, model, dim: vector.length, vector } }
    );
  }
  console.log("restored", lines.length, "embeddings");
  await db.close();
});
'
```

Re-run `140-embed-works.mjs` afterwards — cache hits will copy vectors back into `work.embedding`.

## Re-ingest scenarios

### "I edited some markdown — re-sync"

```bash
node scripts/50-build-index.mjs              # refresh index.json
node scripts/100-ingest-surrealdb.mjs        # re-applies schema + UPDATE on existing records (preserves embeddings)
node scripts/140-embed-works.mjs             # only embeds works whose content_hash changed (cache hits free)
```

### "I added new mevar posts (new Ghost export)"

```bash
node scripts/45-process-ghost.mjs            # regenerate markdown/mevar from new export
node scripts/90-download-mevar-images.mjs    # then 91, 92, 93: the new posts' assets
node scripts/91-patch-mevar-frontmatter.mjs
node scripts/92-download-mevar-assets.mjs
node scripts/93-optimize-images.mjs
node scripts/check-local-assets.mjs
node scripts/65-normalize-bible.mjs          # re-normalize all sources (idempotent)
node scripts/50-build-index.mjs
node scripts/100-ingest-surrealdb.mjs
node scripts/140-embed-works.mjs
```

### "I want to swap the embedding model"

```bash
EMBED_MODEL=text-embedding-3-large node scripts/140-embed-works.mjs
# `work.embedding_model = "text-embedding-3-large"` filter in the SELECT means only large embeddings show
# The 1536-d small embeddings remain in the cache for cheap reverts
```

After: rebuild HNSW with new dimension.

## Failure modes seen so far

| Symptom                                          | Cause                                                  | Fix                                              |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `Found field 'text.darby', but no such field`    | SCHEMAFULL rejects nested object keys                  | Add `FLEXIBLE` to the field def                  |
| `Database index 'X_canonical' already contains…` | Two distinct `bible_ref` rows with same canonical text  | Hash-suffix collision in `refIdToken`            |
| `length limit exceeded` (HTTP 413)               | HTTP transport has 1MB body cap                        | Use `ws://` transport                            |
| `Invalid 'input': maximum context length is 8192 tokens.` | Truncation overshot OpenAI's per-request limit | Reduce `MAX_INPUT_CHARS` in embed script         |
| `terminated` (LLM)                               | DeepSeek upstream connection drop on multi-chunk doc   | Retry with smaller chunks via `74-recover-errors.mjs` |
| `Couldn't coerce value … Expected 'none \| int' but found 'NULL'` | Passing JS `null` to `option<T>` field      | `stripNulls()` helper in ingest                  |
| `INSERT INTO type::table($t)` parse error        | Target table must be literal identifier                | Whitelist + template-literal interpolation       |

## Observability

Per-run summary stats are emitted by every script. The big ones:

- `100-ingest-surrealdb.mjs` — counts of works, refs, persons, edges
- `140-embed-works.mjs` — hits/miss/fail + cost estimate
- `73-apply-llm.mjs` — applied/errored/missing per source

Errors are written to `manifests/<source>-llm-stats.json` with the doc IDs that failed and the reasons.

## Cost ledger (full pipeline run as of 2026-05)

| Step                          | Service       | Cost     |
| ----------------------------- | ------------- | -------- |
| Onedrive cleanup (339 docs)   | DeepSeek V3   | $6.07 |
| Le-scribe cleanup (910 docs)  | DeepSeek V3   | $8.84 |
| Branham cleanup (1206 docs)   | DeepSeek V3   | $32.74 |
| Mevar-PDFs cleanup (69 docs)  | DeepSeek V3   | $1.24 |
| **Subtotal LLM**              |               | **~$50** (paper) / **~$15-20 actual** with caching |
| Embeddings (3,085 docs)       | OpenAI        | $0.62    |
| Firecrawl (scraping)          | Firecrawl     | ~165 credits |
| **Total**                     |               | **<$25** actual |
