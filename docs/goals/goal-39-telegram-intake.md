# GOAL 39: a preaching posted on the Telegram channel becomes a draft

**Status:** not started (written 2026-10-12)
**Repo:** `mevar-v2` (`scripts/`, `markdown/mevar/`)
**Rules:** [README.md](README.md)
**Depends on:** 37 (the announcement), 38 (recording to text)

## Problem

New preachings are shared on the MEVAR Telegram channel as recordings
(audio, sometimes video). Today they reach mevar.org only if Samuel
downloads them, writes the post and adds the recording by hand, so most do
not reach it at all.

## Samuel's request (2026-10-12)

A script that finds the new posts, downloads the recordings, and hands them
to goal 38's flow (transcribe, Samuel reviews, the text is written, a draft,
Samuel reviews, publish). Agreed in chat: it runs on the Mac, not on
Cloudflare.

## Design

1. **Why a client and not the bot.** The Bot API cannot read a channel's
   past posts (a bot only gets updates while it listens, kept 24 hours) and
   cannot download a file over 20 MB. The channel's recordings are larger
   (the `.ogg` in `audio/` run from 9 to 61 MB). A Telegram client (MTProto,
   the `telegram` npm package, GramJS) reads the history and downloads any
   size. That is the dependency's one sentence.
2. **Whose account.** The client logs in as a Telegram account that is an
   administrator of the channel. Its session string gives full access to
   that account: it lives in the root `.env` only (rule 5). A dedicated
   account for MEVAR, not Samuel's own, limits the damage of a leak; the
   choice is Samuel's.
3. **`scripts/170-telegram-intake.mjs`** lists the channel's posts that
   carry audio or video and come after the highest `telegram_message_id` in
   `markdown/mevar/`: id, date, caption, length, size. Git is the state; no
   cursor file. `--take <id>…` then, for each post Samuel names:
   - downloads the media into `audio/` (gitignored), once;
   - writes `markdown/mevar/<slug>.md` with `status: "draft"`, no body,
     `telegram_message_id`, and the title, date, preacher (`preachers.mjs`)
     and place read from the caption. A caption that does not give one of
     them is printed and the field is left for Samuel, never guessed;
   - adds the recording to `scripts/mevar-media.json`, so 97 makes the MP3
     and sets `local_audio` as for every other Mevar recording.
   Then goal 38's flow runs on the draft unchanged: 171, Samuel's
   transcript, 85 and 86, the draft PR.
4. **The client reads the channel's posts and nothing else**: no member
   list, no comments, no reactions, no other chat (rule 3).
5. **The announcement replies to the recording.** Goal 37's script sends
   its message as a reply to `telegram_message_id` when the work has one,
   so the text appears under the recording it comes from.

## Scope out

- Running on a schedule, or a Worker that pings when something is posted.
  Unlock event: Samuel misses posts with the script run by hand.
- Publishing the video itself. A video's sound is the recording; its
  `video_url` is set only when it is also on YouTube.
- Search from Telegram (`docs/follow-ups.md`).

## Acceptance evidence

- `--dry` against the real channel lists the recording posts after a given
  id, with the fields above, and nothing else from the channel.
- One real post taken end to end: the draft file, its `mevar-media.json`
  line, 97's MP3 on R2, then goal 38's transcript waiting for Samuel. A
  second `--take` of the same id changes nothing.
- Goal 37's `--dry` on a push that publishes that draft prints the message
  with its reply-to id; one real reply in the test channel, screenshot on
  the PR.

## Stop points

- The account, its login code, `api_id` and `api_hash`
  (my.telegram.org): Samuel's. Prepare the steps, stop.
- Which posts are taken: Samuel names them.
- Flipping the draft to published: Samuel (`DELIVERY.md`).
