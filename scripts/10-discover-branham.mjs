#!/usr/bin/env node
// Parse a firecrawl scrape of branham.org/en/MessageAudio?year=YYYY into
// a manifest of sermons with PDF urls.
//
// Usage: node scripts/10-discover-branham.mjs <year>

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const year = process.argv[2];
if (!year || !/^\d{4}$/.test(year)) {
  console.error("usage: 10-discover-branham.mjs <year>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const probePath = path.join(root, ".firecrawl", `branham-${year}-probe.json`);
const manifestPath = path.join(root, "manifests", `branham-${year}.json`);

if (!fs.existsSync(probePath)) {
  const url = `https://branham.org/en/MessageAudio?year=${year}`;
  console.log(`scraping ${url}`);
  execFileSync(
    path.join(root, "node_modules/.bin/firecrawl"),
    ["scrape", url, "--format", "markdown,links", "-o", probePath],
    { stdio: "inherit" },
  );
}

const probe = JSON.parse(fs.readFileSync(probePath, "utf8"));
const md = probe.markdown ?? "";

// A sermon block in the markdown looks like:
//   65-0117
//   65-0117A Paradox
//   Phoenix AZ
//   94 min
//   [pdf](https://d2w09gj4mqt5u.cloudfront.net/...pdf "download PDF file")
//   [m4a](https://d21kl6o5a7faj0.cloudfront.net/...m4a "Download Audio")
//   [stream](https://branham.org/en/messagestream/ENG=65-0117 "Stream Audio")
const idRe = new RegExp(`^${year.slice(2)}-\\d{4}[A-Z]?$`);
const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);

const sermons = [];
for (let i = 0; i < lines.length; i++) {
  if (!idRe.test(lines[i])) continue;
  const id = lines[i];
  // Skip if next line is not the title block (defensive)
  const titleLine = lines[i + 1] ?? "";
  if (!titleLine.startsWith(id)) continue;
  const title = titleLine.slice(id.length).trim();
  const location = lines[i + 2] ?? "";
  const duration = lines[i + 3] ?? "";

  const window = lines.slice(i + 4, i + 12).join("\n");
  const pdf = window.match(/\(([^)]*\.pdf)[^)]*\)/)?.[1] ?? null;
  const m4a = window.match(/\(([^)]*\.m4a)[^)]*\)/)?.[1] ?? null;
  const stream = window.match(/\((https:\/\/branham\.org\/en\/messagestream\/[^)]+?)\s/)?.[1]
    ?? window.match(/\((https:\/\/branham\.org\/en\/messagestream\/[^)\s]+)\)/)?.[1]
    ?? null;

  // Date from sermon ID: YY-MMDD[X] -> 19YY-MM-DD
  const m = id.match(/^(\d{2})-(\d{2})(\d{2})/);
  const date = m ? `19${m[1]}-${m[2]}-${m[3]}` : null;

  sermons.push({
    source: "branham",
    sermon_id: id,
    year: Number(year),
    date,
    title,
    location,
    duration,
    pdf_url: pdf,
    audio_url: m4a,
    stream_url: stream,
  });
}

// Dedupe by sermon_id (in case of duplicates in markdown)
const seen = new Set();
const deduped = sermons.filter((s) => {
  if (seen.has(s.sermon_id)) return false;
  seen.add(s.sermon_id);
  return true;
});

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(deduped, null, 2));

const withPdf = deduped.filter((s) => s.pdf_url).length;
console.log(`wrote ${manifestPath}`);
console.log(`  ${deduped.length} sermons, ${withPdf} with PDFs`);
