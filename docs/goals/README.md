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

The hard rules are in `AGENTS.md`; the procedure (worktree, commits, gates,
review, PR, stop points) is `DELIVERY.md`. Both are binding for every goal
here. One rule decides most reviews: the simplest code that works, no
abstraction for a future that has not arrived, no check on a state the types
or the pipeline already exclude. A goal file may add its own rules; it may
not relax those.
