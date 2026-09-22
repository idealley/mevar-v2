# mevar-v2: operating contract for agents

How an agent works in this repository. `CLAUDE.md` imports this file; keep
shared guidance here and nowhere else. `VISION.md` says why the site exists,
`DELIVERY.md` says how a goal ships, `docs/goals/` holds the goals.

Roles: **you** are the agent; **Samuel** is the only human in the loop and
holds every gate.

## Read first

1. This file.
2. `VISION.md`: the why, and the constraints that follow from the readers.
3. The goal file you were given, from `docs/goals/`. `docs/goals/README.md`
   has the order, the decisions already taken and the dispatch text.
4. `DELIVERY.md` before the first commit.
5. `docs/architecture.md`, `docs/data-pipeline.md` and `docs/operations.md`
   when the goal touches `scripts/` or the database; `docs/follow-ups.md`
   for what is known and deferred.

## What this repository is

Three layers, one source of truth:

- `markdown/<source>/` is the corpus: 3,100 works with YAML frontmatter. It
  is the source of truth for everything downstream. The bodies are sermons,
  exhortations, studies and books by named preachers.
- `scripts/` (numbered by stage) turns raw sources into that markdown and
  derives `manifests/` and `index.json` from it. A derived file is never
  edited by hand.
- `web/` is an Astro site that is a static projection of `markdown/`, built
  and served from Cloudflare Pages. SurrealDB (`surreal/`, `db/`) is a local
  research tool over the same corpus, never a dependency of the live site.

## Hard rules

Most guidance is a default Samuel can override. These are not:

1. **Never change the wording of a work.** Pipeline and formatting changes
   only. Editorial passes are their own goal, with their own rules, and even
   there the preacher's words stay the preacher's.
2. **Scripture text comes from data, never from model memory.** The seeded
   Segond text in SurrealDB, or the passage as the preacher quoted it. A
   verse an agent recalls is not a source.
3. **Personal data of readers never enters the repo, a log, a PR or an
   agent's context.** Member and subscriber lists stay where Samuel keeps
   them. Test with fixtures at `example.org`.
4. **Installs happen on the Mac, never from a Linux sandbox.** A sandbox
   install writes Linux binaries that break the macOS checkout.
5. **No secrets in the repo.** Keys live in Pages env vars and in the root
   `.env`, which is gitignored. Never commit a populated env file.
6. **The live site has no runtime dependency.** Every page is static,
   every asset is on our domain, search is a static index. A reader in
   Ouagadougou on a metered phone is the reader we build for (`VISION.md`).

## Glossary

- **work**: one document of the corpus, any kind (sermon, exhortation,
  bible_study, book, chapter, article). One markdown file, one URL.
- **source**: where a work came from: `mevar` (the Ghost posts), `mevar-pdfs`,
  `onedrive`, `branham`, `le-scribe`, `cmpp`, `local`.
- **Ghost**: the CMS that serves mevar.org today and where new articles are
  still written until the cutover. Its export (`mevar.ghost.*.json`,
  gitignored) is imported, never edited.
- **draft**: a work with `status: "draft"`. It exists in the corpus and is
  never built, listed, indexed or emailed until Samuel flips the status.
- **series**: works a reader should read in order, declared in frontmatter
  (`series`, `series_part`). A link between two works is not a series.
- **provenance field**: a frontmatter field that records where something
  came from (`url`, `feature_image`, `pdf_url`, `pdf_download`, `ghost_id`).
  It keeps the remote URL forever; the site reads the `local_*` twin.
- **manifest**: a JSON file under `manifests/` derived from the corpus or
  the raw sources by a script. Regenerated, never hand-merged.
- **goal**: one bounded piece of work with acceptance evidence, one branch,
  one PR. `docs/goals/`.

## Copy rules (site text, emails)

- French first. English only where the work itself is English.
- No em dashes, in French or English. Colon, comma, parentheses, or a new
  sentence.
- French typography: « guillemets », espace insécable before : ; ? !
- "Newsletter", not "infolettre".
- Menu labels match the page title they lead to.

## Commands

```bash
cd web && npm run dev              # mevar source only, fast (CONTENT_SOURCES=mevar)
cd web && npm run dev:all          # full corpus, slow sync
cd web && npm run build            # the gate; full corpus, 8 GB heap
node scripts/<NN>-*.mjs            # pipeline stages, see docs/data-pipeline.md
```

## Working with Samuel

Concise and direct; challenge over-engineering loudly. Questions are
read-only: answer, do not edit. Stop points are in `DELIVERY.md`.
