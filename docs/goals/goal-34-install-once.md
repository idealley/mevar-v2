# GOAL 34: the offer to install is made once

**Status:** PR open (2026-10-08)

## Problem

On the live site (2026-10-08), Samuel's phone (GrapheneOS, Brave): he taps
« Installer », the browser says it adds the site to the home screen, no
icon appears, and when he reloads the home page (the only page that has the
sheet) it offers the installation again.

The manifest, its icons and the service worker answer as they should on
mevar.org, and Chromium reports no installability error (goal 32). On
Android only Chrome, with Google's services, builds an app from a site;
Brave, like Firefox and GrapheneOS's Vanadium, adds a shortcut to the home
screen (web.dev, « Installation »). Why that shortcut did not appear on
this phone is not known, and nothing in the repo decides it.

The second part is ours. A shortcut is not an installation, so the browser
goes on offering one at every page; the sheet remembered a « Plus tard »
and nothing else, so it came back each time.

## Samuel's request (2026-10-08)

« I click install, it seems to install, add to home screen and the icon
does not appear. When I refresh the site, it proposes again to install. »

## Work item

The sheet remembers any answer, « Installer » as well as « Plus tard », and
is not shown again on that device. The browser's own menu still offers the
installation.

## Acceptance evidence

- In a browser: « Installer » calls the browser's prompt, and after a
  reload the sheet stays closed although the browser offers again; the
  same for « Plus tard »; a device that has answered nothing still sees it.
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.

## Stop points

None.

## Left

Whether the shortcut appears from Brave's own menu (« Add to Home
screen »), or with Vanadium, is for Samuel to try on his phone.
