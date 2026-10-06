# GOAL 26: Branham's recordings on our domain, his texts without page headers

**Status:** merged as PR #40 (2026-10-05)

## Problem

After goal 25, three things were left on Branham's side:

- Every Branham page links its recording (1,206) on branham.org's CDN.
  That is the risk goal 24 removed for the PDFs: if the CDN moves or
  deletes a file, the page breaks and we cannot repair it.
- 129 page headers or page numbers from the PDF are still in the texts
  (« 52 THE SPOKEN WORD »), listed in
  `manifests/branham-furniture-unaligned.json`. 65d could not align them
  with the PDF safely.
- `manifests/branham-restore-unaligned.json` (65b) still lists 39 French
  names that goal 25 has restored since.

## Samuel's answers (2026-10-05)

- « we can do from point 1 to 3 ».
- Host the recordings on R2, about 30 GB, which goes past R2's free tier
  (about $0.35 a month at its published price; downloads are free).

## Work items

1. **`scripts/98-r2-branham-audio.mjs`**, for every Branham work with an
   `audio_url`:
   - downloads the recording once into `audio/branham/<path>.m4a`
     (gitignored), and refuses it unless it is an MP4 file;
   - uploads it to `mevar-files` as `audio/branham/<path>.m4a`, with type
     `audio/mp4` (branham.org serves it as `binary/octet-stream`), unless
     the bucket already holds the same bytes;
   - sets `local_audio`. The remote `audio_url` stays, as AGENTS.md keeps
     every remote URL.

   It is idempotent, deletes nothing, and fails the run when a recording
   cannot be had. It shares `scripts/r2.mjs` with 96 and 97.
2. **The page** plays `local_audio` (goal 25's player). It links the
   remote `audio_url` only when a work has no recording of its own.
3. **The 129 page headers** are removed by hand. Each spot is checked
   against the PDF's text. A paragraph number is never removed, and a spot
   that is not clearly furniture is left in place and listed. 65d then
   rewrites its manifest with what is left. Where a page break had also
   garbled the words beside it, the PDF's words are restored. There are
   three such spots, found during the work and in its review:
   - 53-0829: a doubled « you? »;
   - 53-0905: a doubled « Jesus Christ. Amen. »;
   - 59-0823: a paragraph number written as the reference « 2:33 ».
4. **65b's manifest**: a rerun finds no French name left, so it is empty.
   The same rerun would also paste PDF running headers into three texts,
   so those text changes were discarded and 65b now warns against a rerun.

## Acceptance evidence

- Every Branham work names a `local_audio` on `files.mevar.org`, and a
  HEAD request on each answers 200 with `audio/mp4`.
- 98 run twice: the second run downloads and uploads nothing.
- 65d, 67 and 50 are no-ops after the hand fixes.
- `npm test`, the build, `check:dist` and `check:limits` pass.

## Stop points

- Nothing is deleted on R2.
