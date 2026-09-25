#!/usr/bin/env node
// Put back the preacher's wording of the French citations that 65 used to
// rewrite into canonical form ("Math. 24, 6" → "Matthieu 24:6", "Esaïe 35" →
// "Ésaïe 35"), from each work's source, as 65b does for Branham.
//
// A citation whose text is exactly its canonical ref is looked up in the
// source by the two words before it and the three after it. Where that finds
// one spot, and 65 reads the source's wording there as the same ref, the
// wording goes back into the text. Nothing else changes. A spot found zero or
// several times, or worded in a way 65 reads differently, goes to
// manifests/french-citations-unaligned.json with its context. A citation the
// preacher wrote in canonical form himself is found as written and stays.
//
// Sources:
//   mevar       the Ghost export's post html, by slug
//   le-scribe   the PDF in pdf_url: node scripts/20-download-pdfs.mjs manifests/le-scribe.json
//
// Usage: node scripts/65c-restore-french-citations.mjs [export.json]
// Then rerun 65, 47 and 50.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { quotePattern as pattern, before2, after3 } from "./bible-books.mjs";
import { citations } from "./65-normalize-bible.mjs";
import { resolveGhostExport } from "./ghost-export.mjs";

const root = path.resolve(import.meta.dirname, "..");

const ghost = new Map(
  JSON.parse(fs.readFileSync(resolveGhostExport(root), "utf8")).db[0].data.posts.map((p) => [p.slug, p]),
);
const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&apos;": "'", "&#39;": "'", "&quot;": '"', "&gt;": ">" };
// Block tags part words, inline tags do not ("<em>Dieu</em>," is "Dieu,").
const htmlText = (html) => html
  .replace(/<\/?(?:p|br|h\d|li|ul|ol|blockquote|div|figure|hr)\b[^>]*>/g, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);

const pdfRoot = path.join(root, "pdfs/le-scribe");
// 20-download-pdfs.mjs files a PDF under the manifest's year, which is not
// always the markdown's directory.
const pdfs = new Map(fs.readdirSync(pdfRoot, { recursive: true }).map((p) => [path.basename(p, ".pdf"), path.join(pdfRoot, p)]));
const pdfText = (pdf) => execFileSync(path.join(root, "node_modules/.bin/lit"), ["parse", "--no-ocr", "-q", pdf], { encoding: "utf8", maxBuffer: 1 << 26 });

const SOURCES = {
  mevar: (id) => htmlText(ghost.get(id).html),
  "le-scribe": (id) => pdfText(pdfs.get(id)),
};

// Our text loses its markdown (links, quote and heading marks, emphasis; an
// escaped "\_" is a real underscore) and Le Scribe's paragraph numbers
// ("**133.**"), which its PDF gives as a span ("§133 à 141-"). The source
// keeps every character it has, so a span is always its own wording.
const unmark = (s) => s
  .replace(/^\*\*\d+\.\*\* ?/gm, "")
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/^[ \t]*(?:>|#+)[ \t]?/gm, "")
  .replace(/(?<!\\)[*_]/g, "")
  .replace(/\\(.)/g, "$1");
// Both sides: quotes may be curly on one side and straight on the other, and
// a range the PDF broke across two lines ("15:21-" / "28") is one range.
const flat = (s) => s
  .replace(/§\d+(?: à \d+)?- ?/g, "")
  .replace(/\s+/g, " ")
  .replace(/(\d)- (\d)/g, "$1-$2");
const norm = (s) => flat(unmark(s));
const context = (text, at, spot) => flat(unmark(text.slice(Math.max(0, at - 80), at + spot.length + 60))).trim();

// The refs 65 records around a spot: a restored citation must leave them as
// they were, the spoken ones it may be part of included ("le chapitre 3 de
// Jean 4" is Jean 3 and Jean 4; "de Jn 4" is only Jean 4).
const refsNear = (text, at, length) =>
  [...citations(text.slice(Math.max(0, at - 200), at + length + 200))].map((c) => c.ref).sort().join("|");

// One pass over a body: every canonical citation, from the end so the indexes
// hold. The anchors are whole words, and every place they occur is counted,
// overlapping ones included (the lookahead). The span may not contain its own
// anchor, or where a preacher repeats a phrase a lazy span would start at the
// earlier repetition.
function restore(body, source, tally) {
  let out = body;
  const canonical = [...citations(body)].filter((c) => c.text === c.ref).sort((a, b) => b.index - a.index);
  for (const { index, text: spot, ref } of canonical) {
    const before = pattern(before2(body, index, norm));
    const after = pattern(after3(body, index + spot.length, norm));
    const re = new RegExp(`(?<![\\p{L}\\d])(?=${before} ?((?:(?!${before}).){1,60}?) ?${after}(?![\\p{L}\\d]))`, "gu");
    const found = [...source.matchAll(re)];
    const span = found.length === 1 ? found[0][1].trim() : null;
    // The span may end on punctuation our text lost: the opening quote of a
    // reading the markdown made a blockquote ("Jean 4:46-54 “").
    const cite = span && [...citations(span)].find((c) => c.index === 0 && c.ref === ref && !/[\p{L}\d]/u.test(span.slice(c.text.length)));
    const next = cite && out.slice(0, index) + cite.text + out.slice(index + spot.length);
    if (cite?.text === spot) tally.written++;
    else if (cite && refsNear(next, index, cite.text.length) === refsNear(out, index, spot.length)) {
      out = next;
      tally.restored++;
    } else tally.left.push({ spot, source: span, matches: found.length, context: context(body, index, spot) });
  }
  return out;
}

const unaligned = [];
for (const [name, sourceOf] of Object.entries(SOURCES)) {
  let files = 0, restored = 0, written = 0, left = 0;
  const dir = path.join(root, "markdown", name);
  for (const rel of fs.readdirSync(dir, { recursive: true }).filter((p) => p.endsWith(".md")).sort()) {
    const file = path.join(dir, rel);
    const text = fs.readFileSync(file, "utf8");
    const [, fm, body] = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    if (![...citations(body)].some((c) => c.text === c.ref)) continue;
    const source = flat(sourceOf(path.basename(file, ".md")));

    // A restored citation can be the anchor of the one next to it, so passes
    // repeat until nothing moves; the counts are the last pass's.
    let out = body, prev, tally, fileRestored = 0;
    do {
      prev = out;
      tally = { restored: 0, written: 0, left: [] };
      out = restore(out, source, tally);
      fileRestored += tally.restored;
    } while (out !== prev);

    restored += fileRestored;
    written += tally.written;
    left += tally.left.length;
    unaligned.push(...tally.left.map((l) => ({ file: path.relative(root, file), ...l })));
    if (out !== body) {
      fs.writeFileSync(file, fm + out);
      files++;
    }
  }
  console.log(`${name}: restored ${restored} citations in ${files} files, ${written} already as written, ${left} not aligned`);
}

unaligned.sort((a, b) => a.file.localeCompare(b.file) || a.context.localeCompare(b.context));
fs.writeFileSync(path.join(root, "manifests/french-citations-unaligned.json"), JSON.stringify(unaligned, null, 2));
console.log(`→ manifests/french-citations-unaligned.json (${unaligned.length})`);
