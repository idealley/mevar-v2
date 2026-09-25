# GOAL 12: Every Bible ref of a work, in the order it is cited

**Status:** ready to dispatch
**Repo:** `mevar-v2` (`scripts/47-lift-manifest-fields.mjs`,
`scripts/65-normalize-bible.mjs`, `scripts/66-normalize-bible-en.mjs`,
`manifests/bible-refs.json`, `index.json`, the `bible_refs` frontmatter of
every source, `docs/`)
**Depends on:** 11 (merged as PR #11)
**Rules:** [README.md](README.md)

## Problem

A work's Bible refs are kept in two places, and neither is right.

- **The frontmatter is cut at 50.** `scripts/47-lift-manifest-fields.mjs:90`
  copies the refs into `bible_refs` with `refs.slice(0, 50)`. The comment
  says why: "avoid huge frontmatter for sermon transcripts". It is our own
  limit, from commit `958cab3` (2026-05-06), older than any page that could
  show the refs; nothing under `web/src` reads `bible_refs` today. Measured
  on `main` after PR #11: 90 works with frontmatter have more than 50 refs,
  and 3,946 of their refs never reach it. The longest list has 389.
- **The cut is alphabetical, so it hides the end of the alphabet.** A long
  list keeps its first 50 names in alphabetical order (`1 Corinthiens`,
  `Actes`, `Apocalypse`, …) and loses the rest (`Romains`, `Zacharie`, …),
  whatever the preacher dwelt on. Adding a ref can push another one out:
  goal 11 took 38 refs out of 25 works that way (`qui-est-dieu` lost
  `Zacharie 12:1` and `Zacharie 12:10`).
- **The order the preacher cites them in is thrown away.** `65` and `66`
  find each ref at its place in the text, then sort the list alphabetically
  before writing `manifests/bible-refs.json`
  (`scripts/65-normalize-bible.mjs:224`, `scripts/66-normalize-bible-en.mjs:171`:
  `[...new Set(found)].sort()`). The order is not lost: the text still has
  it, and the scripts see each position while they scan. It is only never
  kept.

The manifest and the SurrealDB `cites` edges have every ref; only the
frontmatter is cut, and only the order is missing everywhere.

Ten files have refs in the manifest but no frontmatter at all (322 refs,
among them `cmpp/undated/lc56` with 120 and `local/Volume-2-Ver2.0` with
93). `47` skips them, cap or not. They are "Markdown files with no
frontmatter" in `docs/follow-ups.md`, not this goal.

## Work items

1. **`65` and `66` keep the order of first appearance.** Each match already
   carries its position (`match.index`). Collect `[position, ref]` from every
   pattern of the script (in `65`: the two spoken patterns and `REF_RE`; in
   `66`: `REF_RE` and the two spoken patterns), sort by position, keep the
   first occurrence of each ref, and write that list. Two patterns can find
   refs at nearby positions ("Genèse 19, genèse chapitre 19"): position
   decides, and a ref already listed keeps its first place. Two refs can
   also start at the same position: in `66`, "Luke 11th chapter and 24th
   verse" gives `Luke 11` from `REF_RE` and `Luke 11:24` from a spoken
   pattern. At the same position, the order the script collects them in
   decides (`66`: `REF_RE`, then the spoken patterns; `65`: the spoken
   patterns, then `REF_RE`), so a run is deterministic. Nothing else in
   either script changes: the same refs are found, only their order differs.
2. **`47` copies the whole list.** Remove `.slice(0, 50)` and its comment's
   reason; the frontmatter's `bible_refs` becomes exactly the manifest's list
   for that work, same refs, same order.
3. **Regenerate** in pipeline order: `65`, `66`, `47`, `50`. (`65b` and `49`
   do not read the refs.)
4. **Docs.**
   - `docs/data-pipeline.md`, stage 4: the refs are listed in the order the
     work cites them, first occurrence only.
   - `docs/follow-ups.md`: drop "`47` truncates `bible_refs` alphabetically
     at 50, and the citing order is lost", with this goal's dispatch text;
     check that "`100` keeps only the first verse group of a list" still
     gives the right count.
   - This file: status, and the numbers measured.

## Scope out

- **What a page shows.** No page lists a work's refs today. If one ever
  does, how many it shows is a display choice for that goal, not a cut in
  the data.
- **Goal 08's verse pages.** They read the refs; this goal makes them
  complete. Building them is goal 08.
- **`100-ingest-surrealdb.mjs`.** It builds sets of refs, so the order does
  not matter to it, and it is not rerun here (no database is needed for
  this goal).
- **Finding more or fewer refs.** Any change to what 65 or 66 recognises is
  its own goal. This goal is a pure reorder plus the end of the cut.

## Acceptance evidence

Each item is shown in the PR with the command run and its output. The
baseline is a copy of `manifests/bible-refs.json` taken from `origin/main`
when the goal starts, kept outside the repo; every comparison below is
against that copy.

1. **The same refs, only reordered.** For every key of
   `manifests/bible-refs.json`, the set of refs equals the baseline's (same
   keys, same refs, no duplicate within a list). Expected: 2,886 keys, 39,225
   refs, 0 added, 0 removed; about 2,550 lists change order.
2. **The order is the text's.** For every work, the position of each ref's
   first occurrence in the body, as found by the script's own patterns, never
   decreases along the list. Shown as the count of works checked, of
   violations (expected 0) and of refs sharing a position (expected: 6 in
   `66`, all a chapter and the same chapter with its verse, such as `Luke 11`
   and `Luke 11:24`; 0 in `65`). Plus twenty random works with at least five
   refs, each with its first three refs and the words where they occur.
3. **Nothing is cut.** For every markdown file that has frontmatter and
   refs, the frontmatter `bible_refs` equals the manifest list, same length
   and same order. Expected: 0 mismatches; the 90 works with more than 50
   refs have them all (3,946 refs back in the frontmatter, including the 38
   of goal 11). The 10 files with no frontmatter are listed with their ref
   counts and left alone.
4. **Nothing else changes.** `git diff` on `markdown/` touches only
   `bible_refs` lines: no body, no other frontmatter field; about 2,540
   files. `index.json` changes only `size_bytes` and `line_count`. Shown as
   counts.
5. **Idempotent.** A second run of `65`, `66`, `47` and `50` leaves
   `git status` clean.

## Follow-up

(Filled at the landing check.)
