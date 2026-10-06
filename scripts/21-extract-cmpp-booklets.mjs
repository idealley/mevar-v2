#!/usr/bin/env node
// The CMPP's A5 PDFs are booklets ready for the printer: each PDF page is a
// landscape sheet (`Page rot: 90`) with two A5 pages side by side, in
// printing order (8 pages: 8|1, 2|7, 6|3, 4|5). A page-wide parse (LiteParse)
// reads across the sheet and interleaves the two pages line by line.
//
// Here each half-sheet is extracted on its own (pdftotext -layout, cropped)
// and the halves are put in reading order by the imposition. The page number
// printed at the foot of a half, where there is one, must be the one the
// imposition gives it, or differ from it by one same number on every page
// (unnumbered cover pages): anything else stops the run. A word the PDF
// hyphenates at a line end (a soft hyphen) is joined.
//
// For every entry of manifests/cmpp.json whose PDF (pdfs/cmpp/, from 20) is
// such a booklet: the text goes to .parse-cache/cmpp/<id>.txt (gitignored),
// where 75 reads it; a work with no markdown yet gets it as its raw body,
// for 72 to clean. A text already in .parse-cache/ is not extracted again.
//
// Usage: node scripts/21-extract-cmpp-booklets.mjs   (after 20; needs
// pdfinfo and pdftotext: brew install poppler)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cache = path.join(root, ".parse-cache/cmpp");
fs.mkdirSync(cache, { recursive: true });

// 20 files a PDF under the year the manifest had when it ran, and 73 may have changed that year since.
const pdfs = new Map(fs.readdirSync(path.join(root, "pdfs/cmpp"), { recursive: true }).filter((f) => f.endsWith(".pdf")).map((f) => [path.basename(f, ".pdf"), path.join(root, "pdfs/cmpp", f)]));

let extracted = 0, staged = 0, booklets = 0;
for (const entry of JSON.parse(fs.readFileSync(path.join(root, "manifests/cmpp.json"), "utf8"))) {
  const id = entry.sermon_id, pdf = pdfs.get(id);
  const info = execFileSync("pdfinfo", [pdf]).toString();
  // A folded tract (`_traite`) is a landscape sheet too, in three columns: not a booklet, and left to its plain twin.
  if (!/^Page rot:\s+90$/m.test(info) || id.endsWith("_traite")) continue;
  booklets++;
  const out = path.join(cache, `${id}.txt`);
  if (!fs.existsSync(out)) {
    const sheets = Number(info.match(/^Pages:\s+(\d+)/m)[1]);
    const [w, h] = info.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m).slice(1).map(Number);
    const half = Math.round(Math.max(w, h) / 2), height = Math.round(Math.min(w, h));
    const pages = [], offsets = new Set();
    for (let i = 0; i < sheets; i++) {
      // sheet 1 holds the last page and the first, sheet 2 the second and the one before last, and so on
      const [left, right] = i % 2 === 0 ? [2 * sheets - i, i + 1] : [i + 1, 2 * sheets - i];
      for (const [n, x] of [[left, 0], [right, half]]) {
        const text = execFileSync("pdftotext", ["-layout", "-f", i + 1, "-l", i + 1, "-x", x, "-y", 0, "-W", half, "-H", height, pdf, "-"].map(String)).toString().replace(/\f/g, "");
        pages[n] = text;
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const printed = [lines.at(-1), lines[0]].map((l) => l?.match(/^(\d{1,3})$|\s(\d{1,3})$|^(\d{1,3})\s/)).filter(Boolean).map((m) => Number(m[1] ?? m[2] ?? m[3]));
        if (printed.length && !printed.includes(n)) offsets.add(n - printed[0]);
      }
    }
    if (offsets.size > 1) throw new Error(`${id}: the printed page numbers do not follow the imposition (offsets ${[...offsets].join(", ")})`);
    fs.writeFileSync(out, pages.filter((t) => t?.trim()).join("\n").replace(/­\n[ \t]*/g, ""));
    extracted++;
  }
  const md = path.join(root, entry.local_md ?? `markdown/cmpp/${entry.year ?? "undated"}/${id}.md`);
  if (!fs.existsSync(md)) { fs.mkdirSync(path.dirname(md), { recursive: true }); fs.copyFileSync(out, md); staged++; }
}
console.log(`${booklets} booklets: ${extracted} extracted to .parse-cache/cmpp/, ${staged} staged as a raw body`);
