# GOAL 29: the site counts its visits where mevar.org always has

## Problem

mevar.org on Ghost counts its visits in Google Analytics (property
`G-D3TVDDZ8H7`, in Ghost's header code injection). The new site counts
nothing: at the cutover the history would stop, and with it the only
measure of how the site grows and whom it reaches.

`AGENTS.md` (hard rule 6) and goal 05 ruled a third-party script out.

## Samuel's answers (2026-10-05)

- « we do track this website, not so much to identify people, but to know
  how it grows and the impact. We have the whole history in google can we
  add it ».
- The rule against it came with an `AGENTS.md` copied from another project.
- Later, a move to Plausible, as on aegilo; it is paid, and MEVAR makes no
  money, so not now: « so far google is free ».

## Work items

1. **The same tag, the same property**, in the head of every page of the
   built site: not in `npm run dev`, so that a local session counts
   nothing.
2. **It never holds the page**: its script is fetched once the page has
   loaded, so neither the text nor the service worker (offline reading)
   waits for Google. A reader who leaves before the page has finished
   loading is not counted.
3. **`AGENTS.md`, hard rule 6**: the exception, named and dated.

## Not in this goal

- **A consent banner.** The tag sets cookies, as it does on mevar.org
  today, where there is no banner either. Whether readers in Switzerland
  and the European Union must be asked first is Samuel's decision; nothing
  is built for it here.
- Events beyond the page view (downloads, searches, saved texts).
- Plausible.

## Acceptance evidence

- Every built page carries the tag once; the dev server's pages do not.
  (`astro preview` serves the built site: a local preview is counted.)
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.

## Stop points

The Google Analytics property and its settings are Samuel's. Nothing is
deployed.

## Follow-up

- Plausible, when MEVAR can pay for it: one script to swap in `Layout.astro`.
- The consent question above.
