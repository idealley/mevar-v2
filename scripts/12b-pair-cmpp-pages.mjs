#!/usr/bin/env node
// cmpp.ch publishes its texts as HTML pages too (goal 31): this script finds
// the page of each work of manifests/cmpp.json and records it as `html_url`.
//
// It reads the site as 12 does (the home page, the sitemap, every .htm link
// from there), but once: each page goes to .html-cache/cmpp/<path>
// (gitignored), and a page already there is not fetched again; neither is one
// the site answered 404 for (kept as <path>.404). Three requests at a time, a
// pause before each.
//
// A work's page is:
//   1. the page of its own name, <id>.htm, if the site has it (with an
//      <article>: 43 reads the text there);
//   2. else the page that offers its PDF. A text's page ends on the links to
//      its own PDFs (« Format A4 (pdf) », « Dépliant A4 (pdf) »): the page
//      whose <article> links the work's PDF, when it links the PDFs of one
//      text only (an index page links dozens). The name comes first because
//      the site's own links slip (lc41.htm offers lc40.pdf);
//   3. else the page that offers the PDF of one of its duplicates
//      (quand_dieu_devint_un_homme.htm offers quanddieu.pdf).
// A duplicate (83b's `duplicate_of`) gets none: its keeper takes the page.
// And NOT_ITS_PAGE names the pages that are not the work's text, read by
// hand.
//
// Prints what it found: works with a page, without, by kind, and the text
// pages no work claims. Idempotent.
//
//   node scripts/12b-pair-cmpp-pages.mjs      (on the Mac: plain http)

import fs from "node:fs";
import path from "node:path";
import { field, frontmatter } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");
const SITE = "http://www.cmpp.ch";
export const htmlCache = path.join(root, ".html-cache/cmpp");
const NOT_ITS_PAGE = {
  // questions_et_reponses_bibliques.htm offers its PDF and holds every question and answer (42,000 words): the work is one of them.
  q_r_fevrier_2008_5: "questions_et_reponses_bibliques.htm",
  // The page of this name is headed « Janvier 2007 » and is that month's summary; the PDF is January 2008's.
  video_01_2008: "video_01_2008.htm",
};

/** A page of cmpp.ch by its path ("lc56.htm"), from the cache or fetched into it; null when the site has none. */
export async function page(p) {
  const file = path.join(htmlCache, p);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  if (fs.existsSync(`${file}.404`)) return null;
  await new Promise((r) => setTimeout(r, 250));
  const res = await fetch(`${SITE}/${p}`);
  if (res.status !== 404 && !res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // A link of the site to a page it no longer has is the site's.
  if (res.status === 404) { fs.writeFileSync(`${file}.404`, ""); return null; }
  const text = await res.text();
  fs.writeFileSync(file, text);
  return text;
}

if (import.meta.filename === process.argv[1]) {
  // ─── Every page of the site ───────────────────────────────────────────────
  const queue = ["index.htm", "sitemap.xml"], seen = new Set(), pages = new Map();
  async function crawl() {
    for (let p; (p = queue.shift()); ) {
      if (seen.has(p)) continue;
      seen.add(p);
      const text = await page(p);
      if (text === null) continue;
      if (!p.endsWith(".xml")) pages.set(p, text);
      for (const [, ref] of p.endsWith(".xml") ? text.matchAll(/<loc>([^<]+)<\/loc>/g) : text.matchAll(/href\s*=\s*["']?([^"'\s>]+)/gi)) {
        if (!URL.canParse(ref, `${SITE}/${p}`)) continue;
        const u = new URL(ref, `${SITE}/${p}`);
        if (/^https?:$/.test(u.protocol) && /^(www\.)?cmpp\.ch$/.test(u.hostname) && /\.html?$/i.test(u.pathname)) queue.push(u.pathname.slice(1));
      }
    }
  }
  while (queue.length) await Promise.all(Array.from({ length: 3 }, crawl));

  // ─── Which page offers which PDF ──────────────────────────────────────────
  const offeredBy = new Map(); // "lc56.pdf" → the pages whose article links it
  for (const [p, text] of pages) {
    const article = text.match(/<article[\s\S]*<\/article>/)?.[0] ?? "";
    const offered = new Set([...article.matchAll(/href\s*=\s*["']?([^"'\s>]+\.pdf)/gi)].map(([, ref]) => path.basename(ref)));
    // one text in several layouts, not an index of texts
    if (!offered.size || offered.size > 6) continue;
    for (const pdf of offered) offeredBy.set(pdf, [...(offeredBy.get(pdf) ?? []), p]);
  }

  const manifestPath = path.join(root, "manifests/cmpp.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const kind = (e) => (e.preacher === "William Branham" ? "Branham" : /^(lc\d|lc_|(janvier|mars|juillet|octobre)1974)/.test(e.sermon_id) ? "circular letters" : e.sermon_id.startsWith("video_") ? "monthly summaries" : /^(exhortation_)?annee_/.test(e.sermon_id) ? "yearly exhortations" : "other");
  const counts = {}, without = [], claimed = new Set();
  const fmOf = new Map(manifest.map((e) => [e, frontmatter(fs.readFileSync(path.join(root, e.local_md), "utf8"))]));
  const duplicates = new Map(); // a keeper's path → the ids of its duplicates
  for (const [e, fm] of fmOf) if (field(fm, "duplicate_of")) duplicates.set(field(fm, "duplicate_of"), [...(duplicates.get(field(fm, "duplicate_of")) ?? []), e.sermon_id]);
  const only = (ids) => { const offering = [...new Set(ids.flatMap((i) => offeredBy.get(`${i}.pdf`) ?? []))]; return offering.length === 1 ? offering[0] : null; };
  for (const entry of manifest) {
    const fm = fmOf.get(entry);
    if (field(fm, "duplicate_of")) { delete entry.html_url; continue; }
    const id = entry.sermon_id;
    // a page of the site's layout of today: two older ones (le_reveil_promis, trois_visions) have no <article>
    const found = /<article/.test((await page(`${id}.htm`)) ?? "") ? `${id}.htm` : only([id]) ?? only(duplicates.get(entry.local_md.replace(/^markdown\/|\.md$/g, "")) ?? []);
    const p = found === NOT_ITS_PAGE[id] ? null : found;
    const k = `${kind(entry)}${field(fm, "status") === "draft" ? " (draft)" : ""}`;
    counts[k] ??= { with: 0, without: 0 };
    if (p) { entry.html_url = `${SITE}/${p}`; claimed.add(p); counts[k].with++; } else { delete entry.html_url; counts[k].without++; without.push(id); }
  }
  const out = JSON.stringify(manifest, null, 2);
  if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);

  // A text page: a header, and an article of ten paragraphs or more
  const unclaimed = [...pages].filter(([p, text]) => !claimed.has(p) && /<header/.test(text) && (text.match(/<article[\s\S]*<\/article>/)?.[0].match(/<p[\s>]/g) ?? []).length >= 10).map(([p]) => p).sort();
  console.log(`cmpp.ch: ${pages.size} pages in .html-cache/cmpp/`);
  for (const [k, c] of Object.entries(counts).sort()) console.log(`  ${k}: ${c.with} with a page, ${c.without} without`);
  console.log(`works without a page: ${without.join(" ") || "none"}`);
  console.log(`text pages no work claims: ${unclaimed.length}${unclaimed.length ? `: ${unclaimed.join(" ")}` : ""}`);
}
