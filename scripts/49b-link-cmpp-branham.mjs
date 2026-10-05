#!/usr/bin/env node
// Link each French translation of a Branham sermon published by the CMPP to
// the English sermon it translates, write the link into the frontmatter on
// both sides, and file the translation under its sermon's year.
//
// A CMPP booklet prints its title page at the head of its text: the French
// title, the English one in parentheses, the day and the time of day
// (« 14 juin 1964, matin »). The frontmatter `date` came from a model, so the
// printed day is what is trusted: a translation whose title page prints
// another day than its frontmatter is not linked, it is listed.
//
// The day gives the candidates (the Branham ids start with it: "64-0614M").
// Among them, in this order:
//   1. the English title printed on the title page (also looked for on the
//      frontmatter's day, when the two days differ);
//   2. the time of day printed with the date, against the M / A / E suffix;
//   3. the only sermon of that day, unless its suffix is another time of day
//      than the one printed.
// Anything else is left unlinked and listed in
// manifests/cmpp-branham-unresolved.json. Never guessed.
//
// Samuel's answers come first: scripts/cmpp-branham-decided.json,
// `{"<cmpp id>": "<branham id>" | "none"}`. "none" records that the work
// translates no sermon of the archive, and it leaves the unresolved list.
//
// Writes: `original: "branham/<year>/<id>"` on the translation,
//         `translation_fr: "cmpp/<year>/<id>"` on the sermon,
// and moves a linked translation from markdown/cmpp/undated/ to
// markdown/cmpp/<year>/: a work's URL is its path. Every other CMPP work
// under undated/ whose title page prints the year its frontmatter gives moves
// too. The paths in manifests/cmpp.json and in the two hand-kept files that
// name works by path follow (a later answer of Samuel's moves a work again).
// Idempotent. Run 65, 47, 50 and 160 after it.
//
// Not followed: `local_pdf`. A moved work keeps the address its PDF has on
// files.mevar.org (…/cmpp/undated/<id>.pdf), which still answers; 96 names a
// PDF by its work's path, so its next run would upload the moved works' PDFs
// again under the new path. That run is Samuel's (R2).
//
//   node scripts/49b-link-cmpp-branham.mjs

import fs from "node:fs";
import path from "node:path";
import { dropField, setField } from "./frontmatter.mjs";

const root = path.resolve(import.meta.dirname, "..");
const md = path.join(root, "markdown");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

function readDoc(file) {
  const [, front, body] = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fields = {};
  for (const line of front.split("\n")) {
    const kv = line.match(/^([a-z_]+): (.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^"|"$/g, "");
  }
  return { file, ref: path.relative(md, file).replace(/\.md$/, ""), id: path.basename(file, ".md"), fields, body };
}

const works = [...walk(path.join(md, "cmpp"))].map(readDoc);
const sermons = [...walk(path.join(md, "branham"))].map(readDoc);
const sermonById = new Map(sermons.map((s) => [s.id, s]));
const decided = JSON.parse(fs.readFileSync(path.join(root, "scripts/cmpp-branham-decided.json"), "utf8"));

const byDay = new Map();
for (const s of sermons) {
  const [, yy, mmdd, suffix] = s.id.match(/^(\d{2})-(\d{4})([A-Z]?)$/);
  s.suffix = suffix;
  byDay.set(yy + mmdd, [...(byDay.get(yy + mmdd) ?? []), s]);
}

// ─── The title page ─────────────────────────────────────────────────────────
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// A line that is a day and no more: « 14 juin 1964, matin », « 18 mars 1963, soir »,
// « 8 décembre 1960, jeudi soir ». A date inside a sentence of the foreword is not the sermon's.
const DAY = new RegExp(`^(\\d{1,2})\\s*(?:er|ᵉʳ)?\\s+(${MONTHS.join("|")})\\s+(\\d{4})(?:,?\\s*(?:\\p{L}+ )?(matin|après-midi|soir))?$`, "iu");
const SUFFIX = { matin: "M", "après-midi": "A", soir: "E" };
// Content words of a normalized title, crudely stemmed, as 49 does.
const STOP = new Set("and the of to in on is are was be it he his him god lord jesus christ when what who how why that this for with by from not we you".split(" "));
const stems = (s) => new Set(s.split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, "").slice(0, 6)));
const norm = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/** What the head of a text prints: its day ("1964-06-14"), the time of day, what stands in parentheses under the title (the English title, on a sermon), and the years its short lines name. */
function titlePage(body) {
  // Without the emphasis the clean-up put on some lines: « **17 mars 1963, soir** », « *(The Breach…)* ».
  const head = body.split("\n").map((l) => l.replace(/[*_#]/g, "").trim()).filter(Boolean).slice(0, 25);
  const [, d, month, y, time] = head.map((l) => l.match(DAY)).find(Boolean) ?? [];
  return {
    day: d && `${y}-${String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, "0")}-${d.padStart(2, "0")}`,
    time: time?.toLowerCase(),
    // In parentheses and without an accent: « (Unveiling of God) », not « (Chapitre quatre / 2ème partie) ».
    english: head.map((l) => l.match(/^\(([A-Za-z][A-Za-z0-9 ,.'’?!:-]*)\)$/)?.[1]).find(Boolean),
    // The years a short line names (« Krefeld, mai 1985 », « Copyright © 1978 »):
    // a year inside a sentence of the foreword is not the publication's.
    years: new Set(head.filter((l) => l.length <= 60).join(" ").match(/\b(19|20)\d{2}\b/g)),
  };
}

// ─── Resolve ────────────────────────────────────────────────────────────────
const links = new Map(); // work.ref → sermon
const unresolved = [];
const stats = {};
const againstTime = [];

for (const work of works.filter((w) => w.fields.preacher === "William Branham")) {
  const page = titlePage(work.body);
  const day = page.day ?? work.fields.date;
  const on = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? byDay.get(d.slice(2, 4) + d.slice(5, 7) + d.slice(8)) ?? [] : []);
  const candidates = on(day);
  // The English title is looked for on the frontmatter's day too: a cover can
  // print the previous booklet's date (serie4no6), or two dates (serie5no3).
  const english = norm(page.english);
  const titled = english ? [...new Set([...candidates, ...on(work.fields.date)])].filter((c) => norm(c.fields.title).includes(english) || english.includes(norm(c.fields.title))) : [];
  const timed = page.time ? candidates.filter((c) => c.suffix === SUFFIX[page.time]) : [];
  // A printed English title that shares no word with a sermon's is another
  // sermon's: « God's Eagles » is not « Thirsting for Life », the only one
  // the archive has for 4 March 1960.
  const foreign = (c) => english && ![...stems(norm(c.fields.title))].some((w) => stems(english).has(w));

  let sermon = null, how;
  const answer = decided[work.id];
  if (answer === "none") how = "no Branham sermon (decided)";
  else if (answer) [sermon, how] = sermonById.has(answer) ? [sermonById.get(answer), "decided"] : [null, `the answer ${answer} names no sermon`];
  else if (titled.length === 1) {
    [sermon, how] = [titled[0], "English title on the title page"];
    // The booklet's time of day against the archive's: the title decides, and the pair is shown.
    if (page.time && sermon.suffix && sermon.suffix !== SUFFIX[page.time]) againstTime.push(`${work.id} (« ${page.time} ») → ${sermon.id}`);
  }
  else if (page.day && work.fields.date && page.day !== work.fields.date) how = `the title page prints ${page.day}, the frontmatter says ${work.fields.date}`;
  else if (!day) how = "no date on the title page nor in the frontmatter";
  else if (candidates.length === 0) how = "no Branham sermon that day";
  else if (timed.length === 1 && !foreign(timed[0])) [sermon, how] = [timed[0], "time of day"];
  else if (candidates.length === 1 && (!page.time || !candidates[0].suffix) && !foreign(candidates[0])) [sermon, how] = [candidates[0], "only sermon that day"];
  else if (candidates.some(foreign)) how = `the title page says « ${page.english} », no sermon that day has those words`;
  else how = `${candidates.length} sermon(s) that day, none named by the title page`;

  stats[how.replace(/\d{4}-\d{2}-\d{2}/g, "<day>")] = (stats[how.replace(/\d{4}-\d{2}-\d{2}/g, "<day>")] ?? 0) + 1;
  if (sermon) links.set(work.ref, sermon);
  else if (answer !== "none") {
    unresolved.push({
      cmpp: work.id,
      title: work.fields.title,
      title_page: { day: page.day ?? null, time: page.time ?? null, in_parentheses: page.english ?? null },
      frontmatter_date: work.fields.date ?? null,
      reason: how,
      candidates: candidates.map((c) => ({ branham: c.id, title: c.fields.title })),
    });
  }
}

// One sermon, one translation: two works claiming a sermon both wait.
const claimants = new Map();
for (const [ref, sermon] of links) claimants.set(sermon.ref, [...(claimants.get(sermon.ref) ?? []), ref]);
for (const [sermonRef, refs] of claimants) {
  if (refs.length < 2) continue;
  for (const ref of refs) {
    const work = works.find((w) => w.ref === ref);
    links.delete(ref);
    unresolved.push({
      cmpp: work.id,
      title: work.fields.title,
      reason: `${refs.length} works claim ${sermonRef}: ${refs.map((r) => path.basename(r)).join(", ")}`,
      candidates: [{ branham: path.basename(sermonRef) }],
    });
  }
  stats["claimed twice"] = (stats["claimed twice"] ?? 0) + refs.length;
}

// ─── The year folder ────────────────────────────────────────────────────────
// A linked translation goes to its sermon's year; any other work still under
// undated/ goes to its frontmatter's year when its title page prints it.
const moves = new Map(); // old ref → new ref
for (const work of works) {
  if (!work.ref.startsWith("cmpp/undated/")) continue;
  const sermon = links.get(work.ref);
  const year = sermon ? sermon.ref.split("/")[1] : titlePage(work.body).years.has(work.fields.year) ? work.fields.year : null;
  if (year) moves.set(work.ref, `cmpp/${year}/${work.id}`);
}
for (const [from, to] of moves) {
  fs.mkdirSync(path.dirname(path.join(md, `${to}.md`)), { recursive: true });
  fs.renameSync(path.join(md, `${from}.md`), path.join(md, `${to}.md`));
}
const moved = (ref) => moves.get(ref) ?? ref;
// What names a work by its path, besides the derived files 65, 50 and 160
// rebuild: the manifest, 76's hand-written frontmatter, goal 18's headings.
for (const f of ["manifests/cmpp.json", "scripts/76-add-missing-frontmatter.mjs", "scripts/mevar-section-headings.json"]) {
  const text = fs.readFileSync(path.join(root, f), "utf8");
  const out = text.replace(/cmpp\/undated\/([^/."]+)/g, (old) => moved(old));
  if (out !== text) fs.writeFileSync(path.join(root, f), out);
}

// ─── Write the frontmatter on both sides ────────────────────────────────────
// The link where it stands, or no line at all when there is none.
function write(file, key, value) {
  const text = fs.readFileSync(file, "utf8");
  const out = value ? setField(text, key, value) : dropField(text, key);
  if (out !== text) fs.writeFileSync(file, out);
  return out !== text;
}

const translationOf = new Map([...links].map(([ref, sermon]) => [sermon.ref, moved(ref)]));
let touched = 0;
for (const w of works) if (write(path.join(md, `${moved(w.ref)}.md`), "original", links.get(w.ref)?.ref)) touched++;
for (const s of sermons) if (write(s.file, "translation_fr", translationOf.get(s.ref))) touched++;

unresolved.sort((a, b) => a.cmpp.localeCompare(b.cmpp));
const outPath = path.join(root, "manifests/cmpp-branham-unresolved.json");
fs.writeFileSync(outPath, `${JSON.stringify(unresolved, null, 2)}\n`);

console.log(`CMPP works by William Branham: ${works.filter((w) => w.fields.preacher === "William Branham").length}`);
console.log(`  linked: ${links.size}`);
for (const [how, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`    ${how}: ${n}`);
if (againstTime.length) console.log(`  linked by the title against the printed time of day: ${againstTime.join("; ")}`);
console.log(`  unresolved: ${unresolved.length} → ${path.relative(root, outPath)}`);
console.log(`  moved out of undated/: ${moves.size}`);
console.log(`  frontmatter files touched: ${touched}`);
