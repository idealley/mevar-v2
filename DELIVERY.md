# Delivery

How a goal becomes a merged change in this repository. `AGENTS.md` is the
operating contract; this file is the shipping procedure. Adapted from
`aya-v2/DELIVERY.md` and `firstprinciple/DELIVERY.md`, reduced to what a
content site with one human needs.

The shared procedure is the fleet `delivery` skill, linked on every box
(source: `idealley/fleet`, `skills/delivery/SKILL.md`; read it there if the
skill is not loaded). This file adds what is specific to mevar-v2 and wins
where the two disagree.

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
   fleet `codex-second-opinion` skill and the rules under "Second opinion"
   below; its result goes under "Second opinion".
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

## Second opinion

What this repository adds to the fleet `codex-second-opinion` skill.

**When.** Only when step 4 calls for it: after the step 4 review said
ACCEPT, before the PR or before the merge. Run it again only after a fix
batch that changed more than a few lines, and then the changed code also
goes back through one round of the step 4 review. Two rounds per branch are
the ceiling here, not the skill's three; what remains goes to the PR.

**Size: review the code, sample the data.** A goal that regenerates the
corpus changes hundreds of `markdown/` files, `manifests/*.json` and
`index.json`. No reviewer can read that diff, and one that tries reviews
nothing. So every prompt:

- names the hand-written files (`scripts/`, `docs/`, `web/src/`) as the
  surface to read in full;
- forbids reading the generated diff line by line (`markdown/`,
  `manifests/`, `index.json`, `web/dist/`);
- gives read-only commands that measure it instead: counts before and after
  (`git show origin/main:<file>` against the working file), a seeded random
  sample checked against the text, a `git diff --stat` by directory, and the
  script's `--dry` mode where it has one.

**Models: one pass per task size.** Split the review into scoped passes and
run them in parallel (this repo's exception to the skill's one reviewer at a
time), each with the model its task needs. Name it with `-m`;
the default in `~/.codex/config.toml` is only used when a task does not say.

| model | for | typical pass |
| - | - | - |
| `gpt-6-luna` | simple, mechanical checks | numbers in the docs, the goal file and the PR match the data; copy rules; every changed file is one the goal declares |
| `gpt-6-sol` | moderate: read and verify | sample the generated data against the text; the diff is limited to what the goal predicts; a second run is a no-op |
| `gpt-6-astra` | hard reasoning | attack the code: build inputs that break each property; what could be deleted; convergence and the revert test |

A small change needs only the astra pass. Never more than three passes a
round.

**Invocation.** From the worktree's root. Transcripts go in
`.claude/codex-reviews/`, which `.gitignore` excludes; they never enter a
commit.

```bash
mkdir -p .claude/codex-reviews
codex exec -m <model> --sandbox read-only -C <worktree-root> \
  -o .claude/codex-reviews/<branch>-<pass>.md "<prompt>" \
  </dev/null > .claude/codex-reviews/<branch>-<pass>.log 2>&1
```

`</dev/null` is required: without it `codex exec` waits for more input on
stdin ("Reading additional input from stdin...") and never starts. Do not
edit the worktree while a pass runs; it reads the working tree, not a
commit. The reviewer can still run read-only commands (`git`, `grep`,
`node -e`, a script's `--dry`); never ask it to run a script that writes.
`-o` keeps the final report apart from the tool noise.

**Prompt.**

```
Second-opinion review of the branch <branch> against origin/main in this
repository. Read AGENTS.md (hard rules), DELIVERY.md (the reject list) and
the contract <goal file> first. Surface to read in full: <hand-written
files>. Do NOT read the diff of <generated paths>: it is regenerated by
<scripts>; measure it with read-only commands instead (<suggestions>).
Your pass: <the pass's task, with the 2 to 4 properties it checks>.
Attack it: try to construct an input that violates each property.
Then: has this converged? Report everything remaining, say which
categories are clean, and say which guards would survive being reverted
with the output unchanged.
Report findings only, each with file:line and a concrete violating input
or command output; change nothing. Open with what could be deleted.
```

Properties worth naming when the change is near them:

- a work's wording never changes outside an editorial goal (AGENTS.md hard
  rule 1): a pipeline change touches frontmatter or derived files only;
- Scripture text comes from data, never from a model's memory;
- a derived file (`manifests/*`, `index.json`, `web/dist/`) is regenerated
  by its script, never edited by hand, and the diff is explained by the
  script;
- every script is idempotent: a second run is a no-op, and it deletes only
  what it created;
- a draft is never built, listed, indexed or emailed;
- the live site has no runtime dependency; every asset is on our domain;
- no reader's personal data, no secret, no populated env file anywhere.

Never put `.env`, member or subscriber data, or a Ghost export in the
prompt. Paths under `scripts/`, `docs/`, `web/src/`, `markdown/` and
`manifests/` are fine.

**Output.** A fix is shown with the script rerun and its diff. A decline is
written, with its evidence, in the commit message of the commit that answers
the pass; a finding about breadth the goal did not ask for is declined on
scope. The PR description carries the result under "Second opinion", after
"Independent review", with one line on top per pass: "Codex CLI
(`<model>`, read-only), <pass>: N findings, X fixed, Y declined", then each
finding with what was done and the evidence.

## Full send

Full send: not yet. Samuel changes `not yet` to `allowed` on that line, and
lifts "Nothing is merged by the agent" in step 5, when he decides mevar-v2
may merge unattended. Until then step 5 holds.

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
