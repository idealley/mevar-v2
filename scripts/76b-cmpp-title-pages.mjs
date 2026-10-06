#!/usr/bin/env node
// What the CMPP's own text says against what the LLM pass wrote in the
// frontmatter (goal 16, item 5). The values are read by hand, each with the
// line of the text that settles it; `null` takes a field away, a list with
// its items. A month with no day is a month ("1954-07"), as 12 writes it.
// The same change goes into the work's entry
// of manifests/cmpp.json, so 50 agrees.
//
// And one rule for the whole source: a text dated by its month has no day.
// The first pass wrote « Janvier 2013 » as "2013-01-01". Such a date becomes
// "2013-01" when the work's file name, its subtitle or the head of its text
// names that month and year, unless the subtitle or a short line of that head
// prints the first of the month (« 1er septembre 1963, soir »).
//
// And one for the 187 monthly « Sommaire des rencontres » (video_MM_YYYY):
// they all had that one title, so a reader could not tell them apart. The
// title says the month, from the file name: « Sommaire des rencontres, mars
// 2010 » (Samuel, 2026-10-06).
//
// Idempotent. Run it after 73, which writes the model's values again; then
// 49b, 47 and 50.
//
//   node scripts/76b-cmpp-title-pages.mjs

import fs from "node:fs";
import path from "node:path";
import { dropField, setField } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");

const CORRECTIONS = {
  // The title page: « Juillet 1954 », « Washington D.C. — U.S.A. ». No day.
  la_profondeur: { date: "1954-07" },
  // « Auteur: Missionnaire Ewald Frank, Krefeld (Allemagne) Copyright © 2001 »,
  // and the text speaks of « le 8 octobre 2001 »: not 1 January, and no day printed.
  islam: { date: null },
  // The tracts. They speak of William Branham, they are not his: « Frère
  // Branham certifie que la révélation qu’il a reçue sur le péché originel
  // est l’entière vérité » (eden), « Son nom est: William Marrion Branham. Il
  // s’en est allé comme il est venu (1909 – 1965) » (savez-vous), « le
  // ministère de Son serviteur William Branham » (quel_bapteme). Unsigned;
  // Samuel, 2026-10-06: « these tracts are probably Frank's and explain what
  // branham said ».
  eden: { preacher: "Ewald Frank" },
  "savez-vous": { preacher: "Ewald Frank" },
  "savez-vous_A4_traite": { preacher: "Ewald Frank" },
  quel_bapteme: { preacher: "Ewald Frank" },
  quel_bapteme_A4_traite: { preacher: "Ewald Frank" },
  quand_dieu: { preacher: "Ewald Frank" },
  quand_dieu_A4_traite: { preacher: "Ewald Frank" },
  le_bapteme_une_question_importante: { preacher: "Ewald Frank" },
  le_bapteme_une_question_importante_A4_traite: { preacher: "Ewald Frank" },
  // A death notice, not a work: it names a family, person by person, and the
  // model had lifted the names and their towns into the metadata. A draft is
  // not built, listed or indexed (Samuel, 2026-10-06: « we can keep the death
  // notice out »).
  faire_part_alexis_barilier: { status: "draft", summary: null, tags: null, persons: null, places: null },
};

// A field's line, and the items under it when it is a list
const drop = (text, key) => dropField(text.replace(new RegExp(`^(${key}:)\\n(?:  - .*\\n)+`, "m"), "$1 \n"), key);

const manifestPath = path.join(root, "manifests/cmpp.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let changed = 0;

for (const [id, fields] of Object.entries(CORRECTIONS)) {
  const entry = manifest.find((e) => e.sermon_id === id);
  const file = path.join(root, entry.local_md);
  const before = fs.readFileSync(file, "utf8");
  let text = before;
  for (const [key, value] of Object.entries(fields)) {
    text = value === null ? drop(text, key) : setField(text, key, value);
    if (value === null) delete entry[key]; else entry[key] = value;
  }
  if (text !== before) { fs.writeFileSync(file, text); changed++; }
}

// ─── Each monthly summary says its month ────────────────────────────────────
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
let titles = 0;
for (const entry of manifest) {
  const [, mm, year] = entry.sermon_id.match(/^video_(\d{2})_(\d{4})$/) ?? [];
  const title = mm && `Sommaire des rencontres, ${MOIS[mm - 1]} ${year}`;
  if (!mm || entry.title === title) continue;
  entry.title = title;
  const file = path.join(root, entry.local_md);
  fs.writeFileSync(file, setField(fs.readFileSync(file, "utf8"), "title", title));
  titles++;
}

// ─── A month is not a day ───────────────────────────────────────────────────
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const fold = (t) => (t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ");
let months = 0;
for (const entry of manifest) {
  const [, year, mm] = entry.date?.match(/^(\d{4})-(\d{2})-01$/) ?? [];
  if (!year) continue;
  const month = MONTHS[mm - 1];
  const file = path.join(root, entry.local_md);
  const text = fs.readFileSync(file, "utf8");
  const body = text.slice(text.indexOf("\n---\n", 4) + 5);
  const head = body.split("\n").filter((l) => l.trim()).slice(0, 15).join("\n");
  // A title page's lines are short; a day inside a sentence of the text is an event it tells.
  const titleLines = head.split("\n").filter((l) => l.length <= 80).join("\n");
  const named = fold(entry.sermon_id).includes(month + year) || fold(entry.sermon_id).includes(`${month}_${year}`) || entry.sermon_id.startsWith(`video_${mm}_${year}`)
    || new RegExp(`${month}\\W+${year}`).test(fold(`${entry.subtitle}\n${head}`));
  const firstOfTheMonth = new RegExp(`(^|\\D)(1 ?(er|ᵉʳ)?|premier) ${month} ${year}`).test(fold(`${entry.subtitle}\n${titleLines}`));
  if (!named || firstOfTheMonth) continue;
  entry.date = `${year}-${mm}`;
  fs.writeFileSync(file, setField(text, "date", entry.date));
  months++;
}

const out = JSON.stringify(manifest, null, 2);
if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);
console.log(`${Object.keys(CORRECTIONS).length} works corrected from their own text, ${changed} frontmatters changed; ${months} dates of a first of the month set to their month; ${titles} monthly summaries titled with their month`);
