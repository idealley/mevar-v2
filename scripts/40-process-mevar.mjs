#!/usr/bin/env node
// Take .firecrawl/mevar-crawl-v2.json (firecrawl crawl output) and write each page
// as markdown/mevar/<url-path>.md with YAML frontmatter:
//   ---
//   url: <full source URL>
//   title: <H1 from page>
//   year: <YYYY if extractable from URL or content>
//   slug: <url path without leading/trailing slash>
//   ---
//
// Also writes manifests/mevar.json with one entry per page.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const crawl = JSON.parse(
  fs.readFileSync(path.join(root, ".firecrawl/mevar-crawl-v2.json"), "utf8"),
);

function slugify(p) {
  // p is the URL pathname; convert to a safe local slug
  return p.replace(/^\//, "").replace(/\/$/, "").replace(/[\/]/g, "__") || "index";
}

function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

const seen = new Map(); // canonical pathname -> entry
const manifest = [];

for (const page of crawl.data ?? []) {
  const url = page.metadata?.url ?? page.metadata?.sourceURL;
  if (!url) continue;
  const u = new URL(url);
  if (u.host !== "mevar.org" && u.host !== "www.mevar.org") continue;

  // Drop hash fragments and pagination duplicates — keep canonical only
  const pathname = u.pathname.replace(/\/$/, "") || "/";
  if (pathname.includes("#")) continue;
  if (seen.has(pathname)) continue;

  const md = page.markdown ?? "";
  if (!md.trim()) continue;

  const slug = slugify(pathname);
  const title = extractTitle(md) ?? slug;

  // Year detection: explicit /YYYY/ in path, or 4-digit year in title
  let year = null;
  const yMatch = pathname.match(/\/(\d{4})\/?$/) ?? pathname.match(/^\/(\d{4})$/);
  if (yMatch) year = Number(yMatch[1]);
  if (!year) {
    const yt = title.match(/\b(19|20)\d{2}\b/);
    if (yt) year = Number(yt[0]);
  }

  const entry = {
    source: "mevar",
    sermon_id: slug,
    title,
    year,
    date: null,
    pdf_url: null,
    audio_url: null,
    stream_url: url,
    pathname,
  };
  seen.set(pathname, entry);
  manifest.push(entry);

  const outPath = path.join(root, "markdown", "mevar", `${slug}.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const frontmatter = [
    "---",
    `url: ${url}`,
    `title: ${JSON.stringify(title)}`,
    year ? `year: ${year}` : null,
    `slug: ${slug}`,
    `pathname: ${pathname}`,
    "---",
    "",
  ].filter(Boolean).join("\n");

  fs.writeFileSync(outPath, frontmatter + md + "\n");
}

manifest.sort((a, b) => a.pathname.localeCompare(b.pathname));
fs.writeFileSync(path.join(root, "manifests/mevar.json"), JSON.stringify(manifest, null, 2));

console.log(`wrote ${manifest.length} mevar pages`);
console.log(`  with year: ${manifest.filter((e) => e.year).length}`);
