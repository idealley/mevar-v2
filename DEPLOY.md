# Deploy: Cloudflare Pages

mevar.org is a static site. `web/` is built with Astro, Pagefind indexes the
built pages, and `wrangler pages deploy` uploads `web/dist/` to the Cloudflare
Pages project `mevar`. Nothing runs on a server.

Two ways to deploy, same result:

- **GitHub Actions** (`.github/workflows/deploy.yml`): a push to `main` that
  touches `web/`, `markdown/`, `images/` or `files/` builds and deploys
  production. "Run workflow" on another branch deploys a preview at
  `<branch>.mevar.pages.dev`.
- **From the Mac**: `cd web && npm run deploy`. Production from `main`, a
  preview from any other branch (wrangler reads the git branch).

Everything below is done once, by Samuel, in this order. Nothing here is
automated and no agent does it.

## What you need

- The Cloudflare account that holds the `mevar.org` zone (its nameservers are
  `erin` and `terin.ns.cloudflare.com`).
- Admin rights on the GitHub repository `idealley/mevar-v2`.
- On the Mac: Node 22 or later, and this repository cloned with
  `npm ci` run in `web/`.

## 1. Create the Pages project

From the Mac, in `web/`:

```bash
npx wrangler@4 login                  # opens the browser, approve access
npx wrangler@4 pages project create mevar --production-branch=main
```

Or in the dashboard: **Workers & Pages** → **Create**. On the "Make
something new" screen, pick none of the tiles ("Connect GitHub" builds on
Cloudflare, "Upload your static files" makes a Worker): click **Continue
to Pages** under them → **Use direct upload** → Project name `mevar` →
**Create project**. Leave the
upload empty and close the page; the first deploy (step 4) fills it.

Do not connect the project to GitHub in the dashboard ("Connect to Git"):
the build runs in GitHub Actions and uploads with wrangler, as for
firstprinciple.

## 2. Create the API token

Dashboard → your profile icon (top right) → **My Profile** → **API Tokens** →
**Create Token** → **Custom token** → **Get started**.

- Token name: `mevar-v2 GitHub deploy`
- Permissions: **Account** · **Cloudflare Pages** · **Edit** (one line,
  nothing else)
- Account Resources: **Include** · the account that holds `mevar.org`
- Client IP filtering, TTL: leave empty

**Continue to summary** → **Create Token**. Copy the token now; Cloudflare
shows it once.

The account ID is on **Workers & Pages** → **Overview**, right column,
"Account ID" (or `npx wrangler@4 whoami`).

## 3. Add the two GitHub secrets

```bash
gh secret set CLOUDFLARE_API_TOKEN  -R idealley/mevar-v2   # paste the token
gh secret set CLOUDFLARE_ACCOUNT_ID -R idealley/mevar-v2   # paste the account ID
```

Or on GitHub: the repository → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**, once for each name.

## 4. First deploy, a preview, from the Mac

GitHub shows the "Run workflow" button only once the workflow file is on
`main`, so the first preview goes from the Mac, on the branch that brings
this file (`goal-05-search-and-deploy`) or any branch other than `main`:

```bash
git checkout goal-05-search-and-deploy
cd web && npm ci && npm run deploy
```

About five minutes later wrangler prints the preview URL,
`https://goal-05-search-and-deploy.mevar.pages.dev`. Later previews: GitHub
→ **Actions** → **Deploy to Cloudflare Pages** → **Run workflow** → pick
the branch → **Run workflow**; the log ends with the URL.

The build log prints the Cloudflare limit check:

```
files: <n> (limit 20000)
largest: <path>, <size> MiB (limit 25 MiB)
```

The job fails before uploading if either limit is exceeded. Do not remove
content to get under it: tell the agent working on search, the first lever is
Pagefind's settings.

## 5. Production on mevar.pages.dev

Steps 1 to 3 come before merging to `main`: the merge runs the workflow,
which fails without the secrets. Merge to `main`. The push deploys
production at `https://mevar.pages.dev`. mevar.org still points to Ghost;
nothing public changes yet.

## Cutover checklist

In order. Each step is done by Samuel.

1. **The preview is green.** `https://mevar.pages.dev` opens, a sermon page
   opens, `/recherche/` finds a phrase, `/rss/` lists the newest posts.
   Goal 03's link check (`npm run check:dist`: every Ghost post at its old
   URL, every redirect target, every internal link) runs on the exact
   `dist/` each deploy uploads, and the deploy stops if it fails: a green
   deploy has passed it.
2. **Final Ghost content is in.** Export from Ghost (**Settings** →
   **Advanced** → **Import/Export** → **Export**), import it with the
   additive script from goal 02, download the assets (goal 01), commit,
   push to `main`, wait for the deploy.
3. **Before touching DNS, write down what is there now**, for the rollback.
   On 2026-09-23 it was:

   | Type | Name | Content | Proxy |
   | ---- | ---- | ------- | ----- |
   | A | `mevar.org` | `164.132.163.115` | DNS only |
   | A | `mevar.org` | `217.182.136.94` | DNS only |
   | CNAME | `www` | `mevar.digitalpress.blog` | DNS only |

   Check in the dashboard (**mevar.org** zone → **DNS** → **Records**) that
   this is still true, and take a screenshot. Leave the **MX** and **TXT**
   records alone: they carry the mevar.org email (Cloudflare Email Routing)
   and have nothing to do with the site.

   Also check that the Ghost admin opens at
   `https://mevar.digitalpress.blog/ghost/`: after the switch,
   `mevar.org/ghost/` no longer reaches Ghost, and Ghost still sends the
   newsletter until goal 06 is live.
4. **Switch.** In the **mevar.org** zone → **DNS** → **Records**, delete the
   two `A` records for `mevar.org` and the `www` CNAME. Then **Workers &
   Pages** → `mevar` → **Custom domains** → **Set up a custom domain** →
   `mevar.org` → **Continue** → **Activate domain**. Repeat for
   `www.mevar.org`. Cloudflare creates the records itself because the zone
   is in the same account. Status turns **Active** within minutes; the
   certificate can take up to 15.
5. **Spot check**, in a private window:
   - ten old URLs from a Google search `site:mevar.org`;
   - the links in the two most recent newsletter emails;
   - `https://mevar.org/rss/` (the feed readers subscribe to);
   - one PDF link.
   Every one opens the right page, not a 404 and not the home page.
6. **Ghost stays up, unlinked, for 30 days**, then is cancelled. Do not start
   the 30 days before goal 06's cutover is complete (signup form live,
   members imported, first newsletter sent from Resend): until then Ghost is
   the only thing that sends the newsletter.

## Rollback

**A bad deploy** (the site is up but a page is wrong): **Workers & Pages** →
`mevar` → **Deployments** → the last good production deployment → **⋯** →
**Rollback to this deployment**. Takes effect in seconds. Then fix and push.

**Back to Ghost** (the new site cannot serve mevar.org):

1. **Workers & Pages** → `mevar` → **Custom domains** → remove `mevar.org`
   and `www.mevar.org`.
2. **mevar.org** zone → **DNS** → **Records**: delete any record left for
   `mevar.org` or `www` that points to `mevar.pages.dev`, then recreate the
   three records from step 3 of the checklist, **DNS only** (grey cloud).
3. Wait a few minutes and open `https://mevar.org` in a private window: the
   Ghost site is back. Ghost itself was never changed, so nothing else needs
   restoring.

This works as long as Ghost is not cancelled, which is why step 6 waits 30
days.

## Email: the "Publications" newsletter on Resend

Goal 06. The newsletter leaves Ghost for MEVAR's own Resend account (not the
firstprinciple one). One list, "Publications": an email when a new work is
published, sent by hand. Everything in this section is done by Samuel; the
agent built the code and stops here.

What the code expects:

| Where | Name | Value |
| ----- | ---- | ----- |
| Pages project `mevar`, and the root `.env` | `RESEND_API_KEY` | a **Full access** key (a "Sending access" key answers 401 on contacts) |
| Pages project `mevar`, and the root `.env` | `RESEND_SEGMENT_ID` | the id of the segment readers join |
| `email/email-tools.config.mjs` | `from` | `MEVAR <publications@updates.mevar.org>` |
| `email/email-tools.config.mjs` | `replyTo` | `contact@mevar.org` (Cloudflare Email Routing: check it forwards to a mailbox you read) |

### 1. Account and plan

Before the first broadcast, compare the member count from Ghost (**Members**,
filter "Subscribed") with the plan: the free plan sends 100 emails a day and
3,000 a month. Over 100 members, one broadcast needs the paid plan.

### 2. Sending domain `updates.mevar.org`

Resend → **Domains** → `updates.mevar.org` lists its DNS records (MX and SPF
TXT on `send.updates`, DKIM TXT on `resend._domainkey.updates`). On
2026-09-24 the domain showed **partially failed**: open it, see which line is
not green, and add or fix that record in Cloudflare → **mevar.org** zone →
**DNS** → **Records**, **DNS only** (grey cloud). Then **Verify DNS Records**.
Leave the `mevar.org` MX and TXT records alone: they carry mevar.org's own
mail.

Same page → **Configuration**: turn **Open tracking** and **Click tracking**
off. Readers are not tracked beyond what Resend needs to deliver.

### 3. Contact properties

Resend silently drops a property that is not defined. These three exist
(created 2026-09-24, type Text; a key cannot be renamed later). Check under
**Audience** → **Properties**:

| Key | Written by |
| --- | ---------- |
| `origin` | `newsletter-footer`, `newsletter-page` (the site) or `ghost-import` |
| `source` | `site` or `ghost` |
| `consented_at` | ISO date of the signup, or the Ghost member's `created_at` |

### 4. Segment, key, env vars

1. **Audience** → **Segments**: use `General` or create `Publications`; copy
   its id.
2. **API Keys** → **Create API Key**, name `mevar pages`, permission **Full
   access**, domain `updates.mevar.org`. Copy it; Resend shows it once.
3. Cloudflare → **Workers & Pages** → `mevar` → **Settings** → **Variables
   and Secrets** → **Add**: `RESEND_API_KEY` (type **Secret**) and
   `RESEND_SEGMENT_ID` (type **Text**), for Production and for Preview.
   Redeploy (a variable reaches the function only with the next deploy).
4. The same two lines in the root `.env` on the Mac, for the import and the
   sends.

The deploy runs wrangler from `web/` (workflow and `npm run deploy`), so
`web/functions/` ships with the site and `/api/subscribe` answers. Run from
anywhere else, `functions/` is left behind and `/api/*` answers 405.

### 5. Check the form before the cutover

On the Mac, with the two variables in `web/.dev.vars` (gitignored, same
`NAME=value` lines as `.env`):

```bash
cd web && CONTENT_SOURCES=mevar npx astro build
npx wrangler@4 pages dev dist --compatibility-date=2026-06-24
```

(`astro dev` does not run Pages Functions; the date is the newest the local
runtime knows.) Open `http://localhost:8788/newsletter/`, sign up with your
own address: "Merci, votre inscription est enregistrée." and the contact is
in the segment with `origin`, `source`, `consented_at`. Sign up again with
the same address: still one contact, same properties. An invalid address
shows "Cette adresse e-mail ne semble pas valide." Then delete the test
contact in Resend.

### 6. Import the Ghost members

Ghost Admin → **Members** → **⋯** → **Export all members**. Keep the CSV
outside the repository (it is readers' personal data) and pass its path:

```bash
node scripts/150-import-ghost-members.mjs ~/Downloads/<export>.csv          # dry run, counts only
node --env-file=.env scripts/150-import-ghost-members.mjs ~/Downloads/<export>.csv --send
```

It keeps members with `subscribed_to_emails` true, prints counts, never an
address, and leaves alone a contact already in Resend, so a rerun writes 0
and a reader who unsubscribed stays unsubscribed. At 2 requests a second,
count about a second per member. Compare "subscribed" with Ghost's count,
then delete the CSV.

### 7. Sending a publication

```bash
npm run email:build -- markdown/mevar/<slug>.md       # email/dist/<slug>.html, .txt, sizes
npm run email:test -- email/dist/<slug>.html --to <you>
npm run email:send                                    # wizard: time, then type "send"
git add email/receipts/<slug>.json && git commit -m "data(email): <slug> sent"
```

The broadcast is always scheduled (never "send now") to `RESEND_SEGMENT_ID`;
"dry" instead creates it unscheduled, to review or test from the Resend
dashboard. The wizard stops if `email/receipts/<slug>.json` exists or Resend already has
a broadcast named `Publications <slug>`: a work is never announced twice.
Default time: tomorrow 07:00 Abidjan time. A draft is never built.

### Cutover order

Added to the cutover checklist above; its step 6 waits for this.

1. Resend account, domain verified, env vars set on the Pages project.
2. New site live with the working form. Ghost signup switched off the same
   day (Ghost Admin → **Settings** → **Membership** → **Subscription
   access**: **Nobody**) so no member lands in the old list.
3. Export the members CSV, run the import, compare counts with Ghost.
4. First broadcast from Resend: the newest publication, with one sentence
   saying the letter has a new sender so readers can whitelist it:
   `npm run email:build -- markdown/mevar/<slug>.md --note "…"`.
5. Only then does the 30 day countdown to cancelling Ghost start.
