#!/usr/bin/env node
// Put back the words that old normalizer runs replaced with book names in the
// English Branham transcripts, using each sermon's branham.org PDF.
//
// Before goal 02, 65 (French) also ran over markdown/branham and wrote
// "it Ésaïe 65" for "it is. 65"; 66 wrote "Job 9" for "that's my job. 9".
// Our text cannot tell "is. 65" from "is 65" any more; the PDF can.
//
// Two passes per file, both anchored on the two words before a spot and the
// words after it, which must be found exactly once in the PDF text:
//   1. "<book name> <number>" where the name is French (never right in an
//      English sermon) or the PDF's word ends a sentence: the name goes back
//      to the PDF's word(s).
//   2. Every citation 66 used to write in canonical form ("John 5:24"): the
//      span goes back to what the PDF says ("Saint John 5:24", "First
//      Corinthians 13"), when that starts with the same book. The preacher's
//      words stay; 66 maps them to the canonical ref.
// Nothing else in the text changes. French names that cannot be aligned go to
// manifests/branham-restore-unaligned.json.
//
// Needs the PDFs: node scripts/20-download-pdfs.mjs manifests/branham-<year>.json
// Run after 65, before 66.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BOOKS_FR, BOOKS_EN, escRe } from "./bible-books.mjs";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown/branham");
const pdfRoot = path.join(root, "pdfs/branham");

const EN = new Set(BOOKS_EN.map((row) => row[0]));
const EN_OF = new Map(BOOKS_EN.flatMap((row) => row.map((v) => [v.toLowerCase(), row[0]])));
const VARIANTS = [...EN_OF.keys()].sort((a, b) => b.length - a.length);
const FR_ONLY = new Set(BOOKS_FR.map((row) => row[0]).filter((name) => !EN.has(name)));
const NAME_RE = new RegExp(
  `(?<!\\p{L})(${[...FR_ONLY, ...EN].sort((a, b) => b.length - a.length).map(escRe).join("|")}) (\\d{1,3}(?::\\d{1,3}|st|nd|rd|th)?)(?![\\d\\p{L}])`,
  "gu",
);

// A citation in the canonical form 66 used to write into the text.
const CITE_RE = new RegExp(
  `(?<!\\p{L})(${[...EN].sort((a, b) => b.length - a.length).map(escRe).join("|")}) \\d{1,3}(?::\\d{1,3}(?:-\\d{1,3})?(?:,\\d{1,3}(?:-\\d{1,3})?)*)?(?![\\d\\p{L}])`,
  "gu",
);
const bookOf = (span) => EN_OF.get(VARIANTS.find((v) => span.toLowerCase().startsWith(v + " ")));

// Our text has markdown emphasis and the PDF does not; quotes may be curly on
// one side and straight on the other.
const flat = (s) => s.replace(/\*+/g, "").replace(/\s+/g, " ");
const pattern = (s) => escRe(s).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]');

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (p.endsWith(".md")) yield p;
  }
}

const before2 = (text, at) => flat(text.slice(Math.max(0, at - 300), at)).trimEnd().split(" ").slice(-2).join(" ");
const after3 = (text, at) => flat(text.slice(at, at + 300)).trimStart().split(" ").slice(0, 3).join(" ");

// Pass 1: a book name that is French, or where the PDF ends a sentence.
function restoreNames(text, source, left) {
  let out = text;
  for (const hit of [...text.matchAll(NAME_RE)].reverse()) {
    const [spot, name, number] = hit;
    const before = before2(text, hit.index);
    // Skip the period our text puts after a paragraph number ("80. And").
    const end = hit.index + spot.length;
    const after = after3(text, text[end] === "." ? end + 1 : end);
    // The PDF may carry a page footer between the word and the paragraph number.
    const re = new RegExp(`${pattern(before)} (\\S+(?: \\S+)?) (?:\\d{1,3} THE SPOKEN WORD )?${escRe(number)}\\.? ${pattern(after)}`, "g");
    const found = [...source.matchAll(re)];
    const word = found.length === 1 ? found[0][1] : null;
    if (word && word !== name && (FR_ONLY.has(name) || word.endsWith("."))) {
      out = out.slice(0, hit.index) + word + out.slice(hit.index + name.length);
      restored++;
    } else if (!word && FR_ONLY.has(name)) {
      left.push({ spot, context: flat(text.slice(Math.max(0, hit.index - 80), hit.index + spot.length + 60)).trim() });
    }
  }
  return out;
}

// Pass 2: a citation in canonical form goes back to how the PDF says it. The
// span may not contain its own anchor: where Branham repeats himself ("Acts
// 2:4, Acts 2:4, Acts 2:4") a lazy span would otherwise start at an earlier
// repetition and copy it in a second time.
function restoreCitations(text, source) {
  let out = text;
  for (const hit of [...text.matchAll(CITE_RE)].reverse()) {
    const [spot, name] = hit;
    const before = pattern(before2(text, hit.index));
    const after = pattern(after3(text, hit.index + spot.length));
    const found = [...source.matchAll(new RegExp(`${before} ((?:(?!${before}).){1,60}?) ?${after}`, "g"))];
    const span = found.length === 1 ? found[0][1].trim() : null;
    if (span && span !== spot && !span.includes("THE SPOKEN WORD") && bookOf(span) === name) {
      out = out.slice(0, hit.index) + span + out.slice(hit.index + spot.length);
      restored++;
    }
  }
  return out;
}

const mdFiles = [...walk(mdRoot)];
// 20-download-pdfs.mjs files a PDF under the manifest's year, which is not
// always the markdown's directory. All are checked before any file is written.
const years = fs.readdirSync(pdfRoot);
const pdfOf = new Map(mdFiles.map((f) => {
  const id = path.basename(f, ".md");
  return [f, years.map((y) => path.join(pdfRoot, y, `${id}.pdf`)).find((p) => fs.existsSync(p))];
}));
const missing = mdFiles.filter((f) => !pdfOf.get(f));
if (missing.length) {
  console.error(`${missing.length} Branham PDFs missing: run scripts/20-download-pdfs.mjs first`);
  process.exit(1);
}

let files = 0, restored = 0;
const unaligned = [];

for (const file of mdFiles) {
  const text = fs.readFileSync(file, "utf8");
  const [, fm, body] = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (!NAME_RE.test(body)) continue;
  NAME_RE.lastIndex = 0;

  const source = flat(execFileSync(path.join(root, "node_modules/.bin/lit"), ["parse", "--no-ocr", "-q", pdfOf.get(file)], { encoding: "utf8", maxBuffer: 1 << 26 }));

  // A restored word can fix the context of the spot next to it, so the two
  // passes repeat until nothing moves; the run ends at its own fixed point.
  let out = body, prev, left;
  do {
    prev = out;
    left = [];
    out = restoreCitations(restoreNames(out, source, left), source);
  } while (out !== prev);
  unaligned.push(...left.map((l) => ({ file: path.relative(root, file), ...l })));

  if (out !== body) {
    fs.writeFileSync(file, fm + out);
    files++;
  }
}

unaligned.sort((a, b) => a.file.localeCompare(b.file) || a.context.localeCompare(b.context));
fs.writeFileSync(path.join(root, "manifests/branham-restore-unaligned.json"), JSON.stringify(unaligned, null, 2));

console.log(`restored ${restored} words in ${files} Branham files from their branham.org PDFs`);
console.log(`French book names left, not aligned with the PDF: ${unaligned.length} → manifests/branham-restore-unaligned.json`);
