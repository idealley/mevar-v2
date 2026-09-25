#!/usr/bin/env node
// Goal 10: the check that replaces reading every word of a batch.
//
// For each text of the batch it compares the original (.parse-cache/, from 84)
// with the pass (.pass-cache/, from 85) word by word and accepts only the
// changes goal 04 allows:
//   - whitespace, punctuation, paragraph breaks: not words, not compared (a
//     heading, HTML or an odd number of ** is unexplained);
//   - the preacher's bold stays on the same words; only a verse number in a
//     quote may become bold (counted);
//   - typography: case, œ/oe, an accent on a capital (Eglise → Église) when
//     the unaccented form is not a word (A → À is a substitution); a word in
//     capitals may get its accents back only in the title;
//   - spacing: a word split or joined with the same letters, a side not a
//     word (c omme → comme; "sur tout" → "surtout" is a substitution), and
//     digits in groups of three (50000 → 50 000);
//   - printed furniture removed, counted: a number of 1 to 3 digits alone on
//     its line that continues the pages' rising count (page number), the browser's print header and footer
//     ("…/exo_nov07.html  1/4", "13/03/2010  MEVAR"), the old site's "Haut de
//     page Retour Page d'accueil" bar, and a digit between two letters where
//     that digit does so five times or more (a glyph for "…");
//   - the document's header removed, listed: the original's words before
//     those the body opens with, within the first 80, holding the title;
//   - a reading inserted where the pass put a marker: a blockquote "> **1**…
//     (Réf)", which must equal the Segond verses in SurrealDB, for a
//     reference cited both in the original and in the paragraph before it.
// A word replaced by another is never accepted silently: it goes into the
// substitution table, as a non-word corrected to a word (the French Hunspell
// dictionary says which) or as a word replaced by a word; a word the PDF's
// text layer broke and the pass joined, a letter or two restored ("réa ite"
// → "réalité", at most one dictionary word on the left), goes to the latter.
// Any other change (a word added or removed, several words for a different
// number of others, a reading not Segond, not announced or not resolved) is
// unexplained, and the text is not written.
//
// A text with no unexplained change is written to markdown/: the pass's body,
// its title where only typography changed (also in manifests/onedrive.json,
// which 50 reads), and editorial_pass: "<date>". A text that already has
// editorial_pass is left as it is. The report goes to
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

// Words with their position, in NFC text; a number glued to letters is its
// own word ("11novembre1962"). Each knows whether it is bold (inside **…**)
// and whether its line is a quote ("> ").
function words(text) {
  const stars = [...text.matchAll(/\*\*/g)].map((m) => m.index);
  let s = 0;
  return [...text.matchAll(/[\p{L}\p{M}]+|\p{N}+/gu)].map((m) => {
    while (s < stars.length && stars[s] < m.index) s++;
    const line = text.lastIndexOf("\n", m.index) + 1;
    return { w: m[0], at: m.index, bold: s % 2 === 1, quote: text.startsWith(">", line) };
  });
}

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
// Typography: case, œ/oe, and an accent on a capital where the word without
// it is not a word ("Eglise" → "Église"; "A" → "À" is a word replaced by a
// word). A word in capitals has lost all its accents ("PECHE" is péché or
// pêche), so only a title may have them back ("LES FILS DU DESERT").
function typography(a, b, title = false) {
  if (fold(a) === fold(b)) return true;
  if (isWord(a.toLowerCase())) return false;
  if (title && a === a.toUpperCase() && bare(fold(a)) === bare(fold(b))) return true;
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
  const res = spawnSync("diff", [`${dir}/a`, `${dir}/b`], { encoding: "utf8", maxBuffer: 1 << 28 });
  fs.rmSync(dir, { recursive: true });
  if (res.status !== 0 && res.status !== 1) throw new Error(`diff failed: ${res.error ?? res.stderr}`);
  const out = res.stdout;
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
  // the words the diff left equal, pair by pair
  const equal = [];
  let [i, j] = [0, 0];
  for (const h of [...merged, { as: a.length, ae: a.length, bs: b.length, be: b.length }]) {
    while (i < h.as) equal.push([a[i++], b[j++]]);
    [i, j] = [h.ae, h.be];
  }
  return { changes: merged.map((h) => ({ ...slice(h), parts: h.parts.map(slice) })), equal };
}

function sentence(text, at) {
  const start = Math.max(...[".", "!", "?", "\n"].map((c) => text.lastIndexOf(c, at - 1))) + 1;
  const ends = [".", "!", "?", "\n"].map((c) => text.indexOf(c, at)).filter((i) => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : undefined).trim();
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));
const db = await connect();
const today = new Date().toISOString().slice(0, 10);
const rows = [];
for (const md of batch) {
  const rel = md.slice("markdown/".length);
  const original = fs.readFileSync(path.join(root, ".parse-cache", rel), "utf8").normalize("NFC");
  const pass = JSON.parse(fs.readFileSync(path.join(root, ".pass-cache", rel.replace(/\.md$/, ".json")), "utf8"));
  const r = { md, counts: { typography: 0, spacing: 0, pageNumbers: 0, print: 0, glyph: 0, verseNumbers: 0 }, nonWord: [], word: [], unexplained: [], readings: [], pass };

  // The inserted readings leave the compared text once they are verified:
  // the Segond verses, for a reference the original cites in the paragraph
  // the reading closes (same first verse; the same last one if it says one).
  const cited = [...citations(original)];
  let body = pass.body.normalize("NFC");
  const matches = (c, ref) => c.ref.includes("-") ? c.ref === ref
    : c.ref === ref.replace(/-\d+$/, "") || c.ref === ref.replace(/:.*$/, "");
  for (const { ref } of pass.readings) {
    const verses = await reading(db, ref);
    const inserted = verses && `\n\n${blockquote(verses, ref)}`;
    const at = inserted ? body.indexOf(inserted) : -1;
    const paragraph = body.slice(body.lastIndexOf("\n\n", at - 1) + 2, at);
    const announced = cited.find((c) => matches(c, ref));
    if (at < 0) r.unexplained.push(`reading ${ref} is not the Segond text`);
    else if (!announced || ![...citations(paragraph)].some((c) => matches(c, ref)))
      r.unexplained.push(`reading ${ref} inserted, but the paragraph before it and the original do not announce it`);
    else {
      body = body.replace(inserted, "");
      r.readings.push({ said: announced.text, ref });
    }
  }
  for (const u of pass.unresolved) r.unexplained.push(`reading announced as « ${u} » could not be resolved: nothing inserted`);
  for (const p of body.split(/\n\s*\n/)) {
    if ((p.match(/\*\*/g) ?? []).length % 2) r.unexplained.push(`an odd number of ** in: ${p.slice(0, 200)}`);
    if (/^#/m.test(p)) r.unexplained.push(`a heading, which a sermon has none of: ${p.slice(0, 200)}`);
    if (/<!--|<\/?[a-z][^>]*>/i.test(p)) r.unexplained.push(`HTML in: ${p.slice(0, 200)}`);
  }

  // The document's header: the original's words before the ones the body
  // opens with (6 of its first 8, the pass may have corrected one), within
  // the first 80, and only if they hold the title, as a header does; listed.
  const file = fs.readFileSync(path.join(root, md), "utf8");
  const oldTitle = JSON.parse(file.match(/^title: (.*)$/m)[1]);
  const after = words(body);
  const ow = words(original);
  r.words = ow.length;
  const k = ow.slice(0, 80).findIndex((_, i) => after.slice(0, 8).filter((x, j) => fold(x.w) === fold(ow[i + j]?.w ?? "")).length >= 6);
  const flat = (t) => words(t).map((x) => bare(fold(x.w))).join(" ");
  const header = k > 0 ? original.slice(0, ow[k].at) : "";
  const isHeader = [oldTitle, pass.title].some((t) => flat(t) && flat(header).includes(flat(t)));
  r.removed = isHeader ? [header.replace(/\s+/g, " ").trim()] : [];
  let compared = isHeader ? " ".repeat(ow[k].at) + original.slice(ow[k].at) : original;

  // Printed page furniture the pass removes: the old site's navigation bar,
  // the browser's print header and footer ("http://mevar.org/….html  1/4",
  // "13/03/2010  MEVAR"), a number of one to three digits alone on its line
  // (a page number), and a digit between two letters where the same digit
  // does that five times or more, a glyph that stood for "…" ("serviteur4ils").
  const glyphs = new Set([..."0123456789"].filter((d) => (compared.match(new RegExp(`(?<=\\p{L})${d}(?=\\p{L})`, "gu")) ?? []).length >= 5));
  const furniture = [
    [/^\s*Haut\s+de\s+page\s+Retour\s+Page\s+d['’]accueil\s*$/gm, "print"],
    [/^\s*\S*\.html?\s+\d+\/\d+\s*$/gm, "print"],
    [/^\s*\d{2}\/\d{2}\/\d{4}\s+MEVAR\s*$/gm, "print"],
  ];
  if (glyphs.size) furniture.push([new RegExp(`(?<=\\p{L})[${[...glyphs].join("")}](?=\\p{L})`, "gu"), "glyph"]);
  for (const [re, kind] of furniture)
    compared = compared.replace(re, (m) => { r.counts[kind]++; return " ".repeat(m.length); });
  // Page numbers go up: a number alone on its line is one only if it is
  // above the last one by 1 or 2 (a page may have none).
  let page = 0;
  compared = compared.replace(/^[#*_ ]*(\d{1,3})[*_ ]*$/gm, (m, n) => {
    if (Number(n) <= page || Number(n) > page + 2) return m;
    page = Number(n);
    r.counts.pageNumbers++;
    return " ".repeat(m.length);
  });

  const text = (xs) => xs.map((x) => x.w).join(" ");
  const join = (xs) => fold(xs.map((x) => x.w).join(""));
  // Reads one change; returns what it found, without touching r.
  function classify({ before, after: now, at }) {
    const c = { typography: 0, spacing: 0, nonWord: [], word: [], unexplained: [] };
    const both = [...before, ...now];
    if (before.length && now.length && join(before) === join(now) && before.length !== now.length) {
      // A split or join of the same letters: spacing where a side is not a
      // word ("c omme" → "comme"); a substitution where all are words ("si
      // non" → "sinon", as "sur tout" → "surtout" would be); for digits, only
      // the thousands separator ("50000" → "50 000") is typography.
      if (both.every((x) => /^\d+$/.test(x.w))) {
        if (before.length === 1 && now.slice(1).every((x) => x.w.length === 3)) c.typography++;
        else c.unexplained.push(`« ${text(before)} » → « ${text(now)} » in: ${sentence(body, at)}`);
      } else if (both.some((x) => /^\d+$/.test(x.w))) c.unexplained.push(`« ${text(before)} » → « ${text(now)} » in: ${sentence(body, at)}`);
      else if (both.some((x) => !isWord(x.w))) c.spacing++;
      else c.word.push({ before: text(before), after: text(now), sentence: sentence(body, now[0].at) });
    } else if (before.length === now.length) {
      before.forEach((b, i) => {
        const a = now[i];
        if (b.w === a.w) return;
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
  const { changes, equal } = hunks(words(compared), after);
  // The preacher's bold: on the same words, except a verse number in a quote.
  let run = null;
  const flush = () => { if (run) r.unexplained.push(`bold ${run.added ? "added to" : "removed from"} « ${run.words.join(" ")} » in: ${sentence(body, run.at)}`); run = null; };
  for (const [o, n] of equal) {
    const verse = !o.bold && n.bold && n.quote && /^\d+$/.test(n.w);
    if (verse) r.counts.verseNumbers++;
    if (o.bold === n.bold || verse) { flush(); continue; }
    if (run && run.added === n.bold) run.words.push(n.w);
    else { flush(); run = { added: n.bold, words: [n.w], at: n.at }; }
  }
  flush();
  for (const hunk of changes) {
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
  const [ot, nt] = [words(oldTitle), words(pass.title)];
  r.title = ot.length === nt.length && ot.every((x, i) => typography(x.w, nt[i].w, true)) ? pass.title : oldTitle;
  r.titleRefused = r.title === pass.title ? "" : pass.title;

  const [, fm] = file.match(/^---\n([\s\S]*?)\n---\n/);
  const promoted = /^editorial_pass:/m.test(fm);
  if (!r.unexplained.length && !promoted) {
    const newFm = fm.replace(/^title: .*$/m, () => `title: ${JSON.stringify(r.title)}`) + `\neditorial_pass: "${today}"`;
    fs.writeFileSync(path.join(root, md), `---\n${newFm}\n---\n${pass.body}\n`);
    // 50 takes index.json's titles from the manifest
    manifest.find((e) => e.local_md === md).title = r.title;
  }
  r.promoted = !r.unexplained.length || promoted;
  rows.push(r);
  console.log(`${md}: ${r.promoted ? "promoted" : "NOT promoted"} | typography ${r.counts.typography}, spacing ${r.counts.spacing}, page numbers ${r.counts.pageNumbers}, print ${r.counts.print}, glyphs ${r.counts.glyph}, non-word→word ${r.nonWord.length}, word→word ${r.word.length}, readings ${r.readings.length}, unexplained ${r.unexplained.length}`);
}
await db.close();
fs.writeFileSync(path.join(root, "manifests/onedrive.json"), JSON.stringify(manifest, null, 2));

// ─── Report ──────────────────────────────────────────────────────────────────
const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const L = [`# Goal 10, batch ${batchId}: the check`, "", `Generated by \`scripts/86-check-editorial-pass.mjs ${batchId}\`.`, ""];
L.push("## Per text", "", "| Text | Promoted | Typography | Spacing | Page numbers | Print furniture | Glyphs | Verse numbers bolded | Non-word → word | Word → word | Readings inserted | Unexplained |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) L.push(`| \`${r.md.slice("markdown/".length)}\` | ${!r.promoted ? "**no**" : r.unexplained.length ? "yes (kept from an earlier run)" : "yes"} | ${r.counts.typography} | ${r.counts.spacing} | ${r.counts.pageNumbers} | ${r.counts.print} | ${r.counts.glyph} | ${r.counts.verseNumbers} | ${r.nonWord.length} | ${r.word.length} | ${r.readings.length} | ${r.unexplained.length} |`);
for (const [head, key] of [["Substitutions: a non-word corrected to a word", "nonWord"], ["Substitutions: a word replaced by another word", "word"]]) {
  L.push("", `## ${head}`, "", "| Text | Before | After | Sentence (after) |", "| --- | --- | --- | --- |");
  for (const r of rows) for (const s of r[key]) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(s.before)} | ${cell(s.after)} | ${cell(s.sentence)} |`);
}
L.push("", "## Segond readings inserted", "", "| Text | Announced as | Looked up under |", "| --- | --- | --- |");
for (const r of rows) for (const x of r.readings) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(x.said)} | ${x.ref} |`);
L.push("", "## Not accepted, per text", "");
for (const r of rows) {
  if (r.unexplained.length) L.push(`- \`${r.md.slice("markdown/".length)}\``, ...r.unexplained.map((u) => `  - ${cell(u)}`));
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
L.push("", "## Spend", "", `${tin} tokens in, ${tout} out: $${((tin * 2 + tout * 10) / 1e6).toFixed(2)}, against an estimate of $${(batchWords * 2.6 / 130000).toFixed(2)} for ${batchWords} words. Extraction (pdftohtml) is local.`);
const out = path.join(root, `docs/goals/evidence/goal-10-batch-${batchId}.md`);
fs.writeFileSync(out, L.join("\n") + "\n");
console.log(`report → ${path.relative(root, out)}`);
