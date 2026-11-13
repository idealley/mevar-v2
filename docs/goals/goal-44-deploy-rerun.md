# GOAL 44: a failed upload is re-run without building again

**Status:** in progress.
**Repo:** `mevar-v2` (`.github/workflows/deploy.yml`, `DEPLOY.md`)
**Rules:** [README.md](README.md)

## Problem

On 2026-11-13 the deploy of « L’argent et l’onction » (run 43453160680)
failed twice at its last step. `npm run build`, `check:dist` and
`check:limits` passed; `wrangler pages deploy` stopped after 2 seconds on
its first API call:

```
GET /accounts/***/pages/projects/mevar -> 503 Service Unavailable
no healthy upstream
```

The same call failed from the Mac with Samuel's own login, during
Cloudflare's incident « Workers API availability »
(https://www.cloudflarestatus.com/incidents/e7ktq32gphhe). Nothing in the
repo was wrong. The third attempt, half an hour later, passed.

The workflow is one job, so each « Re-run » built the site again: 9 minutes
of build for 2 seconds of upload. And a failed job skips the post step of
`actions/cache`, so the content store of that build was not saved either.

## Design

1. **Two jobs.** `build` does what the job does today up to
   `check:limits`, then uploads `web/dist` as the artifact `dist`. `deploy`
   (`needs: build`) downloads it and runs wrangler. « Re-run failed jobs »
   after a failed upload runs `deploy` alone, on the same `dist/`.
2. **The deploy job checks out `web/functions` only** (sparse checkout):
   wrangler compiles the Pages Functions (`/api/subscribe`) from there at
   upload time. No `npm ci`, no build.
3. **Two more attempts** in the deploy step, 1 and 3 minutes after a
   failure, so an outage of a few minutes passes without anyone clicking.
4. The artifact is kept 3 days: long enough to re-run after a weekend's
   outage, short enough not to pile up 574 MB per deploy.

## Scope out

- **Retrying only on a 5xx.** wrangler's exit code does not say why it
  failed. Unlock event: a real configuration error makes a deploy wait the
  4 minutes of retries more than once.
- **Deploying from the Mac** (`npm run deploy`): unchanged.

## Acceptance evidence

- A run of the branch (« Run workflow », a preview at
  `goal-44-deploy-rerun.mevar.pages.dev`): both jobs pass; the deploy log
  shows the Functions bundle uploaded; the preview serves a new page and
  answers on `/api/subscribe` like production does.
- The same run's `deploy` job re-run alone: it passes, has no build step,
  and its time.
- The retry loop, run locally with a stub that fails twice: three
  attempts, then success; with a stub that always fails: exit 1 after three.
- The time of the whole run against the last deploys of `main` (upload and
  download of the artifact are the cost).

## Stop points

- GitHub secrets and the Cloudflare project are Samuel's; this goal needs
  neither.
