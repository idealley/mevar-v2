#!/usr/bin/env node
// Frontmatter for the ten works that had none, so the site knows their
// source, title and kind, and 47 and 49 reach them. The values are read by
// hand from each text's title page. The id is the date where the summary's
// own heading contradicts it: "620714Son-confus" says « 14 Juillet 1963 », the
// sermon is 62-0714; a CMPP cover can be the previous issue's, the inner
// title page wins. A month with no day is no date. The same fields go into
// the work's manifest entry (manifests/local.json is created for the two
// volumes), so 50 agrees. Only a file with no frontmatter is written, and
// its manifest entry with it: a rerun, or a later correction, is left alone.
// Run 47, 49 and 50 after it.
//
//   node scripts/76-add-missing-frontmatter.mjs

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const WORKS = {
  "le-scribe/1950/500115Crois-tu": {
    title: "Crois-tu cela ?", subtitle: "Believest Thou This?",
    date: "1950-01-15", year: 1950, location: "Houston (Texas)", preacher: "William Branham",
  },
  "le-scribe/1962/620714Son-confus": {
    title: "Un son confus", subtitle: "An Uncertain Sound",
    date: "1962-07-14", year: 1962, location: "Spokane (Washington)", preacher: "William Branham",
  },
  "le-scribe/1962/620623Perseverant": {
    title: "Persévérant", subtitle: "Perseverant",
    date: "1962-06-23", year: 1962, location: "South Gates (Californie)", preacher: "William Branham",
  },
  // « Mars 1950, date inconnue »
  "le-scribe/undated/5003xxDon&appel": {
    title: "Les dons et les appels sont sans repentance", subtitle: "Gifts and Callings Are Without Repentance",
    date: null, year: 1950, location: "Carlsbad (New Mexico)", preacher: "William Branham",
  },
  // « Février 1956 »
  "le-scribe/undated/5602Combat-foi": {
    title: "Combattre pour la foi", subtitle: "Contending for the Faith",
    date: null, year: 1956, location: "Georgetown (Indiana)", preacher: "William Branham",
  },
  "cmpp/undated/lc56": {
    title: "Lettre Circulaire 56", subtitle: "Janvier 2005",
    date: null, year: 2005, location: "Krefeld", preacher: "Ewald Frank",
  },
  "cmpp/undated/serie1no8": {
    title: "Les douleurs de l’enfantement", subtitle: "24 janvier 1965, après-midi",
    date: "1965-01-24", year: 1965, location: "Ramada Inn, Phoenix, Arizona, U.S.A.", preacher: "William Branham",
  },
  // The cover says « 29 décembre 1963 », the previous issue's; the title page
  // « 14 juin 1964, soir »: 64-0614E, The Oddball.
  "cmpp/undated/serie4no6": {
    title: "L’original", subtitle: "14 juin 1964, soir",
    date: "1964-06-14", year: 1964, location: "Branham Tabernacle, Jeffersonville, Indiana, U.S.A.", preacher: "William Branham",
  },
  // Owen Jorgensen's biography, in French: a book, not a preacher's.
  "local/Volume-1-Ver2.0": {
    title: "Surnaturelle : la vie de William Branham, volume I",
    subtitle: "Livre 1 : Le garçon et sa privation (1909-1933)",
  },
  "local/Volume-2-Ver2.0": {
    title: "Surnaturelle : la vie de William Branham, volume II",
    subtitle: "Livre 2 : Le jeune homme et son désespoir (1933-1946). Livre 3 : L’homme et sa commission (1946-1950)",
  },
};

let written = 0;
const manifests = new Map();

for (const [rel, fields] of Object.entries(WORKS)) {
  const [source] = rel.split("/");
  const sermon_id = path.basename(rel);
  const p = path.join(root, "markdown", `${rel}.md`);
  const text = fs.readFileSync(p, "utf8");
  if (text.startsWith("---\n")) continue;
  const fm = Object.entries({ source, sermon_id, ...fields })
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v : JSON.stringify(v)}`);
  fs.writeFileSync(p, `---\n${fm.join("\n")}\n---\n${text}`);
  written++;

  const file = path.join(root, "manifests", `${source}.json`);
  if (!manifests.has(file)) manifests.set(file, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []);
  const entries = manifests.get(file);
  const entry = entries.find((e) => e.sermon_id === sermon_id) ?? entries[entries.push({ source, sermon_id }) - 1];
  Object.assign(entry, fields);
}

for (const [file, entries] of manifests) fs.writeFileSync(file, JSON.stringify(entries, null, 2));
console.log(`${written} files given frontmatter`);
