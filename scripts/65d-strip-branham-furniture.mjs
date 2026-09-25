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
import { escRe, quotePattern, before2, after3 } from "./bible-books.mjs";

const root = path.resolve(import.meta.dirname, "..");
const mdRoot = path.join(root, "markdown/branham");
const pdfRoot = path.join(root, "pdfs/branham");
const EVEN = "THE SPOKEN WORD";

// Our text has markdown (emphasis, blockquote and heading marks) and the PDF
// does not; quotes may be curly on one side and straight on the other, and our
// paragraph numbers may carry a period the PDF does not print.
const flat = (s) => s.replace(/^[ \t]*(?:>[ \t]*)+|^#{1,6}[ \t]+/gm, "").replace(/\*+/g, "").replace(/\s+/g, " ").replace(/(\d)- (\d)/g, "$1-$2");
const pattern = (s) => quotePattern(s).replace(/(^| )(\d+)\\\./g, "$1$2\\.?");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (p.endsWith(".md")) yield p;
  }
}

// The PDF's text and the titles of its running headers. Each header is
// marked (\u0001…\u0001) so that only a page's header, never the same words in
// the sermon, can confirm a spot.
function readPdf(pdf) {
  const { pages } = JSON.parse(execFileSync(path.join(root, "node_modules/.bin/lit"), ["parse", "--no-ocr", "-q", "--format", "json", pdf], { encoding: "utf8", maxBuffer: 1 << 28 }));
  const titles = new Set();
  const texts = pages.map((page, i) => {
    const [line, ...rest] = page.text.trim().split("\n");
    const flatLine = line.replace(/\s+/g, " ");
    const m = i > 0 && (flatLine.match(/^\d{1,3} (THE SPOKEN WORD)$/) ?? flatLine.match(/^([^a-z]*[A-Z][^a-z]*?) \d{1,3}$/));
    if (!m) return page.text;
    titles.add(m[1]);
    return `\u0001${flatLine}\u0001\n${rest.join("\n")}`;
  });
  return { source: flat(texts.join("\n")), titles };
}

// The page number the extractor left before or after a header, across the
// markdown and the line breaks it put between them.
const NUM_BEFORE = /(?<![\p{L}\d])(\d{1,3})\.?(?:\*\*)?[ \t\n]*(?:#{1,6}[ \t]+|>[ \t]*|\*\*)*$/u;
const NUM_AFTER = /^(?:\*\*)?[ \t\n]*(?:\*\*)?(\d{1,3})(?![\d\p{L}])/u;

// Each reading of one header spot: its span in our text and the page number it
// carries, if any. The PDF decides which reading, if any, is right.
function readings(text, hit, title) {
  const [spot] = hit;
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

// Where the PDF confirms a reading: the position of the one header the words
// either side frame, or -1.
function aligns(text, source, title, r) {
  const header = escRe(flat(title));
  const num = r.num ?? "\\d{1,3}";
  // The PDF prints the number first on even pages, last on odd ones.
  const printed = title === EVEN ? `${num} ${header}` : `${header} ${num}`;
  const before = before2(text, r.start, flat), after = after3(text, r.end, flat);
  const re = new RegExp(`${before ? `(?<![^ ])${pattern(before)} ` : ""}\u0001${printed}\u0001${after ? ` ${pattern(after)}(?![^ ])` : ""}`, "g");
  const found = [...source.matchAll(re)];
  return found.length === 1 ? found[0].index : -1;
}

// Remove a spot, with the markdown marks that shared its line with nothing
// else, and the blank line the page break left in a sentence that goes on.
// Null when the header shares an emphasis with the sermon's words: removing
// it would strand a "*", so the spot is listed instead.
function strip(text, { start, end }) {
  let s = start, e = end;
  // A page number in its own bold ("## COUNTDOWN / **17** atomic") goes whole.
  const numEnd = text.slice(s, e).match(/(\*+)\d{1,3}$/)?.[1];
  if (numEnd && text.startsWith(numEnd, e)) e += numEnd.length;
  const numStart = text.slice(s, e).match(/^\d{1,3}(\*+)/)?.[1];
  if (numStart && text.slice(0, s).endsWith(numStart)) s -= numStart.length;
  // Emphasis around the header alone ("**2 THE SPOKEN WORD** [A brother") goes.
  const wrap = text.slice(0, s).match(/\*+$/)?.[0];
  if (wrap && text.startsWith(wrap, e)) {
    s -= wrap.length;
    e += wrap.length;
  }
  const lineStart = text.lastIndexOf("\n", s - 1) + 1;
  if (/^[ \t*#>]*$/.test(text.slice(lineStart, s))) s = lineStart;
  const lineEnd = text.indexOf("\n", e) < 0 ? text.length : text.indexOf("\n", e);
  if (/^[ \t*]*$/.test(text.slice(e, lineEnd))) e = lineEnd;
  if ((text.slice(s, e).match(/\*/g) ?? []).length % 2 || text.slice(0, s).endsWith("*") !== text.startsWith("*", e)) return null;
  let i = s, j = e;
  while (i > 0 && /\s/.test(text[i - 1])) i--;
  while (j < text.length && /\s/.test(text[j])) j++;
  const gap = text.slice(i, s) + text.slice(e, j);
  const tail = text.slice(e, j);
  const indent = tail.includes("\n") ? tail.slice(tail.lastIndexOf("\n") + 1) : "";
  // The sentence goes on when the text after starts no paragraph and either
  // starts in lowercase or follows text that ends no sentence: "grass; /
  // there's", "generation, / Jesus", "Ephesians / 4:30". In these booklets a
  // paragraph after a page break opens with its number ("57 Every", "50e",
  // "**88b.**"); a quote or heading mark or an editor's bracket also starts
  // one, and a blockquote or heading line before is never continued.
  const lastLine = text.slice(text.lastIndexOf("\n", i - 1) + 1, i);
  const next = text.slice(j);
  const goesOn = !/^\s*[>#]/.test(lastLine) && !/^(?:\**\d+[a-z]?\.?\**\s|[>#[*_-])/.test(next) && (/^\p{Ll}/u.test(next) || !/[.!?…:]["”’)\]*_]*$/.test(lastLine));
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
  // not, may break one over lines or put emphasis inside it, write a straight apostrophe for a curly one
  // ("GOD'S"), or its book name in title case ("THE THIRD Exodus 25"): a title
  // matches with any spacing, either quote and any case, and a hit is read
  // back as the PDF's title.
  const bare = (t) => t.replace(/[\s*]+/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toUpperCase();
  const letter = (ch) => (ch === "'" ? "['‘’]" : ch === '"' ? '["“”]' : escRe(ch));
  const titleOf = new Map([...titles].map((t) => [bare(t), t]));
  const titleRe = new RegExp(`(?<![\\p{L}])(${[...titleOf.keys()].sort((a, b) => b.length - a.length).map((t) => [...t].map(letter).join("[ \\t*]*(?:\\n[ \\t*]*){0,2}")).join("|")})(?![\\p{L}])`, "giu");

  // Removing a header can give its neighbour the context it lacked, so the
  // pass repeats until nothing moves.
  let out = body, prev, left;
  do {
    prev = out;
    left = [];
    // First where each hit aligns, then the stripping: a PDF header that two
    // spots in our text both claim confirms neither (a quoted sentence can
    // repeat the words around a header), and both are listed.
    const plans = [];
    for (const hit of out.matchAll(titleRe)) {
      const title = titleOf.get(bare(hit[1]));
      const rs = readings(out, hit, title);
      // An odd-page title with no number is the sermon's own title, not a
      // header; so is one that opens the body (page 1 has no header).
      if (!rs.length || (title !== EVEN && !flat(out.slice(0, hit.index)).replace(/\d+\.?/g, "").trim())) continue;
      // Only a header printed in capitals goes; one in the sermon's case is
      // at most listed.
      const found = /\p{Ll}/u.test(hit[1]) ? [] : rs.map((r) => ({ r, at: aligns(out, source, title, r) })).filter((f) => f.at >= 0);
      plans.push({ hit, title, rs, found });
    }
    const claims = new Map();
    for (const { found } of plans) if (found.length === 1) claims.set(found[0].at, (claims.get(found[0].at) ?? 0) + 1);
    for (const { hit, title, rs, found } of plans.reverse()) {
      const cut = found.length === 1 && claims.get(found[0].at) === 1 && strip(out, found[0].r);
      if (cut) {
        out = cut;
        stripped[title === EVEN ? "even" : "odd"]++;
      } else if (!/\p{Ll}/u.test(hit[1]) || /\p{Lu}{2}/u.test(hit[1])) {
        // Listed when printed as a header, in capitals; a title that does not
        // align in the sermon's own words ("the spoken Word") is no header.
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
