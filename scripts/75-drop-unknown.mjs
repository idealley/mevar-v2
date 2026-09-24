#!/usr/bin/env node
// Remove the `date` and `location` values the LLM cleanup wrote as "Unknown"
// ("unknown", "Unknown (likely Florida or southern US)"): no value is not a
// value. From the frontmatter in markdown/ and from the manifests; 73 no longer
// writes them. Idempotent; only these two fields are touched, never a body.
// Run 50-build-index.mjs after it.
//
//   node scripts/75-drop-unknown.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const UNKNOWN = /^unknown\b/i;
const FIELDS = ["date", "location"];

let values = 0;

for (const f of fs.readdirSync(path.join(root, "manifests"))) {
  const p = path.join(root, "manifests", f);
  const entries = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(entries)) continue;
  let changed = false;
  for (const e of entries) {
    for (const k of FIELDS) {
      if (typeof e?.[k] !== "string" || !UNKNOWN.test(e[k])) continue;
      console.log(`manifests/${f}: ${e.sermon_id} ${k}: ${JSON.stringify(e[k])}`);
      delete e[k];
      changed = true;
      values++;
    }
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(entries, null, 2));
}

const line = new RegExp(`^(?:${FIELDS.join("|")}): "unknown\\b.*\\n`, "gim");
for (const rel of fs.readdirSync(path.join(root, "markdown"), { recursive: true })) {
  if (!rel.endsWith(".md")) continue;
  const p = path.join(root, "markdown", rel);
  const text = fs.readFileSync(p, "utf8");
  const end = text.indexOf("\n---\n", 4) + 1;
  const fm = text.slice(0, end);
  const cleaned = fm.replace(line, (l) => {
    console.log(`markdown/${rel}: ${l.trim()}`);
    values++;
    return "";
  });
  if (cleaned !== fm) fs.writeFileSync(p, cleaned + text.slice(end));
}

console.log(`${values} "Unknown" values removed`);
