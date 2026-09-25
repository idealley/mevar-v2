# Delivery

How a goal becomes a merged change in this repository. `AGENTS.md` is the
operating contract; this file is the shipping procedure. Adapted from
`aya-v2/DELIVERY.md` and `firstprinciple/DELIVERY.md`, reduced to what a
content site with one human needs.

## Shape

1. **Worktree per goal.** `git fetch origin`, then
   `git worktree add ../mevar-v2-<branch> -b <branch> origin/main`, branch
   named for the goal (`goal-01-local-assets`). Never on `main`, never in
   another goal's worktree. `npm install` at the root and in `web/`, on the
   Mac. If two goals run in parallel their declared files do not overlap; a
   change that needs a file outside the goal's set stops and asks.
2. **Atomic Conventional Commits.** `feat|fix|docs|chore|refactor|data|content(scope): …`
   as in the existing history (`feat(web):`, `data(mevar):`,
   `fix(scripts):`). One conceptual change per commit; a reviewer reads the
   branch history as the story of the change. No secrets, no populated env
   files, no `mevar.ghost.*.json`.
3. **Gates, proportional to the change.**
   - Touched `web/`: `npm run build` on the full corpus, plus the goal's own
     check script against `dist/` once goal 03 has created it.
   - Touched `scripts/`: rerun the script; a second run is a no-op;
     `git diff --stat` is limited to what the goal predicts.
   - Touched `markdown/` by hand (editorial goals only): `git diff --word-diff`
     shows only the kinds of change the goal allows.
   - Docs-only: no gates.
4. **Independent review before the PR.** The implementing session spawns a
   fresh subagent with an empty context and gives it this prompt verbatim,
   the two names filled in, nothing added:

   > Review the branch `<branch>` against `origin/main`. The goal file is
   > `docs/goals/<file>.md`; the reject list is in `DELIVERY.md`. You did not
   > write this code. Open with what could be deleted. Every finding cites
   > file:line and quotes the line. End with ACCEPT or REJECT.

   Fix every finding or decline it with evidence in the commit message that
   answers the round. Re-run once. Open the PR at ACCEPT, or after the second
   round with the remaining findings and the evidence against them in the PR
   description under "Independent review". When the dispatch or Samuel asks
   for it, a second opinion from another model family follows, with the
   `codex-second-opinion` skill (`.claude/skills/`); its result goes under
   "Second opinion".
5. **Non-draft PR** with `gh pr create`. The description opens with the
   problem, names the goal file, and lists every acceptance item with the
   command run and its output. Deviations from the goal file are stated, not
   hidden. Nothing is merged by the agent.
6. **Merge and landing check, by Samuel.** Squash merge keeps `main` at one
   commit per goal. After the merge, the goal file's acceptance section is
   read against `main`, not against the PR description; a gap becomes a line
   in the goal's "Follow-up" section or a new goal.
7. **Report.** Gates run with their output, review rounds, deviations, and
   the one thing the next goal should know. Findings that belong to another
   goal go into that goal file, not into the code.

## What a reviewer rejects

The review opens with one question: **what in this change could be
deleted?** A file nothing imports, a helper with one caller, a document
describing one step of a goal: sent back on that question alone.

Then, quoting the line:

- an abstraction, option or parameter with a single concrete use ("we will
  need it later" is the reason to reject);
- a check on a state the pipeline or the types already exclude: a frontmatter
  field the schema guarantees, a file the glob just returned, a `try/catch`
  that adds no handling, a default for an impossible undefined;
- a "utils" module with one caller, or the same helper copied into a third
  file instead of named once;
- a dependency added without the one sentence that names what it replaces;
- a derived file (`manifests/*`, `index.json`) edited by hand, or regenerated
  with a diff the script does not explain;
- a change to a work's wording outside an editorial goal;
- a script that is not idempotent, or that deletes what it did not create;
- a page that ships more than the reader asked for (a list of 2,000 cards,
  a precache of every page, a web font);
- code the goal file did not ask for, however good.

## Stop points

- **Cloudflare (project, env vars, custom domain, DNS), Resend (account,
  domain, keys), GitHub secrets, Ghost (signup, billing, cancellation)** are
  Samuel's. Prepare in test mode, document the exact clicks, stop.
- **Flipping a draft to published, and every real email send**: Samuel.
- Anything that spends money waits for Samuel; LLM cleanup runs state their
  estimate first.
- A human gate is closed by the human. A discovered workaround is reported,
  never taken.
- Environmental failures are declared, not worked around: never copy secrets
  into a worktree, never install from a sandbox.

## Generated files

`manifests/*.json`, `index.json`, `manifests/bible-refs.json` and everything
under `web/dist/` are generated. Regenerate, never hand-merge; a final
regeneration on a clean branch produces no diff.
