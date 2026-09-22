# Dispatch texts

One block per goal, to paste as the opening message of a fresh agent session
started in `~/projects/mevar-v2`. Order matters: each block assumes the
previous PRs are merged into `main`, except where it says "parallel".

## Step 0, by Samuel, before any dispatch

The goal files and the new article are uncommitted on `main`. Worktrees
branch from `main`, so they must land first:

```bash
cd ~/projects/mevar-v2
rm .git/claude-stale-index.lock            # leftover from a sandbox session
git add docs/goals markdown/mevar/ce-qui-arrive-le-jour-du-seigneur.md manifests/
git commit -m "docs(goals): v1 goals 01-06 + import the 2026-09 Ghost post"
git push
gh auth status                             # PRs are opened with gh
```

`docs/website.pen` stays untracked unless you want it in.

## Common preamble (every block starts with this)

```
Read docs/goals/README.md, then the goal file named below. The README's rules
are binding, its rule 5 (simplest code that works) most of all.

Setup, on this Mac:
  git fetch origin && git worktree add ../mevar-v2-<branch> -b <branch> origin/main
  cd ../mevar-v2-<branch> && npm install && (cd web && npm install)
Work only in that worktree. Commit as you go, Conventional Commits, one
conceptual change per commit. When the acceptance evidence in the goal file is
met, push and open a non-draft PR with `gh pr create` against main. The PR
description opens with the problem, names the goal file, and lists every
acceptance item with the command you ran and its output. Report deviations
from the goal file and anything you found that belongs in another goal. Do not
merge. Stop at the goal's stop points.
```

---

## 1. Goal 02: corpus and pipeline gaps

Run first: goal 01 rewrites markdown that the old import script would wipe,
and goals 03 and 04 need its outputs.

```
<preamble>
Goal file: docs/goals/goal-02-corpus-gaps.md. Branch: goal-02-corpus-gaps.

Context: the September 2026 Ghost export is at
manifests/mevar.ghost.2026-09-20-19-24-38.json (gitignored). The post it
added, ce-qui-arrive-le-jour-du-seigneur, is already in markdown/ and the
manifests, without series fields and without index.json rebuilt. Use that
export for item 1's "changes nothing" check.

Work the items in the order of the goal file. Item 6 (Le-Scribe to Branham
links) is the largest; do it after items 1 to 5 are committed so a problem
there does not hold the rest. Never edit the body of a sermon.
```

## 2. Goal 01: local assets

Parallel with goal 02 is allowed, but sequential is simpler: both edit
frontmatter in markdown/mevar and a rebase is then trivial.

```
<preamble>
Goal file: docs/goals/goal-01-local-assets.md. Branch: goal-01-local-assets.

Recount the numbers in the goal's Problem section before starting and put the
real ones in the PR. Downloads need the network and Ghost is live at
mevar.org; the DigitalOcean CDN host is
digitalpress.fra1.cdn.digitaloceanspaces.com. Reuse files already in the
gitignored pdfs/ folder before downloading. Commit the downloaded assets.
Do not run scripts/45-process-ghost.mjs.
```

## 3. Goal 03: URLs and navigation

After 01 and 02 are merged.

```
<preamble>
Goal file: docs/goals/goal-03-urls-and-navigation.md. Branch:
goal-03-urls-and-navigation.

The full-corpus build is the gate (`npm run build` in web/, no
CONTENT_SOURCES). Use `CONTENT_SOURCES=mevar npm run dev` while iterating.
Build the dist check script early, in web/scripts/check-dist.mjs, and run it
after every change: it is the acceptance evidence. Report the full build's
time and peak memory in the PR; goal 05 needs them.
```

## 4. Goal 04: drafts editorial pass

After 02 is merged. Parallel with 03 is fine (different files).

```
<preamble>
Goal file: docs/goals/goal-04-drafts-editorial.md. Branch:
goal-04-drafts-editorial.

This is editorial work on seven files, no code. The one hard constraint: the
preacher's words do not change, only transcription errors, punctuation,
layout and Scripture readings. Scripture text comes only from the local
SurrealDB seeded by scripts/110-seed-bible-text.mjs (start it per
docs/operations.md; if it is not seeded, seed it, and say so). One commit per
sermon. Leave status: "draft" on all seven. Put the per-sermon table from the
acceptance section in the PR; Samuel reads each sermon from there.
```

## 5. Goal 05: search and deploy

After 01 and 03 are merged.

```
<preamble>
Goal file: docs/goals/goal-05-search-and-deploy.md. Branch:
goal-05-search-and-deploy.

Reference for the workflow: ~/projects/firstprinciple/.github/workflows/deploy.yml
and DEPLOY.md there. Read-only; copy the method, not files. Goal 03's PR
reports the full build's time and memory: read it first, it decides whether
CI can build or the v1 deploy is from the Mac. Fix the PWA precache before
anything else; it is the one change that protects readers on metered
connections. The Cloudflare project does not exist yet: write DEPLOY.md so
Samuel can create it, then stop at the stop points. Do not create anything in
Cloudflare.
```

## 6. Goal 06: email on Resend

After 05 is merged and Samuel has answered the goal's decision (which Resend
account). Must be live before Ghost is cancelled.

```
<preamble>
Goal file: docs/goals/goal-06-email-on-resend.md. Branch:
goal-06-email-on-resend.

Decision taken: <separate Resend account | firstprinciple account>. Sending
domain: <lettre.mevar.org>. Reference code in ~/projects/firstprinciple
(packages/ui/server/resend.ts, sites/samuelpouyt/functions/api/subscribe.ts,
packages/email-tools/, sites/samuelpouyt/email/) is read-only; copy and
reduce, never import across repos. The Ghost members CSV does not exist for
you: build the import against tests/fixtures/members.csv with three
example.org addresses and never ask for the real file. Test the function
with `wrangler pages dev`, not `astro dev`. Stop at the stop points; every
real send is Samuel's.
```

---

## Merge ritual, by Samuel, after each PR

```bash
gh pr checks <n> && gh pr merge <n> --squash --delete-branch
cd ~/projects/mevar-v2 && git pull
git worktree remove ../mevar-v2-<branch>
```

Squash keeps `main` at one commit per goal; the atomic commits stay readable
in the PR. If you prefer the atomic commits on `main`, use `--rebase`.
