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
| 07 | [Branham text](goal-07-branham-text.md): restore the text from branham.org, find spoken citations | 02 | none |
| 08 | [Mevar first](goal-08-mevar-first.md): Mevar lists and search first, the archive below, verse pages | 05 | none |
| 09 | [Mevar duplicates](goal-09-mevar-duplicates.md): each sermon once across Ghost, PDFs and OneDrive | none | Samuel decides the uncertain pairs |
| 10 | [Mevar editorial](goal-10-mevar-editorial.md): goal 04's pass on the OneDrive and PDF texts, in batches | 09 | cost estimate; Samuel reads a sample of each batch |
| 11 | [French spoken refs](goal-11-french-spoken-refs.md): "Luc chapitre 18 verset 9" and "le chapitre 24 de Matthieu" are recorded | 07 | none |
| 12 | [Bible refs complete](goal-12-bible-refs-complete.md): every ref in the frontmatter, in the order the work cites them | 08, 11 | none |
| 13 | [Furniture, footnotes, Le Scribe](goal-13-furniture-footnotes-le-scribe.md): no page headers in Branham, working footnotes, every summary linked | 12 | Samuel answers the 94 Le Scribe links |
| 14 | [French citations as written](goal-14-french-citations-as-written.md): 65's old rewrites undone in Mevar posts, Le Scribe, CMPP | 07, 12 | the source of the two local volumes |

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

## Decisions taken 2026-09-24 (Samuel)

- **Mevar and the archive.** Mevar is what mevar.org publishes plus the
  OneDrive and PDF texts, deduplicated (goal 09) and after goal 04's
  editorial pass (goal 10). The rest (Branham, Le Scribe, CMPP, the local
  volumes) is the archive: context and history. Every list and the search
  show Mevar first; the archive sits below, on the same page.
- **Until its pass,** a OneDrive or PDF text stays visible in the archive;
  the pass promotes it. Samuel approves each batch by reading a sample.
- **Verse pages** list the works citing a verse; no Bible text on the site.
- **PDF parsing:** LlamaParse or LiteParse where the extracted text is poor.
- **Preacher names:** one display name per person, given name first
  ("Parfait M'bra", "André Kadjany"), written into the `preacher` field
  from a committed registry; the bodies keep what the transcript says.
  The archive preachers (Branham, Frank, Barilier) get author pages.

## Rules for every goal

The hard rules are in `AGENTS.md`; the procedure (worktree, commits, gates,
review, PR, stop points) is `DELIVERY.md`. Both are binding for every goal
here. One rule decides most reviews: the simplest code that works, no
abstraction for a future that has not arrived, no check on a state the types
or the pipeline already exclude. A goal file may add its own rules; it may
not relax those.
