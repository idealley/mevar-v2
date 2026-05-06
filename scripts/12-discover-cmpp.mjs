#!/usr/bin/env node
// Build manifests/cmpp.json from cmpp map + topic-index scrapes.
// PDFs are heterogeneous: monthly letters (mars1974.pdf), videos (video_07_2003.pdf),
// thematic series (7sceaux3.pdf), exhortations (exhortation_annee_2025_A4.pdf), etc.
// Sniff dates where the filename embeds a month name or YYYY.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "manifests", "cmpp.json");

function readLinks(p) {
  if (!fs.existsSync(p)) return [];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.links ?? j.data?.links?.map((l) => l.url ?? l) ?? [];
}

const urls = new Set();
for (const u of readLinks(path.join(root, ".firecrawl/cmpp-map.json"))) {
  if (typeof u === "string") urls.add(u);
}
const pagesDir = path.join(root, ".firecrawl/cmpp-pages");
if (fs.existsSync(pagesDir)) {
  for (const f of fs.readdirSync(pagesDir)) {
    for (const u of readLinks(path.join(pagesDir, f))) urls.add(u);
  }
}

const months = {
  janvier: "01", fevrier: "02", février: "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", aout: "08", août: "08",
  septembre: "09", octobre: "10", novembre: "11", decembre: "12", décembre: "12",
};

const entries = [];
const seenPath = new Map();
for (const u of urls) {
  if (typeof u !== "string" || !/\.pdf$/i.test(u)) continue;
  const canonical = u
    .replace(/^https?:\/\/www\.cmpp\.ch/, "http://cmpp.ch")
    .replace(/^https:\/\/cmpp\.ch/, "http://cmpp.ch");
  if (seenPath.has(canonical)) continue;
  seenPath.set(canonical, true);

  const filename = path.basename(canonical);
  const stem = filename.replace(/\.pdf$/i, "");

  let date = null;
  let year = null;

  // Pattern: monthname + YYYY (e.g. mars1974, octobre1974)
  const m1 = stem.toLowerCase().match(/^(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(\d{4})/);
  if (m1) {
    const mon = months[m1[1]] ?? null;
    if (mon) {
      year = Number(m1[2]);
      date = `${year}-${mon}-01`;
    }
  }
  // Pattern: video_MM_YYYY
  const m2 = !date && stem.match(/^video_(\d{2})_(\d{4})/i);
  if (m2) {
    year = Number(m2[2]);
    date = `${year}-${m2[1]}-01`;
  }
  // Pattern: lc_<month>_YYYY
  const m3 = !date && stem.toLowerCase().match(/^lc_(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)_(\d{4})/);
  if (m3) {
    const mon = months[m3[1]] ?? null;
    if (mon) {
      year = Number(m3[2]);
      date = `${year}-${mon}-01`;
    }
  }
  // Pattern: any 4-digit year (loose fallback for `annee_2020`, `exhortation_annee_2025_A4`)
  if (!year) {
    const m4 = stem.match(/(19|20)\d{2}/);
    if (m4) year = Number(m4[0]);
  }

  entries.push({
    source: "cmpp",
    sermon_id: stem,
    year,
    date,
    title: stem.replace(/_/g, " "),
    pdf_url: canonical,
    stream_url: null,
  });
}

entries.sort((a, b) => {
  const da = a.date ?? (a.year ? `${a.year}-99-99` : "9999");
  const db = b.date ?? (b.year ? `${b.year}-99-99` : "9999");
  if (da !== db) return da.localeCompare(db);
  return a.sermon_id.localeCompare(b.sermon_id);
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(entries, null, 2));

const dated = entries.filter((e) => e.date).length;
const withYear = entries.filter((e) => e.year).length;
console.log(`wrote ${out}: ${entries.length} PDFs, ${dated} with full dates, ${withYear} with year`);
