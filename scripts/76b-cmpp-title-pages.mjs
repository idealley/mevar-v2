#!/usr/bin/env node
// What the CMPP's own text says against what the LLM pass wrote in the
// frontmatter (goal 16, item 5). The values are read by hand, each with the
// line of the text that settles it; `null` takes a field away. A month with
// no day is no date (as in 76). The same change goes into the work's entry
// of manifests/cmpp.json, so 50 agrees. Idempotent. Run it after 73, which
// writes the model's values again; then 49b, 47 and 50.
//
//   node scripts/76b-cmpp-title-pages.mjs

import fs from "node:fs";
import path from "node:path";
import { dropField, setField } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");

const CORRECTIONS = {
  // The title page: « Juillet 1954 », « Washington D.C. — U.S.A. ». No day.
  la_profondeur: { date: null },
  // « Auteur: Missionnaire Ewald Frank, Krefeld (Allemagne) Copyright © 2001 »,
  // and the text speaks of « le 8 octobre 2001 »: not 1 January, and no day printed.
  islam: { date: null },
  // « Frère Branham certifie que la révélation qu’il a reçue sur le péché
  // originel est l’entière vérité » : written about him, not by him. The
  // tract is unsigned, so no name replaces his (Samuel, 2026-10-05: not a
  // sermon of Branham's).
  eden: { preacher: null },
};

const manifestPath = path.join(root, "manifests/cmpp.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let changed = 0;

for (const [id, fields] of Object.entries(CORRECTIONS)) {
  const entry = manifest.find((e) => e.sermon_id === id);
  const file = path.join(root, entry.local_md);
  const before = fs.readFileSync(file, "utf8");
  let text = before;
  for (const [key, value] of Object.entries(fields)) {
    text = value === null ? dropField(text, key) : setField(text, key, value);
    if (value === null) delete entry[key]; else entry[key] = value;
  }
  if (text !== before) { fs.writeFileSync(file, text); changed++; }
}

const out = JSON.stringify(manifest, null, 2);
if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);
console.log(`${Object.keys(CORRECTIONS).length} works corrected from their own text, ${changed} frontmatters changed`);
