# GOAL 36: every page of the site has a way in on a desktop screen

**Status:** in progress on `goal-36-entry-points` (2026-10-09)
**Repo:** `mevar-v2` (`web/src/components/`)
**Rules:** [README.md](README.md)

## Problem

« Mes lectures » (`/mes-lectures/`) is linked only from the tab bar, which
is hidden from 1024px, and from the offline page: on a desktop screen
nothing leads to it. « Séries » (`/series/`) and « Mis en avant »
(`/selection/`) are in neither the header nor the footer; the home page
leads to one series and to the selection, not to the series page. The
announcement of the new site (`markdown/mevar/le-nouveau-site-de-mevar.md`)
sends readers to all three.

## Samuel's request (2026-10-09)

« The https://mevar.org/mes-lectures/ is not showing on the desktop. The
url, the links works but we have no entry point for it on the UI. » Agreed
in chat: a button in the header, and the three pages in the footer.

## Design

1. **Header, from 1024px:** a round button with the bookmark icon of the
   tab bar, labelled « Mes lectures » for screen readers, between search and
   the theme toggle. A tool of the reader, like search, not a list of the
   library, so not in the row of lists (seven links, already tightened
   under 1280px).
2. **Footer, « Le site »:** « Séries », « Mis en avant », « Mes lectures »
   after « Thèmes », each label the title of its page.

## Acceptance evidence

- `npm run build` on the full corpus (on the Mac: the gate needs an 8 GB
  heap and the macOS image libraries).
- The header and the footer of a built page at 1280px, screenshot on the PR.
