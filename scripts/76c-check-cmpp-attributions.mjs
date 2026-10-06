#!/usr/bin/env node
// Read-only: each CMPP work's `preacher`, `date` and `location` against what
// its PDF prints (goal 16; the three came from the LLM pass, which was asked
// to name an author, a date and a place for every text and did).
//
// An author is printed when the PDF signs: his name alone on a line (« EWALD
// FRANK », « William Marrion Branham », « A. Barilier »), « Missionnaire
// Ewald Frank », « Prédication de frère Ewald Frank », the speaker naming
// himself (« c’est frère Frank qui vous parle »), or the editor naming whose
// text he introduces (« ce nouvel écrit de notre frère M’Bra Parfait »). A
// name inside a sentence is someone the text speaks of (« notre frère Ewald
// Frank a enseigné »), and names no author.
//
// Per work, the worst of its three fields:
//   contradicted   the PDF is signed by another than the work's preacher;
//   not printed    the PDF is not signed, or the date is more than it
//                  prints, or it does not print the place;
//   confirmed      everything the frontmatter says, the PDF prints.
// 76b applies what follows for dates and places (a date is what the PDF
// prints, a place it does not print goes); an author is corrected by hand in
// 76b's table, after reading the line this report gives. An issue of the
// circular letters or of the monthly summaries keeps its author where it is
// not signed: Ewald Frank writes the first in the first person (« il m’a
// aussi dit: «Frère Frank, attends… » ») and speaks the second; a letter can
// carry a piece another signs (lc53, lc55), which does not make it his.
//
//   node scripts/76c-check-cmpp-attributions.mjs

import fs from "node:fs";
import path from "node:path";
import { extraction, linesOf, printedDate, printsPlace } from "./cmpp-pdfs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const SERIES = /^(lc\d|lc_|(janvier|mars|juillet|octobre)1974|video_)/;

const AUTHORS = { "William Branham": "(william |w\\. ?)?(marrion |m\\. ?)?branham", "Ewald Frank": "(ewald |e\\. ?)?frank", "Alexis Barilier": "(alexis |a\\. ?)?barilier", "Parfait M'bra": "(parfait )?m[’' ]?bra( parfait)?" };
/** The line of a PDF that signs it for an author, among its first 40 lines, its last 40 and its short ones. */
function signature(name, lines) {
  const n = AUTHORS[name];
  const signs = [
    new RegExp(`^(par |de |du )?(frere |fr\\.? |rev\\.? )?${n}$`), // his name and no more
    new RegExp(`(missionnaire|pasteur) ${n}\\b`),
    new RegExp(`^predication de (frere )?${n}\\b`),
    new RegExp(`(c ?['’ ]?est|ici|votre) (votre )?frere ${n},? qui vous (parle|salue)`),
  ];
  // « cet extrait du livre écrit par notre frère en Christ et serviteur de Dieu M’Bra Parfait », over two lines
  const introduced = new RegExp(`(ecrit|etude) (de|par) notre frere[a-z ]{0,40}? ${n}\\b`);
  const where = [...lines.slice(0, 40), ...lines.slice(-40), ...lines.filter((l) => l.length <= 45)];
  // the speaker's sentence runs over two lines of the page
  return [...where, lines.slice(0, 15).join(" ")].find((l) => signs.some((re) => re.test(l))) ?? lines.slice(0, 40).join(" ").match(introduced)?.[0];
}

const counts = { confirmed: 0, "not printed": 0, contradicted: 0 };
for (const e of JSON.parse(fs.readFileSync(path.join(root, "manifests/cmpp.json"), "utf8"))) {
  const text = extraction(e.sermon_id), lines = linesOf(text), notes = [];
  let worst = "confirmed";
  const note = (state, what) => { notes.push(what); if (worst !== "contradicted") worst = state; };
  if (e.preacher && !signature(e.preacher, lines)) {
    const other = !SERIES.test(e.sermon_id) && Object.keys(AUTHORS).find((name) => name !== e.preacher && signature(name, lines));
    if (other) note("contradicted", `preacher ${e.preacher}, the PDF is signed ${other}: « ${signature(other, lines).slice(0, 80)} »`);
    else note("not printed", `preacher ${e.preacher}, the PDF is not signed${SERIES.test(e.sermon_id) ? " (a series)" : ""}`);
  }
  const date = e.date && printedDate(e.sermon_id, e.date, text);
  if (e.date && date !== e.date) note("not printed", `date ${e.date}, the PDF prints ${date ?? "none"}`);
  if (e.location && !printsPlace(e.location, text)) note("not printed", `location « ${e.location} » not printed`);
  counts[worst]++;
  if (worst !== "confirmed") console.log(`${worst.padEnd(12)} ${e.sermon_id}: ${notes.join("; ")}`);
}
console.log(Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join(", "));
