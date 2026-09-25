#!/usr/bin/env node
// Goal 10: the check that replaces reading every word of a batch.
//
// For each text of the batch it compares the original (.parse-cache/, from 84)
// with the pass (.pass-cache/, from 85) word by word and accepts only the
// changes goal 04 allows:
//   - whitespace, punctuation, markup, paragraph breaks: not words, not compared;
//   - typography: case, œ/oe, an accent on a capital (Eglise → Église) or on
//     a word in capitals (DESERT → désert) when the unaccented form is not a
//     word (A → À is a substitution);
//   - spacing: a word split or joined with the same letters (c omme → comme);
//   - printed furniture removed: a number alone on its line (page number), the
//     browser's print header and footer ("…/exo_nov07.html  1/4",
//     "13/03/2010  MEVAR"), the old site's "Haut de page Retour Page
//     d'accueil" bar, a digit between two letters (a glyph for "…"); counted;
//   - the document's header removed: the original's words before those the
//     body opens with, within the first 80 (title, "Prêché le … à …", which
//     the frontmatter holds); listed;
//   - a reading inserted where the pass put a marker: " (Réf)" and the
//     blockquote, which must equal the Segond verses in SurrealDB exactly,
//     for a reference the original cites (same book, chapter, first verse).
// A word replaced by another is never accepted silently: it goes into the
// substitution table, as a non-word corrected to a word (the French Hunspell
// dictionary says which) or as a word replaced by a word; a word the PDF's
// text layer broke and the pass joined, a letter or two restored ("réa ite"
// → "réalité", at most one dictionary word on the left), goes to the latter. Any other change
// (a word added or removed, several words for a different number of others,
// a reading that is not Segond or not announced, an odd number of ** in a
// paragraph) is unexplained, and the text is not written.
//
// A text with no unexplained change is written to markdown/: the pass's body,
// its title where only typography changed, and editorial_pass: "<date>". A
// text that already has editorial_pass is left as it is. The report goes to
// docs/goals/evidence/goal-10-batch-<batch>.md.
//
// Usage: node scripts/86-check-editorial-pass.mjs <batch>   (SurrealDB with 110 run)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dictionary from "dictionary-fr";
import nspell from "nspell";
import { citations } from "./65-normalize-bible.mjs";
import { connect, reading, blockquote } from "./segond.mjs";

const root = path.resolve(import.meta.dirname, "..");
const batchId = process.argv[2];
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[batchId];
const spell = nspell(dictionary);
const isWord = (w) => spell.correct(w) || spell.correct(w.toLowerCase());

// Words with their position; a number glued to letters is its own word
// ("11novembre1962").
const words = (text) => [...text.matchAll(/\p{L}+|\p{N}+/gu)].map((m) => ({ w: m[0], at: m.index }));

function distance(a, b) {
  let row = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

const fold = (w) => w.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
const bare = (w) => w.normalize("NFD").replace(/\p{Diacritic}/gu, "");
function typography(a, b) {
  if (fold(a) === fold(b)) return true;
  // An accent restored where capitals dropped it, and only where the word
  // without it is not a word: "Eglise" → "Église", "DESERT" → "désert"; but
  // "A" → "À", "OU" → "où", "LA" → "là" are words replaced by words.
  if (isWord(a.toLowerCase())) return false;
  if (a === a.toUpperCase() && bare(fold(a)) === bare(fold(b))) return true;
  return a[0] !== a[0].toLowerCase() && b[0] !== b[0].toLowerCase()
    && bare(a[0]) === bare(b[0]) && fold(a.slice(1)) === fold(b.slice(1));
}

// Myers diff of two word lists, through diff(1): hunks of [before, after].
// Two hunks at most two words apart are read as one change first, since the
// diff splits "vous vous" → "Vous vous" in two; if that change is not
// allowed, its parts are read one by one ("Ecritures il ya" → "Écritures il
// y a" is a capital accent and a split).
function hunks(a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goal10-"));
  fs.writeFileSync(`${dir}/a`, a.map((x) => x.w).join("\n") + "\n");
  fs.writeFileSync(`${dir}/b`, b.map((x) => x.w).join("\n") + "\n");
  const out = spawnSync("diff", [`${dir}/a`, `${dir}/b`], { encoding: "utf8", maxBuffer: 1 << 28 }).stdout;
  fs.rmSync(dir, { recursive: true });
  const range = (s) => { const [x, y = x] = s.split(",").map(Number); return [x, y]; };
  const merged = [];
  for (const m of out.matchAll(/^(\d+(?:,\d+)?)([acd])(\d+(?:,\d+)?)$/gm)) {
    const [a1, a2] = range(m[1]), [b1, b2] = range(m[3]);
    // half-open ranges [as, ae) of a and [bs, be) of b
    const h = m[2] === "a" ? { as: a1, ae: a1, bs: b1 - 1, be: b2 }
      : m[2] === "d" ? { as: a1 - 1, ae: a2, bs: b1, be: b1 }
      : { as: a1 - 1, ae: a2, bs: b1 - 1, be: b2 };
    const last = merged.at(-1);
    if (last && h.as - last.ae <= 2 && h.bs - last.be <= 2) Object.assign(last, { ae: h.ae, be: h.be, parts: [...last.parts, h] });
    else merged.push({ ...h, parts: [h] });
  }
  const slice = (h) => ({ before: a.slice(h.as, h.ae), after: b.slice(h.bs, h.be), at: b[Math.min(h.bs, b.length - 1)]?.at ?? 0 });
  return merged.map((h) => ({ ...slice(h), parts: h.parts.map(slice) }));
}

function sentence(text, at) {
  const start = Math.max(...[".", "!", "?", "\n"].map((c) => text.lastIndexOf(c, at - 1))) + 1;
  const ends = [".", "!", "?", "\n"].map((c) => text.indexOf(c, at)).filter((i) => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : undefined).trim();
}

const db = await connect();
const today = new Date().toISOString().slice(0, 10);
const rows = [];
for (const md of batch) {
  const rel = md.slice("markdown/".length);
  const original = fs.readFileSync(path.join(root, ".parse-cache", rel), "utf8");
  const pass = JSON.parse(fs.readFileSync(path.join(root, ".pass-cache", rel.replace(/\.md$/, ".json")), "utf8"));
  const r = { md, counts: { typography: 0, spacing: 0, pageNumbers: 0, print: 0, navigation: 0, glyph: 0 }, nonWord: [], word: [], unexplained: [], readings: [], pass };

  // The inserted readings leave the compared text once they are verified:
  // the Segond verses, for a reference the original cites.
  const cited = [...citations(original)];
  let body = pass.body;
  for (const { ref } of pass.readings) {
    const verses = await reading(db, ref);
    const inserted = verses && ` (${ref})\n\n${blockquote(verses)}`;
    const start = ref.replace(/-\d+$/, "");
    const announced = cited.find((c) => c.ref.replace(/-\d+$/, "") === start || c.ref === start.replace(/:\d+$/, ""));
    if (!inserted || !body.includes(inserted)) r.unexplained.push(`reading ${ref} is not the Segond text`);
    else if (!announced) r.unexplained.push(`reading ${ref} inserted, but the original does not cite it`);
    else {
      body = body.replace(inserted, "");
      r.readings.push({ said: announced.text, ref });
    }
  }
  for (const p of pass.body.split(/\n\s*\n/))
    if ((p.match(/\*\*/g) ?? []).length % 2) r.unexplained.push(`an odd number of ** in: ${p.slice(0, 200)}`);

  // The document's header: the original's words before the ones the body
  // opens with (6 of its first 8, the pass may have corrected one), if the
  // body opens within the first 80 words; listed.
  const after = words(body);
  const ow = words(original);
  r.words = ow.length;
  const k = ow.slice(0, 80).findIndex((_, i) => after.slice(0, 8).filter((x, j) => fold(x.w) === fold(ow[i + j]?.w ?? "")).length >= 6);
  r.removed = k > 0 ? [original.slice(0, ow[k].at).replace(/\s+/g, " ").trim()] : [];
  let compared = k > 0 ? " ".repeat(ow[k].at) + original.slice(ow[k].at) : original;

  // Printed page furniture the pass removes: the old site's navigation bar,
  // the browser's print header and footer ("http://mevar.org/….html  1/4",
  // "13/03/2010  MEVAR"), a number alone on its line (a page number), and a
  // digit between two letters, a glyph that stood for "…" ("serviteur4ils").
  const furniture = [
    [/^\s*Haut\s+de\s+page\s+Retour\s+Page\s+d['’]accueil\s*$/gm, "navigation"],
    [/^\s*\S*\.html?\s+\d+\/\d+\s*$/gm, "print"],
    [/^\s*\d{2}\/\d{2}\/\d{4}\s+MEVAR\s*$/gm, "print"],
    [/^[#*_ ]*\d+[*_ ]*$/gm, "pageNumbers"],
    [/(?<=\p{L})\d(?=\p{L})/gu, "glyph"],
  ];
  for (const [re, kind] of furniture)
    compared = compared.replace(re, (m) => { r.counts[kind]++; return " ".repeat(m.length); });

  const text = (xs) => xs.map((x) => x.w).join(" ");
  const join = (xs) => fold(xs.map((x) => x.w).join(""));
  // Reads one change; returns what it found, without touching r.
  function classify({ before, after: now, at }) {
    const c = { typography: 0, spacing: 0, nonWord: [], word: [], unexplained: [] };
    if (before.length && now.length && join(before) === join(now) && before.length !== now.length) c.spacing++;
    else if (before.length === now.length) {
      before.forEach((b, i) => {
        const a = now[i];
        if (typography(b.w, a.w)) { c.typography++; return; }
        const row = { before: b.w, after: a.w, sentence: sentence(body, a.at) };
        (!isWord(b.w) && isWord(a.w) ? c.nonWord : c.word).push(row);
      });
    } else if (now.length && now.length < before.length && before.filter((b) => isWord(b.w)).length < 2
      && distance(join(before), join(now)) <= 2) {
      // a word the text layer broke, joined, a letter or two restored ("réa ite"
      // → "réalité"); read line by line. Two words or more on the left side
      // would hide a word removed ("n a pa" → "a pas"): unexplained.
      c.word.push({ before: text(before), after: text(now), sentence: sentence(body, now[0].at) });
    } else c.unexplained.push(`« ${text(before)} » → « ${text(now)} » in: ${sentence(body, at)}`);
    return c;
  }
  for (const hunk of hunks(words(compared), after)) {
    let found = [classify(hunk)];
    if (found[0].unexplained.length && hunk.parts.length > 1) found = hunk.parts.map(classify);
    for (const c of found) {
      r.counts.typography += c.typography;
      r.counts.spacing += c.spacing;
      r.nonWord.push(...c.nonWord);
      r.word.push(...c.word);
      r.unexplained.push(...c.unexplained);
    }
  }

  // The title: only typography may change.
  const file = fs.readFileSync(path.join(root, md), "utf8");
  const oldTitle = JSON.parse(file.match(/^title: (.*)$/m)[1]);
  const [ot, nt] = [words(oldTitle), words(pass.title)];
  r.title = ot.length === nt.length && ot.every((x, i) => typography(x.w, nt[i].w)) ? pass.title : oldTitle;
  r.titleRefused = r.title === pass.title ? "" : pass.title;

  if (!r.unexplained.length && !/^editorial_pass:/m.test(file)) {
    const [, fm] = file.match(/^---\n([\s\S]*?)\n---\n/);
    const newFm = fm.replace(/^title: .*$/m, `title: ${JSON.stringify(r.title)}`) + `\neditorial_pass: "${today}"`;
    fs.writeFileSync(path.join(root, md), `---\n${newFm}\n---\n${pass.body}\n`);
  }
  r.promoted = !r.unexplained.length || /^editorial_pass:/m.test(file);
  rows.push(r);
  console.log(`${md}: ${r.promoted ? "promoted" : "NOT promoted"} | typography ${r.counts.typography}, spacing ${r.counts.spacing}, page numbers ${r.counts.pageNumbers}, print ${r.counts.print + r.counts.navigation}, glyphs ${r.counts.glyph}, non-word→word ${r.nonWord.length}, word→word ${r.word.length}, readings ${r.readings.length}, unexplained ${r.unexplained.length}`);
}
await db.close();

// ─── Report ──────────────────────────────────────────────────────────────────
const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const L = [`# Goal 10, batch ${batchId}: the check`, "", `Generated by \`scripts/86-check-editorial-pass.mjs ${batchId}\`.`, ""];
L.push("## Per text", "", "| Text | Promoted | Typography | Spacing | Page numbers | Print furniture | Glyphs | Non-word → word | Word → word | Readings inserted | Unexplained |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) L.push(`| \`${r.md.slice("markdown/".length)}\` | ${r.promoted ? "yes" : "**no**"} | ${r.counts.typography} | ${r.counts.spacing} | ${r.counts.pageNumbers} | ${r.counts.print + r.counts.navigation} | ${r.counts.glyph} | ${r.nonWord.length} | ${r.word.length} | ${r.readings.length} | ${r.unexplained.length} |`);
for (const [head, key] of [["Substitutions: a non-word corrected to a word", "nonWord"], ["Substitutions: a word replaced by another word", "word"]]) {
  L.push("", `## ${head}`, "", "| Text | Before | After | Sentence (after) |", "| --- | --- | --- | --- |");
  for (const r of rows) for (const s of r[key]) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(s.before)} | ${cell(s.after)} | ${cell(s.sentence)} |`);
}
L.push("", "## Segond readings inserted", "", "| Text | Announced as | Looked up under |", "| --- | --- | --- |");
for (const r of rows) for (const x of r.readings) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(x.said)} | ${x.ref} |`);
L.push("", "## Not accepted, per text", "");
for (const r of rows) {
  const items = [...r.unexplained, ...r.pass.unresolved.map((u) => `reading marker not resolved, nothing inserted: ${u}`)];
  if (items.length) L.push(`- \`${r.md.slice("markdown/".length)}\``, ...items.map((u) => `  - ${cell(u)}`));
}
L.push("", "## Headers removed (the frontmatter holds title, date, place)", "");
for (const r of rows) for (const h of r.removed) L.push(`- \`${path.basename(r.md, ".md")}\`: ${cell(h)}`);
L.push("", "## Sentences the pass left as they are (unclear)", "");
for (const r of rows) for (const u of r.pass.unclear) L.push(`- \`${path.basename(r.md, ".md")}\`: ${cell(u)}`);
L.push("", "## Titles", "", "| Text | Title | Proposed by the pass and refused (a word changed) |", "| --- | --- | --- |");
for (const r of rows) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(r.title)} | ${cell(r.titleRefused)} |`);
// gpt-6-sol, per million tokens: $2 in, $10 out (reasoning included)
const usage = rows.flatMap((r) => r.pass.usage);
const [tin, tout] = [usage.reduce((a, u) => a + u.prompt_tokens, 0), usage.reduce((a, u) => a + u.completion_tokens, 0)];
// The estimate given before the first run: $2.60 for 130,000 words.
const batchWords = rows.reduce((a, r) => a + r.words, 0);
L.push("", "## Spend", "", `${tin} tokens in, ${tout} out: $${((tin * 2 + tout * 10) / 1e6).toFixed(2)}, against an estimate of $${(batchWords * 2.6 / 130000).toFixed(2)} for ${batchWords} words. Extraction (LiteParse, mammoth) is local.`);
const out = path.join(root, `docs/goals/evidence/goal-10-batch-${batchId}.md`);
fs.writeFileSync(out, L.join("\n") + "\n");
console.log(`report → ${path.relative(root, out)}`);
