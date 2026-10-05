#!/usr/bin/env node
// Each CMPP text once (goal 16, item 4). cmpp.ch publishes a text in several
// layouts: A4, A5, large print (`_gc`) and folded tract (`_traite`), each a
// PDF and so a work. The works whose ids differ only by those suffixes are a
// group. One keeps, the others get `duplicate_of: "cmpp/<year>/<id>"`, goal
// 09's field: the site does not build a duplicate and redirects its address.
// Nothing is deleted.
//
// The keeper: the id without a suffix; else the `_A4`; else the `_A5`. A
// `_gc` or a `_traite` never keeps: a group with no other member is listed.
//
// A variant is folded only when its body says so: normalised words, 5-word
// shingles (as 83), and at least 0.90 of the variant's shingles found in the
// keeper. That holds for the same text in another layout and for a tract
// that is an excerpt of the full text. A variant under the threshold is not
// folded; it is listed in manifests/cmpp-variants.json, with every group.
//
// Run it after 73 (which rewrites a frontmatter whole) and after 49b (which
// moves works: the keeper's path is read at each run). A second run changes
// nothing.
//
//   node scripts/83b-cmpp-variants.mjs

import fs from "node:fs";
import path from "node:path";
import { dropField, setField } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "markdown/cmpp");
const K = 5;
const SAME_TEXT = 0.9;
const SUFFIXES = /(_A4|_A5|_gc|_traite)+$/i;

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
  const base = id.replace(SUFFIXES, "");
  groups.set(base, [...(groups.get(base) ?? []), work]);
}

// The rank of a layout as a keeper; Infinity never keeps.
function rank(work, base) {
  const suffix = work.id.slice(base.length).toLowerCase();
  if (suffix === "") return 0;
  if (/_gc|_traite/.test(suffix)) return Infinity;
  return suffix === "_a4" ? 1 : 2;
}

const duplicateOf = new Map(); // work.ref → keeper.ref
const report = [];
for (const [base, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  if (members.length < 2) continue;
  members.sort((a, b) => rank(a, base) - rank(b, base) || a.id.localeCompare(b.id));
  const [keeper, ...variants] = members;
  if (rank(keeper, base) === Infinity) {
    report.push({ group: base, keeper: null, reason: "only large-print or tract layouts", works: members.map((w) => w.id) });
    continue;
  }
  const body = (w) => shingles(fs.readFileSync(w.file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, ""));
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

let touched = 0;
for (const w of works) {
  const text = fs.readFileSync(w.file, "utf8");
  const out = duplicateOf.has(w.ref) ? setField(text, "duplicate_of", duplicateOf.get(w.ref)) : dropField(text, "duplicate_of");
  if (out !== text) { fs.writeFileSync(w.file, out); touched++; }
}

const outPath = path.join(root, "manifests/cmpp-variants.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

const notFolded = report.flatMap((g) => (g.keeper ? g.not_folded.map((v) => `${v.id} (${v.in_keeper} of it in ${g.keeper})`) : [`${g.group}: ${g.reason}`]));
console.log(`CMPP works: ${works.length}, groups of layouts: ${report.length}`);
console.log(`  folded: ${duplicateOf.size} duplicates in ${report.filter((g) => g.folded?.length).length} groups`);
console.log(`  not folded: ${notFolded.length}${notFolded.length ? `: ${notFolded.join("; ")}` : ""} → ${path.relative(root, outPath)}`);
console.log(`  frontmatter files touched: ${touched}`);
