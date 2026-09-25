#!/usr/bin/env node
// Walk markdown/ + manifests/ to produce a master index.json:
// [{ source, sermon_id?, title, date?, year?, location?, source_url, pdf_url?, original?, local_md, size_bytes, line_count }]
//
// Usage: node scripts/50-build-index.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown");
const manifestsDir = path.join(root, "manifests");

// Load all manifests, keyed by source/sermon_id for join with markdown files.
const manifestEntries = new Map();
if (fs.existsSync(manifestsDir)) {
  for (const f of fs.readdirSync(manifestsDir)) {
    if (!f.endsWith(".json")) continue;
    if (f.includes("inventory") || f.includes("overlap")) continue;
    const arr = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), "utf8"));
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (!e?.source || !e?.sermon_id) continue;
      manifestEntries.set(`${e.source}/${e.sermon_id}`, e);
    }
  }
}

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

const index = [];
for (const mdPath of walk(mdRoot)) {
  const rel = path.relative(root, mdPath);
  const stat = fs.statSync(mdPath);
  const text = fs.readFileSync(mdPath, "utf8");
  const lineCount = text.split("\n").length;

  // markdown/<source>/<...path>/<basename>.md
  const parts = rel.split(path.sep);
  const source = parts[1];
  const basename = path.basename(mdPath, ".md");

  const manifest = manifestEntries.get(`${source}/${basename}`);
  // Written by 49-link-le-scribe-branham.mjs — frontmatter, not a manifest.
  const original = text.match(/^original: "(.+)"$/m)?.[1] ?? null;
  // A post's status is its frontmatter's, as the site builds it: Samuel
  // publishes a draft here, and mevar.json keeps what the Ghost import said.
  const status = text.match(/^status: "(.+)"$/m)?.[1] ?? manifest?.status ?? null;

  index.push({
    source,
    sermon_id: manifest?.sermon_id ?? basename,
    title: manifest?.title ?? basename,
    subtitle: manifest?.subtitle ?? null,
    date: manifest?.date ?? null,
    year: manifest?.year ?? null,
    location: manifest?.location ?? null,
    preacher: manifest?.preacher ?? null,
    duration: manifest?.duration ?? null,
    source_url: manifest?.stream_url ?? null,
    pdf_url: manifest?.pdf_url ?? null,
    audio_url: manifest?.audio_url ?? null,
    mevar_match: manifest?.mevar_match ?? null,
    aliases: manifest?.aliases ?? null,
    tags: manifest?.tags ?? null,
    authors: manifest?.authors ?? null,
    type: manifest?.type ?? null,
    status,
    summary: manifest?.summary ?? null,
    persons: manifest?.persons ?? null,
    places: manifest?.places ?? null,
    themes: manifest?.themes ?? null,
    feature_image: manifest?.feature_image ?? null,
    local_image: manifest?.local_image ?? null,
    llm_cleaned: manifest?.llm_cleaned ?? false,
    original,
    local_md: rel,
    size_bytes: stat.size,
    line_count: lineCount,
  });
}

// Stable sort: source, then date (nulls last), then sermon_id
index.sort((a, b) => {
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  if (a.date !== b.date) return (a.date ?? "9999").localeCompare(b.date ?? "9999");
  return a.sermon_id.localeCompare(b.sermon_id);
});

fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(index, null, 2));

const bySrc = {};
for (const e of index) bySrc[e.source] = (bySrc[e.source] ?? 0) + 1;
console.log(`wrote index.json: ${index.length} entries`);
for (const [src, n] of Object.entries(bySrc)) console.log(`  ${src}: ${n}`);
