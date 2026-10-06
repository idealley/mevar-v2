#!/usr/bin/env node
// What the CMPP's own text says against what the LLM pass wrote in the
// frontmatter (goal 16, item 5). The values are read by hand, each with the
// line of the text that settles it; `null` takes a field away, a list with
// its items. A month with no day is a month ("1954-07"), as 12 writes it.
// The same change goes into the work's entry
// of manifests/cmpp.json, so 50 agrees.
//
// And two rules for the whole source, on the text of each PDF (cmpp-pdfs.mjs;
// 21 and 22 first, for the booklets and the PDFs with lost signs):
//   (Not for a work that has its page of cmpp.ch, goal 31: 43 sets its date
//   and place from the page's header, and what the header does not print
//   stays as it is.)
//   - a date is what the PDF prints, no more. The pass was asked for a date
//     and wrote « Janvier 2013 » as "2013-01-01", « Année 2020 » as
//     "2020-01-01". A day no title page or signature prints becomes its month
//     ("2013-01") when the file name or the PDF names the month, and goes
//     otherwise: the work keeps its `year`. A date set by hand in the table
//     is left alone, and a duplicate (83b) has the date of the work it
//     duplicates: two A5 layouts print the month of the circular letter
//     they were sent with, their keeper does not.
//   - a place the PDF does not print as the text's own goes (a line of a
//     title page or of a signature, as for a date; a place inside a sentence
//     is one the text speaks of): the pass was told « Krefeld par défaut pour
//     Ewald Frank », and wrote it on texts that print another address or
//     none.
//   - a yearly exhortation (annee_YYYY, exhortation_annee_YYYY) names no
//     preacher. The pass gave all fifty to Ewald Frank. None is signed, each
//     ends on the CMPP's address, and where one names him it speaks of him:
//     « Le départ de cette terre du serviteur fidèle et prudent, notre frère
//     Ewald Frank » (2025), « que ce soit avec frère William Branham, frère
//     Ewald Frank et frère Alexis Barilier » (2020). They are unsigned; no
//     name is put in his place, and they are drafts, not built, until their
//     author is verified (Samuel, 2026-10-06, who believes he knows whose
//     they are: « we will need to verify […] then I would not publish
//     them »).
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
import { dropField, field, frontmatter, setField } from "./frontmatter.mjs";
import { extraction, printedDate, printsPlace } from "./cmpp-pdfs.mjs";

const root = path.resolve(import.meta.dirname, "..");

const CORRECTIONS = {
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
  // « 4 mars 1960, après-midi », « (God’s Eagles) », Tulsa: the booklet's
  // date is the American 4/3/60 read the European way. The sermon is
  // 60-0403, « As the Eagle Stirreth », Tulsa, Oklahoma, 3 April 1960,
  // afternoon: its opening prayer (« Almighty God, the Creator of heavens and
  // earth, and the Author of everlasting Life… for this great Tulsa meeting »)
  // is the translation's, sentence for sentence, and so is its end (« If you
  // die in your sins, it won’t be God’s fault… a sinner is an unbeliever »,
  // « Don’t move around. See? Each one of you is a spirit »). The archive's
  // sermon of 4 March 1960 (60-0304, « Thirsting for Life », Phoenix) names
  // no eagle and no Tulsa. Settled from the two texts; Samuel did not know.
  // The subtitle stays: it is what the booklet prints.
  les_aigles_de_dieu: { date: "1960-04-03" },
  // « SEPTEMBRE – OCTOBRE 1966 » at the head of the first of the PDF's twelve letters (the last: « AVRIL – JUIN 1968 »).
  la_parole_de_dieu_demeure_eternellement: { date: "1966-09" },
  // Published under the publisher's name (Samuel, 2026-10-06: « maybe we can
  // publish them with something like Author CMPP »; he thinks them probably
  // by another of the CMPP's writers, which no page says).
  // Unsigned, and its own text rules out the preacher the pass gave it:
  // « notre frère Ewald Frank, qui […] a enseigné », « notre frère Alexis
  // Barilier », « dans la brochure de frère Frank ».
  ministeres_pasteur_A4: { preacher: "CMPP" },
  ministeres_pasteur_A4_gc: { preacher: "CMPP" },
  ministeres_pasteur_A5: { preacher: "CMPP" },
  // The same: « Pour la cellule des Frankistes, ce n’est que frère Frank et
  // ses brochures qui comptent […] Ils veulent défendre frère Frank ».
  reflexions: { preacher: "CMPP" },
  // A death notice, not a work: it names a family, person by person, and the
  // model had lifted the names and their towns into the metadata. A draft is
  // not built, listed or indexed (Samuel, 2026-10-06: « we can keep the death
  // notice out »).
  // Its day is in a sentence: « Survenu le 6 septembre 2013, dans sa 89ème année. »
  faire_part_alexis_barilier: { status: "draft", date: "2013-09-06", summary: null, tags: null, persons: null, places: null },
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

// ─── A yearly exhortation is unsigned, and a draft until its author is known ─
let unsigned = 0;
for (const entry of manifest) {
  if (!/^(exhortation_)?annee_\d{4}/.test(entry.sermon_id) || (!entry.preacher && entry.status === "draft")) continue;
  delete entry.preacher;
  entry.status = "draft";
  const file = path.join(root, entry.local_md);
  fs.writeFileSync(file, setField(dropField(fs.readFileSync(file, "utf8"), "preacher"), "status", "draft"));
  unsigned++;
}

// ─── A date and a place are what the PDF prints ─────────────────────────────
let dates = 0, places = 0;
for (const entry of manifest) {
  const file = path.join(root, entry.local_md);
  const before = fs.readFileSync(file, "utf8");
  let text = before;
  // A work whose text is its page of cmpp.ch (goal 31) has that page's header for its date and place (43): the page is the better witness.
  if (entry.html_url) continue;
  const pdf = extraction(entry.sermon_id);
  if (entry.date && !CORRECTIONS[entry.sermon_id]?.date && !field(frontmatter(before), "duplicate_of")) {
    const printed = printedDate(entry.sermon_id, entry.date, pdf);
    if (printed !== entry.date) {
      text = printed ? setField(text, "date", printed) : dropField(text, "date");
      if (printed) entry.date = printed; else delete entry.date;
      dates++;
    }
  }
  if (entry.location && !printsPlace(entry.location, pdf)) { text = dropField(text, "location"); delete entry.location; places++; }
  if (text !== before) fs.writeFileSync(file, text);
}

// A duplicate says what its keeper says
const byRef = new Map(manifest.map((e) => [e.local_md.replace(/^markdown\/|\.md$/g, ""), e]));
for (const entry of manifest) {
  const file = path.join(root, entry.local_md);
  const text = fs.readFileSync(file, "utf8");
  const keeper = byRef.get(field(frontmatter(text), "duplicate_of"));
  if (!keeper || (keeper.date ?? null) === (entry.date ?? null)) continue; // 12 writes « no date » as null
  fs.writeFileSync(file, keeper.date ? setField(text, "date", keeper.date) : dropField(text, "date"));
  if (keeper.date) entry.date = keeper.date; else delete entry.date;
  dates++;
}

const out = JSON.stringify(manifest, null, 2);
if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);
console.log(`${Object.keys(CORRECTIONS).length} works corrected from their own text, ${changed} frontmatters changed; ${titles} monthly summaries titled with their month; ${dates} dates and ${places} places set to what the PDF prints; ${unsigned} yearly exhortations made unsigned drafts`);
