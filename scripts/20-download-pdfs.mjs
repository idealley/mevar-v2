#!/usr/bin/env node
// Download PDFs listed in a manifest. Idempotent: skips files that already exist.
//
// Usage: node scripts/20-download-pdfs.mjs manifests/branham-1965.json

import fs from "node:fs";
import path from "node:path";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("usage: 20-download-pdfs.mjs <manifest.json>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));

const CONCURRENCY = 8;
let done = 0;
let skipped = 0;
let failed = 0;

async function download(entry) {
  if (!entry.pdf_url) {
    skipped++;
    return;
  }
  const subdir = entry.year ? String(entry.year) : "undated";
  const outDir = path.join(root, "pdfs", entry.source, subdir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${entry.sermon_id}.pdf`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    skipped++;
    return;
  }

  const res = await fetch(entry.pdf_url);
  if (!res.ok) {
    console.error(`  ${entry.sermon_id}: HTTP ${res.status}`);
    failed++;
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  done++;
  process.stdout.write(`  ${entry.sermon_id} (${(buf.length / 1024).toFixed(0)}KB)\n`);
}

// Simple concurrent worker pool
const queue = [...manifest];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    try {
      await download(entry);
    } catch (e) {
      console.error(`  ${entry.sermon_id}: ${e.message}`);
      failed++;
    }
  }
});

await Promise.all(workers);

console.log(`\ndownloaded: ${done}, skipped: ${skipped}, failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
