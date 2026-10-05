#!/usr/bin/env node
// Checks web/dist/ after a full build: nothing that works on Ghost today
// breaks (goal 03). Runs every section, exits 1 if one failed.
//
//   node scripts/check-dist.mjs

import fs from "node:fs";
import path from "node:path";
import { slug } from "github-slugger";

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
  const index = path.join(f, "index.html");
  if (p.endsWith("/")) return fs.existsSync(index) ? index : null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  return fs.existsSync(index) ? index : null;
}

// 1. Ghost posts at their root URL; drafts nowhere.
// A post's status is its frontmatter's, as the site builds it: Samuel
// publishes a draft in markdown/, and mevar.json keeps what the Ghost import
// said.
const posts = read("mevar.json").filter((p) => p.type === "post");
for (const p of posts) {
  const text = fs.readFileSync(path.join(web, "../markdown/mevar", `${p.sermon_id}.md`), "utf8");
  const frontmatter = text.slice(0, text.indexOf("\n---\n", 4));
  p.status = frontmatter.match(/^status: "(.+)"$/m)?.[1];
  p.duplicate = /^duplicate_of: /m.test(frontmatter);
}
// A published post with duplicate_of is not built: its URL answers 301 to the
// post it duplicates (section 2 checks where the 301 lands).
const published = posts.filter((p) => p.status === "published" && !p.duplicate);
const drafts = posts.filter((p) => p.status === "draft");
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
// Goal 19: every Mevar text moved beside the Ghost posts is at its root URL
// (a draft, bilanchaine, is never built).
const moved = fs.readdirSync(path.join(web, "../markdown/mevar"))
  .map((f) => [f, fs.readFileSync(path.join(web, "../markdown/mevar", f), "utf8")])
  .filter(([, text]) => /^source_path: /m.test(text) && !/^status: "draft"$/m.test(text));
report(
  `every moved Mevar text at /<slug>/, none at its old /works/ URL: ${moved.length} texts`,
  moved.flatMap(([f, text]) => {
    const old = `/works/${text.match(/^source_path: "(.+)\.md"$/m)[1].split("/").map((s) => slug(s)).join("/")}/`;
    return [...(served(`/${f.slice(0, -3)}/`) ? [] : [`/${f.slice(0, -3)}/ missing`]), ...(served(old) ? [`${old} still built`] : [])];
  }),
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
    // Another scheme or host: not a file here. Our own absolute URL is, when
    // it names a fragment.
    if (/^([a-z][a-z0-9+.-]*:|\/\/|$)/i.test(href) && !(href.startsWith("https://mevar.org/") && href.includes("#"))) continue;
    // A relative href resolves against the page's own URL, as a browser does.
    const url = new URL(href, `https://mevar.org/${path.relative(dist, path.dirname(page))}/`);
    const fragment = decodeURIComponent(url.hash.slice(1));
    let target = page;
    if (!href.startsWith("#")) {
      hrefs++;
      const p = url.pathname;
      if (!known.has(p)) known.set(p, served(p));
      target = known.get(p);
      if (!target) {
        broken.push(`${path.relative(dist, page)} -> ${href}`);
        continue;
      }
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

// 6. What a search engine reads (goal 28): robots.txt names the sitemap, every
// page's JSON-LD parses, and every Ghost post says it is an article, with its
// title, its date and its author.
const robots = path.join(dist, "robots.txt");
report(
  "robots.txt names the sitemap",
  fs.existsSync(robots) && fs.readFileSync(robots, "utf8").includes("Sitemap: https://mevar.org/sitemap-index.xml") ? [] : ["dist/robots.txt missing, or without its Sitemap line"],
);
// Each page's blocks, parsed; a block that does not parse is reported once.
const unparsed = [];
const badDate = [];
const undescribed = [];
let blocks = 0;
const jsonLd = new Map(pages.map((page) => [page, []]));
for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  if (!/<meta name="description" content="[^"]/.test(html)) undescribed.push(path.relative(dist, page));
  for (const [, block] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    blocks++;
    try {
      const data = JSON.parse(block);
      jsonLd.get(page).push(data);
      // A day, a month or a year: never « 1950-01-?? ».
      if (data["@type"] === "Article" && data.datePublished && !/^\d{4}(-\d{2}){0,2}$/.test(data.datePublished)) badDate.push(`${path.relative(dist, page)}: ${data.datePublished}`);
    } catch {
      unparsed.push(path.relative(dist, page));
    }
  }
}
report("every JSON-LD block parses", unparsed, `${blocks} blocks`);
report("every Article's date is a day, a month or a year", badDate);
report("every page has a description", undescribed);
report(
  "every Ghost post is an Article with its title, date and author",
  published.flatMap((p) => {
    const file = served(`/${p.sermon_id}/`);
    const article = jsonLd.get(file)?.find((d) => d["@type"] === "Article");
    const said = article?.headline && article.datePublished && article.author?.name && fs.readFileSync(file, "utf8").includes('<meta property="og:type" content="article"');
    return said ? [] : [`/${p.sermon_id}/`];
  }),
  `${published.length} posts`,
);

process.exit(failed ? 1 : 0);
