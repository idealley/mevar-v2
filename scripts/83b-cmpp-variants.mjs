#!/usr/bin/env node
// Each CMPP text once (goal 16, item 4). cmpp.ch publishes a text in several
// layouts: A4, A5, large print (`_gc`) and folded tract (`_traite`), each a
// PDF and so a work. The works whose ids differ only by those suffixes are a
// group. One keeps, the others get `duplicate_of: "cmpp/<year>/<id>"`, goal
// 09's field: the site does not build a duplicate and redirects its address.
// Nothing is deleted.
//
// The keeper: the id without a suffix; else the `_A4`; else the `_A5`; a
// `_gc` or a `_traite` last.
//
// Four letters of 1974 are in the corpus under two names (SAME_LETTER): the
// one cmpp.ch no longer links joins the group of the one it links, and never
// keeps.
//
// A variant is folded only when its body says so: normalised words, 5-word
// shingles (as 83), and at least 0.90 of the variant's shingles found in the
// keeper. That holds for the same text in another layout and for a tract
// that is an excerpt of the full text. A variant under the threshold is not
// folded; it is listed in manifests/cmpp-variants.json, with every group.
//
// Run it after 73 (which rewrites a frontmatter whole) and after 49b (which
// moves works: the keeper's path is read at each run). A `duplicate_of` this
// script did not write (its target is no keeper of these groups) is left
// alone. A second run changes nothing.
//
//   node scripts/83b-cmpp-variants.mjs

import fs from "node:fs";
import path from "node:path";
import { dropField, field, frontmatter, setField } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "markdown/cmpp");
const K = 5;
const SAME_TEXT = 0.9;
const SUFFIXES = /(_A4|_A5|_gc|_traite)+$/i;
// The same letter under the name cmpp.ch gave it first, and the one it has
// now: 0.96 to 0.97 of each in the other, and 12 lists the first as no
// longer linked on the site.
const SAME_LETTER = { janvier1974: "lc_janvier_1974", mars1974: "lc_mars_1974", juillet1974: "lc_juillet_1974", octobre1974: "lc_octobre_1974" };

function shingles(body) {
  const w = body.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  const set = new Set();
  for (let i = 0; i + K <= w.length; i++) set.add(w.slice(i, i + K).join(" "));
  return set;
}
/** The share of a's shingles that b holds. */
const contained = (a, b) => (a.size ? [...a].filter((s) => b.has(s)).length / a.size : 0);

const groups = new Map(); // base id → works
const works = [];
for (const rel of fs.readdirSync(dir, { recursive: true }).sort()) {
  if (!rel.endsWith(".md")) continue;
  const id = path.basename(rel, ".md");
  const work = { id, ref: `cmpp/${rel.replace(/\.md$/, "")}`, file: path.join(dir, rel) };
  works.push(work);
  const base = SAME_LETTER[id] ?? id.replace(SUFFIXES, "");
  groups.set(base, [...(groups.get(base) ?? []), work]);
}

// The rank of a work as its group's keeper: the lowest keeps.
function rank(work) {
  if (SAME_LETTER[work.id]) return 4;
  const suffix = (work.id.match(SUFFIXES)?.[0] ?? "").toLowerCase();
  if (suffix === "") return 0;
  if (/_gc|_traite/.test(suffix)) return 3;
  return suffix === "_a4" ? 1 : 2;
}

const duplicateOf = new Map(); // work.ref → keeper.ref
const report = [];
for (const [base, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  if (members.length < 2) continue;
  members.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const [keeper, ...variants] = members;
  // The text after « ---\n<frontmatter>\n---\n »
  const body = (w) => { const text = fs.readFileSync(w.file, "utf8"); return shingles(text.slice(frontmatter(text).length + 9)); };
  const kept = body(keeper);
  const entry = { group: base, keeper: keeper.id, folded: [], not_folded: [] };
  for (const v of variants) {
    const own = body(v);
    const inKeeper = +contained(own, kept).toFixed(3), ofKeeper = +contained(kept, own).toFixed(3);
    if (inKeeper >= SAME_TEXT) { duplicateOf.set(v.ref, keeper.ref); entry.folded.push({ id: v.id, in_keeper: inKeeper, of_keeper: ofKeeper }); }
    else entry.not_folded.push({ id: v.id, in_keeper: inKeeper, of_keeper: ofKeeper, reason: "the bodies differ beyond layout" });
  }
  report.push(entry);
}

// A line of ours on a work no longer folded names a keeper of these groups,
// under its path of today or of before a move: only that line is taken away.
const keepers = new Set(report.map((g) => g.keeper));
const ours = (target) => target?.startsWith("cmpp/") && keepers.has(path.basename(target));
let touched = 0;
for (const w of works) {
  const text = fs.readFileSync(w.file, "utf8");
  const out = duplicateOf.has(w.ref) ? setField(text, "duplicate_of", duplicateOf.get(w.ref))
    : ours(field(frontmatter(text), "duplicate_of")) ? dropField(text, "duplicate_of") : text;
  if (out !== text) { fs.writeFileSync(w.file, out); touched++; }
}

const outPath = path.join(root, "manifests/cmpp-variants.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

const notFolded = report.flatMap((g) => g.not_folded.map((v) => `${v.id} (${v.in_keeper} of it in ${g.keeper})`));
console.log(`CMPP works: ${works.length}, groups of layouts: ${report.length}`);
console.log(`  folded: ${duplicateOf.size} duplicates in ${report.filter((g) => g.folded.length).length} groups`);
console.log(`  not folded: ${notFolded.length}${notFolded.length ? `: ${notFolded.join("; ")}` : ""} → ${path.relative(root, outPath)}`);
console.log(`  frontmatter files touched: ${touched}`);
