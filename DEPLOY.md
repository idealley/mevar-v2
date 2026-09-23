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

Or in the dashboard: **Workers & Pages** → **Create** → **Pages** tab →
**Use direct upload** → Project name `mevar` → **Create project**. Leave the
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
production at `https://mevar.pages.dev`. mevar.org still points to Ghost; nothing public changes yet.

## Cutover checklist

In order. Each step is done by Samuel.

1. **The preview is green.** `https://mevar.pages.dev` opens, a sermon page
   opens, `/recherche/` finds a phrase. Run the link check from goal 03
   against the live URL and get zero broken links.
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
   - `https://mevar.org/rss/`;
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
