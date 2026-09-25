#!/usr/bin/env node
// Each Mevar text once (goal 09). Compares every pair across the Ghost posts
// (mevar), the PDFs (mevar-pdfs) and OneDrive, and within OneDrive, on the
// whole body: normalised words, 5-word shingles, containment both ways.
//
// Bands, chosen from the distribution this script prints (goal 09 PR):
//   same text      both containments >= 0.90                  applied
//   same sermon    both containments >= 0.70                  applied
//   download       a PDF held by the posts that link it       applied
//   uncertain      one containment >= 0.20, or titles alike   applied only when
//                  and one containment >= 0.10                Samuel says "same"
// Samuel's answers: scripts/mevar-duplicates-decided.json, keyed "<id> | <id>",
// "same" or "different", on any pair: "different" also cuts an applied pair.
//
// A shingle held by more than 20 works is a formula ("au nom de jesus christ")
// and is not counted as shared.
//
// In each group the Ghost post stays; else the text with more of the sermon
// (more shingles); else the one with fewer OCR-like tokens. A group kept by a
// Ghost draft, or holding an uncertain pair not called "same", waits.
// The others get duplicate_of: "<source>/<path>", the keeper's file path, which
// the site turns into its URL (web/astro.config.mjs). Nothing is deleted.
//
// Writes manifests/mevar-duplicates.json and the duplicate_of lines of
// markdown/onedrive/ and markdown/mevar-pdfs/. A second run changes nothing.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const K = 5;
const MIN_SHARED = 50; // shingles; below this a short audio post "contains" anything
const SAME_TEXT = 0.9;
const SAME_SERMON = 0.7;
const UNCERTAIN = 0.2;
const UNCERTAIN_TITLED = 0.1;
const TITLES_ALIKE = 0.75;

const decided = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-duplicates-decided.json"), "utf8"));

function field(fm, name) {
  const m = fm.match(new RegExp(`^${name}: "(.*)"$`, "m"));
  return m && m[1];
}

function words(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
}

// Tokens a clean transcript does not have: a capital inside a word, a
// replacement or ligature glyph, a word cut by a hyphen at a line end. Digits
// glued to letters are not counted: they are verse references ("1Pie", "V12").
const OCR = /\p{Ll}\p{Lu}|[\uFFFD\uFB00-\uFB06]|\p{L}-$/u;

const works = [];
for (const source of ["mevar", "mevar-pdfs", "onedrive"]) {
  const dir = path.join(root, "markdown", source);
  for (const rel of fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".md")).sort()) {
    const file = path.join(dir, rel);
    const text = fs.readFileSync(file, "utf8");
    const [, fm, body] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (source === "mevar" && field(fm, "type") !== "post") continue;
    const w = words(body);
    const shingles = new Set();
    for (let i = 0; i + K <= w.length; i++) shingles.add(w.slice(i, i + K).join(" "));
    works.push({
      id: `${source}/${field(fm, "sermon_id")}`, path: `${source}/${rel.slice(0, -".md".length)}`, source, file, fm, body,
      title: field(fm, "title"), draft: field(fm, "status") === "draft", pdf: field(fm, "local_pdf"),
      excerpt: body.split(/\s+/).filter(Boolean).slice(0, 300).join(" "),
      ocr: body.split(/\s+/).filter((t) => OCR.test(t)).length, shingles,
    });
  }
}

// Inverted index: shingle -> works holding it; count shared shingles per pair.
const holders = new Map();
works.forEach((w, i) => {
  for (const s of w.shingles) {
    const h = holders.get(s);
    if (h) h.push(i);
    else holders.set(s, [i]);
  }
});
const shared = new Map();
for (const h of holders.values()) {
  if (h.length > 20) continue;
  for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) {
    const [x, y] = [works[h[a]], works[h[b]]];
    if (x.source === y.source && x.source !== "onedrive") continue;
    const key = `${h[a]} ${h[b]}`;
    shared.set(key, (shared.get(key) || 0) + 1);
  }
}

function titleScore(a, b) {
  const x = new Set(words(a).filter((t) => t.length > 3));
  const y = new Set(words(b).filter((t) => t.length > 3));
  let n = 0;
  for (const t of x) if (y.has(t)) n++;
  return x.size + y.size ? (2 * n) / (x.size + y.size) : 0;
}

// Distribution of the smaller containment, for every pair sharing MIN_SHARED
// shingles, and of the larger one for the pairs below SAME_SERMON (where the
// uncertain band is cut).
const round = (n) => Math.round(n * 1000) / 1000;
const bins = Array(10).fill(0);
const below = Array(10).fill(0);
const pairs = [];
for (const [key, n] of shared) {
  if (n < MIN_SHARED) continue;
  const [a, b] = key.split(" ").map((i) => works[i]);
  const inA = n / a.shingles.size; // share of a found in b
  const inB = n / b.shingles.size;
  const [lo, hi] = [Math.min(inA, inB), Math.max(inA, inB)];
  bins[Math.min(9, Math.floor(lo * 10))]++;
  if (lo < SAME_SERMON) below[Math.min(9, Math.floor(hi * 10))]++;
  const title = titleScore(a.title, b.title);
  const band = lo >= SAME_TEXT ? "same_text"
    : lo >= SAME_SERMON ? "same_sermon"
    : hi >= UNCERTAIN || (title >= TITLES_ALIKE && hi >= UNCERTAIN_TITLED) ? "uncertain"
    : null;
  if (!band) continue;
  const [first, second] = a.id < b.id ? [a, b] : [b, a];
  const decision = decided[`${first.id} | ${second.id}`] || null;
  pairs.push({
    a: first, b: second, band, decision,
    in_a: round(first === a ? inA : inB), in_b: round(first === a ? inB : inA), title: round(title),
  });
}
pairs.sort((p, q) => p.a.id.localeCompare(q.a.id) || p.b.id.localeCompare(q.b.id));

console.log(`works: ${works.length}; pairs sharing >= ${MIN_SHARED} shingles, by the smaller containment:`);
const bin = (c, i) => console.log(`  ${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}  ${c}`);
bins.forEach(bin);
console.log(`pairs below ${SAME_SERMON}, by the larger containment:`);
below.forEach(bin);

// A PDF is its posts' download when the Ghost posts that link it (same
// local_pdf) hold it between them: one PDF for parts 1 and 2 of a series.
// Applied like same text. A book whose post is an excerpt stays uncertain,
// and a pair Samuel answered "different" does not count toward the sum.
for (const w of works.filter((w) => w.source === "mevar-pdfs")) {
  const links = pairs.filter((p) => p.band === "uncertain" && p.decision !== "different" && (p.a === w ? p.b : p.b === w ? p.a : null)?.pdf === w.pdf);
  if (links.reduce((n, p) => n + (p.a === w ? p.in_a : p.in_b), 0) >= SAME_TEXT) for (const p of links) p.band = "download";
}

const keys = new Set(pairs.map((p) => `${p.a.id} | ${p.b.id}`));
for (const [key, value] of Object.entries(decided)) {
  if (!keys.has(key) || !["same", "different"].includes(value)) console.warn(`decision ignored: "${key}": "${value}"`);
}

// Groups: union of the applied pairs and the uncertain pairs Samuel called "same".
const applied = pairs.filter((p) => p.decision === "same" || (p.band !== "uncertain" && p.decision !== "different"));
const parent = new Map();
const find = (id) => (parent.has(id) ? find(parent.get(id)) : id);
for (const p of applied) {
  const [x, y] = [find(p.a.id), find(p.b.id)];
  if (x !== y) parent.set(x < y ? y : x, x < y ? x : y);
}
const grouped = new Set(applied.flatMap((p) => [p.a, p.b]));
const members = new Map();
for (const w of grouped) {
  const r = find(w.id);
  if (!members.has(r)) members.set(r, []);
  members.get(r).push(w);
}

function keeper(group) {
  const ghost = group.filter((w) => w.source === "mevar").sort((x, y) => x.draft - y.draft);
  if (ghost.length) return { keep: ghost[0], rule: ghost.length > 1 ? "ghost post (several, first by id)" : "ghost post" };
  const [first, second] = [...group].sort((x, y) => y.shingles.size - x.shingles.size || x.ocr - y.ocr || x.id.localeCompare(y.id));
  const rule = first.shingles.size > second.shingles.size ? "more of the sermon"
    : first.ocr < second.ocr ? "cleaner" : "as long and as clean, first by id";
  return { keep: first, rule };
}

const duplicateOf = new Map();
const groups = [];
for (const group of members.values()) {
  group.sort((x, y) => x.id.localeCompare(y.id));
  const { keep, rule } = keeper(group);
  const ids = new Set(group.map((w) => w.id));
  // Held: a draft is never built, so nothing may redirect to it yet (a rerun
  // after Samuel publishes it applies the group); a group that holds an
  // unanswered uncertain pair waits for the answer; a group that holds a pair
  // answered "different" waits until "different" cuts a pair that joins them.
  const inside = pairs.filter((p) => ids.has(p.a.id) && ids.has(p.b.id));
  const open = inside.filter((p) => p.band === "uncertain" && !p.decision);
  const split = inside.filter((p) => p.decision === "different");
  const key = (p) => `${p.a.id} | ${p.b.id}`;
  const held = keep.draft ? "kept by a Ghost draft"
    : open.length ? `waits for an answer on ${open.map(key).join(", ")}`
    : split.length ? `joins ${split.map(key).join(", ")}, answered "different": cut a pair that joins them`
    : null;
  if (!held) for (const w of group) if (w !== keep && w.source !== "mevar") duplicateOf.set(w.id, keep.path);
  groups.push({
    keep: keep.id, rule, held,
    members: group.map((w) => ({ id: w.id, title: w.title, shingles: w.shingles.size, ocr_tokens: w.ocr })),
    pairs: applied.filter((p) => ids.has(p.a.id)).map((p) => ({
      a: p.a.id, b: p.b.id, band: p.band, decision: p.decision, in_a: p.in_a, in_b: p.in_b, title: p.title,
    })),
  });
}
groups.sort((x, y) => x.keep.localeCompare(y.keep));

const uncertain = pairs.filter((p) => p.band === "uncertain").map((p) => ({
  key: `${p.a.id} | ${p.b.id}`, decision: p.decision, in_a: p.in_a, in_b: p.in_b, title: p.title,
  a: { title: p.a.title, excerpt: p.a.excerpt }, b: { title: p.b.title, excerpt: p.b.excerpt },
}));

fs.writeFileSync(
  path.join(root, "manifests/mevar-duplicates.json"),
  JSON.stringify({ groups, uncertain }, null, 2) + "\n",
);

// duplicate_of lines: set, replace or remove, only in the PDF and OneDrive texts.
let changed = 0;
for (const w of works) {
  if (w.source === "mevar") continue;
  const target = duplicateOf.get(w.id);
  const line = target ? `duplicate_of: ${JSON.stringify(target)}\n` : "";
  let fm = `${w.fm}\n`.replace(/^duplicate_of: .*\n/m, "");
  if (line) fm = fm.replace(/^(sermon_id: .*\n)/m, `$1${line}`);
  if (fm !== `${w.fm}\n`) {
    fs.writeFileSync(w.file, `---\n${fm}---\n${w.body}`);
    changed++;
  }
}

// Report.
const count = (xs, f) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log("pairs per band:", count(pairs, (p) => p.band));
console.log("pairs per band and source pair:", count(pairs, (p) => `${p.band}: ${p.a.source} x ${p.b.source}`));
console.log("uncertain decided:", count(uncertain, (u) => u.decision || "open"));
console.log(`groups: ${groups.length}; keeper rules:`, count(groups, (g) => g.rule));
console.log("groups held, not applied:", groups.filter((g) => g.held).map((g) => `${g.keep}: ${g.held}`));
console.log("duplicate_of per source:", count([...duplicateOf.keys()], (id) => id.split("/")[0]));
const ghostPosts = works.filter((w) => w.source === "mevar" && !w.draft).length;
const others = works.filter((w) => w.source !== "mevar" && !duplicateOf.has(w.id)).length;
const waiting = groups.filter((g) => g.held).flatMap((g) => g.members.filter((m) => m.id !== g.keep && !m.id.startsWith("mevar/"))).length;
console.log(`Mevar set: ${ghostPosts} published Ghost posts + ${others} PDF and OneDrive texts without duplicate_of = ${ghostPosts + others}` +
  ` (${waiting} of those are in held groups and get duplicate_of once released)`);
console.log(`frontmatter files changed: ${changed}`);
