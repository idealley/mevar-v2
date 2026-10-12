# GOAL 37: a published Mevar work is announced on the Telegram channel

**Status:** not started (written 2026-10-12)
**Repo:** `mevar-v2` (`.github/workflows/deploy.yml`, `scripts/`)
**Rules:** [README.md](README.md)

## Problem

MEVAR has a Telegram channel where the preachings are shared. When a work is
published on mevar.org, nobody is told there unless Samuel posts the link by
hand. Telegram is light on a metered connection, so for the readers
`VISION.md` builds for, it is one of the best places to hear that a text is
out.

## Samuel's request (2026-10-12)

Automated posting from the GitHub Action, agreed in chat. Goal 06 keeps the
email a human decision; this does not contradict it: a Mevar work is
published only when Samuel flips its `status` or merges its PR, so the
announcement follows a human decision already taken.

## Design

1. **What is new.** After the production deploy, a script compares the push
   (`github.event.before` to `HEAD`, `git diff -M --name-status`) under
   `markdown/mevar/` only. The archive (Branham, Le Scribe, CMPP, the local
   volumes) is never announced. A work is new when it is published at
   `HEAD` and was absent or a draft at `before` (a rename keeps the old
   path's status: goal 19's moves announce nothing).
2. **The message.** French, one per work, sent with `sendMessage` (Bot API,
   plain `fetch`, no library): the title in bold, the subtitle if any, the
   preacher and the date (« 12 octobre 2026 »), the link. Telegram's link
   preview shows the page's image and description from goal 28. Copy rules
   of `AGENTS.md` apply (no em dash, « guillemets », espace insécable).
3. **The URL.** The rule is one line and has two copies already
   (`web/src/lib/works.ts`, `email/build.mjs`). A third copy is a reject:
   name it once for the two scripts.
4. **A bulk push announces nothing.** More than 3 new works in one push: no
   message, the list is printed in the run log. A re-import or a clean-up
   goal never floods the channel.
5. **The workflow.** `actions/checkout` with the depth the diff needs; a
   step after « Deploy », on `main` only, with `TELEGRAM_BOT_TOKEN` and
   `TELEGRAM_CHANNEL_ID` from GitHub secrets. A manual run
   (`workflow_dispatch`) has no `before` and announces nothing. The site is
   deployed before this step runs: a failure here turns the run red and
   changes nothing on the site.
6. **`--dry`** prints the messages instead of sending them, and takes
   `--before <sha>` so it can be run on the Mac against any past push.

## Scope out

- Replying to the Telegram post of the recording: goal 39 adds the
  `telegram_message_id` it needs, and the reply with it.
- Search from Telegram (`docs/follow-ups.md`).
- Remembering what was sent. Git is the state; re-running a production run
  by hand sends its messages again, and that is Samuel's choice to make.

## Acceptance evidence

- `--dry --before <sha>` on the push that published
  `le-nouveau-site-de-mevar` prints exactly one message, and the text of
  that message is in the PR.
- `--dry` on a push that only moved or edited published Mevar works
  prints nothing; on a push with more than 3 new works it prints the list
  and sends nothing.
- One real message in Samuel's test channel (stop point below), screenshot
  on the PR.

## Stop points

- Samuel creates the bot with @BotFather, makes it an administrator of a
  private test channel and then of the MEVAR channel with « Post messages »
  only, and sets the two GitHub secrets. Prepare the exact clicks in the
  PR; do not ask for the token.
- The switch from the test channel to the real one is Samuel's, after the
  first real publication went out right.
