# Query recipes

All queries assume you're connected to namespace `revelation`, database `main`. Run via:

```bash
surreal sql --endpoint http://localhost:8000 --user root --pass root --ns revelation --db main --pretty
```

or via the JS SDK with `db.query(...)`.

## Counts + structure

```surql
-- Top-level counts
SELECT count() AS works FROM work GROUP ALL;
SELECT count() AS refs  FROM bible_ref GROUP ALL;
SELECT count() AS edges FROM cites GROUP ALL;

-- Per-source breakdown
SELECT source, count() AS n FROM work GROUP BY source ORDER BY n DESC;
SELECT kind, count() AS n FROM work GROUP BY kind ORDER BY n DESC;

-- Coverage
SELECT count() AS with_emb FROM work WHERE embedding != NONE GROUP ALL;
SELECT count() AS with_text FROM bible_ref WHERE text != NONE GROUP ALL;
```

## Bible reference queries

```surql
-- All references in a chapter
SELECT canonical, text.lsg AS lsg
FROM bible_ref
WHERE book = bible_book:`66_apocalypse` AND chapter = 6
ORDER BY verse_start;

-- Top 10 most-cited verses across the corpus
SELECT canonical, count(<-cites) AS n
FROM bible_ref
ORDER BY n DESC LIMIT 10;
```

## Graph traversal

```surql
-- A sermon and what it cites
SELECT title, year, source,
       ->cites->bible_ref.canonical AS verses
FROM work:branham_65_0117;

-- Who else cites the same verses as this work?
LET $verses = SELECT VALUE ->cites->bible_ref.id FROM work:onedrive_juin;
SELECT id, title, year, source,
       count(->cites[?out IN $verses]) AS shared
FROM work
WHERE id != work:onedrive_juin
  AND ->cites->bible_ref.id ?= $verses
ORDER BY shared DESC LIMIT 20;

-- All works mentioning Abraham (person)
SELECT id, title, year, source FROM work
WHERE id IN (SELECT VALUE <-mentions<-work FROM person WHERE name = "Abraham")
ORDER BY date DESC LIMIT 20;
```

## "What did Branham say on Apocalypse 6?"

```surql
LET $rev6 = (SELECT VALUE id FROM bible_ref WHERE book = bible_book:`66_apocalypse` AND chapter = 6);
SELECT id, title, year, summary
FROM work
WHERE source = "branham"
  AND ->cites->bible_ref.id ?= $rev6
ORDER BY date;
```

The `?=` operator returns true if any element of the right-side array intersects the left.

## Vector search (semantic)

Pre-compute the query vector via OpenAI, then:

```surql
-- $q is a 1536-d float array passed via $params
SELECT title, year, source,
       vector::similarity::cosine(embedding, $q) AS score
FROM work
WHERE embedding != NONE
ORDER BY score DESC LIMIT 10;
```

KNN with HNSW (after the index is built):

```surql
SELECT title, year, source,
       vector::similarity::cosine(embedding, $q) AS score
FROM work
WHERE embedding <|10,40|> $q
ORDER BY score DESC;
```

`<|N,EFC|>` = N nearest neighbors, EFC = exploration factor. Use this form once HNSW is built — much faster than full scan.

## Full-text search (BM25)

```surql
-- The `body` field has a French analyzer index
SELECT id, title,
       search::score(0) AS score,
       search::highlight("**", "**", 0) AS snippet
FROM work
WHERE body @0@ "réveillez-vous et préparez la guerre"
ORDER BY score DESC LIMIT 10;
```

## Hybrid (vector + BM25)

```surql
-- Weighted score: 70% semantic, 30% lexical
SELECT id, title, source,
       (search::score(0) * 0.3
        + vector::similarity::cosine(embedding, $q) * 0.7) AS score,
       search::highlight("**", "**", 0) AS snippet
FROM work
WHERE (body @0@ $keyword OR embedding <|20,80|> $q)
ORDER BY score DESC LIMIT 10;
```

## Time-based queries

```surql
-- All works in 1965 sorted by date
SELECT id, title, source FROM work WHERE year = 1965 ORDER BY date;

-- Year distribution
SELECT year, count() AS n FROM work GROUP BY year ORDER BY year;

-- Decade trends
SELECT
  math::floor(year / 10) * 10 AS decade,
  count() AS n
FROM work
WHERE year != NONE
GROUP BY decade ORDER BY decade;
```

## Author / preacher queries

```surql
-- Who's the most-published?
SELECT person.name, count(<-by) AS works
FROM person
ORDER BY works DESC LIMIT 10;

-- All works preached by William Branham in 1965
SELECT id, title, location FROM work
WHERE id IN (SELECT VALUE <-by<-work FROM person WHERE name = "William Branham")
  AND year = 1965
ORDER BY date;
```

## Cross-source dedup

```surql
-- Le-scribe summaries linked to their Branham source
SELECT in.title AS summary, out.title AS source_sermon, similarity
FROM based_on
WHERE in.source = "le-scribe" AND out.source = "branham"
ORDER BY similarity DESC LIMIT 20;
```

## User-facing queries (after auth is wired)

```surql
-- Current user's bookmarks (needs $auth populated by Logto JWT)
SELECT ->bookmarked->work.* AS bookmarks FROM type::record($token.app_sub);

-- Current user's progress on a specific work
SELECT progress, completed_at FROM completed
WHERE in = type::record($token.app_sub) AND out = work:le_royaume_de_dieu_kadjani;

-- Annotations on a work, scoped to current user
SELECT note, anchor, updated_at FROM annotated
WHERE in = type::record($token.app_sub) AND out = $work
ORDER BY updated_at DESC;
```

## Schema introspection

```surql
INFO FOR DB;                    -- list all tables, accesses, etc.
INFO FOR TABLE work;            -- fields, indexes, perms
INFO FOR TABLE bible_ref;
EXPLAIN SELECT * FROM work WHERE year = 1965;
```

## Performance notes

- **HNSW index** on `embedding` makes vector queries O(log N) instead of full scan. After embedding new docs, the index updates automatically; no manual REBUILD needed in steady state.
- **FULLTEXT BM25** on `body` is built once via `DEFINE INDEX work_body_fr`. Adding/updating works incrementally maintains the index.
- **Graph traversal** (`->cites->bible_ref`) uses the unique `cites_in_out` index — sub-millisecond on this corpus.
- **`SELECT VALUE field`** flattens to a bare array, useful for `IN` lookups.
