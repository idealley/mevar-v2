#!/usr/bin/env node
// Take the printed page headers out of the Branham bodies. The PDF extractor
// merged them into the text: "18 THE SPOKEN WORD" on even pages, the sermon's
// title and the page number on odd pages ("AN EXODUS 19", "QUES TIONS A ND
// ANSWERS ON GENESIS 21"). A reader meets them in the middle of a sentence and
// 66 reads "EXODUS 19" as a reference.
//
// The headers come from the sermon's branham.org PDF: the first line of every
// page after the first. A spot in our text goes only where the two words before
// it and the three after it frame that header, with the same page number,
// exactly once in the PDF text. The header, its page number and the markdown
// wrapped around them (bold, a heading mark) go; a sentence the page broke in
// two is joined again. No word of the sermon and no paragraph number changes.
// A spot that does not align is listed in
// manifests/branham-furniture-unaligned.json.
//
// Needs the PDFs: node scripts/20-download-pdfs.mjs manifests/branham-<year>.json
// Run after 65b, before 66.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { escRe } from "./bible-books.mjs";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown/branham");
const pdfRoot = path.join(root, "pdfs/branham");
const EVEN = "THE SPOKEN WORD";

// Our text has markdown (emphasis, blockquote and heading marks) and the PDF
// does not; quotes may be curly on one side and straight on the other, and our
// paragraph numbers may carry a period the PDF does not print.
const flat = (s) => s.replace(/^[ \t]*(?:>[ \t]*)+|^#{1,6}[ \t]+/gm, "").replace(/\*+/g, "").replace(/\s+/g, " ").replace(/(\d)- (\d)/g, "$1-$2");
const pattern = (s) => escRe(s).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]').replace(/(^| )(\d+)\\\./g, "$1$2\\.?");
const before2 = (text, at) => flat(text.slice(Math.max(0, at - 300), at)).trimEnd().split(" ").slice(-2).join(" ");
const after3 = (text, at) => flat(text.slice(at, at + 300)).trimStart().split(" ").slice(0, 3).join(" ");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (p.endsWith(".md")) yield p;
  }
}

// The PDF's text and the titles of its running headers.
function readPdf(pdf) {
  const { pages } = JSON.parse(execFileSync(path.join(root, "node_modules/.bin/lit"), ["parse", "--no-ocr", "-q", "--format", "json", pdf], { encoding: "utf8", maxBuffer: 1 << 28 }));
  const titles = new Set();
  for (const page of pages.slice(1)) {
    const line = page.text.trim().split("\n")[0].replace(/\s+/g, " ");
    const m = line.match(/^\d{1,3} (THE SPOKEN WORD)$/) ?? line.match(/^([^a-z]*[A-Z][^a-z]*?) \d{1,3}$/);
    if (m) titles.add(m[1]);
  }
  return { source: flat(pages.map((p) => p.text).join("\n")), titles };
}

// The page number the extractor left before or after a header, across the
// markdown and the line breaks it put between them.
const NUM_BEFORE = /(?<![\p{L}\d])(\d{1,3})\.?(?:\*\*)?[ \t\n]*(?:#{1,6}[ \t]+|>[ \t]*|\*\*)*$/u;
const NUM_AFTER = /^(?:\*\*)?[ \t\n]*(?:\*\*)?(\d{1,3})(?![\d\p{L}])/u;

// Each reading of one header spot: its span in our text and the page number it
// carries, if any. The PDF decides which reading, if any, is right.
function readings(text, hit) {
  const [spot, title] = hit;
  const start = hit.index, end = start + spot.length;
  const out = [];
  const b = text.slice(Math.max(0, start - 200), start).match(NUM_BEFORE);
  if (b) out.push({ start: start - b[0].length, end, num: b[1] });
  const a = text.slice(end, end + 200).match(NUM_AFTER);
  if (a) out.push({ start, end: end + a[0].length, num: a[1] });
  // An even header whose number the extractor dropped.
  if (title === EVEN) out.push({ start, end, num: null });
  return out;
}

function aligns(text, source, title, r) {
  const header = flat(title).split(" ").map(escRe).join(" ");
  const num = r.num ?? "\\d{1,3}";
  // The PDF prints the number first on even pages, last on odd ones.
  const printed = title === EVEN ? `${num} ${header}` : `${header} ${num}`;
  const re = new RegExp(`${pattern(before2(text, r.start))} ${printed} ${pattern(after3(text, r.end))}`, "g");
  return [...source.matchAll(re)].length === 1;
}

// Remove a spot with the markdown around it on its own line, and the blank
// line the page break left in a sentence that goes on.
function strip(text, { start, end }) {
  let s = start, e = end;
  while (s > 0 && /[ \t*#>]/.test(text[s - 1])) s--;
  while (e < text.length && /[ \t*]/.test(text[e])) e++;
  // Emphasis marks go only when they wrap the header alone.
  if ((text.slice(s, e).match(/\*/g) ?? []).length % 2) {
    s = start;
    e = end;
  }
  let i = s, j = e;
  while (i > 0 && /\s/.test(text[i - 1])) i--;
  while (j < text.length && /\s/.test(text[j])) j++;
  const gap = text.slice(i, s) + text.slice(e, j);
  const tail = text.slice(e, j);
  const indent = tail.includes("\n") ? tail.slice(tail.lastIndexOf("\n") + 1) : "";
  // The sentence goes on in lowercase, or with a verse, an ordinal or a list
  // ("Ephesians / 4:30", "the / 15th verse", "32, / 33, 34"); a new paragraph
  // starts with a capital or with its number ("57 Every", "50e", "88b.").
  const goesOn = /^(?:\p{Ll}|\d+(?::\d|st\b|nd\b|rd\b|th\b|,))/u.test(text.slice(j));
  const sep = !gap.includes("\n") ? " " : /\n[ \t]*\n/.test(gap) && !goesOn ? "\n\n" : "\n";
  return text.slice(0, i) + (i && j < text.length ? sep + indent : "") + text.slice(j);
}

const mdFiles = [...walk(mdRoot)];
// 20-download-pdfs.mjs files a PDF under the manifest's year, which is not
// always the markdown's directory.
const years = fs.readdirSync(pdfRoot);
const pdfOf = (f) => years.map((y) => path.join(pdfRoot, y, `${path.basename(f, ".md")}.pdf`)).find((p) => fs.existsSync(p));
const missing = mdFiles.filter((f) => !pdfOf(f));
if (missing.length) {
  console.error(`${missing.length} Branham PDFs missing: run scripts/20-download-pdfs.mjs first`);
  process.exit(1);
}

let files = 0;
const stripped = { even: 0, odd: 0 };
const unaligned = [];

for (const file of mdFiles) {
  const text = fs.readFileSync(file, "utf8");
  const [, fm, body] = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);

  const { source, titles } = readPdf(pdfOf(file));
  if (!titles.size) continue;
  // The PDF spaces some titles out ("THE PR ESENCE OF"), our text often does
  // not: a title matches with any spacing between its letters, and a hit is
  // read back as the PDF's title.
  const bare = (t) => t.replace(/\s+/g, "");
  const titleOf = new Map([...titles].map((t) => [bare(t), t]));
  const titleRe = new RegExp(`(?<![\\p{L}])(${[...titleOf.keys()].sort((a, b) => b.length - a.length).map((t) => [...t].map(escRe).join("[ \\t]*")).join("|")})(?![\\p{L}])`, "gu");

  // Removing a header can give its neighbour the context it lacked, so the
  // pass repeats until nothing moves.
  let out = body, prev, left;
  do {
    prev = out;
    left = [];
    for (const hit of [...out.matchAll(titleRe)].reverse()) {
      const title = titleOf.get(bare(hit[1]));
      const rs = readings(out, hit);
      // An odd-page title with no number is the sermon's own title, not a
      // header; so is one that opens the body (page 1 has no header).
      if (!rs.length || (title !== EVEN && !flat(out.slice(0, hit.index)).replace(/\d+\.?/g, "").trim())) continue;
      const ok = rs.filter((r) => aligns(out, source, title, r));
      if (ok.length === 1) {
        out = strip(out, ok[0]);
        stripped[title === EVEN ? "even" : "odd"]++;
      } else {
        const at = rs[0];
        left.push({ spot: flat(out.slice(at.start, at.end)).trim(), context: flat(out.slice(Math.max(0, at.start - 80), at.end + 60)).trim() });
      }
    }
  } while (out !== prev);
  unaligned.push(...left.map((l) => ({ file: path.relative(root, file), ...l })));

  if (out !== body) {
    fs.writeFileSync(file, fm + out);
    files++;
  }
}

unaligned.sort((a, b) => a.file.localeCompare(b.file) || a.context.localeCompare(b.context));
fs.writeFileSync(path.join(root, "manifests/branham-furniture-unaligned.json"), JSON.stringify(unaligned, null, 2) + "\n");

console.log(`stripped ${stripped.even} even-page and ${stripped.odd} odd-page headers in ${files} Branham files`);
console.log(`headers left, not aligned with the PDF: ${unaligned.length} → manifests/branham-furniture-unaligned.json`);
