#!/usr/bin/env node
// Build manifests/cmpp.json from cmpp.ch itself: a plain fetch of its pages.
// The site is static HTML. The crawl starts at the home page and at the
// sitemap robots.txt declares, follows every .htm / .html link of the site
// and keeps every link to a PDF.
//
// An entry the manifest already has is left as it is (73 and 76 have filled
// it since), also when its PDF is no longer linked on the site: the work
// exists. A PDF the manifest does not have is added, with what its file name
// says. The run prints both lists. A second run changes nothing.
//
// PDFs are heterogeneous: monthly letters (mars1974.pdf), videos (video_07_2003.pdf),
// thematic series (7sceaux3.pdf), exhortations (exhortation_annee_2025_A4.pdf), etc.
// Sniff dates where the filename embeds a month name or YYYY. A month with
// no day is written as a month: "1974-03".
//
//   node scripts/12-discover-cmpp.mjs      (on the Mac: no TLS, plain http)

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "manifests", "cmpp.json");

// ─── The crawl ──────────────────────────────────────────────────────────────
const SITE = "http://www.cmpp.ch";
const queue = [`${SITE}/`, `${SITE}/sitemap.xml`];
const pages = new Set();
const urls = new Set(); // every PDF linked, as the manifest writes it: http://cmpp.ch/<path>
const dead = [];

async function crawl() {
  for (let page; (page = queue.shift()); ) {
    if (pages.has(page)) continue;
    pages.add(page);
    const res = await fetch(page);
    // A link of the site to a page it no longer has is the site's; anything else stops the run.
    if (res.status === 404) { dead.push(page); continue; }
    if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
    const text = await res.text();
    const refs = page.endsWith(".xml") ? text.matchAll(/<loc>([^<]+)<\/loc>/g) : text.matchAll(/href\s*=\s*["']?([^"'\s>]+)/gi);
    for (const [, ref] of refs) {
      if (!URL.canParse(ref, page)) continue;
      const u = new URL(ref, page);
      if (!/^https?:$/.test(u.protocol) || !/^(www\.)?cmpp\.ch$/.test(u.hostname)) continue;
      if (/\.pdf$/i.test(u.pathname)) urls.add(`http://cmpp.ch${u.pathname}`);
      else if (/(\.html?|\/)$/i.test(u.pathname)) queue.push(`${SITE}${u.pathname}`);
    }
  }
}
// Four at a time. A worker that finds the queue empty while another still reads a page is not missed: the loop runs until a pass adds nothing.
while (queue.length) await Promise.all(Array.from({ length: 4 }, crawl));

const manifest = JSON.parse(fs.readFileSync(out, "utf8"));
const known = new Set(manifest.map((e) => e.pdf_url));

const months = {
  janvier: "01", fevrier: "02", février: "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", aout: "08", août: "08",
  septembre: "09", octobre: "10", novembre: "11", decembre: "12", décembre: "12",
};

const entries = [];
for (const canonical of urls) {
  if (known.has(canonical)) continue;

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
      date = `${year}-${mon}`;
    }
  }
  // Pattern: video_MM_YYYY
  const m2 = !date && stem.match(/^video_(\d{2})_(\d{4})/i);
  if (m2) {
    year = Number(m2[2]);
    date = `${year}-${m2[1]}`;
  }
  // Pattern: lc_<month>_YYYY
  const m3 = !date && stem.toLowerCase().match(/^lc_(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)_(\d{4})/);
  if (m3) {
    const mon = months[m3[1]] ?? null;
    if (mon) {
      year = Number(m3[2]);
      date = `${year}-${mon}`;
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
const gone = manifest.filter((e) => !urls.has(e.pdf_url));
if (entries.length) fs.writeFileSync(out, JSON.stringify([...manifest, ...entries], null, 2));

console.log(`cmpp.ch: ${pages.size} pages read, ${urls.size} PDFs linked`);
if (dead.length) console.log(`  links of the site to a page it does not have: ${dead.join(", ")}`);
console.log(`manifest: ${manifest.length} entries, ${entries.length} added, ${gone.length} no longer linked on the site (kept)`);
if (entries.length) console.log(`  added: ${entries.map((e) => e.sermon_id).join(" ")}`);
if (gone.length) console.log(`  no longer linked: ${gone.map((e) => e.sermon_id).join(" ")}`);
