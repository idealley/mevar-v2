#!/usr/bin/env node
// Download all mevar.json feature_image URLs to images/mevar/<post-slug>.<ext>
// and add local_image field to each manifest entry.
//
// Filename convention: <post-slug>.<ext>  (post-slug is mevar's sermon_id slug).
// Re-runs are idempotent: skips downloads already on disk.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "images/mevar");
fs.mkdirSync(outDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar.json"), "utf8"));

function extFrom(url) {
  const m = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

const tasks = manifest.filter((e) => e.feature_image);
const CONCURRENCY = 8;
const queue = [...tasks];
let done = 0, ok = 0, cached = 0, failed = 0;

async function downloadOne(entry) {
  const ext = extFrom(entry.feature_image);
  const filename = `${entry.sermon_id}.${ext}`;
  const localPath = path.join(outDir, filename);
  entry.local_image = `images/mevar/${filename}`;

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    cached++;
    return;
  }
  try {
    const res = await fetch(entry.feature_image);
    if (!res.ok) {
      console.error(`  HTTP ${res.status}: ${entry.sermon_id}`);
      failed++;
      delete entry.local_image;
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    ok++;
  } catch (e) {
    console.error(`  ${entry.sermon_id}: ${e.message}`);
    failed++;
    delete entry.local_image;
  }
}

async function worker() {
  while (queue.length) {
    const e = queue.shift();
    if (!e) return;
    await downloadOne(e);
    done++;
    if (done % 20 === 0) console.log(`  [${done}/${tasks.length}] ok=${ok} cached=${cached} fail=${failed}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

fs.writeFileSync(path.join(root, "manifests/mevar.json"), JSON.stringify(manifest, null, 2));
console.log(`\ndone: ok=${ok} cached=${cached} fail=${failed}`);
console.log(`local_image set on ${manifest.filter((e) => e.local_image).length} entries`);
