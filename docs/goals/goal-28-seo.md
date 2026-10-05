# GOAL 28: what a search engine and a shared link read

## Problem

After goal 27 every page has a title, a description, a canonical URL and
four Open Graph tags, and the site has a sitemap and a feed. The rest is
missing:

- no structured data (JSON-LD) on any page;
- no `robots.txt`, so nothing tells a crawler where the sitemap is;
- `og:type` is `website` on a work, with no date and no author; no
  `og:url`, `og:site_name`, `og:locale`, no card for the other networks, and
  no image at all on a page without one of its own;
- no `<link rel="alternate">` to the feed;
- a work without a `summary` (most of them) is described by the site's own
  sentence, the same on thousands of pages;
- `dist/404.html` names a canonical URL, `/404/`, that no page has
  (`docs/follow-ups.md`).

## Samuel's request (2026-10-05)

« let's do the SEO now to fixing the missing things ».

## Work items

1. **A work** says what it is: an `Article` in JSON-LD (title, description,
   language, date, image, author with their page, and MEVAR as publisher of
   its own texts only), `og:type` `article` with its date and author.
2. **Where a page is**: a `BreadcrumbList` wherever the page shows a
   breadcrumb (a work, a book, a chapter, a verse).
3. **The home page**: a `WebSite`, published by the `Organization` MEVAR,
   with its full name and its mark.
4. **Every page**: `og:url`, `og:site_name`, `og:locale` (French, or English
   on Branham's texts), a card, an image (the mark when the page has none),
   and the link to the feed.
5. **A work's description** is its summary, or else the opening of its own
   words, as its card already shows.
6. **`robots.txt`**: everything allowed, and the sitemap.
7. **The 404 page** has no canonical URL and no `og:url`.

## Decisions (mine, for Samuel to overturn)

- **No `SearchAction`.** Google retired the search box it fed in 2024, and
  the search page reads no `?q=`. Not built.
- **No publisher on an archive text.** Branham, Frank and the others are
  kept here with permission; MEVAR is the publisher of its own texts.
- **A work whose day is not known** gives its month, or else its year.

## Acceptance evidence

- `check:dist`, four new lines: `robots.txt` names the sitemap; every
  JSON-LD block of every page parses; every Article's date is a day, a
  month or a year; every published Ghost post is an
  `Article` with its title, date and author, and `og:type` `article`.
- `npm run build` on the full corpus, `check:dist`, `check:limits`,
  `npm test`.
- The head of the home page, of a Mevar work, of a Branham text and of the
  404 page, quoted in the PR.

## Stop points

None: nothing is deployed, and Search Console (submitting the sitemap,
reading what Google found) is Samuel's.

## Follow-up

- 12 Branham texts have no summary, and their description gets French
  spacing (the excerpt is made for French; noted in goal 27's review).
