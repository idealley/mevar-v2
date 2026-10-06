#!/usr/bin/env node
// Read-only: each CMPP work's `preacher`, `date` and `location` against what
// its PDF prints (goal 16; the three came from the LLM pass, which was asked
// to name an author, a date and a place for every text and did).
//
// Per work, the worst of its three fields:
//   contradicted   the PDF names another author where an author is named;
//   not printed    the author is named nowhere at the head or the end, or
//                  the date is more than the PDF prints, or no name of the
//                  place is in it;
//   confirmed      everything the frontmatter says, the PDF prints.
// 76b applies what follows for dates and places (a date is what the PDF
// prints, a place it does not print goes); an author is corrected by hand in
// 76b's table, after reading the line this report gives. A work of a series
// whose issues are signed keeps its author where one issue does not name him.
//
//   node scripts/76c-check-cmpp-attributions.mjs [--all]   (--all: every work, not the counts and the doubtful ones)

import fs from "node:fs";
import path from "node:path";
import { extraction, printedAuthor, printedDate, printsPlace } from "./cmpp-pdfs.mjs";

const root = path.resolve(import.meta.dirname, "..");
// The circular letters, the monthly summaries, the yearly exhortations, the booklets of « La Parole parlée »
const SERIES = /^(lc\d|lc_|(janvier|mars|juillet|octobre)1974|video_|annee_|exhortation_annee_|serie\d|rev\d|7sceaux)/;

const counts = { confirmed: 0, "not printed": 0, contradicted: 0 };
for (const e of JSON.parse(fs.readFileSync(path.join(root, "manifests/cmpp.json"), "utf8"))) {
  const text = extraction(e.sermon_id), notes = [];
  let worst = "confirmed";
  const note = (state, what) => { notes.push(what); if (worst !== "contradicted") worst = state; };
  if (e.preacher) {
    const [state, line] = printedAuthor(e.preacher, text);
    if (state === "contradicted") note(state, `preacher ${e.preacher}, the PDF names ${line}`);
    else if (state === "not printed") note(state, `preacher ${e.preacher} not printed${SERIES.test(e.sermon_id) ? " (a series)" : ""}`);
  }
  if (e.date && printedDate(e.sermon_id, e.date, text) !== e.date) note("not printed", `date ${e.date}, the PDF prints ${printedDate(e.sermon_id, e.date, text) ?? "none"}`);
  if (e.location && !printsPlace(e.location, text)) note("not printed", `location « ${e.location} » not printed`);
  counts[worst]++;
  if (worst !== "confirmed" || process.argv.includes("--all")) console.log(`${worst.padEnd(12)} ${e.sermon_id}${notes.length ? `: ${notes.join("; ")}` : ""}`);
}
console.log(Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join(", "));
