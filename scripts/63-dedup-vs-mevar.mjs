#!/usr/bin/env node
// For each onedrive entry, find best mevar match by Jaccard similarity on fingerprint
// word sets. Annotate manifests/onedrive.json in-place with mevar_match field.
//
// Output also writes manifests/onedrive-mevar-overlap.json for inspection.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function fingerprintBody(md) {
  let text = md.replace(/^---[\s\S]*?\n---\n/, "");
  text = text.toLowerCase().replace(/[^a-zà-ÿ ]+/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length >= 4);
  return new Set(words.slice(0, 200));
}

const onedrive = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));

// Build mevar fingerprints
const mevarManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar.json"), "utf8"));
const mevarFps = [];
for (const m of mevarManifest) {
  const mdPath = path.join(root, "markdown", "mevar", `${m.sermon_id}.md`);
  if (!fs.existsSync(mdPath)) continue;
  const md = fs.readFileSync(mdPath, "utf8");
  mevarFps.push({ ...m, fp: fingerprintBody(md) });
}
console.log(`mevar fingerprints: ${mevarFps.length}`);

function jaccard(a, b) {
  let inter = 0;
  const small = a.size <= b.size ? a : b;
  const large = a.size <= b.size ? b : a;
  for (const w of small) if (large.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

let matched = 0;
const overlaps = [];
for (const e of onedrive) {
  const fp = new Set(e.fingerprint_words);
  let best = { score: 0, mevar: null };
  for (const m of mevarFps) {
    const s = jaccard(fp, m.fp);
    if (s > best.score) best = { score: s, mevar: m };
  }
  if (best.score >= 0.5 && best.mevar) {
    e.mevar_match = {
      pathname: best.mevar.pathname,
      url: best.mevar.stream_url,
      title: best.mevar.title,
      similarity: Number(best.score.toFixed(3)),
    };
    matched++;
    overlaps.push({
      onedrive_id: e.sermon_id,
      onedrive_title: e.title,
      onedrive_path: e.local_md,
      mevar_url: best.mevar.stream_url,
      mevar_title: best.mevar.title,
      similarity: Number(best.score.toFixed(3)),
    });
  } else {
    e.mevar_match = null;
  }
  // keep fingerprint_words on the saved manifest so re-runs are idempotent
  // (62 regenerates them, 64 ignores them when writing frontmatter)
}

fs.writeFileSync(path.join(root, "manifests/onedrive.json"), JSON.stringify(onedrive, null, 2));

overlaps.sort((a, b) => b.similarity - a.similarity);
fs.writeFileSync(
  path.join(root, "manifests/onedrive-mevar-overlap.json"),
  JSON.stringify(overlaps, null, 2),
);

const histogram = { ">=0.9": 0, "0.7-0.9": 0, "0.5-0.7": 0, "<0.5": 0 };
for (const o of overlaps) {
  if (o.similarity >= 0.9) histogram[">=0.9"]++;
  else if (o.similarity >= 0.7) histogram["0.7-0.9"]++;
  else histogram["0.5-0.7"]++;
}
histogram["<0.5"] = onedrive.length - matched;

console.log(`onedrive entries: ${onedrive.length}`);
console.log(`with mevar match (>=0.5): ${matched}`);
console.log(`similarity histogram:`, histogram);
