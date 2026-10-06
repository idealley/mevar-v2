#!/usr/bin/env node
// Goal 24: the Branham, Le Scribe and CMPP PDFs served from our domain.
//
// Their pages linked each PDF on another site (branham.org's CDN,
// le-scribe.org, cmpp.ch), which can move or delete it. For every work of
// those sources with a `pdf_url` (a draft left out), this script takes its PDF (the local copy
// in pdfs/<source>/, gitignored, which goals 01–02 downloaded for Branham
// and Le Scribe; one not held, CMPP's for instance, downloaded once from its
// pdf_url), uploads it to the R2
// bucket `mevar-files` as <source>/<path>.pdf when the bucket does not hold
// the same bytes (its etag is the MD5), and names it in the work's
// `local_pdf`: https://files.mevar.org/<source>/<path>.pdf. The pages read
// `local_pdf` before `pdf_url`; the remote `pdf_url` stays.
//
// Idempotent: a second run uploads nothing and changes no frontmatter. It
// deletes nothing, in the bucket or elsewhere.
//
// Usage: node scripts/96-r2-pdfs.mjs [--dry]. Needs the `cf` CLI logged in
// to the account that holds the bucket.

import fs from "node:fs";
import path from "node:path";
import { frontmatter, field, setField } from "./frontmatter.mjs";
import { put, url } from "./r2.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const SOURCES = ["branham", "le-scribe", "cmpp"];

const isPdf = (file) => { try { const h = Buffer.alloc(5); const fd = fs.openSync(file, "r"); fs.readSync(fd, h, 0, 5, 0); fs.closeSync(fd); return h.toString() === "%PDF-"; } catch { return false; } };

// CMPP's PDF, downloaded once; refused unless it is a PDF
async function download(from, file) {
  const res = await fetch(from);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`${from}: HTTP ${res.status}, not a PDF`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

const works = [];
for (const source of SOURCES)
  for (const rel of fs.readdirSync(path.join(root, "markdown", source), { recursive: true }).sort()) {
    if (!rel.endsWith(".md")) continue;
    const md = path.join("markdown", source, rel);
    const text = fs.readFileSync(path.join(root, md), "utf8");
    const fm = frontmatter(text);
    const pdfUrl = field(fm, "pdf_url");
    // a draft is not published, and neither is its PDF (the CMPP's death notice, goal 16)
    if (pdfUrl && field(fm, "status") !== "draft") works.push({ source, rel: rel.replace(/\.md$/, ""), md, text, pdfUrl });
  }

let uploaded = 0, downloaded = 0, frontmatters = 0;
const missing = [];
const queue = [...works];
async function worker() {
  for (let w; (w = queue.shift()); ) {
    const file = path.join(root, "pdfs", w.source, `${w.rel}.pdf`);
    // a PDF not held locally (on the first run, CMPP's 242 and two of Le
    // Scribe's), or a cached file that is not one (an error page an earlier
    // download kept): downloaded again, and refused unless it is a PDF
    if (!isPdf(file)) {
      downloaded++;
      if (dry) continue;
      try { await download(w.pdfUrl, file); } catch (e) { missing.push(`${w.md} (${e.message})`); continue; }
    }
    const key = `${w.source}/${w.rel}.pdf`;
    if (await put(key, file, "application/pdf", dry)) uploaded++;
    const text = setField(w.text, "local_pdf", url(key));
    if (text !== w.text) { frontmatters++; if (!dry) fs.writeFileSync(path.join(root, w.md), text); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`${works.length} works with a pdf_url; ${downloaded} downloaded, ${uploaded} uploaded, ${frontmatters} frontmatters${dry ? " (dry)" : ""}`);
// every work must have its PDF: one missing fails the run
if (missing.length) { console.error(`no PDF for ${missing.length}: ${missing.slice(0, 10).join(", ")}`); process.exit(1); }
