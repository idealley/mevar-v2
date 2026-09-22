# GOAL 01: Every image and PDF served from our own domain

**Status:** ready to dispatch
**Repo:** `mevar-v2` (scripts at the root, site in `web/`)
**Rules:** [README.md](README.md)

## Problem

The day Ghost is switched off, every asset it hosts dies. The markdown in
`markdown/mevar/` still points at Ghost for almost everything that is not text
(counts from 2026-09-20, recount before starting):

- 111 body images at `https://mevar.org/content/images/...`
- 364 PDF links at `https://mevar.org/content/files/...`
- about 50 files on `digitalpress.fra1.cdn.digitaloceanspaces.com` (the PDF
  download cards, `pdf_download:` in frontmatter, one body image)
- 69 `pdf_url:` values in `markdown/mevar-pdfs/` pointing at `mevar.org`
- 112 posts have a `feature_image`, 110 are downloaded to `images/mevar/`.
  Missing: `ce-qui-arrive-le-jour-du-seigneur` and one other.

Feature images are also far too heavy for the audience: 26 MB for 110 files,
the largest is a 2.7 MB PNG, one is a 1.8 MB GIF.

## Design

1. **Download.** Extend the existing pattern (`90-download-mevar-images.mjs`,
   `80-download-mevar-pdfs.mjs`): one new script that collects every URL on
   the two Ghost hosts from `markdown/mevar/` and `markdown/mevar-pdfs/`
   (bodies and frontmatter), downloads each file once, and is idempotent.
   Body images go to `images/mevar/content/`, files to `files/mevar/`. Keep
   the original file name. On a name collision, prefix with the Ghost
   `YYYY-MM` path segment.
2. **Deduplicate before downloading PDFs.** Many of the 364 links are the
   same file linked from several posts, and part of them already exist in
   the gitignored `pdfs/` folder. Reuse what is on disk.
3. **Rewrite.** Replace each downloaded URL in the markdown with a
   root-relative path (`/images/mevar/content/...`, `/files/mevar/...`).
   `feature_image:` keeps the remote URL as provenance, `local_image:` is what
   the site reads (already the convention). Add `local_pdf:` next to
   `pdf_download:` and `pdf_url:` the same way.
4. **Serve.** `web/public/images` is already a symlink to `../../images`. Add
   the same symlink for `files`. The downloaded assets are committed to git:
   the site must build from a clean clone with no network.
5. **Optimize images.** One script, run once and rerunnable: resize to
   1600 px max width, re-encode to WebP (keep the GIF only if it is really
   animated), update `local_image:` extensions. Target: feature images under
   150 KB each, `images/` under 8 MB total.
6. **Make script 45 stop undoing this.** Today `45-process-ghost.mjs` wipes
   `markdown/mevar/` and regenerates it from the Ghost export, which would
   erase the rewritten links. This part is owned by goal 02 (additive
   import). If 02 has not merged yet, do not run 45.

## Scope out

- Audio. Branham audio and PDFs stay on their CloudFront hosts, Le-Scribe and
  cmpp PDFs stay on their own sites. We link to third parties, we do not
  mirror them.
- R2 or any object storage. Unlock event: a single file over 25 MiB (the
  Cloudflare Pages per-file limit) or the repo passing 1 GB.
- Any change to page templates (goal 03).

## Acceptance evidence

- `grep -r "mevar.org/content\|digitaloceanspaces" markdown/ | grep -v "^[^:]*:feature_image:\|pdf_download:\|pdf_url:"`
  returns nothing: the only remaining references are provenance fields.
- Every root-relative asset path in `markdown/` resolves to a file on disk. A
  ten-line check script proves it and is committed with the goal.
- Every post with `feature_image:` has a `local_image:` that exists.
- `du -sh images/` is under 8 MB. No file in `images/` or `files/` is over
  25 MiB. Report the total size of `files/`.
- The download script rerun a second time downloads nothing and changes
  nothing (`git status` clean).
- `npm run build` in `web/` passes. Spot check in `npm run preview`: one post
  with body images, one with a PDF card, the newest post with its feature
  image.
- Report: number of files downloaded, number of dead links on Ghost (404
  today, list them, do not invent replacements).
