#!/usr/bin/env node
// Goal 10: the check that replaces reading every word of a batch.
//
// For each text of the batch it compares the original (.parse-cache/, from 84)
// with the pass (.pass-cache/, from 85) word by word and accepts only the
// changes goal 04 allows:
//   - whitespace, punctuation, markup, paragraph breaks: not words, not compared;
//   - typography: case, an accent on a capital (Eglise → Église), œ/oe;
//   - spacing: a word split or joined with the same letters (c omme → comme);
//   - page numbers removed;
//   - the document's header removed: the "#" lines the original opens with
//     (title, "Prêché le … à …", which the frontmatter holds), and the old
//     site's "Haut de page Retour Page d'accueil" bar; each is listed;
//   - a reading inserted where the pass put a marker: " (Réf)" and the
//     blockquote, which must equal the Segond verses in SurrealDB exactly.
// A word replaced by another is never accepted silently: it goes into the
// substitution table, as a non-word corrected to a word (the French Hunspell
// dictionary says which) or as a word replaced by a word. Any other change
// (a word added or removed, a reading that is not Segond) is unexplained, and
// the text is not written.
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
import { connect, reading, blockquote } from "./segond.mjs";

const root = path.resolve(import.meta.dirname, "..");
const batchId = process.argv[2];
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[batchId];
const spell = nspell(dictionary);
const isWord = (w) => spell.correct(w) || spell.correct(w.toLowerCase());

// Words with their position; HTML tags (<u> from LlamaParse) are markup.
function words(text) {
  return [...text.replace(/<\/?[a-z]+>/gi, (t) => " ".repeat(t.length)).matchAll(/[\p{L}\p{N}]+/gu)]
    .map((m) => ({ w: m[0], at: m.index }));
}

const fold = (w) => w.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
const bare = (w) => w.normalize("NFD").replace(/\p{Diacritic}/gu, "");
function typography(a, b) {
  if (fold(a) === fold(b)) return true;
  // an accent on a capital: "Eglise" → "Église", "A" → "À"
  return a[0] !== a[0].toLowerCase() && b[0] !== b[0].toLowerCase()
    && bare(a[0]) === bare(b[0]) && fold(a.slice(1)) === fold(b.slice(1));
}

// Myers diff of two word lists, through diff(1): hunks of [before, after].
function hunks(a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goal10-"));
  fs.writeFileSync(`${dir}/a`, a.map((x) => x.w).join("\n") + "\n");
  fs.writeFileSync(`${dir}/b`, b.map((x) => x.w).join("\n") + "\n");
  const out = spawnSync("diff", [`${dir}/a`, `${dir}/b`], { encoding: "utf8", maxBuffer: 1 << 28 }).stdout;
  fs.rmSync(dir, { recursive: true });
  const range = (s) => { const [x, y = x] = s.split(",").map(Number); return [x, y]; };
  return [...out.matchAll(/^(\d+(?:,\d+)?)([acd])(\d+(?:,\d+)?)$/gm)].map((m) => {
    const [a1, a2] = range(m[1]), [b1, b2] = range(m[3]);
    return {
      before: m[2] === "a" ? [] : a.slice(a1 - 1, a2),
      after: m[2] === "d" ? [] : b.slice(b1 - 1, b2),
      at: b[Math.max(b1 - 1, 0)]?.at ?? 0, // where it is in the new text
    };
  });
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
  const r = { md, counts: { typography: 0, spacing: 0, pageNumbers: 0 }, nonWord: [], word: [], unexplained: [], readings: [], pass };

  // The inserted readings leave the compared text once they are verified.
  let body = pass.body;
  for (const { said, ref } of pass.readings) {
    const inserted = ` (${ref})\n\n${blockquote(await reading(db, ref))}`;
    if (!body.includes(inserted)) { r.unexplained.push(`reading ${ref} is not the Segond text`); continue; }
    body = body.replace(inserted, "");
    r.readings.push({ said, ref });
  }

  // The header and the navigation bar leave the original; the report lists them.
  const lines = original.split("\n");
  const opening = lines.findIndex((l) => l.trim() && !l.startsWith("#"));
  r.removed = lines.slice(0, opening).filter((l) => l.trim());
  const nav = /^(<u>)?Haut de page(<\/u>)? (<u>)?Retour(<\/u>)? (<u>)?Page d['’]accueil(<\/u>)?$/;
  r.removed.push(...lines.filter((l) => nav.test(l.trim())));
  const compared = lines.slice(opening).filter((l) => !nav.test(l.trim())).join("\n");

  const after = words(body);
  for (const { before, after: now, at } of hunks(words(compared), after)) {
    const join = (xs) => fold(xs.map((x) => x.w).join(""));
    if (before.length && now.length && join(before) === join(now) && before.length !== now.length) r.counts.spacing++;
    else if (!now.length && before.every((x) => /^\d+$/.test(x.w))) r.counts.pageNumbers += before.length;
    else if (before.length === now.length) {
      before.forEach((b, i) => {
        const a = now[i];
        if (typography(b.w, a.w)) { r.counts.typography++; return; }
        const row = { before: b.w, after: a.w, sentence: sentence(body, a.at) };
        if (!isWord(b.w) && isWord(a.w)) r.nonWord.push(row);
        else r.word.push(row);
      });
    } else {
      r.unexplained.push(`« ${before.map((x) => x.w).join(" ")} » → « ${now.map((x) => x.w).join(" ")} » in: ${sentence(body, at)}`);
    }
  }

  // The title: only typography may change.
  const oldTitle = JSON.parse(fs.readFileSync(path.join(root, md), "utf8").match(/^title: (.*)$/m)[1]);
  const [ot, nt] = [words(oldTitle), words(pass.title)];
  r.title = ot.length === nt.length && ot.every((x, i) => typography(x.w, nt[i].w)) ? pass.title : oldTitle;

  const file = fs.readFileSync(path.join(root, md), "utf8");
  r.written = false;
  if (!r.unexplained.length && !/^editorial_pass:/m.test(file)) {
    const [, fm] = file.match(/^---\n([\s\S]*?)\n---\n/);
    const newFm = fm.replace(/^title: .*$/m, `title: ${JSON.stringify(r.title)}`) + `\neditorial_pass: "${today}"`;
    fs.writeFileSync(path.join(root, md), `---\n${newFm}\n---\n${pass.body}\n`);
    r.written = true;
  }
  r.promoted = /^editorial_pass:/m.test(fs.readFileSync(path.join(root, md), "utf8"));
  rows.push(r);
  console.log(`${md}: ${r.promoted ? "promoted" : "NOT promoted"} | typography ${r.counts.typography}, spacing ${r.counts.spacing}, page numbers ${r.counts.pageNumbers}, non-word→word ${r.nonWord.length}, word→word ${r.word.length}, readings ${r.readings.length}, unexplained ${r.unexplained.length}`);
}
await db.close();

// ─── Report ──────────────────────────────────────────────────────────────────
const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const L = [`# Goal 10, batch ${batchId}: the check`, "", `Generated by \`scripts/86-check-editorial-pass.mjs ${batchId}\`.`, ""];
L.push("## Per text", "", "| Text | Promoted | Typography | Spacing | Page numbers | Non-word → word | Word → word | Readings inserted | Unexplained |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) L.push(`| \`${r.md.slice("markdown/".length)}\` | ${r.promoted ? "yes" : "**no**"} | ${r.counts.typography} | ${r.counts.spacing} | ${r.counts.pageNumbers} | ${r.nonWord.length} | ${r.word.length} | ${r.readings.length} | ${r.unexplained.length} |`);
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
L.push("", "## Header lines removed", "");
for (const r of rows) for (const h of r.removed) L.push(`- \`${path.basename(r.md, ".md")}\`: ${cell(h)}`);
L.push("", "## Sentences the pass left as they are (unclear)", "");
for (const r of rows) for (const u of r.pass.unclear) L.push(`- \`${path.basename(r.md, ".md")}\`: ${cell(u)}`);
L.push("", "## Titles", "", "| Text | Title |", "| --- | --- |");
for (const r of rows) L.push(`| \`${path.basename(r.md, ".md")}\` | ${cell(r.title)} |`);
// gpt-6-sol, per million tokens: $2 in, $10 out (reasoning included)
const usage = rows.flatMap((r) => r.pass.usage);
const [tin, tout] = [usage.reduce((a, u) => a + u.prompt_tokens, 0), usage.reduce((a, u) => a + u.completion_tokens, 0)];
L.push("", "## Spend", "", `${tin} tokens in, ${tout} out: $${((tin * 2 + tout * 10) / 1e6).toFixed(2)}.`);
const out = path.join(root, `docs/goals/evidence/goal-10-batch-${batchId}.md`);
fs.writeFileSync(out, L.join("\n") + "\n");
console.log(`report → ${path.relative(root, out)}`);
