# GOAL 38: a preaching that exists only as a recording gets its text

**Status:** not started (written 2026-10-12)
**Repo:** `mevar-v2` (`scripts/`, `transcripts/`, `markdown/mevar/`)
**Rules:** [README.md](README.md), and goal 04's rules for the text
**Kind:** EDITORIAL, with a script. Every batch is its own PR.

## Problem

75 Mevar works have a recording (`local_audio`, goal 25). 61 of them have
fewer than 150 words of text, most have none: the page is a player and a
title. Those preachings are not in the search, cannot be read offline, and
cost a reader on a metered phone the whole recording to know what was said.
New preachings arrive the same way, as recordings shared on the Telegram
channel (goal 39). Measured 2026-10-12 with a count of body words over
`markdown/mevar/` for every work with `local_audio`.

The other 14 have both a recording and a full text (« Le nouveau
ministère », « Les frères jumeaux du message du temps de la fin » 1 to 3,
« Dieu n'est pas un homme pour mentir », …). They are the benchmark.

## Samuel's request (2026-10-12)

Recordings are transcribed, Samuel reviews the transcript, the text is
written in the house style, Samuel reviews the work, it is published. Two
human gates, agreed in chat: the words are settled at the first, the layout
at the second.

## Design

1. **Transcribe.** `scripts/171-transcribe.mjs <recording>` runs whisper.cpp
   (Homebrew, on the Mac: `AGENTS.md` rule 4) in French, with an initial
   prompt holding the vocabulary a general model gets wrong: the book names
   of `bible-books.mjs`, the display names of `preachers.mjs`, and a short
   fixed list of Message terms (« l'Épouse », « le cri de minuit », « le
   septième sceau »…). A video goes through ffmpeg for its sound first.
   Output: `transcripts/mevar/<slug>.txt`, one paragraph per pause, each
   opening with its time in the recording (`[12:40]`) so Samuel can jump
   there while he listens.
2. **First gate: Samuel corrects the transcript** in that file and commits
   it. It is committed because it is his work and because it is the
   original the check measures the text against.
3. **Write the text.** 85 and 86 as goal 10 uses them, with the reviewed
   transcript in the place of 84's original (the `[mm:ss]` marks dropped).
   The rules are goal 04's: the preacher's words do not change, « Amen »
   and repetitions stay, Scripture from the Segond in SurrealDB through
   `segond.mjs`. Change 85 and 86 only where a transcript differs from a
   PDF's text, and say where in the PR.
4. **The work.** The body goes into the existing file; title, date, preacher
   and recording are already there. The fields a Mevar text has and an
   audio post lacks (`summary`, `tags`, `persons`, the Bible refs) come from
   the stages that made them for the OneDrive texts (65, 67, the 70s), not
   from a new prompt. If none fits, the PR says why.
5. **Second gate: the PR.** Each work is already published, so merging the
   batch publishes its texts. Batches as goal 10's, their size set by
   Samuel after the benchmark.

## Measured before the first batch (stop point)

On 3 of the 14 benchmark works, chosen for different recording conditions
(the `.wav`, an `.ogg` from the channel, the Guibéroua `.mp3`):

- the word error rate of the raw transcript against the published text,
  both lowercased and without punctuation. The published text was edited, so
  this is an upper bound; the 20 most frequent substitutions, listed;
- large-v3 against large-v3-turbo: the same two numbers, and the minutes of
  transcription per hour of recording on the Mac;
- how often a spoken reading differs from the Segond, what Whisper writes
  where a song is sung (goal 33), and where an interpreter repeats in
  another language, if a recording has one.

The report goes in `docs/goals/evidence/goal-38-benchmark.md`. Samuel
decides from it: go or stop, the model, the batch size.

## Samuel's answers (2026-10-12)

- **A reading the preacher reads aloud is replaced by the seeded Segond
  text** (`segond.mjs`), not kept as Whisper heard it. He reads the Segond,
  so the replacement removes the transcription errors and changes no word
  of his. The passage becomes a blockquote in goal 04's house style, with
  the reference the preacher announced. A paraphrase is not a reading: it
  stays inline, as he said it (goal 04, rule 2). 86 accepts the Segond in
  place of the transcript's span only where a reference is cited there,
  and lists each replacement with the words it replaced, so Samuel sees
  them at the second gate.

## Unlock event

- **Marking doubtful words.** whisper.cpp gives a confidence per word. If
  the benchmark shows the errors sit in the low-confidence words, the
  review file marks them and Samuel reads those first. Not before.

## Scope out

- New works from the channel: goal 39.
- Telling who speaks (an interpreter, a second preacher): only if the
  benchmark finds it matters.
- Any change to the recordings or to how the page plays them.

## Acceptance evidence

- The benchmark report, before any batch.
- Per batch PR: 86's output on each text (only the changes goal 04 allows,
  against the reviewed transcript), `npm run build` on the full corpus, a
  screenshot of one page with its text under the player, and a second run
  of 171 and 85 that changes nothing.

## Stop points

- The benchmark report (above).
- The cost estimate of the 85 run for each batch, before it runs
  (`DELIVERY.md`).
- Each transcript waits for Samuel's correction; no text is written from a
  transcript he has not committed.
