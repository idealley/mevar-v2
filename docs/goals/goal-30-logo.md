# GOAL 30: MEVAR's eagle is back beside its name

## Problem

Goal 27 drew the header and the footer as `docs/website.pen` does: an
orange dot before « MEVAR ». The design has no logo, and MEVAR has one:
the eagle, `web/public/brand/logo.svg` (the file Ghost serves today) and
its white twin, both already in the repo and in every icon of the site.

## Samuel's request (2026-10-05)

« additionally we forgot MEVAR logo », with the URL of the eagle on Ghost
(the same bytes as `web/public/brand/logo.svg`).

## Work items

1. **Header and footer**: the eagle in place of the dot, dark on a light
   ground, white on a dark one (the dark theme, and the footer in both).
2. **The install sheet**: the eagle on its dark tile, in place of « M ».

## Acceptance evidence

- The header in light and in dark, the footer and the install sheet, seen
  in a browser.
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.

## Stop points

None.
