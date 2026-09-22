# Goals: mevar.org v1

Six goals take the repo from "corpus done, site scaffolded" to "mevar.org served
from Cloudflare, Ghost switched off". One goal per worktree and per PR.

| # | Goal | Depends on | Human gate |
| - | ---- | ---------- | ---------- |
| 01 | [Local assets](goal-01-local-assets.md): every image and PDF served from our own domain | none | none |
| 02 | [Corpus gaps](goal-02-corpus-gaps.md): pipeline fixes, Le-Scribe to Branham links | none | none |
| 03 | [URLs and navigation](goal-03-urls-and-navigation.md): nothing that works on Ghost today breaks | 01 | none |
| 04 | [Drafts editorial pass](goal-04-drafts-editorial.md): the 7 drafts become publishable | 02 | Samuel reads each draft |
| 05 | [Search and deploy](goal-05-search-and-deploy.md): Pagefind, Cloudflare Pages, Africa budget | 01, 03 | Cloudflare project, secrets, DNS |
| 06 | [Email on Resend](goal-06-email-on-resend.md): signup, member import, publication emails | 01, 05 | Resend account, DNS, real import, every real send |

[DISPATCH.md](DISPATCH.md) holds the text to paste for each goal. 01 and 02 can run in parallel. 04 can run any time after 02. 06 must be live
before Ghost is cancelled, not before the site goes live.

## Decisions already taken (2026-09-20, Samuel)

- **Scope:** v1 publishes the full corpus (all 7 sources, about 3,100 works).
  Written permission to republish the third-party texts exists.
- **Search:** Pagefind, static. No hosted database in v1. SurrealDB stays a
  local tool; the site is a static projection of `markdown/`.
- **Deploy:** this repo, its own Cloudflare Pages project. Not a site inside
  the firstprinciple monorepo.
- **Drafts:** they get an editorial pass (goal 04), then they publish.
- **Email:** the newsletter leaves Ghost for Resend, same method as
  firstprinciple, on a new sending domain (goal 06).
- **Audience:** most visits come from Africa. Static, CDN, light pages,
  offline reading. Every goal is judged against that.

## Rules for every goal

1. **Worktree and branch per goal** (`goal-01-local-assets`, etc.). Never on
   `main`. Atomic Conventional Commits, as in the existing history
   (`feat(web):`, `data(mevar):`, `fix(scripts):`, `docs:`).
2. **Installs happen on the Mac**, never from a Linux sandbox. A sandbox
   install writes Linux binaries that break the macOS checkout.
3. **Never change the wording of a sermon, article or book.** Pipeline and
   formatting changes only. Goal 04 is the one exception and has its own rules.
4. **`markdown/` is the source of truth for the site.** Manifests and
   `index.json` are derived. A change to a derived file without the change
   that produces it is a bug.
5. **Simplest code that works.** No abstraction for a possible future need,
   no config option nobody asked for, no defensive checks against states the
   types or the pipeline already exclude. A new dependency needs one sentence
   of justification in the PR. The reviewer rejects a PR on this rule alone.
6. **Gate for anything touching `web/`:** `npm run build` in `web/` passes on
   the full corpus, plus the goal's own acceptance checks. Gate for
   `scripts/`: rerun the script and show `git diff --stat` is limited to what
   the goal predicts.
7. **Stop points:** Cloudflare account actions, secrets, DNS, and switching
   Ghost off are Samuel's. Prepare, document the exact clicks, stop.
8. **Report** at the end: gates run with their output, deviations from the
   goal file, anything discovered that belongs in another goal.
