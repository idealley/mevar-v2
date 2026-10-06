#!/usr/bin/env node
// Fourteen CMPP PDFs (« Sommaire des rencontres », October 2012 to February
// 2014) are set in a font that maps no apostrophe, dash, quotation mark,
// ellipsis or « œ » to a character: their text layer reads « c est »,
// « s urs », « Krefeld  Allemagne ». The letters are right, the signs are
// lost, and each left a space.
//
// Here the letters come from the text layer (pdftotext -layout) and the lost
// signs from an OCR of the pages (pdftoppm at 300 dpi, then Tesseract.js in
// French, the engine LiteParse uses and brings with it), page by page,
// aligned letter by letter. A gap of the text layer takes what the OCR sees
// there only when that is the layer's own punctuation plus such signs: none
// of the OCR's letters is kept. « S OMMAIRE », a small capital the layer
// spaces, is joined where the OCR reads one word.
//
// What the OCR could not settle is in scripts/cmpp-extraction-fixes.json,
// read by hand from the page: per work, an exact passage of the result and
// what the page prints.
//
// For every entry of manifests/cmpp.json whose PDF (pdfs/cmpp/, from 20) has
// lost its apostrophes: the text goes to .parse-cache/cmpp/<id>.txt
// (gitignored), where 75 and 76b read it. A text already there is not
// extracted again.
//
// Usage: node scripts/22-extract-cmpp-lost-signs.mjs   (after 20; needs
// pdftotext and pdftoppm: brew install poppler. The first run downloads
// Tesseract's French model into .parse-cache/.)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createWorker } from "tesseract.js";
import { cache, pdfs } from "./cmpp-pdfs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const fixes = JSON.parse(fs.readFileSync(path.join(root, "scripts/cmpp-extraction-fixes.json"), "utf8"));

// More elisions with a space (« c est », « qu il ») than apostrophes in the whole text
const lostSigns = (text) => (text.match(/(?<!\p{L})(?:[cdjlmnst]|qu) [aeéèêiouyh]/giu) ?? []).length > Math.max(10, (text.match(/[’']/g) ?? []).length);

const SIGNS = /[’'‘—–\-«»“”"… ]|\.\.\.|œ|oe|Œ|OE/g;
const letters = (t) => [...t].flatMap((c, i) => (/[\p{L}\p{N}]/u.test(c) ? [i] : []));
// The longest common subsequence of two strings of letters, as pairs of positions
function lcs(a, b) {
  const n = a.length, m = b.length, W = m + 1, d = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) d[i * W + j] = a[i] === b[j] ? d[(i + 1) * W + j + 1] + 1 : Math.max(d[(i + 1) * W + j], d[i * W + j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (d[(i + 1) * W + j] >= d[i * W + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** One page: the text layer `P` with the signs the OCR `O` sees in its gaps. */
function withSigns(P, O) {
  const ip = letters(P), io = letters(O);
  const pairs = lcs(ip.map((i) => P[i].toLowerCase()), io.map((i) => O[i].toLowerCase()));
  const gaps = new Map(); // where a gap of P starts → [where it ends, what replaces it]
  for (let k = 0; k + 1 < pairs.length; k++) {
    const [a, x] = pairs[k], [b, y] = pairs[k + 1];
    if (b !== a + 1) continue; // between two letters that follow one another in the text layer
    const sp = P.slice(ip[a] + 1, ip[b]), so = O.slice(io[x] + 1, io[y]);
    if (!sp.includes(" ") || /\n/.test(sp + so)) continue; // a lost sign leaves a space, on one line
    const seen = so.replace(/ +/g, " ");
    if (sp.replace(SIGNS, "") === so.replace(SIGNS, "") && seen.trim() !== sp.replace(/ +/g, " ").trim()) gaps.set(ip[a] + 1, [ip[b], seen.replace(/['‘]/g, "’").replace(/oe/g, "œ").replace(/OE/g, "Œ")]);
    else if (y === x + 1 && so === "" && /^\p{Lu}$/u.test(P[ip[a]]) && (a === 0 || ip[a - 1] !== ip[a] - 1) && /\p{Lu}/u.test(P[ip[b]])) gaps.set(ip[a] + 1, [ip[b], ""]);
  }
  let text = "";
  for (let i = 0; i < P.length; ) { const gap = gaps.get(i); if (gap) { text += gap[1]; i = gap[0]; } else text += P[i++]; }
  return text;
}

let found = 0, extracted = 0, ocr;
for (const entry of JSON.parse(fs.readFileSync(path.join(root, "manifests/cmpp.json"), "utf8"))) {
  const id = entry.sermon_id, pdf = pdfs.get(id);
  if (!lostSigns(execFileSync("pdftotext", [pdf, "-"], { maxBuffer: 1 << 28 }).toString())) continue;
  found++;
  const out = path.join(cache, `${id}.txt`);
  if (fs.existsSync(out)) continue;
  ocr ??= await createWorker("fra", 1, { cachePath: path.join(root, ".parse-cache") });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cmpp-pages-"));
  execFileSync("pdftoppm", ["-r", "300", "-png", pdf, path.join(tmp, "p")]);
  const images = fs.readdirSync(tmp).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
  const pages = [];
  for (const [i, image] of images.entries()) {
    const layer = execFileSync("pdftotext", ["-layout", "-f", i + 1, "-l", i + 1, pdf, "-"].map(String)).toString().replace(/\f/g, "");
    pages.push(withSigns(layer, (await ocr.recognize(path.join(tmp, image))).data.text));
  }
  fs.rmSync(tmp, { recursive: true });
  let text = pages.join("\n");
  for (const [passage, printed] of fixes[id] ?? []) {
    if (text.split(passage).length !== 2) throw new Error(`${id}: « ${passage} » is not once in the extraction`);
    text = text.replace(passage, () => printed);
  }
  fs.writeFileSync(out, text);
  extracted++;
}
await ocr?.terminate();
console.log(`${found} PDFs with lost signs: ${extracted} extracted to .parse-cache/cmpp/`);
