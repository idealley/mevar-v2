# Known gaps and follow-ups

Living list of stuff we know about and have decided to defer, with enough context to pick back up.

## Spelled-out scripture citations are not detected

**Status**: 65 and 66 only match `Book chapter:verse` in numerals. Branham reads his text aloud instead: **2,948** occurrences of "`Saint John the 4th chapter`" / "`Kings, the 6th chapter`" in the Branham corpus, 365 of them naming the verse too ("`Saint Matthew the 4th chapter, the 23rd verse`"). None of those is in `bible-refs.json`, so a sermon's principal reading — the passage it opens with — is usually the one reference that is missing.

The book also comes after the chapter: "`In the 20th chapter of Numbers, I read these words:`" (`53-0512`), **614** more occurrences of "`the <N>th chapter of <Book>`".

**Fix**: two more patterns, `<Book>,? (the )?<N>(st|nd|rd|th) chapter(,? (and )?the <M>(st|nd|rd|th) verse)?` and `the <N>(st|nd|rd|th) chapter of <Book>`, with the ordinals mapped to numbers. Worth doing before the site ships reference-based navigation; it roughly doubles the coverage of the Branham corpus.

## French book names left inside the English Branham text

**Status**: before goal 02, 65 (the French normalizer) also ran over `markdown/branham/` and rewrote English words it took for book abbreviations. The text still carries it: **358** `Ésaïe <n>` in 270 files ("The Bible says it Ésaïe 65 He's here", from "is" + paragraph 65), **154** `Sophonie <n>` in 131 files ("so"), **39** `Hébreux <n>` in 38 files ("he"), plus a handful of `Actes`, `Habacuc`, `Marc`, `Juges`: **377** files in all. A reader sees these mid-sentence. Goal 02 stopped the cause (65 no longer scans Branham) and repaired the two cases whose original is certain (`Joël` → `Joel`, `you'Revelation` → `you're`).

**Fix**: not mechanical. The French regex also swallowed an optional period after the abbreviation ("is. 65" and "is 65" both became "Ésaïe 65"), so the original punctuation cannot be restored from the text alone. Either compare against the branham.org source, or accept "is 65" and note it. Belongs with the page-furniture cleanup, since the "65" is usually a paragraph number there too.

## Printed page furniture is inside the sermon bodies

**Status**: the PDF extractor merged the booklet's running headers and footers into the text. `THE SPOKEN WORD` appears **5,894** times across **840** Branham files, and `QUES TIONS A ND ANSWERS ON` (a spaced-out running header) 23 times. A reader sees it: `53-0729` reads "…and now we're 18 THE SPOKEN WORD at the eye age".

It also feeds the bible-ref normalizer false positives, because the page number sits right after a book name: the 8 `Genesis 19 / 21 / 23 … / 33` refs in `53-0729` are all the page numbers of the booklet *Questions and Answers on Genesis*, and none of those chapters is cited anywhere in the sermon.

**Fix**: strip the furniture at the extraction stage, then rerun 66. Doing it in the normalizer would clean the manifest and leave the visible text broken.

## `47` truncates `bible_refs` alphabetically at 50

**Status**: 90 files have more than 50 references and `47-lift-manifest-fields.mjs` keeps the first 50. Since the list is sorted alphabetically, that keeps `1 John` … `Genesis` and drops `Revelation` and `Zechariah` — 3,956 references in all. `manifests/bible-refs.json` and the SurrealDB `cites` edges are complete; only the frontmatter is cut.

**Fix**: decide what the page should show, then either lift the cap or keep the references in order of appearance rather than alphabetically. The normalizer sorts them, so order of appearance is not recoverable today.

## `100-ingest-surrealdb.mjs` never deletes an edge

**Symptom**: all eight edge types — `by`, `cites`, `mentions`, `mentions_place`, `has_theme`, `has_tag`, `contains`, `based_on` — go through the same insert-only `inChunks`. Re-ingesting after the corpus changed adds the new edges and leaves the old ones. Against `origin/main`, goal 02 removes 477 (file, reference) pairs from `manifests/bible-refs.json` (impossible chapters, the "you're" misreads, malformed ranges, and the 83 one-chapter refs that change form), so a database ingested before it keeps up to 477 stale `cites` edges; a corrected `original` link leaves both `based_on` edges, since the unique index is on `(in, out)`.

**Fix**: delete a work's outgoing edges of each type before relating the current set, or diff against what is stored. One pass over all eight types, not one type at a time. Until then, a corpus change means rebuilding the database rather than re-ingesting on top.

## Bible-ref false positives from short book names

**Symptom**: 60-odd `Esther <n>` refs in files that never mention Esther.

**Cause**: `Est` is an accepted abbreviation for Esther in `65-normalize-bible.mjs`, and `est` is the French verb. `c'est 11 heures` becomes `Esther 11`. The same shape hits `Job` (`Jb`), `Ruth`, `Amos`, `Ge`, `Ne`.

**Fix**: drop the variants that collide with common French words, or require a chapter:verse pair (not a bare chapter) for the two-letter variants. The impossible-chapter filter added in goal 02 catches only the ones above the book's chapter count.

## Le-Scribe summaries with no Branham link

**Status**: 796 of 910 linked by `49-link-le-scribe-branham.mjs`. The other 114 are in `manifests/le-scribe-branham-unresolved.json` with their candidates: 77 still ambiguous between sermons the same day, 10 with no Branham sermon that day, 10 where two summaries claim one sermon (Hébreux 2A/2B and Semence 1re/2e parts are one sermon split in two summaries — the schema has one `summary_fr` per sermon), 9 with no date in the id (`wmbch15`, `59xxxxDiacres`), 5 with no frontmatter, and 3 where Le-Scribe's date is known to be wrong.

Those 3 are the place to start, because the right sermon is already known: `530606Demons-physique` is `53-0608A "Demonology, Physical Realm"`, `530607Demons-religieux` is `53-0609A "Demonology, Religious Realm"`; `600803Jehova-J` has no Jehovah-Jireh sermon within four days. The same drift shows in the "claimed twice" rows: `550118Ange` claims `55-0118 "This Great Warrior, David"`. More links of the "only sermon that day" kind may carry it unseen; nothing but a French title against an English one reveals it.

**Fix**: a human pass over the 114, or model the summary→sermon relation as many-to-one on both sides.

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
