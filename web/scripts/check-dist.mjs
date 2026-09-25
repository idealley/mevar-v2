#!/usr/bin/env node
// Checks web/dist/ after a full build: nothing that works on Ghost today
// breaks (goal 03). Runs every section, exits 1 if one failed.
//
//   node scripts/check-dist.mjs

import fs from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const dist = path.join(web, "dist");
const manifests = path.join(web, "../manifests");
const read = (f) => JSON.parse(fs.readFileSync(path.join(manifests, f), "utf8"));

let failed = 0;
function report(name, problems, detail = "") {
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${detail ? `: ${detail}` : ""}`);
  for (const p of problems.slice(0, 30)) console.log(`       ${p}`);
  if (problems.length > 30) console.log(`       … and ${problems.length - 30} more`);
  if (problems.length) failed++;
}

/** The file a root-relative URL path is served from, or null. */
function served(p) {
  const f = path.join(dist, decodeURIComponent(p));
  if (p.endsWith("/")) return fs.existsSync(path.join(f, "index.html")) ? f : null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  return fs.existsSync(path.join(f, "index.html")) ? f : null;
}

// 1. Ghost posts at their root URL; drafts nowhere.
// A post's status is its frontmatter's, as the site builds it: Samuel
// publishes a draft in markdown/, and mevar.json keeps what the Ghost import
// said.
const posts = read("mevar.json").filter((p) => p.type === "post");
const status = (p) => fs.readFileSync(path.join(web, "../markdown/mevar", `${p.sermon_id}.md`), "utf8").match(/^status: "(.+)"$/m)?.[1];
const published = posts.filter((p) => status(p) === "published");
const drafts = posts.filter((p) => status(p) === "draft");
report(
  "every published Ghost post at /<slug>/",
  published.filter((p) => !served(`/${p.sermon_id}/`)).map((p) => `/${p.sermon_id}/ missing`),
  `${published.length} posts`,
);
report(
  "no draft built",
  drafts
    .map((p) => `/${p.sermon_id}/`)
    .filter((u) => served(u))
    .map((u) => `${u} exists`),
  `${drafts.length} drafts`,
);
report(
  "no /works/mevar/ page",
  fs.existsSync(path.join(dist, "works/mevar")) ? ["dist/works/mevar/ exists"] : [],
);

// 2. Every redirect lands on a page: goal 03's, and the duplicates' (goal 08)
// that the build appends. ":slug" is each Ghost author.
const authors = read("mevar-authors.json").map((a) => a.slug);
const targets = fs
  .readFileSync(path.join(dist, "_redirects"), "utf8")
  .split("\n")
  .filter((l) => l.startsWith("/"))
  .flatMap((l) => {
    const to = l.split(/\s+/)[1];
    return to.includes(":slug") ? authors.map((a) => to.replace(":slug", a)) : [to];
  });
report(
  "every _redirects target exists",
  targets.filter((t) => !served(t)).map((t) => `${t} missing`),
  `${targets.length} targets`,
);

// 3. Every internal href in every page resolves.
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(dist);
const known = new Map();
const broken = [];
let hrefs = 0;
// A #fragment names an id of the page it points to: the page's own for "#…".
const idsOf = new Map();
const ids = (file) => {
  if (!idsOf.has(file)) idsOf.set(file, new Set([...fs.readFileSync(file, "utf8").matchAll(/\sid="([^"]*)"/g)].map((m) => m[1])));
  return idsOf.get(file);
};
const noAnchor = [];
let fragments = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  for (const [, raw] of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = raw.replaceAll("&amp;", "&");
    // Another scheme or host: not a file here.
    if (/^([a-z][a-z0-9+.-]*:|\/\/|$)/i.test(href)) continue;
    // A relative href resolves against the page's own URL, as a browser does.
    const url = new URL(href, `https://mevar.org/${path.relative(dist, path.dirname(page))}/`);
    const fragment = decodeURIComponent(url.hash.slice(1));
    let target = page;
    if (!href.startsWith("#")) {
      hrefs++;
      const p = url.pathname;
      if (!known.has(p)) known.set(p, served(p) !== null);
      if (!known.get(p)) {
        broken.push(`${path.relative(dist, page)} -> ${href}`);
        continue;
      }
      const f = served(p);
      target = fs.statSync(f).isDirectory() ? path.join(f, "index.html") : f;
    }
    if (!fragment || !target.endsWith(".html")) continue;
    fragments++;
    if (!ids(target).has(fragment)) noAnchor.push(`${path.relative(dist, page)} -> ${href}`);
  }
}
report(
  "every internal href resolves",
  broken,
  `${hrefs} links checked in ${pages.length} pages, ${known.size} distinct targets`,
);
report("every #fragment names an id of its page", noAnchor, `${fragments} fragments checked`);

// 4. The sitemap lists every page once, no draft, no /works/mevar/.
const sitemapIndex = path.join(dist, "sitemap-index.xml");
const locs = fs.existsSync(sitemapIndex)
  ? fs
      .readdirSync(dist)
      .filter((f) => /^sitemap-\d+\.xml$/.test(f))
      .flatMap((f) => [...fs.readFileSync(path.join(dist, f), "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)])
      .map((m) => new URL(m[1]).pathname)
  : [];
const draftUrls = new Set(drafts.map((p) => `/${p.sermon_id}/`));
report(
  "sitemap-index.xml, no draft, no /works/mevar/",
  [
    ...(fs.existsSync(sitemapIndex) ? [] : ["dist/sitemap-index.xml missing"]),
    ...locs.filter((u) => draftUrls.has(u) || u.startsWith("/works/mevar/")).map((u) => `${u} listed`),
  ],
  `${locs.length} URLs`,
);

// 5. RSS at /rss/: the 30 newest published Ghost posts.
const rssFile = path.join(dist, "rss/index.xml");
const rss = fs.existsSync(rssFile) ? fs.readFileSync(rssFile, "utf8") : "";
const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const newest = published
  .toSorted((a, b) => b.published_at.localeCompare(a.published_at) || a.title.localeCompare(b.title))
  .slice(0, 30)
  .map((p) => `https://mevar.org/${p.sermon_id}/`);
const links = items.map((i) => i.match(/<link>([^<]*)<\/link>/)?.[1]);
report(
  "rss/index.xml, the 30 newest posts",
  [
    ...(rss.startsWith("<?xml") && /<rss [^>]*version="2\.0"/.test(rss) && rss.trimEnd().endsWith("</rss>")
      ? []
      : ["dist/rss/index.xml missing or not an RSS 2.0 document"]),
    ...items.filter((i) => !/<title>[^<]+<\/title>/.test(i)).map(() => "an item has no title"),
    ...newest.filter((u) => !links.includes(u)).map((u) => `${u} not in the feed`),
    ...(items.length === 30 ? [] : [`${items.length} items`]),
  ],
  `${items.length} items`,
);

process.exit(failed ? 1 : 0);
