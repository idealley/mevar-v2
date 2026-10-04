#!/usr/bin/env node
// Goal 24: the Branham, Le Scribe and CMPP PDFs served from our domain.
//
// Their pages linked each PDF on another site (branham.org's CDN,
// le-scribe.org, cmpp.ch), which can move or delete it. For every work of
// those sources with a `pdf_url`, this script takes its PDF (the local copy
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
// Usage: node scripts/91-r2-pdfs.mjs [--dry]. Needs the `cf` CLI logged in
// to the account that holds the bucket.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { frontmatter, field, setField } from "./frontmatter.mjs";

const exec = promisify(execFile);
// a call the API rate-limits (429) is tried again, a little later each time
async function run(cmd, args, opts) {
  for (let wait = 2000; ; wait *= 2) {
    try { return await exec(cmd, args, opts); }
    catch (e) { if (!/429/.test(e.message) || wait > 64000) throw e; await new Promise((r) => setTimeout(r, wait)); }
  }
}
const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const BUCKET = "mevar-files";
const DOMAIN = "https://files.mevar.org";
const SOURCES = ["branham", "le-scribe", "cmpp"];

const isPdf = (file) => { try { const h = Buffer.alloc(5); const fd = fs.openSync(file, "r"); fs.readSync(fd, h, 0, 5, 0); fs.closeSync(fd); return h.toString() === "%PDF-"; } catch { return false; } };
const md5 = (file) => crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");

// what the bucket holds under a prefix: key → etag
// (the listing's promise is kept, so the workers share one call per prefix)
const held = new Map();
function list(prefix) {
  if (!held.has(prefix)) held.set(prefix, listed(prefix));
  return held.get(prefix);
}
async function listed(prefix) {
  const { stdout } = await run("cf", ["r2", "objects", "list", "--bucket-name", BUCKET, "--prefix", prefix, "--per-page", "1000"], { maxBuffer: 1 << 26 });
  const objects = JSON.parse(stdout);
  if (objects.length >= 1000) throw new Error(`${prefix}: 1000 objects or more, past one page`);
  return new Map(objects.map((o) => [o.key, o.etag]));
}

// CMPP's PDF, downloaded once; refused unless it is a PDF
async function download(url, file) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`${url}: HTTP ${res.status}, not a PDF`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

const works = [];
for (const source of SOURCES)
  for (const rel of fs.readdirSync(path.join(root, "markdown", source), { recursive: true }).sort()) {
    if (!rel.endsWith(".md")) continue;
    const md = path.join("markdown", source, rel);
    const text = fs.readFileSync(path.join(root, md), "utf8");
    const url = field(frontmatter(text), "pdf_url");
    if (url) works.push({ source, rel: rel.replace(/\.md$/, ""), md, text, url });
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
      try { await download(w.url, file); } catch (e) { missing.push(`${w.md} (${e.message})`); continue; }
    }
    const key = `${w.source}/${w.rel}.pdf`;
    const objects = await list(`${path.posix.dirname(key)}/`);
    if (objects.get(key) !== md5(file)) {
      uploaded++;
      if (!dry) await run("cf", ["r2", "objects", "put", key, "--bucket-name", BUCKET, "--file", file, "--content-type", "application/pdf", "-q"], { maxBuffer: 1 << 24 });
    }
    // each part of the path percent-encoded: Le Scribe's names hold « & »
    // (18) and a literal « %20 » (two)
    const text = setField(w.text, "local_pdf", `${DOMAIN}/${key.split("/").map(encodeURIComponent).join("/")}`);
    if (text !== w.text) { frontmatters++; if (!dry) fs.writeFileSync(path.join(root, w.md), text); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`${works.length} works with a pdf_url; ${downloaded} downloaded, ${uploaded} uploaded, ${frontmatters} frontmatters${dry ? " (dry)" : ""}`);
// every work must have its PDF: one missing fails the run
if (missing.length) { console.error(`no PDF for ${missing.length}: ${missing.slice(0, 10).join(", ")}`); process.exit(1); }
