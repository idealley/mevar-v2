# GOAL 25: The data clean before the design

## Problem

Before the design work, Samuel asked for the data to be « correct, clean »
(2026-10-04). An audit of `main` found:

- 69 Ghost posts were sermons on SoundCloud and 8 were videos on YouTube.
  The ingest kept their text but dropped the embeds. The SoundCloud tracks
  are all gone. Most of these posts hold only a line or two of text, so
  their pages, and the PDF goal 23 made of each one, have almost nothing
  in them.
- An old French normalizer replaced some words in Branham's English texts
  with French book names, e.g. « God is. 133 » became « God Ésaïe 133 ».
- Two pairs of scripts share a number: `90-mevar-pdfs` and
  `90-download-mevar-images`, `91-r2-pdfs` and
  `91-patch-mevar-frontmatter`.
- 67 writes `manifests/branham-furniture-unaligned.json` without its last
  newline, and 65d writes it with one. Each undoes the other.

## Samuel's answers (2026-10-04)

- « I would like to host the audio on R2 and re link the youtube videos. »
  He found the recordings and put them in a local folder (now `audio/`,
  which `.gitignore` already excludes): « probably we need to standardize
  the name, but I let you check ».
- The posts with no text: « Hide them for now » until their audio is back.
  Then (2026-10-05) he found the four recordings still missing, and: « the
  recording without page, need to be published ».
- CMPP's contact details stay as they were published.

## Work items

1. **`scripts/mevar-media.json`** holds the decisions: which recording in
   `audio/` belongs to which post, and which YouTube video. Recordings are
   matched by title, part number and date. 68 of the 69 SoundCloud posts
   have one; « Le Sermon sur la Montagne (5) » has its own text. Three
   posts with a full text get the recording of the same sermon (same title
   and date). The four recordings that match no post get a page of their
   own: a post with the title and date of its recording, Parfait M'bra its
   preacher, as he is of 65 of the 67 other recordings.
2. **`scripts/97-mevar-media.mjs`**:
   - converts each recording to a mono 64 kbit/s MP3
     (`audio/mp3/<recording>.mp3`, gitignored). The sources are Ogg Vorbis
     (55), AAC (14), MP3 (2) and WAV (1), and Safari does not play Vorbis.
   - uploads the MP3 to R2 as `audio/<slug>.mp3`, unless the bucket
     already holds the same bytes;
   - sets `local_audio: "https://files.mevar.org/audio/<slug>.mp3"` and
     `video_url`.
   It is idempotent, deletes nothing, and fails the run when a recording
   is missing. 96 and 97 share their R2 helpers in `scripts/r2.mjs`.
3. **The page**: WorkPage plays `local_audio` in the browser's own
   `<audio>` player, which loads nothing until it is played. It links
   `video_url` with a « Vidéo » button.
4. **Drafts**: none is left. The four posts with no text, recording or
   video were drafts until Samuel found their recordings.
5. **No text PDF for a post without text.** 95 (formerly 90) skips a Ghost
   post of under 100 words and removes its `text_pdf`. The PDF it had
   made is then unnamed, so 95 deletes it as before. Word counts: the
   short posts go up to 78 words, and the next post has 295.
6. **Branham**: the replaced words are restored from the PDFs, by
   matching the context with `pdftotext`.
7. **Numbers**: `90-mevar-pdfs` becomes `95-mevar-pdfs`, and `91-r2-pdfs`
   becomes `96-r2-pdfs`.
8. **67** keeps each manifest's last line ending as it was.

## Acceptance evidence

- Every post in `mevar-media.json` names its `local_audio` or `video_url`.
  A HEAD request on each `local_audio` answers 200 with `audio/mpeg`.
- 97, 95 and 96 each run twice: the second run changes nothing and
  uploads nothing. 67 followed by 65d is a no-op.
- No text PDF is left for a post under 100 words.
- `npm test`, the build, `check:dist` and `check:limits` pass.

## Stop points

- Nothing is deleted on R2.
- A recording matched only by guesswork is not published. It goes to
  Samuel.

## Follow-up

- `manifests/branham-restore-unaligned.json` (65b) still lists 39 spots
  that this goal restored. Rerunning 65b could rewrite other citations,
  so it was not rerun.
