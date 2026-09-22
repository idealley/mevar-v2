#!/usr/bin/env node
// Lift fields from manifests + bible-refs.json into each markdown's frontmatter.
// Idempotent. pdf_url / audio_url / stream_url are left alone once set;
// bible_refs is rewritten from the manifest, which is what produces it.
//
// Lifts:
//   - pdf_url       (from manifests/<source>.json or per-year branham manifests)
//   - audio_url     (same)
//   - stream_url    (same)
//   - bible_refs    (from manifests/bible-refs.json keyed by markdown path)
//   - Pour mevar entries with a Ghost file-card cleaned by 46-: pdf_download
//     is already there, just synthesize pdf_url from it if pdf_url is empty.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// ─── Build lookup: sermon_id → manifest entry ────────────────────────────────
function loadManifest(p) {
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const lookup = new Map(); // `${source}/${sermon_id}` → entry
for (const f of fs.readdirSync(path.join(root, "manifests"))) {
  if (!f.endsWith(".json")) continue;
  if (!/^(?:branham-\d{4}|le-scribe|cmpp|onedrive|mevar|mevar-pdfs-corpus|local)\.json$/.test(f)) continue;
  const arr = loadManifest(path.join(root, "manifests", f));
  if (!Array.isArray(arr)) continue;
  for (const e of arr) {
    const src = e.source ?? (f.startsWith("branham-") ? "branham" : f.replace(/\.json$/, "").replace(/-corpus$/, ""));
    const id = e.sermon_id;
    if (!id) continue;
    lookup.set(`${src}/${id}`, e);
  }
}
console.log(`manifest lookup: ${lookup.size} entries`);

const refsByFile = JSON.parse(fs.readFileSync(path.join(root, "manifests/bible-refs.json"), "utf8"));

// ─── Walk markdown/ and patch frontmatter ────────────────────────────────────
function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

// Replace a `key:` line and its "  - " list in the frontmatter, in place.
// A null block removes the key; a missing key is appended.
function replaceBlock(fm, key, block) {
  const lines = fm.split("\n");
  const i = lines.indexOf(`${key}:`);
  if (i === -1) return block ? `${fm}\n${block}` : fm;
  let j = i + 1;
  while (j < lines.length && lines[j].startsWith("  - ")) j++;
  lines.splice(i, j - i, ...(block ? block.split("\n") : []));
  return lines.join("\n");
}

let touched = 0, addedPdf = 0, addedAudio = 0, addedRefs = 0;
const KEYS = ["pdf_url", "audio_url", "stream_url"];

for (const filePath of walk(path.join(root, "markdown"))) {
  const text = fs.readFileSync(filePath, "utf8");
  const m = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  if (!m) continue;
  let fm = m[2];
  const body = m[4];

  // Derive source + sermon_id from path
  const rel = path.relative(path.join(root, "markdown"), filePath);
  const parts = rel.split(path.sep);
  const source = parts[0];
  const basename = path.basename(filePath, ".md");
  const entry = lookup.get(`${source}/${basename}`);

  let changed = false;

  // Lift pdf_url / audio_url / stream_url from manifest if missing in frontmatter
  if (entry) {
    for (const key of KEYS) {
      if (!entry[key]) continue;
      // Quote values that contain : or # for safe YAML
      const re = new RegExp(`^${key}:`, "m");
      if (re.test(fm)) continue;
      fm += `\n${key}: ${JSON.stringify(entry[key])}`;
      if (key === "pdf_url") addedPdf++;
      if (key === "audio_url") addedAudio++;
      changed = true;
    }
  }

  // bible_refs follows manifests/bible-refs.json (cap at 50 — avoid huge
  // frontmatter for sermon transcripts). A ref the manifest dropped goes.
  const fmRel = `markdown/${rel.split(path.sep).join("/")}`;
  const refs = refsByFile[fmRel] ?? [];
  const block = refs.length
    ? `bible_refs:\n${refs.slice(0, 50).map((r) => "  - " + JSON.stringify(r)).join("\n")}`
    : null;
  const before = fm;
  fm = replaceBlock(fm, "bible_refs", block);
  if (fm !== before) {
    if (!/^bible_refs:/m.test(before)) addedRefs++;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, m[1] + fm + m[3] + body);
    touched++;
  }
}

console.log(`patched ${touched} files`);
console.log(`  + pdf_url:    ${addedPdf}`);
console.log(`  + audio_url:  ${addedAudio}`);
console.log(`  + bible_refs: ${addedRefs}`);
