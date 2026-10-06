# GOAL 27: the site as `docs/website.pen` draws it

**Status:** merged as PR #41 (2026-10-05)

## Problem

The site works and carries the whole corpus, in the scaffold's look: a
grey component kit, system fonts, no dark mode, a phone layout that is the
desktop one squeezed. `docs/website.pen` is the design Samuel built for
mevar.org: the home page, a work's page, six phone screens, a light and a
dark theme, and the rule for cards with and without an image.

## Samuel's request (2026-10-05)

« can you implement this design thouroughly and implement all pages, the
different views, the dark and light mode, mobile version etc. The goal is
achieved when the website looks exactly like the design, that we do have
all the functionalities etc. and that all is pixel perfect. »

## What the design holds

| Frame | What it fixes |
| ----- | ------------- |
| Web — Accueil v2 (moderne), and (sombre) | the home page from 1024px, both themes |
| Web — Article (v2), and (sombre) | a work's page from 1024px, both themes |
| Mobile — Accueil, Article, Recherche, Mes lectures, Écritures, Installer l'app | the six phone screens |
| Cartes — règles d'image | a card with an image, without one, and on a photo |
| Hero — exploration, B | the hero from 1024px, see « Decisions » |

Measures, colours and type come from the file itself (exported frame by
frame as CSS), not from a reading of the pictures.

## Work items

1. **Tokens, type, themes.** The design's variables as CSS variables,
   light and dark; its three faces (Instrument Serif, Inter Tight,
   Newsreader) served from our domain, latin subset. The theme is the
   reader's choice, kept on the device, or else the system's, applied
   before the first paint.
2. **Shell.** Header, footer, and under 1024px a bar of four tabs
   (Accueil, Recherche, Écritures, Mes lectures) with a page's own top bar.
3. **Home page**, section by section as drawn: hero and the latest
   publication, the ways in, the selection, the recent texts, the reading
   cards, the verse, the four ways to follow, the newsletter.
4. **A work's page**: reading progress, breadcrumb, the sections of the
   text, sharing, saving, text size, PDF, the Scriptures it cites, its
   author, what to read next. Everything the page does today stays:
   recording, video, series, summary and original, published-with, tags.
5. **Every other page** in the same vocabulary: the four lists and their
   archives, authors, themes, years, verse pages, the site's own pages,
   404, offline.
6. **Search** as the phone screen draws it, on Pagefind's JS API: field,
   archive switch, three filters, results with their list, excerpt, date
   and reading time.
7. **Écritures**: an index of the books the library cites (`/bible/`), the
   most cited of each testament, and a page per book leading to the
   chapter pages that exist.
8. **Mes lectures**: the texts opened on the device, how far each was read,
   which ones the service worker still holds; an offline notice.
9. **Install sheet** on a phone when the browser offers the installation.

## Decisions (mine, for Samuel to overturn)

- **The hero is the latest publication on the photograph of Abraham at
  Mamre**, with « Par où commencer » beside it (frame « Hero — exploration »,
  B). Samuel, 2026-10-05: the latest text leads, as on mevar.org, and the
  photograph is the background. The first build took the dark slab with the
  mission's sentence and its three figures; that hero is gone. Under 1024px
  the phone frame stays as drawn: the mission's sentence, then the latest
  publication on its own image.
- **One navigation.** The home frame lists « À propos » without
  « Écritures », the article frame the reverse. The header lists both.
- **Web fonts, against `DELIVERY.md`'s reject list** (« a web font »). The
  design is these three faces; they are on our domain, 15 to 45 KB each,
  `font-display: swap`, and Newsreader is fetched only by a page with a
  body. The cost is stated in the PR.
- **A link exists only where its page does.** The design's footer names
  « Mentions légales », « Confidentialité », « Plan du site »,
  « Téléchargements », « Nous écrire », and YouTube and Facebook icons.
  None has a page, an address or an account in the repo, so none is built. « Ouvrage solidaire du Christ »
  leads to the page whose title is « Courage soldat de Christ! » and takes
  that title (copy rule: a label matches its page).
- **The verse on the home page** is Hébreux 4:12, first clause. Its words
  are checked against the seeded Segond 1910 text (hard rule 2), and it is
  labelled « Segond 1910 », not « NEG 1979 » as drawn: the repo holds no
  NEG text to check it against.
- **The newsletter is described as goal 06 built it.** The design promises
  one email a week with the full text; the email is sent at each
  publication and carries the summary, a link and the PDF. The page says
  that.
- **No date on the PDF card.** The design dates the PDF (« mis en ligne
  le… »); the repo records when a work was published, not when its PDF was
  put online.
- **A work's words do not move** (hard rule 1). The design lifts a text's
  first heading above its title and prints a reference under each quote;
  the page shows the body as it is written.
- **« À lire en ce moment »** is the series, newest part first, and its
  link leads to a new `/series/` page. **« Mis en avant »** is the works
  marked `featured`, and its link leads to a new `/selection/` page.
- **Nothing about a reader leaves the device.** Mes lectures, the theme
  and the text size are in `localStorage`.
- **The component kit goes.** Nothing imports the Svelte kit once the
  pages are redrawn, so it, the Svelte integration and their packages are
  removed.

## Acceptance evidence

- The home page and a work's page at 1440px, and the six phone screens at
  390px, overlaid on the design's frames: sections at the same height to
  the pixel, light and dark.
- Theme switch, reading progress, text size, saving, copy link, the full
  reference index, Mes lectures with a page held offline, the offline
  fallback, search with its filters, the testament switch, the install
  sheet: each exercised in a real browser against the built site.
- `npm run build` on the full corpus, `npm run check:dist`,
  `npm run check:limits`, `npm test`.
- The weight of a page before and after: HTML, CSS, JS, fonts.

## Stop points

None of Samuel's gates is touched: no deploy, no Cloudflare, no email.

## Follow-up

- The four footer pages and the two social accounts, when they exist.
