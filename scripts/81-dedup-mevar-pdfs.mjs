#!/usr/bin/env node
// Three-tier dedup of mevar PDFs against onedrive content:
//   1. Exact sha1 hash match (definite duplicate)
//   2. Filename basename match against onedrive sermon_id (likely duplicate)
//   3. Content fingerprint match against onedrive markdown (probable duplicate)
//
// Outputs a triage manifest: definite/likely/probable/unique buckets.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const mevarPdfs = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar-pdfs.json"), "utf8"))
  .filter((e) => e.sha1);  // skip failed downloads
const onedriveInv = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const onedriveManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));

// Hash → onedrive entry (for tier 1)
const onedriveByHash = new Map();
for (const e of onedriveInv) {
  if (e.hash) onedriveByHash.set(e.hash, e);
}

// Sermon_id (lowercased, normalized) → onedrive entry (for tier 2)
const onedriveByNorm = new Map();
for (const e of onedriveManifest) {
  const norm = e.sermon_id.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  onedriveByNorm.set(norm, e);
}

// Onedrive content fingerprints (for tier 3)
function fingerprintBody(md) {
  let text = md.replace(/^---[\s\S]*?\n---\n/, "");
  text = text.toLowerCase().replace(/[^a-zà-ÿ ]+/g, " ");
  return new Set(text.split(/\s+/).filter((w) => w.length >= 4).slice(0, 200));
}
function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

console.log("loading onedrive fingerprints...");
const onedriveFps = [];
for (const e of onedriveManifest) {
  const mdPath = path.join(root, e.local_md);
  if (!fs.existsSync(mdPath)) continue;
  onedriveFps.push({ entry: e, fp: fingerprintBody(fs.readFileSync(mdPath, "utf8")) });
}
console.log(`  ${onedriveFps.length} onedrive fingerprints loaded`);

// Dedupe mevar PDFs by URL — same PDF may appear in multiple posts; only classify once
const seenUrl = new Set();
const uniquePdfs = mevarPdfs.filter((e) => {
  if (seenUrl.has(e.pdf_url)) return false;
  seenUrl.add(e.pdf_url);
  return true;
});

const buckets = { definite: [], likely: [], probable: [], unique: [] };

for (const pdf of uniquePdfs) {
  const filename = path.basename(pdf.local_path).replace(/\.pdf$/i, "");
  const norm = filename.toLowerCase().replace(/[\s\-]+/g, "_");

  // Tier 1: exact hash
  const hashHit = onedriveByHash.get(pdf.sha1);
  if (hashHit) {
    buckets.definite.push({ ...pdf, match_type: "hash", onedrive_id: hashHit.canonical_path });
    continue;
  }

  // Tier 2: filename match
  const nameHit = onedriveByNorm.get(norm);
  if (nameHit) {
    buckets.likely.push({ ...pdf, match_type: "filename", onedrive_id: nameHit.sermon_id });
    continue;
  }

  // Tier 3: read PDF as bytes is no good — we need its TEXT content.
  // For now, defer to LLM-cleaning step. Just mark as "unique" if no quick match.
  buckets.unique.push(pdf);
}

// Write triage manifest
fs.writeFileSync(
  path.join(root, "manifests/mevar-pdfs-triage.json"),
  JSON.stringify({
    summary: {
      total: uniquePdfs.length,
      definite_duplicate: buckets.definite.length,
      likely_duplicate: buckets.likely.length,
      probable_duplicate: buckets.probable.length,
      need_processing: buckets.unique.length,
    },
    buckets,
  }, null, 2),
);

console.log(`\n=== triage ===`);
console.log(`  total mevar PDFs:         ${uniquePdfs.length}`);
console.log(`  definite (hash match):    ${buckets.definite.length}`);
console.log(`  likely (filename match):  ${buckets.likely.length}`);
console.log(`  need processing:          ${buckets.unique.length}`);
