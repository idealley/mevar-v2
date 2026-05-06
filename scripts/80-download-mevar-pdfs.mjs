#!/usr/bin/env node
// Extract all mevar.org/content/files/*.pdf URLs from markdown/mevar/, download them
// to pdfs/mevar-cdn/, and hash for cross-source dedup.
//
// Output: manifests/mevar-pdfs.json
//   [{ post_slug, pdf_url, local_path, sha1, size, status }]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown/mevar");
const outRoot = path.join(root, "pdfs/mevar-cdn");
fs.mkdirSync(outRoot, { recursive: true });

const RE = /https:\/\/mevar\.org\/content\/files\/[^)\"' \n]+\.pdf/g;

// Collect all URLs and their source posts
const entries = [];
for (const f of fs.readdirSync(mdRoot)) {
  if (!f.endsWith(".md")) continue;
  const text = fs.readFileSync(path.join(mdRoot, f), "utf8");
  const matches = [...new Set(text.match(RE) ?? [])];
  for (const url of matches) {
    entries.push({ post_slug: f.replace(/\.md$/, ""), pdf_url: url });
  }
}

// Dedupe by URL — same PDF can appear in multiple posts, but we only download once
const seenUrls = new Set();
const toDownload = entries.filter((e) => {
  if (seenUrls.has(e.pdf_url)) return false;
  seenUrls.add(e.pdf_url);
  return true;
});
console.log(`unique mevar PDF URLs: ${toDownload.length}`);

const CONCURRENCY = 8;
let done = 0, ok = 0, skipped = 0, failed = 0;
async function downloadOne(entry) {
  const filename = decodeURIComponent(entry.pdf_url.split("/").pop());
  const localPath = path.join(outRoot, filename);
  entry.local_path = path.relative(root, localPath);

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    const buf = fs.readFileSync(localPath);
    entry.sha1 = crypto.createHash("sha1").update(buf).digest("hex");
    entry.size = buf.length;
    entry.status = "cached";
    skipped++;
    return;
  }

  try {
    const res = await fetch(entry.pdf_url);
    if (!res.ok) {
      entry.status = `HTTP ${res.status}`;
      failed++;
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    entry.sha1 = crypto.createHash("sha1").update(buf).digest("hex");
    entry.size = buf.length;
    entry.status = "ok";
    ok++;
  } catch (e) {
    entry.status = `error: ${e.message}`;
    failed++;
  }
}

const queue = [...toDownload];
async function worker() {
  while (queue.length) {
    const e = queue.shift();
    if (!e) return;
    await downloadOne(e);
    done++;
    if (done % 20 === 0) {
      console.log(`[${done}/${toDownload.length}] ok=${ok} cached=${skipped} fail=${failed}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// Re-attach all post mappings (one PDF may map to multiple posts)
const byUrl = new Map(toDownload.map((e) => [e.pdf_url, e]));
const finalManifest = entries.map((e) => ({
  post_slug: e.post_slug,
  pdf_url: e.pdf_url,
  ...byUrl.get(e.pdf_url),
}));
fs.writeFileSync(path.join(root, "manifests/mevar-pdfs.json"), JSON.stringify(finalManifest, null, 2));

console.log(`\ndone: ok=${ok} cached=${skipped} fail=${failed}`);
console.log(`unique pdfs on disk: ${[...new Set(finalManifest.map((e) => e.local_path))].length}`);
console.log(`total size: ${(finalManifest.reduce((s, e) => s + (e.size ?? 0), 0) / 1e6).toFixed(1)} MB`);
