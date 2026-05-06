#!/usr/bin/env node
// Patch mevar markdown frontmatter to add `local_image: <path>` for posts that
// have a downloaded feature image. Idempotent.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar.json"), "utf8"));

let updated = 0;
for (const entry of manifest) {
  if (!entry.local_image) continue;
  const mdPath = path.join(root, "markdown/mevar", `${entry.sermon_id}.md`);
  if (!fs.existsSync(mdPath)) continue;
  const text = fs.readFileSync(mdPath, "utf8");
  const m = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  if (!m) continue;
  const fm = m[2];
  // Replace existing local_image line if present, else insert before --- close
  const localImageLine = `local_image: ${JSON.stringify(entry.local_image)}`;
  let newFm;
  if (/^local_image:/m.test(fm)) {
    newFm = fm.replace(/^local_image:.*$/m, localImageLine);
  } else if (/^feature_image:/m.test(fm)) {
    newFm = fm.replace(/^(feature_image:.*)$/m, `$1\n${localImageLine}`);
  } else {
    newFm = fm + `\n${localImageLine}`;
  }
  if (newFm !== fm) {
    fs.writeFileSync(mdPath, m[1] + newFm + m[3] + m[4]);
    updated++;
  }
}
console.log(`patched ${updated} mevar markdown files`);
