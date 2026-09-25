# GOAL 12: Every Bible ref of a work, in the order it is cited

**Status:** in review (dispatched 2026-09-25 by Samuel; branch
`goal-12-bible-refs-complete`, baseline `fba80c0`)
**Repo:** `mevar-v2` (`scripts/47-lift-manifest-fields.mjs`,
`scripts/65-normalize-bible.mjs`, `scripts/66-normalize-bible-en.mjs`,
`manifests/bible-refs.json`, `index.json`, the `bible_refs` frontmatter of
every source, `docs/`)
**Depends on:** 11 (merged as PR #11) and 08 (merged as PR #12, which
exported `citations()` from 65 and 66 and gave the ten works with no
frontmatter theirs)
**Rules:** [README.md](README.md)

## Problem

A work's Bible refs are kept in two places, and neither is right.

- **The frontmatter is cut at 50.** `scripts/47-lift-manifest-fields.mjs:90`
  copies the refs into `bible_refs` with `refs.slice(0, 50)`. The comment
  says why: "avoid huge frontmatter for sermon transcripts". It is our own
  limit, from commit `958cab3` (2026-05-06), older than any page that could
  show the refs; nothing under `web/src` reads `bible_refs` today (goal 08's
  verse pages read `manifests/bible-refs.json`). Measured on `main` after
  PR #12: 95 works have more than 50 refs, and 4,325 of their refs never
  reach the frontmatter. The longest list has 389.
- **The cut is alphabetical, so it hides the end of the alphabet.** A long
  list keeps its first 50 names in alphabetical order (`1 Corinthiens`,
  `Actes`, `Apocalypse`, …) and loses the rest (`Romains`, `Zacharie`, …),
  whatever the preacher dwelt on. Adding a ref can push another one out:
  goal 11 took 38 refs out of 25 works that way (`qui-est-dieu` lost
  `Zacharie 12:1` and `Zacharie 12:10`).
- **The order the preacher cites them in is thrown away.** `65` and `66`
  find each ref with its position (`citations()` yields `{ index, text, ref
  }`), then sort the list alphabetically before writing
  `manifests/bible-refs.json` (`scripts/65-normalize-bible.mjs:275`,
  `scripts/66-normalize-bible-en.mjs:213`: `[...new Set([...citations(body)]
  .map((c) => c.ref))].sort()`). The order is not lost: the positions are
  right there. It is only never kept.

## Work items

1. **`65` and `66` keep the order of first appearance.** Change only the
   driver line quoted above, in each script: sort the citations by `index`,
   and at the same index the longer `text` first (the rule
   `web/src/lib/bible-links.mjs` already uses), then keep the first
   occurrence of each ref. `citations()` itself does not change: the site
   imports it. Two refs can start at the same index: in `66`, "Luke 11th
   chapter and 24th verse" gives `Luke 11` (the shorter `REF_RE` match) and
   `Luke 11:24` (the spoken one); the longer match comes first. The same
   refs are found, only their order differs. If any work gains or loses a
   ref, stop and find out why; what 65 or 66 recognises is another goal.
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
- **`web/`.** Goal 08's verse pages read `manifests/bible-refs.json`, which
  is already complete, and `web/src/lib/bible-links.mjs` links the refs in a
  body through `citations()`, which this goal does not change. No page
  changes; `npm run build` is not a gate here.
- **`100-ingest-surrealdb.mjs`.** It builds sets of refs, so the order does
  not matter to it, and it is not rerun here (no database is needed for
  this goal).
- **Finding more or fewer refs.** Any change to what 65 or 66 recognises is
  its own goal. This goal is a pure reorder plus the end of the cut.

## Acceptance evidence

Each item is shown in the PR with the command run and its output. The
baseline is the commit the branch starts from, saved with a copy of its
`manifests/bible-refs.json` outside the repo when the goal starts; every
comparison below, the `git show <commit>:<path>` ones included, is against
that commit, even if `main` moves meanwhile. The expected values were
measured on `main` after PR #12 (2026-09-25).

1. **The same refs, only reordered.** For every key of
   `manifests/bible-refs.json`, the set of refs equals the baseline's (same
   keys, same refs, no duplicate within a list). Expected: 2,953 keys,
   40,602 refs, 0 added, 0 removed; about 2,610 lists change order.
2. **The order is the text's.** For every work, the list equals its
   `citations()` sorted by index, then longer text first, first occurrence
   kept. Shown as the count of works checked, of mismatches (expected 0) and
   of pairs of refs whose first occurrences share an index (expected: 6 in
   `66`, each a chapter and the same chapter with its verse, such as `Luke
   11:24` before `Luke 11`; 0 in `65`). Plus twenty random works with at
   least five refs, drawn with a seed stated in the PR, each with its first three refs and the words where they
   occur.
3. **Nothing is cut.** For every markdown file with refs, the frontmatter
   `bible_refs` equals the manifest list, same length and same order.
   Expected: 0 mismatches; the 95 works with more than 50 refs have them all
   (4,325 refs back in the frontmatter, including the 38 of goal 11).
4. **Nothing else changes.** `git diff` on `markdown/` touches only
   `bible_refs` lines: no body, no other frontmatter field; about 2,610
   files. `index.json` changes only `size_bytes` and `line_count`. Shown as
   counts.
5. **Idempotent.** A second run of `65`, `66`, `47` and `50` leaves
   `git status` clean.

## Measured

On the branch, against `fba80c0`, 2026-09-25: 2,953 keys and 40,602 refs
in `manifests/bible-refs.json`, 0 added, 0 removed, 0 duplicates; 2,609
lists change order. Every list is its work's `citations()` in text order
(1,820 works in `65`, 1,133 in `66`, 0 mismatches); 6 pairs of refs share a
first index, all in `66`, each a chapter and its verse. Every frontmatter
`bible_refs` is its manifest list (0 mismatches); the 95 works over 50 refs
get their 4,325 others back, goal 11's 38 (25 works) included, and the
longest list has 389. `git diff` touches 2,609 markdown files, `bible_refs`
lines only; `index.json` changes `size_bytes` and `line_count` of 95 rows.
A second run of 65, 66, 47 and 50 leaves `git status` clean.

## Follow-up

(Filled at the landing check.)
