# GOAL 19: The Mevar texts under mevar/, named by their title and year

**Status:** in progress
**Repo:** `mevar-v2` (`scripts/`, `manifests/`, `index.json`,
`markdown/onedrive/` and `markdown/mevar-pdfs/` moving to `markdown/mevar/`,
`web/src/`, `web/scripts/`, `docs/`)
**Depends on:** 10 (batches 01 to 03), 18 (merged as PR #25)
**Rules:** [README.md](README.md)
**Kind:** STRUCTURE: files move and are renamed; no word of a text changes.

## Problem

Samuel (2026-09-29): a promoted text is still `markdown/onedrive/pdf/nov2009.md`,
served at `/works/onedrive/pdf/nov2009/`. The path says where the file came
from, not what it is: « these nov2009 have been done out of lack of
understanding of managing content a long time ago ». In a static site the
file's name is the URL. A Mevar text should sit with the other Mevar content,
named by its title and year: « it also immediately helps to understand where
this article is situated in time ».

mevar.org still serves Ghost; the new site is on the preview only, so no
`/works/onedrive/…` URL has been public and none needs a redirect.

## Decisions (Samuel, 2026-09-29)

- **One folder:** every Mevar text in `markdown/mevar/`, beside the Ghost
  posts, served at `/<slug>/`. The Ghost import (45) is additive: it only
  creates a file for a slug that has none.
- **Name:** the title and the year, `perseverez-dans-la-vision-du-reveil-2009`;
  no year repeated when the title holds one (`2013-annee-de-mission`); the
  month when two texts would share a name
  (`la-guerre-de-liberation-avril-2007`, `…-mai-2007`).
- **What moves:** the texts goal 10 has promoted (and the works split from
  them); a later batch's texts move when promoted. CMPP, Branham, Le Scribe
  and the local volumes stay where they are.
- **Titles:** a text titled after its month (« Exhortation bilan de fin
  d'année 2008 ») takes the title its document gives, and the generic one
  becomes its subtitle.

## Work items

1. **`88-mevar-paths.mjs`** moves each promoted goal 10 text to
   `markdown/mevar/<slug>.md`, records where it came from
   (`source_path: "onedrive/pdf/nov2009.md"`, `source` unchanged), and
   rewrites every reference to its old path: `manifests/onedrive.json`
   (`local_md`), `manifests/bible-refs.json`'s keys, `published_with`,
   `duplicate_of`. A name taken by a Ghost post stops the script. A second
   run is a no-op.
2. **The pipeline keeps its keys.** The batches, the editor's fixes, the
   heading decisions and the caches stay keyed by the original path; 86
   finds a moved text through its `source_path`.
3. **The scripts that read `markdown/mevar/` as the Ghost posts** (46, 48,
   80, 83, 92, 94, 87, 50) read a moved text as what it is: its `source`
   says so.
4. **The site** decides a root URL by the folder, not by `source`: a text
   under `mevar/` is at `/<slug>/`.
5. **Generic titles**: the three promoted texts whose title is their month
   take their document's title (86's rule: the words are in the PDF's
   opening).

## Scope out

- The texts goal 10 has not reached, CMPP, Branham, Le Scribe, local.
- Any word of a text; the Ghost posts' own files.

## Acceptance evidence

1. The list: old path, new path, title, year; the names that took a month;
   the texts with no year.
2. `git diff --stat -M`: the moves are renames; bodies unchanged except
   the three retitled texts' frontmatter.
3. 86 on batches 01 to 03, 65, 47, 50, 83, 87 and 88: a second run is a
   no-op.
4. `npm run build`, `check:dist`: every moved text at `/<slug>/`, no
   `/works/onedrive/…` page for them.
