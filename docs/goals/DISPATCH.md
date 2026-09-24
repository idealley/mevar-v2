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
git add AGENTS.md CLAUDE.md DELIVERY.md VISION.md docs/goals \
        markdown/mevar/ce-qui-arrive-le-jour-du-seigneur.md manifests/
git commit -m "docs: operating contract, delivery, vision, v1 goals; import the 2026-09 Ghost post"
git push
gh auth status                             # PRs are opened with gh
```

`docs/website.pen` stays untracked unless you want it in.

## Common preamble (every block starts with this)

```
Read AGENTS.md, VISION.md, DELIVERY.md, docs/goals/README.md, then the goal
file named below, in that order. Follow DELIVERY.md exactly: worktree from
origin/main, npm install on this Mac at the root and in web/, atomic
Conventional Commits, the gates for what you touch, the independent
subagent review with the prompt given there, then a non-draft PR with
`gh pr create` whose description opens with the problem and lists every
acceptance item with the command you ran and its output. Do not merge. Stop
at the stop points. End with the report DELIVERY.md asks for.
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

## 8. Goal 08: Mevar first

After goal 05 is merged. Parallel with goal 09 (different files).

```
<preamble>
Goal file: docs/goals/goal-08-mevar-first.md. Branch: goal-08-mevar-first.

isMevar reads editorial_pass and duplicate_of, which goals 09 and 10 will
write; until then no OneDrive or PDF text has them, so Mevar is the Ghost
posts. Build and test the archive lists with that. The verse pages add
about 1,400 files: run check:limits before and after and report both.
```

## 9. Goal 09: Mevar duplicates

Any time; parallel with goal 08.

```
<preamble>
Goal file: docs/goals/goal-09-mevar-duplicates.md. Branch:
goal-09-mevar-duplicates.

Print the score distribution before choosing thresholds. The uncertain band
is Samuel's: list it in the PR with excerpts and stop; do not apply a guess.
Frontmatter only, never a body.
```

## 10. Goal 10: Mevar editorial, per batch

After goal 09 is merged. One session can run several batches; each batch
is its own branch and PR.

```
<preamble>
Goal file: docs/goals/goal-10-mevar-editorial.md. Also read
docs/goals/goal-04-drafts-editorial.md: its rules are this goal's rules.
Branch: goal-10-batch-01 (then -02, …).

First deliverable, before any paid run: the cost estimate for the whole
goal and per batch, the PDF text-quality measure, and the LlamaParse /
LiteParse comparison on five bad PDFs. Stop there for Samuel. Then batch 01.
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
