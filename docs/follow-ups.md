# Known gaps and follow-ups

Living list of stuff we know about and have decided to defer, with enough context to pick back up.

## English bible-ref coverage gap

**Status**: 442 / 1,206 branham markdown files have detected refs in `manifests/bible-refs.json`. Should be closer to 1,200 — every Branham sermon cites Scripture.

**Cause**: `66-normalize-bible-en.mjs` was run BEFORE the LLM cleanup pass rewrote bodies. After LLM applied (`73-apply-llm.mjs branham`), the cleaned bodies have canonicalised refs that the regex would catch better. The English normalizer was not re-run.

**Fix** (5 min):

```bash
node scripts/66-normalize-bible-en.mjs           # re-scan branham/, merge into bible-refs.json
node scripts/100-ingest-surrealdb.mjs            # rebuild cites edges (preserves embeddings)
```

## Bogus refs from over-eager regex

**Symptom**: e.g. `"Sophonie 155"` shows up — but Sophonie has only 3 chapters.

**Cause**: regex matches a book name followed by what's actually a paragraph number from the cleaned text (`...la sophonie. 155 Le frère...`).

**Fix**: bound chapter ≤ 150 in `65-normalize-bible.mjs` and `66-normalize-bible-en.mjs` (Psalms is the longest at 150). Also bound verse ≤ 176 (Ps 119). Easier: hardcode max-chapter per book.

Currently affects ~50-100 records out of 8,810 — small noise, but the bogus refs aren't wrong, just impossible. Worth filtering at the normalizer level rather than post-hoc.

## Two stubborn embedding failures

**Status**: 2 / 3,103 works failed embedding even with reduced truncation. Likely empty or anomalous bodies.

**Fix**: dump the IDs from `manifests/onedrive-llm-stats.json` style (or query `SELECT id FROM work WHERE embedding = NONE`), inspect each, decide whether to remove from corpus or hand-fix.

## chapter-only `bible_ref` records have no text

**Status**: 1,451 / 8,810 refs are chapter-only (e.g. `"Matthieu 24"`). The verse-text seeder skips these because joining all verses inline is too long.

**Fix when surfaced in UI**: lazy-fetch chapter when user hovers/expands a chapter-only citation. Build a helper `getChapterText(book_id, chapter, translation)` that pulls all verses for that chapter and returns them concatenated. Or build a `bible_chapter` materialized view in SurrealDB.

## Strong's not yet seeded

**Status**: `scripts/130-seed-strongs.mjs` exists, `scripts/120-clone-stepbible.sh` is set up.

**Fix**: run them — about 5-10 min total.

```bash
bash scripts/120-clone-stepbible.sh        # ~50 MB sparse clone
node scripts/130-seed-strongs.mjs          # parses TAGNT + TAHOT, merges Strong's into bible_ref.strong
```

## Auth not wired

See [auth.md](auth.md). Schema + skill knowledge in place; needs Logto tenant + the 7 steps documented there.

## No Astro frontend yet

The graph is queryable but there's no UI. Decisions to make when starting:

- Astro vs SvelteKit (Astro better for content-heavy SSG, SvelteKit better if there's lots of interactivity)
- How to handle SurrealDB connection in serverless / edge functions (HTTP transport per request, not pooled WebSockets)
- Markdown rendering: directly from `markdown/` files at build time, or pulled from SurrealDB? (Files are cleaner; DB allows live editing.)
- Image strategy: `images/mevar/` is the local copy; bake into static assets or serve from CDN?

## No production deployment

Local-only today. Production checklist:

- SurrealDB hosting (Fly.io single binary, or self-host VPS, or SurrealDB Cloud)
- HTTPS termination
- CORS configuration (Surreal v3 needs `--web-cors '*'` or specific origins for browser clients)
- Backups schedule (export → S3 / B2 nightly)
- Monitoring (logs, query performance, embedding API budget)

## Cross-language linking

**Idea**: when a French sermon cites `"Matthieu 24:6"` and an English Branham sermon cites `"Matthew 24:6"`, both currently land on different `bible_ref` records (`matthieu_24_6` vs `matthew_24_6`). They should resolve to the same conceptual verse.

**Fix**: collapse on `(book_canon_order, chapter, verse_start, verse_end)` rather than localized canonical string. Would also let us deduplicate the 8,810 refs down to ~5k true verses.

Defer until UX requires it (probably when surface a "verse drilldown" view).

## Series / convention grouping

**Idea**: many Branham sermons are part of named series ("Seven Seals", "Church Ages", "Marriage and Divorce"). Currently no explicit modeling — they're just sermons with similar dates and topics.

**Fix**: add a `series` table and `part_of` edge. Detect series via filename patterns (`63-0317M`, `63-0318M`, `63-0319` … and titles "The Seven Seals — Day 1").

## Annotations / personal notes

Schema has the `annotated` edge with PERMISSIONS clauses ready, but no UI. When wired:

- Anchor format: paragraph number + char offset within paragraph (preserves through edits)
- Search across user's own notes
- Optional: highlight + tag the underlying paragraph itself in their copy
