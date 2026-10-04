# GOAL 24: The Branham, Le Scribe and CMPP PDFs served from our domain

## Problem

Every Branham (1,206), Le Scribe (910) and CMPP (242) page offers its
original PDF, but by linking to another site: branham.org's CDN,
le-scribe.org, cmpp.ch. If one of them moves or deletes a file, the page's
button breaks, and we cannot repair it. Samuel (2026-10-04): « I am simply
afraid of those links to disappear ».

## Samuel's answers (2026-10-04)

- Store them on Cloudflare R2 (about 0.4 GB: within R2's free tier at its
  published prices, with no fee on downloads).
- The `cf` CLI is installed and logged in, « it should allow you to do
  everything for the next goal »: creating the bucket and its domain is
  part of this goal, not a stop point.

## Work items

1. **Cloudflare**, with `cf`:
   - an R2 bucket, `mevar-files`;
   - its custom domain `files.mevar.org` (a new record in the `mevar.org`
     zone; no existing record changes), TLS 1.2 at least.
2. **`scripts/91-r2-pdfs.mjs`**, for every Branham, Le Scribe and CMPP
   work with a `pdf_url`:
   - the PDF: Branham's and Le Scribe's local copies (`pdfs/<source>/`,
     gitignored, downloaded by goals 01–02); CMPP's downloaded once from
     its `pdf_url` into `pdfs/cmpp/`;
   - refused unless it starts as a PDF (« %PDF- »): a cached file that does
     not is downloaded again;
   - uploaded to `mevar-files` as `<source>/<path>.pdf`, its path the
     work's under `markdown/<source>/` (a year's folder, or `undated`), when the
     bucket does not already hold the same bytes (its etag is the file's
     MD5);
   - named in the work's `local_pdf` as
     `https://files.mevar.org/<source>/<path>.pdf` (the remote
     `pdf_url` stays, as AGENTS.md keeps every remote URL).
   Idempotent: a second run uploads nothing and changes no frontmatter. It
   deletes nothing in the bucket. A work whose PDF cannot be had fails the
   run. It reads and sets frontmatter with `scripts/frontmatter.mjs`, which
   90 now shares (Samuel, on this PR: name the helpers once).
3. **The pages** read `local_pdf` before `pdf_url` already: no change.

## Acceptance evidence

- Every Branham, Le Scribe and CMPP work names a `local_pdf` on
  `files.mevar.org`, and a request to each answers 200 with a PDF.
- 91 run twice: the second run uploads nothing.
- Build and `check:dist` pass.

## Stop points

- Nothing is deleted on R2 or in DNS by this goal.

## Follow-up

- 86, 87 and 88 keep their own variants of the frontmatter helpers that
  `scripts/frontmatter.mjs` now names for 90 and 91. Found by goal 24's
  review.
