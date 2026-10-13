# GOAL 41: publishing an article restores the content store

**Status:** done: merged as PR #56 (2026-10-13), landing check on `main` the
same day. On a deploy that edits one post (run 38457625689): `Syncing
content` 9 s, the whole run 3 min 02 s. The deploy of the merge itself, with
no store to restore (run 38452979299): 8 min 42 s and 11 min 34 s.
**Repo:** `mevar-v2` (`web/src/lib/bible-links.mjs`, `.github/workflows/deploy.yml`)
**Rules:** [README.md](README.md)

## Problem

Goal 40 took a deploy from about 37 minutes to 11 min 18 s (run
38387969764, 2026-10-13). Rendering is no longer the cost; parsing the
corpus is:

| Step | Time |
| ---- | ---- |
| Content sync (`[content] Syncing content`) | 8 min 32 s |
| `generating static routes`, 4,544 pages | 35 s |
| Pagefind | 50 s |
| `check:dist`, `check:limits`, upload | 25 s |

Goal 40 also caches Astro's content store between deploys, so that a run
parses only the files that changed. But the store is restored only when its
cache key matches, and the key changes on the deploys that matter most. The
store holds each work's rendered HTML, and two rehype plugins put into that
HTML something that is not in the work's own file:

- `bible-links.mjs` reads the work's references from
  `manifests/bible-refs.json`. The whole manifest is in the key: one new
  reference in one work discards the store of all 3,100.
- `bookmarks.mjs` writes the title and summary of another post into the
  work that cites it (« Cité dans ce texte »). The key holds a hash of the
  title and summary of every published post: a new post discards the store,
  though 30 pages carry a card.

So a new article, a changed title or a text with new references pays the 8
and a half minutes, and the deploy stays over ten. Replayed over the last
45 deploys of `main` before goal 40 (its independent review), the key would
have restored a store on 11 of 44.

## Design

1. **A Bible link reads the work's own frontmatter.** `bible-links.mjs`
   takes the references from `bible_refs` in the frontmatter (goal 12), which
   it already has as `file.data.astro.frontmatter`, instead of the manifest.
   The dependency is then inside the file Astro digests, and
   `manifests/bible-refs.json` leaves the key. On 2026-10-13 the two lists
   were equal, in the same order, for each of the 3,394 files of
   `markdown/`; check it again before the change, and stop if they differ.
2. **The key holds the posts a work cites, not every post.** The step that
   computes the key hashes the title and summary of the posts some work
   links to (`/<slug>/` in a body), published or not: a superset of the
   cards, cheap to find, and safe. A new post nothing links to leaves the
   key as it is. A draft that becomes published and that a work already
   links to changes it.
3. **Measure the restored run.** Goal 40 could not: the first run after its
   merge had no store. The PR carries the time of `Syncing content` on a run
   that restored one.

`works.ts` also reads the manifest, for the verse pages: that is done when
a page is rendered, not stored, and stays.

## Scope out

- **Moving the card's text out of the stored HTML** (a marker in the body,
  filled when the page is rendered). Unlock event: the narrowed key still
  misses on ordinary publications.
- **The plugins' code, the packages and `astro.config.mjs` in the key.** A
  change to one of them must parse the corpus again.
- **A faster runner**, as in goal 40. Unlock event: a deploy that restores
  the store still takes more than ten minutes.
- The time of a full parse itself (8 min 32 s on the runner, 3 min on the
  Mac).

## Acceptance evidence

- The comparison of item 1: the count of files, and of files whose
  `bible_refs` differs from the manifest's entry (0).
- `npm run build` before the change and after it, both from a cleared
  store: `diff -r` of the two `dist/` reports no difference outside
  `pagefind/`, where the filter files, the meta file and the hash in
  `pagefind-entry.json` differ from one run of Pagefind to the next on the
  same input (goal 40).
- `npm run check:dist` and `npm run check:limits` pass on the new build.
- The key, computed on `main` and again with a new published post added
  that nothing links to: the same. With the title of a cited post changed:
  another.
- A stale card is impossible, shown locally: with a warm store, change the
  title of a cited post, compute the key (it changed), and build from a
  cleared store: the card shows the new title.
- From the deploy logs after the merge (a landing check): the time of
  `Syncing content` and of the whole run, on a deploy that adds or edits one
  post. Both in the goal's Status line.

## Stop points

- A file whose `bible_refs` differs from the manifest: stop and report
  which.
- A difference in `dist/` outside `pagefind/`: stop.
- GitHub secrets and the Cloudflare project are Samuel's; this goal needs
  neither.
