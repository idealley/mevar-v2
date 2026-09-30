#!/usr/bin/env node
// Goal 20: the subtitles of the Mevar texts goal 10 covers, in sentence case,
// as goal 18 wrote their titles: « Exhortation de Juin 2011 » → « Exhortation
// de juin 2011 », « Exhortation Fin Mai 2011 » → « Exhortation fin mai 2011 ».
// A month, or a word that says which part of it (fin, mi, début, spéciale, du
// mois…), takes a lower-case initial; the first word and every other word
// keep theirs, so a proper noun stays. Only a capitalised word changes: a
// subtitle in capitals (« UN MESSAGE SANS PUISSANCE ») is its batch's to
// write.
//
// The texts: markdown/onedrive/, markdown/mevar-pdfs/, and the markdown/mevar/
// files with a source_path (goal 19's moved texts; not the Ghost posts). The
// frontmatter's subtitle line changes, and the same subtitle in
// manifests/onedrive.json and manifests/mevar-pdfs-corpus.json, which 50
// reads for index.json. A second run is a no-op.
//
// Usage: node scripts/89-subtitle-case.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const LOWER = new Set(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  "fin", "mi", "début", "spéciale", "spécial", "mois", "année"]);

// "d'Octobre", "Mi-Juillet": each run of letters is a word
const sentenceCase = (s) => {
  let first = true;
  return s.replace(/\p{L}+/gu, (w) => {
    const keep = first || !/^\p{Lu}\p{Ll}*$/u.test(w) || !LOWER.has(w.toLowerCase());
    first = false;
    return keep ? w : w.toLowerCase();
  });
};

const manifests = ["manifests/onedrive.json", "manifests/mevar-pdfs-corpus.json"];
const entries = new Map(manifests.map((m) => [m, JSON.parse(fs.readFileSync(path.join(root, m), "utf8"))]));
const changed = [];
for (const dir of ["markdown/onedrive", "markdown/mevar-pdfs", "markdown/mevar"])
  for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true }).sort()) {
    if (!rel.endsWith(".md")) continue;
    const md = `${dir}/${rel}`;
    const text = fs.readFileSync(path.join(root, md), "utf8");
    const fm = text.slice(4, text.indexOf("\n---\n", 4));
    if (dir === "markdown/mevar" && !/^source_path:/m.test(fm)) continue;
    const line = fm.match(/^subtitle: (.*)$/m);
    if (!line) continue;
    const before = JSON.parse(line[1]);
    const after = sentenceCase(before);
    if (after === before) continue;
    fs.writeFileSync(path.join(root, md), text.replace(line[0], `subtitle: ${JSON.stringify(after)}`));
    for (const list of entries.values())
      for (const e of list) if (e.local_md === md) e.subtitle = after;
    changed.push({ md, before, after });
  }
for (const [m, list] of entries) fs.writeFileSync(path.join(root, m), JSON.stringify(list, null, 2));

for (const c of changed) console.log(`${c.md}: « ${c.before} » → « ${c.after} »`);
console.log(`${changed.length} subtitles in sentence case`);
