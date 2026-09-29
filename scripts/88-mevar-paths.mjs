#!/usr/bin/env node
// Goal 19: a text goal 10 has promoted leaves markdown/onedrive/ or
// markdown/mevar-pdfs/ for markdown/mevar/<title>-<year>.md, beside the Ghost
// posts, and is served at /<slug>/ (Samuel, 2026-09-29: « it also
// immediately helps to understand where this article is situated in time »).
//
// The name is the title and the year, as a URL writes them; no year when the
// title holds one (« 2013-annee-de-mission »); the month when two texts would
// share a name (« la-guerre-de-liberation-avril-2007 »). A name a Ghost post
// already has stops the script.
//
// The moved file records where it came from, `source_path`, and keeps its
// `source`; every reference to its old path follows it: the manifests'
// `local_md`, manifests/bible-refs.json's keys, `published_with` and
// `duplicate_of`. The pipeline keeps the original path as its key (the
// batches, the editor's fixes, the heading decisions, the caches); 86 finds
// the text through `located()`. A second run is a no-op.
//
// Usage: node scripts/88-mevar-paths.mjs [--dry]

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MEVAR = "markdown/mevar";
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

const frontmatter = (text) => text.slice(4, text.indexOf("\n---\n", 4));
const field = (fm, k) => JSON.parse(fm.match(new RegExp(`^${k}: (.*)$`, "m"))?.[1] ?? "null");

/** Where a goal 10 text is now: its original path, or the mevar/ file that records it as its source. */
export function located(md) {
  if (fs.existsSync(path.join(root, md))) return md;
  for (const f of fs.readdirSync(path.join(root, MEVAR)))
    if (f.endsWith(".md") && frontmatter(fs.readFileSync(path.join(root, MEVAR, f), "utf8")).includes(`\nsource_path: ${JSON.stringify(md.slice("markdown/".length))}`)) return `${MEVAR}/${f}`;
  return md;
}

const slug = (t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Only when run, not when 86 imports located().
if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes("--dry");
  const texts = [];
  for (const dir of ["markdown/onedrive", "markdown/mevar-pdfs"])
    for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true }).sort()) {
      if (!rel.endsWith(".md")) continue;
      const md = `${dir}/${rel}`;
      const text = fs.readFileSync(path.join(root, md), "utf8");
      const fm = frontmatter(text);
      if (!/^editorial_pass:/m.test(fm) || /^duplicate_of:/m.test(fm)) continue;
      const date = field(fm, "date") ?? "";
      const year = String(field(fm, "year") ?? date.slice(0, 4) ?? "");
      const base = slug(field(fm, "title"));
      texts.push({ md, text, base, year, month: MONTHS[Number(date.slice(5, 7)) - 1] });
    }

  // the name: title and year; with the month where two would be the same
  const name = (t, month) => [t.base, /(^|-)\d{4}(-|$)/.test(t.base) ? "" : [month && t.month, t.year].filter(Boolean).join("-")].filter(Boolean).join("-");
  const counts = new Map();
  for (const t of texts) counts.set(name(t), (counts.get(name(t)) ?? 0) + 1);
  const ghost = new Set(fs.readdirSync(path.join(root, MEVAR)).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
  for (const t of texts) {
    t.slug = counts.get(name(t)) > 1 ? name(t, true) : name(t);
    t.to = `${MEVAR}/${t.slug}.md`;
  }
  const clash = texts.filter((t) => ghost.has(t.slug) || texts.filter((u) => u.slug === t.slug).length > 1);
  if (clash.length) {
    for (const t of clash) console.error(`${t.md}: « ${t.slug} » is taken`);
    process.exit(1);
  }
  for (const t of texts) console.log(`${t.md} → ${t.to}${t.year ? "" : "  (no year)"}`);
  console.log(`${texts.length} texts to move`);
  if (dry || !texts.length) process.exit(0);

  const moved = new Map(texts.map((t) => [t.md, t.to]));
  const work = (p) => p.replace(/^markdown\//, "").replace(/\.md$/, "");
  const workMoved = new Map(texts.map((t) => [work(t.md), work(t.to)]));

  for (const t of texts) {
    const text = t.text.replace(/^(source: .*)$/m, `$1\nsource_path: ${JSON.stringify(t.md.slice("markdown/".length))}`);
    fs.writeFileSync(path.join(root, t.to), text);
    fs.rmSync(path.join(root, t.md));
  }

  // published_with and duplicate_of, wherever they name a moved text
  for (const rel of fs.readdirSync(path.join(root, "markdown"), { recursive: true })) {
    if (!rel.endsWith(".md") || rel.startsWith("branham/")) continue;
    const p = path.join(root, "markdown", rel);
    const text = fs.readFileSync(p, "utf8");
    const next = text.replace(/^(published_with|duplicate_of): "([^"]+)"$/gm, (l, k, v) => workMoved.has(v) ? `${k}: ${JSON.stringify(workMoved.get(v))}` : l);
    if (next !== text) fs.writeFileSync(p, next);
  }
  // the manifests' local_md
  for (const f of ["onedrive.json", "mevar-pdfs-corpus.json"]) {
    const p = path.join(root, "manifests", f);
    const entries = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const e of entries) if (moved.has(e.local_md)) e.local_md = moved.get(e.local_md);
    fs.writeFileSync(p, JSON.stringify(entries, null, 2));
  }
  // bible-refs.json's keys, in their order
  const refsPath = path.join(root, "manifests/bible-refs.json");
  const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
  fs.writeFileSync(refsPath, JSON.stringify(Object.fromEntries(Object.entries(refs).map(([k, v]) => [moved.get(k) ?? k, v])), null, 2));
  console.log(`moved ${texts.length}`);
}
