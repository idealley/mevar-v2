#!/usr/bin/env node
// The words of a CMPP work's PDF, put back where the LLM clean-up (72, 73) or
// an older step changed them (hard rule 1: the text keeps its words). The
// clean-up is asked to change the layout only; it also spells out a Bible
// abbreviation here and there (« Tim. » to « Timothée »), accents a capital
// (« Eglise » to « Église »), writes « sœurs » for « soeurs », corrects a
// misprint or slips on a word.
//
// A work's body is compared with the extraction of its PDF, word for word
// (the two aligned by `diff` on their words without case or accent). Three
// kinds of difference are restored, each only where the words around it are
// the same on both sides:
//   - a word that differs from the PDF's by its accents or by « œ » / « oe »;
//   - a book of the Bible spelled out before a chapter, where the PDF
//     abbreviates it, with its point;
//   - one word for one word, three letters apart at most.
// Nothing else is touched: a title page the clean-up left out, a word the
// PDF cuts at a line end, the layout.
//
// scripts/cmpp-source-words.json holds, per work, what a reader of the PDF
// decided: `keep`, a difference that is the extraction's fault and stays as
// cleaned ("œuvre→uvre": the font maps no « œ »), and `by_hand`, an exact
// passage of the body and what the PDF prints, for what the three rules
// cannot see (two words for one, a word cut at a page end).
//
// The extraction is .parse-cache/cmpp/<id>.txt: 21's for a booklet, 22's for
// a PDF with lost signs, and for any other PDF LiteParse's, made here if it
// is not there. Idempotent: a second run changes nothing. Run it after 73,
// on the works 73 wrote, then 65 and 47.
//
// Usage: node scripts/75-restore-source-words.mjs <cmpp id> [<cmpp id>…]
// (needs `diff`; 20, 21 and 22 first)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extraction } from "./cmpp-pdfs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const decided = JSON.parse(fs.readFileSync(path.join(root, "scripts/cmpp-source-words.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/cmpp.json"), "utf8"));

const words = (text) => [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], i: m.index }));
const fold = (w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
const upper = (w) => [...w.replace(/œ/g, "oe").replace(/Œ/g, "Oe")].map((c) => c !== c.toLowerCase());
const sameCase = (a, b) => upper(a).join() === upper(b).join();
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
  return d[a.length][b.length];
}

/** The body with the source's words: [body, what was restored as "cleaned→source"]. */
function restore(body, source, keep) {
  const A = words(source), B = words(body);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cmpp-words-"));
  fs.writeFileSync(path.join(tmp, "a"), `${A.map((t) => fold(t.w)).join("\n")}\n`);
  fs.writeFileSync(path.join(tmp, "b"), `${B.map((t) => fold(t.w)).join("\n")}\n`);
  const hunks = spawnSync("diff", ["a", "b"], { cwd: tmp, maxBuffer: 1 << 30 }).stdout.toString().split("\n").filter((l) => /^\d/.test(l));
  fs.rmSync(tmp, { recursive: true });

  // The words diff holds equal, as pairs of positions, and the runs it holds different
  const pairs = [], runs = [];
  let ia = 0, ib = 0;
  const equal = (n) => { while (n-- > 0) pairs.push([ia++, ib++]); };
  for (const hunk of hunks) {
    const [, a1, a2, op, b1, b2] = hunk.match(/^(\d+)(?:,(\d+))?([acd])(\d+)(?:,(\d+))?$/);
    const ae = Number(a2 ?? a1), be = Number(b2 ?? b1);
    equal((op === "a" ? Number(a1) : Number(a1) - 1) - ia);
    runs.push([ia, op === "a" ? ia : ae, ib, op === "d" ? ib : be]);
    if (op !== "a") ia = ae;
    if (op !== "d") ib = be;
  }
  equal(A.length - ia);

  const edits = [], restored = [];
  const put = (b, word) => { if (keep.has(`${b.w}→${word}`)) return; edits.push([b.i, b.w.length, word]); restored.push(`${b.w}→${word}`); };
  // accents and « œ »: the same word for diff, between two words it pairs as well
  const follows = (k) => k < 0 || k + 1 >= pairs.length || (pairs[k + 1][0] === pairs[k][0] + 1 && pairs[k + 1][1] === pairs[k][1] + 1);
  for (const [k, [x, y]] of pairs.entries()) {
    const a = A[x].w, b = B[y].w;
    if (a.normalize("NFC").toLowerCase() !== b.normalize("NFC").toLowerCase() && sameCase(a, b) && follows(k - 1) && follows(k)) put(B[y], a);
  }
  for (const [as, ae, bs, be] of runs) {
    if (ae - as !== 1 || be - bs !== 1) continue;
    const a = A[as], b = B[bs];
    const after = (text, t, n) => text.slice(t.i + t.w.length, t.i + t.w.length + n);
    // « Tim. 1.1 » in the PDF, « Timothée 1.1 » in the body
    if (a.w.length < b.w.length && fold(b.w).startsWith(fold(a.w)) && /^\.? ?\d/.test(after(source, a, 4)) && /^ ?\d/.test(after(body, b, 3))) put(b, a.w + (after(source, a, 1) === "." ? "." : ""));
    // one word for one word, its neighbours the same
    else if (as > 0 && ae < A.length && A[as - 1].w === B[bs - 1].w && A[ae].w === B[be].w && Math.min(a.w.length, b.w.length) >= 2 && distance(a.w, b.w) <= 3) put(b, a.w);
  }
  for (const [i, length, word] of edits.sort((p, q) => q[0] - p[0])) body = body.slice(0, i) + word + body.slice(i + length);
  return [body, restored];
}

const ids = process.argv.slice(2);
if (!ids.length) { console.error("usage: 75-restore-source-words.mjs <cmpp id> [<cmpp id>…]"); process.exit(2); }
let changed = 0, total = 0;
for (const id of ids) {
  const entry = manifest.find((e) => e.sermon_id === id);
  if (!entry) throw new Error(`${id}: not in manifests/cmpp.json`);
  // A work whose text is its page of cmpp.ch (goal 31) has that page's words, not its PDF's.
  if (entry.html_url) continue;
  const file = path.join(root, entry.local_md);
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf("\n---\n", 4) + 5;
  let [body, restored] = restore(text.slice(start), extraction(id), new Set(decided[id]?.keep));
  for (const [passage, printed] of decided[id]?.by_hand ?? []) {
    const times = body.split(passage).length - 1;
    if (times === 1) { body = body.replace(passage, () => printed); restored.push(`${passage}→${printed}`); }
    else if (times || !body.includes(printed)) throw new Error(`${id}: « ${passage} » is ${times} times in the body`);
  }
  if (!restored.length) continue;
  fs.writeFileSync(file, text.slice(0, start) + body);
  changed++;
  total += restored.length;
  console.log(`${id}: ${restored.length}  ${restored.slice(0, 12).join(", ").replace(/\n/g, "⏎")}${restored.length > 12 ? ", …" : ""}`);
}
console.log(`${ids.length} works compared with their PDF, ${total} words restored in ${changed}`);
