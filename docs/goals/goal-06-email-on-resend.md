# GOAL 06: The newsletter moves from Ghost to Resend

**Status:** needs one decision from Samuel (see "Decision before dispatch")
**Repo:** `mevar-v2` (`web/functions/`, `email/`, `scripts/`)
**Rules:** [README.md](README.md)
**Reference:** `~/projects/firstprinciple`: `packages/ui/server/resend.ts`
(contact upsert, read its comment on why it is GET then POST or PATCH),
`sites/samuelpouyt/functions/api/subscribe.ts`, `packages/email-tools/`
(test send, scheduled broadcast, receipts), `sites/samuelpouyt/email/`
(markdown to HTML and text render). Same method, reduced to what MEVAR needs.

## Problem

Ghost is not only the CMS, it is the mailing list. The 2026-09-20 export
shows two active newsletters ("MEVAR - Publications" and "Toutes les
notifications"), 42 posts that were emailed to members when published, open
signup, and sending through Mailgun. When Ghost is cancelled (goal 05, step
5), the readers who asked to be told about a new publication stop hearing
from us, and the site has no signup form.

The member list is **not** in the content export. It is a separate CSV
(Ghost Admin, Members, Export).

## Decision before dispatch (Samuel)

The firstprinciple Resend account is capped at three segments by its plan and
all three are used (see the header of `subscribe.ts` there, which is why the
monthly brief lives in D1). MEVAR needs one more list. Two ways:

- **A separate Resend account for MEVAR (recommended).** Own API key, own
  domain, own limits, and a ministry list never sits in the business CRM.
  Free plan on 2026-09-20: 3,000 emails a month, 100 a day, 3 domains. Check
  the contact and daily limits against the real member count before choosing
  the plan: a broadcast to more than 100 members in a day may need the paid
  plan.
- The same account, with the list as a D1 table and per-recipient sends, the
  way the monthly brief does it. More code, shared key, mixed brands.

The rest of this goal assumes the first option.

## Design

1. **One list, one product.** "Publications": an email when a new work is
   published on the site. The two Ghost newsletters merge into it. No weekly
   letter, no segments by topic. Unlock event for a second list: Samuel
   writes a second kind of email.
2. **Sending domain.** A subdomain (`updates.mevar.org`, the one Samuel
   created in the Resend account; decided 2026-09-24 over the planned
   `lettre.mevar.org`), so its SPF and DKIM records never collide with
   whatever serves `mevar.org` mail today. From:
   `MEVAR <publications@updates.mevar.org>`, reply-to `contact@mevar.org`.
3. **Signup.** `web/functions/api/subscribe.ts`, a Cloudflare Pages Function:
   validate the email, upsert the Resend contact with
   `{ origin, source: "site", consented_at }`, join the segment. Copy the
   three helpers it needs from `resend.ts` into the function file. Do not
   create a shared package between the two repos. One form component, in the
   footer and on `/newsletter/` (the Ghost page of that name already exists
   in the corpus, so the old URL keeps working). French copy: "Newsletter",
   not "infolettre". `astro dev` does not run Pages Functions; test with
   `wrangler pages dev`. The deploy step must run wrangler from `web/`, or
   `functions/` does not ship and `/api/*` answers 405 (see the comment in
   firstprinciple's `deploy.yml`).
4. **Member import.** `scripts/150-import-ghost-members.mjs <csv path>`:
   reads the Ghost CSV, keeps only members subscribed to an active
   newsletter, upserts each into Resend with
   `{ origin: "ghost-import", source: "ghost", consented_at: <Ghost created_at> }`.
   Idempotent, rate limited, dry run by default (`--send` to write). Prints
   counts only.
5. **The email.** `email/build.mjs <work path>` renders one work from its
   frontmatter: title, preacher, date, the `summary:`, the feature image
   (WebP from goal 01, under 100 KB), a "Lire la prédication" button to the
   canonical URL and a "Télécharger le PDF" link when `local_pdf:` exists.
   Not the full text: the readers are on metered phones, and the page is
   cached for offline reading once opened. HTML under 40 KB plus a plain text
   part. Resend's own unsubscribe link in the footer.
6. **Sending.** Copy `packages/email-tools/` (tests included) and its config
   file with one product entry. Same ritual as firstprinciple: render, test
   email to Samuel, then a scheduled broadcast with a receipt JSON committed
   under `email/receipts/`. Never two broadcasts for the same work: check the
   receipts and Resend before sending.

## Personal data rules (hard)

- The members CSV is personal data of identifiable people in a religious
  context. It never enters the repo, a commit, a PR, a log or an agent's
  context. It stays where Samuel saved it and is passed by path. The import
  script prints counts, never addresses.
- The agent builds and tests the import with a fixture of three fake
  addresses at `example.org`. **Samuel runs the real import himself.**
- No tracking pixels or click tracking beyond Resend's defaults; turn open
  and click tracking off for the domain if the account allows it.

## Scope out

- Paid tiers, member login, comments. Ghost had them available; MEVAR never
  used them (`portal_plans: ["free"]`).
- Automatic send on publish. A human decides which work is announced.
  Unlock event: Samuel announces every publication for three months and asks
  for it.
- Migrating email history or open rates.

## Acceptance evidence

- `POST /api/subscribe` under `wrangler pages dev`: a valid address returns
  200 and the contact appears in the Resend test audience with its
  properties; an invalid address returns 400; a second signup with the same
  address does not duplicate the contact and does not wipe its properties.
- Import dry run on the fixture prints "3 read, 2 subscribed, 0 written".
  With `--send` against a test audience: 2 contacts, and a rerun writes 0.
- `email/build.mjs` on `markdown/mevar/ce-qui-arrive-le-jour-du-seigneur.md`
  produces HTML and text; sizes reported; screenshot of the test email on a
  phone width attached to the PR.
- `node --test` for the copied email-tools passes.
- `DEPLOY.md` gains the email section: the Resend account, domain and DNS
  records, the Pages env vars (`RESEND_API_KEY`, `RESEND_SEGMENT_ID`), and
  the cutover order below.

## Cutover order (added to goal 05's checklist, executed by Samuel)

1. Resend account, domain verified, env vars set on the Pages project.
2. New site live with the working form. Ghost signup switched off the same
   day so no member lands in the old list.
3. Export the members CSV, run the import, compare counts with Ghost.
4. First broadcast from Resend: the newest publication, with one sentence
   saying the letter has a new sender so readers can whitelist it.
5. Only then does the 30 day countdown to cancelling Ghost start.

## Stop points

Creating the Resend account, DNS records, API keys and env vars, the real
member export and import, and every real broadcast: Samuel.
