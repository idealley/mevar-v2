# GOAL 17: French typography: a narrow space before « : ; ? ! »

**Status:** merged as PR #22 (2026-09-28); the reference follow-up below in progress
**Repo:** `mevar-v2` (`web/src/lib/`, `web/src/content.config.ts`,
`web/astro.config.mjs`, `email/build.mjs`, `tests/`, `package.json`,
`docs/`)
**Depends on:** 10 (batch 02 merged as PR #21)
**Rules:** [README.md](README.md)
**Kind:** DISPLAY. No markdown file changes: the site and the emails add
the space when they render (Samuel, 2026-09-28).

## Problem

French puts a narrow no-break space (U+202F) before « : ; ? ! ». The
corpus has it in few places. Measured on `main` after PR #21, in the
bodies:

| source | ordinary space | no-break or narrow | none |
| - | -: | -: | -: |
| `mevar` | 31,695 | 4,782 | 7,462 |
| `onedrive` | 48,943 | 3,543 | 12,645 |
| `le-scribe` | 58,797 | 0 | 16,891 |
| `cmpp` | 42 | 0 | 87,221 |
| `mevar-pdfs` | 10,247 | 0 | 1,237 |
| `local` | 3,465 | 0 | 188 |

« none » includes what must stay: « Jean 3:16 », « 10:30 », web
addresses. `branham` is English and has no such space.

Samuel's decisions (2026-09-28): the space is added at display, not in
the files, so re-imports from Ghost stay right and 86 compares the same
bodies; and where a text has none, one is added.

## Work items

1. **One function, `frenchSpacing`**, in `web/src/lib/`: before « ; ? ! »
   and « : », an ordinary, no-break or thin space becomes a narrow one; a
   letter or a closing mark (« » ) ] ’ ») directly before them gets one.
   Never after a digit (« Jean 3:16 », « 10:30 »), never in a web address,
   never between two marks (« ?! »).
2. **The site**: a rehype plugin applies it to every French body's text
   (not code, not Branham), after the Bible links; the content schema
   applies it to the title, subtitle and summary of every French work, so
   lists, pages, feeds and search read the same.
3. **The emails**: `email/build.mjs` applies it to the title, the summary
   and Samuel's note.
4. **Tests** for the function, in the root `npm test`.
5. **Follow-up (Samuel, after PR #22): a reference takes no space.**
   Word puts one before « : » (« Philippiens 2 :3-8 »), and PR #22 made it
   the narrow one. In a Bible reference as 65 reads it (`citations()`, the
   same the Bible links use), « : » now takes no space on either side:
   « 2:3-8 », « 24:28 », « Hébreux 5:5-10 ». Not between any two numbers:
   « juin 1933 : 1) » and « verset 24 : 24 Car » are not references. A
   spelling 65 does not read (« Mathieu », « Ephésiens », « Hébr », « Pier »,
   about 180 in `dist`) keeps its narrow space, and is not linked either:
   a follow-up for 65.

## Scope out

- The markdown files, the manifests, `index.json`, SurrealDB.
- The spaces inside « guillemets », the site's own interface text.
- English (Branham).

## Acceptance evidence

1. The tests, with the cases above and their counter-cases.
2. `npm run build` on the full corpus; in `dist/`, per source, the count
   of « : ; ? ! » after a space other than the narrow one, before and
   after (expected 0 in the French bodies), and a sample of rendered
   sentences, references and addresses left as they are.
3. `git diff --stat`: no file under `markdown/` or `manifests/`.
