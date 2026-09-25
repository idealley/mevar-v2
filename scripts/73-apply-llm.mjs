#!/usr/bin/env node
// Apply LLM-cleaned content from .llm-cache-<source>/ back into markdown/<source>/
// and update manifests/<source>.json with rich NER fields.
//
// Usage:  node scripts/73-apply-llm.mjs <source>      # onedrive | le-scribe | branham
//
// Behavior:
//   - For each cache entry with cleaned_markdown set: rewrite the corresponding
//     markdown file to {frontmatter from manifest + new fields} + cleaned body.
//   - For errored entries: leave the original file intact, log them.
//   - Merge LLM-extracted NER fields (persons, places, themes, summary, tags,
//     plus any title/subtitle/date/location/preacher upgrades) into the manifest
//     entry. Existing manifest fields are kept if LLM returned null.
//   - Writes manifests/<source>-llm-stats.json with per-doc status.
//   - Never rewrites a file that has `editorial_pass` (goal 10): its body is
//     the edited text, not the cache's.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = process.argv[2];
if (!["onedrive", "le-scribe", "branham", "mevar-pdfs", "cmpp"].includes(source)) {
  console.error("usage: 73-apply-llm.mjs <onedrive|le-scribe|branham|mevar-pdfs|cmpp>");
  process.exit(2);
}

const cacheDir = source === "onedrive"
  ? path.join(root, ".llm-cache")
  : path.join(root, `.llm-cache-${source}`);

function loadManifest() {
  if (source === "branham") {
    const all = [];
    for (const f of fs.readdirSync(path.join(root, "manifests")).filter((f) => /^branham-\d{4}\.json$/.test(f))) {
      const arr = JSON.parse(fs.readFileSync(path.join(root, "manifests", f), "utf8"));
      all.push(...arr);
    }
    return all;
  }
  if (source === "mevar-pdfs") {
    return JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar-pdfs-corpus.json"), "utf8"));
  }
  return JSON.parse(fs.readFileSync(path.join(root, `manifests/${source}.json`), "utf8"));
}

function saveManifest(arr) {
  if (source === "branham") {
    const byYear = new Map();
    for (const e of arr) {
      const k = e.year ?? "unknown";
      if (!byYear.has(k)) byYear.set(k, []);
      byYear.get(k).push(e);
    }
    for (const [year, entries] of byYear) {
      fs.writeFileSync(path.join(root, `manifests/branham-${year}.json`), JSON.stringify(entries, null, 2));
    }
  } else if (source === "mevar-pdfs") {
    fs.writeFileSync(path.join(root, "manifests/mevar-pdfs-corpus.json"), JSON.stringify(arr, null, 2));
  } else {
    fs.writeFileSync(path.join(root, `manifests/${source}.json`), JSON.stringify(arr, null, 2));
  }
}

function yamlString(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(String(v));
}

function makeFrontmatter(e) {
  const lines = ["---"];
  lines.push(`source: ${yamlString(e.source)}`);
  lines.push(`sermon_id: ${yamlString(e.sermon_id)}`);
  if (e.title) lines.push(`title: ${yamlString(e.title)}`);
  if (e.subtitle) lines.push(`subtitle: ${yamlString(e.subtitle)}`);
  if (e.date) lines.push(`date: ${yamlString(e.date)}`);
  if (e.year) lines.push(`year: ${e.year}`);
  if (e.location) lines.push(`location: ${yamlString(e.location)}`);
  if (e.preacher) lines.push(`preacher: ${yamlString(e.preacher)}`);
  if (e.duration) lines.push(`duration: ${yamlString(e.duration)}`);
  if (e.summary) lines.push(`summary: ${yamlString(e.summary)}`);
  if (e.tags?.length) {
    lines.push("tags:");
    for (const t of e.tags) lines.push(`  - ${yamlString(t)}`);
  }
  if (e.persons?.length) {
    lines.push("persons:");
    for (const p of e.persons) lines.push(`  - ${yamlString(p)}`);
  }
  if (e.places?.length) {
    lines.push("places:");
    for (const p of e.places) lines.push(`  - ${yamlString(p)}`);
  }
  if (e.themes?.length) {
    lines.push("themes:");
    for (const t of e.themes) lines.push(`  - ${yamlString(t)}`);
  }
  if (e.pdf_url) lines.push(`pdf_url: ${yamlString(e.pdf_url)}`);
  if (e.audio_url) lines.push(`audio_url: ${yamlString(e.audio_url)}`);
  if (e.stream_url) lines.push(`stream_url: ${yamlString(e.stream_url)}`);
  if (e.source_path) lines.push(`source_path: ${yamlString(e.source_path)}`);
  if (e.hash) lines.push(`hash: ${yamlString(e.hash)}`);
  if (e.aliases?.length) {
    lines.push("aliases:");
    for (const a of e.aliases) lines.push(`  - ${yamlString(a)}`);
  }
  if (e.mevar_match) {
    lines.push("mevar_match:");
    lines.push(`  url: ${yamlString(e.mevar_match.url)}`);
    lines.push(`  title: ${yamlString(e.mevar_match.title)}`);
    lines.push(`  similarity: ${e.mevar_match.similarity}`);
  }
  lines.push(`llm_cleaned: true`);
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

const manifest = loadManifest();
const byId = new Map(manifest.map((e) => [e.sermon_id, e]));

const stats = { total: manifest.length, applied: 0, errored: 0, missing_cache: 0, no_change: 0, editorial_pass: 0 };
const errors = [];

for (const cacheFile of fs.readdirSync(cacheDir)) {
  if (!cacheFile.endsWith(".json")) continue;
  const id = path.basename(cacheFile, ".json");
  const entry = byId.get(id);
  if (!entry) continue;

  const cache = JSON.parse(fs.readFileSync(path.join(cacheDir, cacheFile), "utf8"));
  if (cache._error || cache._parse_error) {
    stats.errored++;
    errors.push({ id, reason: cache._error ?? cache._parse_error });
    continue;
  }
  if (!cache.cleaned_markdown) {
    stats.errored++;
    errors.push({ id, reason: "no cleaned_markdown" });
    continue;
  }

  // Merge LLM fields into manifest entry (keep existing if LLM returned null).
  // A date or location "Unknown", "Unknown (likely Florida…)" is the model
  // saying it has nothing.
  for (const key of ["title", "subtitle", "date", "location", "preacher", "summary"]) {
    if (cache[key] == null || cache[key] === "") continue;
    if ((key === "date" || key === "location") && /^\s*unknown\b/i.test(cache[key])) continue;
    entry[key] = cache[key];
  }
  if (cache.date && /^\d{4}-\d{2}-\d{2}$/.test(cache.date)) {
    entry.year = Number(cache.date.slice(0, 4));
  }
  // NER fields: prefer LLM (always overwrite if present)
  if (Array.isArray(cache.tags)) entry.tags = [...new Set(cache.tags)];
  if (Array.isArray(cache.persons)) entry.persons = [...new Set(cache.persons)];
  if (Array.isArray(cache.places)) entry.places = [...new Set(cache.places)];
  if (Array.isArray(cache.themes)) entry.themes = [...new Set(cache.themes)];
  entry.llm_cleaned = true;

  // Compute local_md if missing (le-scribe / branham / cmpp manifests don't store it)
  function computeMd(year) {
    if (source === "le-scribe") return `markdown/le-scribe/${year ?? "undated"}/${entry.sermon_id}.md`;
    if (source === "cmpp") return `markdown/cmpp/${year ?? "undated"}/${entry.sermon_id}.md`;
    if (source === "branham") return `markdown/branham/${year}/${entry.sermon_id}.md`;
    return entry.local_md;
  }
  if (!entry.local_md) entry.local_md = computeMd(entry.year);
  let mdPath = path.join(root, entry.local_md);
  // Fallback: derive year from sermon_id "YY-MMDD..." (handles wrong-year manifest entries)
  if (!fs.existsSync(mdPath) && source === "branham") {
    const m = entry.sermon_id.match(/^(\d{2})-/);
    if (m) {
      const yy = Number(m[1]);
      const altYear = yy >= 47 ? 1900 + yy : 2000 + yy;
      const altPath = computeMd(altYear);
      if (fs.existsSync(path.join(root, altPath))) {
        entry.local_md = altPath;
        entry.year = altYear;
        if (entry.date && !entry.date.startsWith(String(altYear))) {
          // Fix date too: keep month/day but correct year
          const md = entry.date.match(/-(\d{2})-(\d{2})$/);
          if (md) entry.date = `${altYear}-${md[1]}-${md[2]}`;
        }
        mdPath = path.join(root, altPath);
      }
    }
  }
  if (!fs.existsSync(mdPath) && source === "cmpp") {
    // LLM may have corrected entry.year but the file still sits under its
    // original year directory (often "undated"). Search all year dirs.
    const candidates = fs.readdirSync(path.join(root, "markdown/cmpp"))
      .map((d) => path.join("markdown/cmpp", d, `${entry.sermon_id}.md`))
      .filter((p) => fs.existsSync(path.join(root, p)));
    if (candidates.length === 1) {
      entry.local_md = candidates[0];
      mdPath = path.join(root, candidates[0]);
    }
  }
  if (!fs.existsSync(mdPath)) {
    stats.missing_cache++;
    continue;
  }

  if (/^editorial_pass:/m.test(fs.readFileSync(mdPath, "utf8").split("\n---\n")[0])) {
    stats.editorial_pass++;
    continue;
  }

  const fm = makeFrontmatter(entry);
  fs.writeFileSync(mdPath, fm + cache.cleaned_markdown.replace(/^---\n[\s\S]*?\n---\n+/, "") + "\n");
  stats.applied++;
}

saveManifest(manifest);
fs.writeFileSync(
  path.join(root, `manifests/${source}-llm-stats.json`),
  JSON.stringify({ stats, errors }, null, 2),
);
console.log(`${source}: applied=${stats.applied} errored=${stats.errored} missing=${stats.missing_cache} editorial_pass=${stats.editorial_pass}`);
if (errors.length) console.log(`  ${errors.length} errors → manifests/${source}-llm-stats.json`);
