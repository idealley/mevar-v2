#!/usr/bin/env node
// Link each French Le-Scribe summary to the English Branham sermon it
// summarizes, and write the link into the frontmatter on both sides.
//
// Both ids start with the same date: "630112aInfluence" and "63-0112".
// One Branham sermon that day → the link is certain. Several → disambiguate,
// in this order:
//   1. the Le-Scribe `subtitle` sometimes names the sermon id outright;
//   2. it is more often the English title, verbatim or in part;
//   3. "matin" / "après-midi" / "soir" in the subtitle against Branham's
//      M / A / E suffix;
//   4. the a/b/c suffix of the Le-Scribe id against the day's sermons in
//      time order.
// Anything still ambiguous is left unlinked and listed in
// manifests/le-scribe-branham-unresolved.json. Never guessed.
//
// Samuel's answers come first: scripts/le-scribe-branham-decided.json,
// `{"<le-scribe id>": "<branham id>" | "none"}`. An id links; "none" records
// that the summary has no Branham sermon, and it leaves the unresolved list.
//
// Writes: `original: "branham/<year>/<id>"` on the summary,
//         `summary_fr: "le-scribe/<year>/<id>"` on the sermon.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

function readDoc(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  const fields = {};
  if (m) {
    for (const line of m[2].split("\n")) {
      const kv = line.match(/^([a-z_]+): (.*)$/);
      if (kv) fields[kv[1]] = kv[2].replace(/^"|"$/g, "");
    }
  }
  return {
    file,
    hasFrontmatter: !!m,
    ref: path.relative(path.join(root, "markdown"), file).replace(/\.md$/, ""),
    id: path.basename(file, ".md"),
    fields,
  };
}

const summaries = [...walk(path.join(root, "markdown/le-scribe"))].map(readDoc);
const sermons = [...walk(path.join(root, "markdown/branham"))].map(readDoc);
const sermonById = new Map(sermons.map((s) => [s.id, s]));

const decided = JSON.parse(fs.readFileSync(path.join(root, "scripts/le-scribe-branham-decided.json"), "utf8"));
const summaryIds = new Set(summaries.map((s) => s.id));
for (const [id, answer] of Object.entries(decided)) {
  if (!summaryIds.has(id) || (answer !== "none" && !sermonById.has(answer))) {
    console.warn(`decision ignored: "${id}": "${answer}"`);
    delete decided[id];
  }
}

// ─── Index Branham sermons by YYMMDD ────────────────────────────────────────
// Suffixes in time order: sunrise, morning, afternoon, evening.
const SUFFIX_ORDER = ["", "S", "M", "A", "B", "E", "X"];
const byDay = new Map();
for (const s of sermons) {
  const m = s.id.match(/^(\d{2})-(\d{4})([A-Z]?)$/);
  s.suffix = m[3];
  const day = m[1] + m[2];
  if (!byDay.has(day)) byDay.set(day, []);
  byDay.get(day).push(s);
}
for (const list of byDay.values()) {
  list.sort((a, b) => SUFFIX_ORDER.indexOf(a.suffix) - SUFFIX_ORDER.indexOf(b.suffix));
}

// ─── Resolve ────────────────────────────────────────────────────────────────
const norm = (s) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

// Content words of a normalized title, crudely stemmed ("projects",
// "projected" → "project").
const STOP = new Set("and the of to in on is are was be it he his him god lord jesus christ when what who how why that this for with by from not we you".split(" "));
const stems = (s) => new Set(s.split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, "").slice(0, 6)));

// Matched against norm(), which has already turned "après-midi" into "apres midi".
const TIME_SUFFIX = [[/\bmatin\b/, "M"], [/\bapres midi\b/, "A"], [/\bsoir\b/, "E"]];

function resolve(summary, candidates) {
  const subtitle = norm(summary.fields.subtitle);

  // 1. The subtitle is sometimes the sermon id itself. Only trust it when it
  // names one of that day's sermons — most of these ids are stray ("65-0117"
  // on a 1955 summary).
  const named = candidates.filter((c) => c.id === summary.fields.subtitle?.trim());
  if (named.length === 1) return [named[0], "sermon id in the subtitle"];

  // 2. English title, verbatim then contained
  if (subtitle) {
    let hit = candidates.filter((c) => norm(c.fields.title) === subtitle);
    if (hit.length === 1) return [hit[0], "title"];
    hit = candidates.filter((c) => {
      const t = norm(c.fields.title);
      return t && (t.includes(subtitle) || subtitle.includes(t));
    });
    if (hit.length === 1) return [hit[0], "title-part"];
  }

  // 3. Time of day named in the subtitle
  for (const [re, suffix] of TIME_SUFFIX) {
    if (!re.test(subtitle)) continue;
    const hit = candidates.filter((c) => c.suffix === suffix);
    if (hit.length === 1) return [hit[0], "time-of-day"];
  }

  // 4. a/b/c suffix of the Le-Scribe id → nth sermon of the day
  const letter = summary.id.match(/^\d{6}([a-c])/)?.[1];
  if (letter) {
    const nth = candidates["abc".indexOf(letter)];
    if (nth) return [nth, "abc-suffix"];
  }

  // 5. The English title in other words: "When Love Projects" for "When Love
  // Is Projected". Trusted only when exactly one of the day's sermons shares a
  // content word with the subtitle.
  const words = stems(subtitle);
  const hit = candidates.filter((c) => [...stems(norm(c.fields.title))].some((w) => words.has(w)));
  if (hit.length === 1) return [hit[0], "title-words"];

  return [null, `${candidates.length} sermons that day`];
}

const links = new Map(); // summary.ref → sermon
const unresolved = [];
const stats = {};

for (const summary of summaries) {
  const day = summary.id.match(/^(\d{6})/)?.[1];
  const candidates = day ? byDay.get(day) ?? [] : [];

  let sermon = null, how;
  const answer = decided[summary.id];
  if (!summary.hasFrontmatter) how = "no frontmatter in the Le-Scribe file";
  else if (answer === "none") how = "no Branham sermon (decided)";
  else if (answer) [sermon, how] = [sermonById.get(answer), "decided"];
  else if (!day) how = "no date in the Le-Scribe id";
  else if (candidates.length === 0) how = "no Branham sermon that day";
  else if (candidates.length === 1) [sermon, how] = [candidates[0], "only sermon that day"];
  else [sermon, how] = resolve(summary, candidates);

  stats[how] = (stats[how] ?? 0) + 1;
  if (sermon) links.set(summary.ref, sermon);
  else if (answer !== "none") {
    unresolved.push({
      le_scribe: summary.ref,
      title: summary.fields.title ?? null,
      subtitle: summary.fields.subtitle ?? null,
      reason: how,
      candidates: candidates.map((c) => ({ branham: c.ref, title: c.fields.title ?? null })),
    });
  }
}

// A sermon claimed by two summaries means one of them is wrong — drop both.
const claimants = new Map();
for (const [ref, sermon] of links) {
  if (!claimants.has(sermon.ref)) claimants.set(sermon.ref, []);
  claimants.get(sermon.ref).push(ref);
}
for (const [sermonRef, refs] of claimants) {
  if (refs.length < 2) continue;
  const sermon = links.get(refs[0]);
  for (const ref of refs) {
    const summary = summaries.find((s) => s.ref === ref);
    links.delete(ref);
    unresolved.push({
      le_scribe: ref,
      title: summary.fields.title ?? null,
      subtitle: summary.fields.subtitle ?? null,
      reason: `${refs.length} summaries claim ${sermonRef}`,
      candidates: [{ branham: sermonRef, title: sermon.fields.title ?? null }],
    });
  }
  stats["claimed twice"] = (stats["claimed twice"] ?? 0) + refs.length;
}

// ─── Write the frontmatter on both sides ────────────────────────────────────
function setField(file, key, value) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  if (!m) return false;
  // Replaced where it stands, so a field another script appended after it
  // (47's bible_refs) does not swap places with it on every run.
  const lines = m[2].split("\n");
  const i = lines.findIndex((l) => l.startsWith(`${key}: `));
  const line = value ? [`${key}: ${JSON.stringify(value)}`] : [];
  if (i === -1) lines.push(...line);
  else lines.splice(i, 1, ...line);
  const out = m[1] + lines.join("\n") + m[3] + m[4];
  if (out === text) return false;
  fs.writeFileSync(file, out);
  return true;
}

const summaryOf = new Map(); // sermon.ref → summary.ref
for (const [ref, sermon] of links) summaryOf.set(sermon.ref, ref);

let touched = 0;
for (const s of summaries) if (setField(s.file, "original", links.get(s.ref)?.ref)) touched++;
for (const s of sermons) if (setField(s.file, "summary_fr", summaryOf.get(s.ref))) touched++;

unresolved.sort((a, b) => a.le_scribe.localeCompare(b.le_scribe));
const outPath = path.join(root, "manifests/le-scribe-branham-unresolved.json");
fs.writeFileSync(outPath, JSON.stringify(unresolved, null, 2));

console.log(`Le-Scribe summaries: ${summaries.length}`);
console.log(`  linked: ${links.size}`);
for (const [how, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`    ${how}: ${n}`);
console.log(`  unresolved: ${unresolved.length} → ${path.relative(root, outPath)}`);
console.log(`  frontmatter files touched: ${touched}`);
