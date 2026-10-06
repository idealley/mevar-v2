# GOAL 32: the app's manifest, as Chrome asks for it

## Problem

Chrome's « Application » panel on `mevar.pages.dev` (2026-10-06) reports
three things about the manifest, none of them an error:

- one icon is declared `any maskable`. Android crops a maskable icon to its
  own shape, and `icon-512.png` draws the eagle on 74% of the square, at
  the edge of what every shape keeps;
- no `id`, so the app's identity is its `start_url`;
- no screenshot, so the installation is offered in the plain dialog.

A fourth, protocol handlers, does not apply: the site opens no link of its
own kind.

## Samuel's request (2026-10-06)

« Is this normal? until the final domain? », then « perfect let's do those
small things ».

## Work items

1. **A maskable icon of its own**, `brand/icon-maskable-512.png`: the eagle
   of `brand/logo.svg` on 60% of the square, on the page's ground. The two
   other icons keep purpose `any`.
2. **`id: "/"`.**
3. **Two screenshots of the home page**, phone (780 × 1688) and desktop
   (1280 × 800, `form_factor: "wide"`), as JPEG. A browser fetches them
   when it offers the installation, not before: they are not precached.

## Acceptance evidence

- The built `manifest.webmanifest`; the files it names exist at the sizes
  it declares.
- `dist/sw.js` precaches neither the screenshots nor the new icon.
- Chrome's panel on the built site: the three remarks are gone.
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.

## Stop points

None.

## Left

The screenshots show the home page of 2026-10-06. They are taken by hand;
retake them when the home page changes its look.
