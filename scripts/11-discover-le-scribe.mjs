#!/usr/bin/env node
// Build manifests/le-scribe.json from le-scribe map + per-year scrapes.
// Filename pattern: YYMMDD<Slug>.pdf (e.g. 550123Approche.pdf)
// Plus a few non-dated PDFs (wmbch20.pdf = biography chapter)

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "manifests", "le-scribe.json");

function readLinks(p) {
  if (!fs.existsSync(p)) return [];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.links ?? j.data?.links?.map((l) => l.url ?? l) ?? [];
}

const urls = new Set();
for (const u of readLinks(path.join(root, ".firecrawl/le-scribe-map.json"))) {
  if (typeof u === "string") urls.add(u);
}
const yearsDir = path.join(root, ".firecrawl/le-scribe-years");
if (fs.existsSync(yearsDir)) {
  for (const f of fs.readdirSync(yearsDir)) {
    for (const u of readLinks(path.join(yearsDir, f))) urls.add(u);
  }
}

const pdfs = [...urls]
  // Normalize www host to canonical
  .map((u) => u.replace(/^http:\/\/www\.le-scribe\.org/, "http://le-scribe.org"))
  .filter((u) => /\.pdf$/i.test(u));

const seen = new Set();
const entries = [];
for (const url of pdfs) {
  if (seen.has(url)) continue;
  seen.add(url);

  const filename = path.basename(url);
  const stem = filename.replace(/\.pdf$/i, "");

  // YYMMDD<Slug> -> date + slug
  const m = stem.match(/^(\d{2})(\d{2})(\d{2})(.*)$/);
  let date = null;
  let slug = stem;
  let year = null;
  if (m) {
    const [, yy, mm, dd, rest] = m;
    year = Number(yy) >= 47 && Number(yy) <= 65 ? 1900 + Number(yy) : null;
    if (year) {
      date = `${year}-${mm}-${dd}`;
      slug = rest;
    }
  }

  entries.push({
    source: "le-scribe",
    sermon_id: stem,
    year,
    date,
    title: slug,
    pdf_url: url,
    stream_url: null,
  });
}

entries.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(entries, null, 2));

const dated = entries.filter((e) => e.date).length;
console.log(`wrote ${out}: ${entries.length} PDFs, ${dated} with dates`);
