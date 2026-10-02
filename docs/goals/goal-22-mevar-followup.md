# GOAL 22: Mevar follow-up to goal 21

**Status:** PR open
**Repo:** `mevar-v2` (`scripts/86`, `scripts/65`, the batch 01 entry
`Exhortationnovembre2007` and the batch 07 entry `pred_sept2010` of
`scripts/mevar-editorial-fixes.json`, the frontmatter `bible_refs` of the
French works, `manifests/bible-refs.json`, `index.json`, `docs/`)
**Depends on:** 10 (batches 01 to 07), 21
**Rules:** [README.md](README.md)
**Kind:** PIPELINE and goal 10's editorial path (86); no word of a text
changes.

## Problem

Goal 10's batches 06 and 07 and goal 21 left three faults:

- two editor's fixes on overlapping spans of a pass make 86 apply one over
  the other without a word (batch 06 hit it with an Esther 3:13 fix; the
  readers' `check.py` caught it, 86 did not);
- in 86's header test, a text whose date Samuel decided may have any 19xx or
  20xx year in its removed header (`decided.date && /^(19|20)\d\d$/`), where
  only the year the decision replaced is needed for the next run to accept
  the header it accepted;
- the citations written with a dot between chapter and verse, « Mat.
  24.14 » (about 10,100, most in CMPP), are recorded by 65 as the chapter
  alone.

## Decisions (Samuel, 2026-10-01)

« yes let's go ahead with both » (this goal and goal 10's batch 08, in
parallel).

## Work items

1. **86 reports an overlapping fix.** Two editor's fixes whose spans in the
   pass overlap are unexplained, both finds quoted, and neither is applied.
   Measured first on batches 01 to 07: a text with such a pair would stop
   promoting; each pair is folded into one fix, before and after shown, the
   text's wording unchanged.
2. **A decided date allows only the year it replaced.** The editor's entry
   records the date the decision replaced (`replaced_date`); 86 checks it
   against the frontmatter before promotion, and afterwards counts only that
   date's words as the header's. A fixture shows the guard both ways.
3. **65 reads « Mat. 24.14 ».** A dot between two digits, right after a
   book, separates chapter and verse; a decimal, a price, a time, a page or
   a list number has no book before it. Measured read-only first, per
   source; a seeded sample of at least 100 gained references read against
   their sentence; every gained range looked up in SurrealDB. Then 65 on
   every French source, 47 and 50.

## Scope out

- Any word of a text.
- 85, and batch 08's entries in the three editorial data files, in flight in
  parallel. Whichever PR merges second reruns 65 (all sources), 47 and 50,
  and 86 on every batch, instead of merging those lines by hand.
- A reference to a verse Segond does not have (« Apocalypse 3.24 »): recorded
  as written, as main already does for 61 such; listed for Samuel.

## Acceptance evidence

1. The overlapping pairs in batches 01 to 07 before the change, each fold
   before → after, and the edited body identical; 86 on a fixture with an
   overlap reports it with both finds.
2. The rule chosen; the fixture: the replaced year accepted, another year
   refused, before and after the change.
3. References gained per source, the sample and its verdicts, the SurrealDB
   check; only `bible_refs`, `manifests/bible-refs.json` and `index.json`
   change; a second run of 65, 47 and 50 is a no-op.
4. 86 on batches 01 to 07 promotes every text; `npm run build`,
   `npm run check:dist`; `git status` clean after a second run of each
   script.
