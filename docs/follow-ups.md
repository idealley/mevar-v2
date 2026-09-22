# Known gaps and follow-ups

Living list of stuff we know about and have decided to defer, with enough context to pick back up.

## `100-ingest-surrealdb.mjs` never deletes an edge

**Symptom**: all eight edge types — `by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on` — go through the same insert-only `inChunks`. Re-ingesting after the corpus changed adds the new edges and leaves the old ones. Goal 02 dropped 374 impossible bible refs, so an existing database keeps 374 stale `cites` edges; a corrected `original` link leaves both `based_on` edges, since the unique index is on `(in, out)`.

**Fix**: delete a work's outgoing edges of each type before relating the current set, or diff against what is stored. One pass over all eight types, not one type at a time. Until then, a corpus change means rebuilding the database rather than re-ingesting on top.

## Bible-ref false positives from short book names

**Symptom**: 60-odd `Esther <n>` refs in files that never mention Esther.

**Cause**: `Est` is an accepted abbreviation for Esther in `65-normalize-bible.mjs`, and `est` is the French verb. `c'est 11 heures` becomes `Esther 11`. The same shape hits `Job` (`Jb`), `Ruth`, `Amos`, `Ge`, `Ne`.

**Fix**: drop the variants that collide with common French words, or require a chapter:verse pair (not a bare chapter) for the two-letter variants. The impossible-chapter filter added in goal 02 catches only the ones above the book's chapter count.

## Le-Scribe summaries with no Branham link

**Status**: 799 of 910 linked by `49-link-le-scribe-branham.mjs`. The other 111 are in `manifests/le-scribe-branham-unresolved.json` with their candidates: 77 still ambiguous between sermons the same day, 10 with no Branham sermon that day, 10 where two summaries claim one sermon (Hébreux 2A/2B and Semence 1re/2e parts are one sermon split in two summaries — the schema has one `summary_fr` per sermon), 9 with no date in the id (`wmbch15`, `59xxxxDiacres`), 5 with no frontmatter.

One link is known to be wrong: `530607Demons-religieux` → `53-0607A "The Ministry of Christ"`. The subtitle says "dimanche après-midi" so the time-of-day rule takes it, but the titles do not match — Le-Scribe's date for the demonology series looks to be off by a day or two. Check it against `53-0608` before trusting that pair.

**Fix**: a human pass over the 120, or model the summary→sermon relation as many-to-one on both sides.

## Markdown files with no frontmatter

**Status**: 7 files — `markdown/local/*.md` (2) and 5 Le-Scribe files (`1950/500115Crois-tu`, `1962/620714Son-confus`, `1962/620623Perseverant`, `undated/5003xxDon&appel`, `undated/5602Combat-foi`). Every script that patches frontmatter skips them, so they carry no metadata and no bible refs.

**Fix**: run them through `64-add-frontmatter.mjs`, or drop them.

## Branham `date` frontmatter does not match the sermon id

**Symptom**: `markdown/branham/1958/58-0501.md` has `date: "1955-01-29"` and `subtitle: "55-0129"`; `62-0704` has `date: "1965-01-17"`.

**Cause**: the metadata extractor read the date off the wrong element on branham.org. The sermon id is authoritative — that is why `49-link-le-scribe-branham.mjs` matches on the id, not on `date`.

**Fix**: rebuild `date` from `sermon_id` for the branham source.

## `npm install` fails in `web/`

**Symptom**: `ERESOLVE`: `@vite-pwa/astro@1.2.0` peers `astro@^1 || … || ^5`, the project is on `astro@6.2.2`.

**Fix**: upgrade or drop `@vite-pwa/astro`. Until then `npm install --legacy-peer-deps`.

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
