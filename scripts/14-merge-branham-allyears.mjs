#!/usr/bin/env node
// Take .firecrawl/branham-allyears.json (output of the interact script) and merge
// with the existing 1965 manifest into per-year manifests/branham-YYYY.json.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = JSON.parse(
  fs.readFileSync(path.join(root, ".firecrawl/branham-allyears.json"), "utf8"),
);

let written = 0;
let totalSermons = 0;

for (const [yearStr, raw] of Object.entries(src)) {
  const year = Number(yearStr);
  const seen = new Set();
  const sermons = [];
  for (const r of raw) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    const m = r.id.match(/^(\d{2})-(\d{2})(\d{2})/);
    const date = m ? `${1900 + Number(m[1])}-${m[2]}-${m[3]}` : null;
    const title = (r.title ?? "").replace(r.id, "").trim().replace(/\s+/g, " ");
    sermons.push({
      source: "branham",
      sermon_id: r.id,
      year,
      date,
      title,
      location: null,
      duration: null,
      pdf_url: r.pdf,
      audio_url: r.audio,
      stream_url: r.stream,
    });
  }
  if (!sermons.length) continue;
  const out = path.join(root, `manifests/branham-${year}.json`);
  fs.writeFileSync(out, JSON.stringify(sermons, null, 2));
  totalSermons += sermons.length;
  written += 1;
  console.log(`  branham-${year}.json: ${sermons.length}`);
}

console.log(`\n${written} year manifests, ${totalSermons} sermons total`);
