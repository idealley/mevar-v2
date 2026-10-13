# GOAL 40: a deploy takes under ten minutes

**Status:** merged, PR #55 (2026-10-13). First deploy after the merge, run
38387969764, with no store to restore: `generating static routes` 35 s (was
28 min 28 s), `Syncing content` 8 min 32 s, the whole run 11 min 18 s (was
about 37). Still owed: the time of `Syncing content` on a run that restores
the store. The deploys that do not restore it are
[goal 41](goal-41-store-restored.md).
**Repo:** `mevar-v2` (`web/src/lib/works.ts`, `.github/workflows/deploy.yml`)
**Rules:** [README.md](README.md)

## Problem

A push to `main` takes about 37 minutes to reach mevar.org. On 2026-10-12
the page a newsletter links to answered 404 for that long after its fix was
merged, and a typo in one article cost another full build.

The last green deploy before that day (run 37883924378, 2026-10-09), from
its log:

| Step | Time |
| ---- | ---- |
| Content sync (`[content] Syncing content`) | 7 min 05 s |
| `generating static routes`, 4,544 pages | 28 min 28 s |
| Pagefind | 41 s |
| `check:dist`, `check:limits`, upload | 20 s |

The rendering time is the work pages, at a flat cost whatever the length of
the text:

| Pages | Count | Per page |
| ----- | ----- | -------- |
| `/works/branham/` | 1,206 | 569 ms |
| `/works/le-scribe/` | 910 | 600 ms |
| `/<slug>/` (Mevar) | 522 | 480 ms |
| `/works/cmpp/` | 401 | 483 ms |
| `/bible/` | 1,321 | 2 ms |
| every list (authors, themes, years, kinds) | about 180 | 10 to 50 ms |

**Hypothesis, not yet measured:** `allWorks()` (`web/src/lib/works.ts`)
loads the collection and sorts its 3,100 entries on every call, nothing
keeps the result, and a work page calls it several times: `WorkPage.astro`
for the series, `nextWorks()`, `workAt()` and the helpers beside them. A
flat half second per page is what that would cost.

The 7 minutes of sync are spent again on every run because CI starts
without `web/.astro/data-store.json`, where Astro keeps each entry with the
digest of its file and skips the ones that did not change.

## Samuel's request (2026-10-12)

« Do you think we can improve the build, and rebuild only what actually
changed? » Astro renders every page on every build: there is no supported
way to render only the pages a change touches. Agreed in chat: remove the
repeated work, cache the content store, then measure.

## Design

1. **Measure first.** Profile the render of work pages on the Mac
   (`node --cpu-prof` on a build limited to one source, or timers around
   the calls in `WorkPage.astro`) and name what the half second is spent
   on. The PR carries the numbers. If it is not the repeated reading of the
   collection, stop and report: the rest of this goal assumes it is.
2. **The list of works is computed once per build.** `allWorks()` keeps
   its result for the life of the process. If the profile shows a second
   repeated computation (a helper that filters the whole list for each
   page), it gets the same treatment, and only if the profile shows it.
   Nothing a page displays changes.
3. **The content store is cached in CI.** `actions/cache` on
   `web/.astro/data-store.json` in `deploy.yml`, restored before the build
   and saved after it, keyed so that a run always restores the newest store
   and Astro's digests decide what is parsed again. A change to
   `web/src/content.config.ts`, to a remark or rehype plugin, or to the
   Astro version must not serve stale entries: check what Astro invalidates
   by itself and put the rest in the key.

## Scope out

- **A faster runner (Blacksmith or another).** The repo is public, so
  GitHub's runners are free, and the time is spent in our own code. Unlock
  event: a deploy still takes more than ten minutes after this goal.
- **Building only the changed pages**, by hand or with a custom cache of
  `dist/`. Unlock event: Astro supports it.
- **Splitting the archive from the Mevar texts** into two builds or two
  projects.
- The `concurrency` setting and the `paths` filter of `deploy.yml`.
- The local build's 8 GB heap. If it falls as a side effect, say so in the
  PR; do not chase it.

## Acceptance evidence

- The profile of item 1: where the time of a work page goes, before and
  after.
- `npm run build` on the full corpus, before the change and after it, on
  the same machine: `diff -r` of the two `dist/` reports no difference, or
  each difference is named and explained (a build timestamp, a hash). No
  page changes for a reader.
- `npm run check:dist` and `npm run check:limits` pass on the new build.
- From the deploy logs after the merge (a landing check, since the cache
  only exists once `main` has run once): the time of `generating static
  routes`, and the time of `Syncing content` on a second run that changes
  one markdown file. Both in the goal's Status line.
- A run after a change to `content.config.ts` or to a plugin parses the
  corpus again: shown on a preview deploy (`workflow_dispatch`) or argued
  from the cache key, with the line quoted.

## Stop points

- Item 1 refutes the hypothesis: stop and report what the profile shows.
- A difference in `dist/` that is not a timestamp or a hash: stop.
- GitHub secrets and the Cloudflare project are Samuel's; this goal needs
  neither.
