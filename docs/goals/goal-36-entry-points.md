# GOAL 36: every page of the site has a way in on a desktop screen

**Status:** in progress on `goal-36-entry-points` (2026-10-09)
**Repo:** `mevar-v2` (`web/src/components/`)
**Rules:** [README.md](README.md)

## Problem

« Mes lectures » (`/mes-lectures/`) is linked only from the tab bar, which
is hidden from 1024px, and from the offline page: on a desktop screen
nothing leads to it. « Mis en avant » (`/selection/`) is in neither the
header, the footer nor the chips of `Browse.astro`; the home page links it
only when a featured text has an image. The announcement of the new site
(`markdown/mevar/le-nouveau-site-de-mevar.md`, on the branch
`goal-34-email-template` until goal 35 lands) sends readers to both.

« Séries » was in the request too, but it has its way in on every screen:
the chip in `Browse.astro` and « Toutes les séries » on the home page.

## Samuel's request (2026-10-09)

« The https://mevar.org/mes-lectures/ is not showing on the desktop. The
url, the links works but we have no entry point for it on the UI. » Agreed
in chat: a button in the header, and the pages in the footer (« Séries »
dropped after the review, see above).

## Design

1. **Header, from 1024px:** a round button with the bookmark icon of the
   tab bar, labelled « Mes lectures » for screen readers, between search and
   the theme toggle. A tool of the reader, like search, not a list of the
   library, so not in the row of lists (seven links, already tightened
   under 1280px).
2. **Footer, « Le site »:** « Mis en avant » and « Mes lectures » after
   « Thèmes », each label the title of its page.

## Acceptance evidence

- `npm run build` on the full corpus (on the Mac: the gate needs an 8 GB
  heap and the macOS image libraries).
- The header of a built page at 1024px, where it is tightest (`lg:flex`
  turns it on, the lists already narrow their gap under 1280px), and the
  footer: screenshots on the PR. If the header overflows at 1024px, that is
  a finding for the PR, not a fix made in advance.
