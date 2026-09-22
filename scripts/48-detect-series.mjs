#!/usr/bin/env node
// Detect mevar article series from Ghost HTML kg-bookmark cards.
//
// Source of truth: Ghost's "internal link" cards rendered as
//   <figure class="kg-card kg-bookmark-card">
//     <a class="kg-bookmark-container" href="__GHOST_URL__/<slug>/">…</a>
//   </figure>
// — the `__GHOST_URL__` prefix is unambiguous: it's an internal site link.
//
// A link alone is NOT a series: Ghost bookmark cards are also used for
// "see also" and for announcements ("Nouveau site web" links to three
// unrelated articles). An edge only counts as a series edge when the two
// posts also share a title stem, or both carry an explicit part number and
// those numbers differ. And a series stays within one kind: a sermon and the
// exhortation on the same theme ("L'esprit babylonien") are related, not parts.
//
// Approach:
//   1. Walk Ghost JSON posts; extract internal-bookmark targets per post.
//   2. Keep only the bookmark pairs that pass the series test above.
//   3. Connected components over the kept edges = series.
//   4. Order members by explicit part number when both have one, else by date.
//   5. Pick a series name = longest common title prefix, fallback to the
//      first member's title minus the part suffix.
//   6. Write manifests/mevar-series.json and lift `series` / `series_part`
//      into each member's frontmatter (idempotent).

import fs from "node:fs";
import path from "node:path";
import { resolveGhostExport } from "./ghost-export.mjs";

const root = path.resolve(import.meta.dirname, "..");
const ghostJsonPath = resolveGhostExport(root);
const dump = JSON.parse(fs.readFileSync(ghostJsonPath, "utf8"));
const posts = dump.db[0].data.posts.filter((p) => p.status === "published" && p.type === "post");

const bySlug = new Map(posts.map((p) => [p.slug, p]));

// ── 1. Extract internal bookmark targets per slug ───────────────────────────
const bookmarkRe = /<a class="kg-bookmark-container"[^>]*href="__GHOST_URL__\/([^"\/]+)\/?"/g;
const links = new Map(); // slug → Set<slug>
for (const p of posts) {
  const targets = new Set();
  if (!p.html) continue;
  let m;
  bookmarkRe.lastIndex = 0;
  while ((m = bookmarkRe.exec(p.html)) !== null) {
    const target = m[1];
    if (target !== p.slug && bySlug.has(target)) targets.add(target);
  }
  if (targets.size) links.set(p.slug, targets);
}

// ── 2. Keep only the pairs that look like a series ──────────────────────────
// Explicit part number: "(3)", "(Partie 5)", "— deuxième partie", slug "-2".
const ORDINALS = { premiere: 1, deuxieme: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7 };
const deaccent = (s_) => s_.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function partOf(post) {
  const title = deaccent(post.title);
  const paren = title.match(/\(\s*(?:partie\s*)?(\d+)\s*\)/);
  if (paren) return Number(paren[1]);
  const ordinal = title.match(/(premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme|septieme)\s*partie/);
  if (ordinal) return ORDINALS[ordinal[1]];
  const partN = title.match(/partie\s*(\d+)/);
  if (partN) return Number(partN[1]);
  return partFromSlug(post.slug);
}

// Title without its part marker, as lowercase accent-free words.
function stemWords(post) {
  return deaccent(post.title)
    .replace(/\(\s*(?:partie\s*)?\d+\s*\)/g, " ")
    .replace(/(premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme|septieme)\s*partie/g, " ")
    .replace(/partie\s*\d+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Two titles share a stem when their first words agree: at least 2 words and
// 8 characters, enough to separate "Le fruit de l'Esprit – La joie" from
// "Le royaume de Dieu".
function sharesStem(a, b) {
  const wa = stemWords(a), wb = stemWords(b);
  let n = 0;
  while (n < wa.length && n < wb.length && wa[n] === wb[n]) n++;
  return n >= 2 && wa.slice(0, n).join(" ").length >= 8;
}

// Kind tags, in the order web/src/lib/utils.ts deriveKind reads them.
const KIND_TAGS = ["Prédications", "Exhortations", "Etudes Bibliques", "Publications"];
const tagsBySlug = new Map(
  JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar.json"), "utf8")).map((e) => [e.sermon_id, e.tags]),
);
const kindOf = (post) => KIND_TAGS.find((t) => tagsBySlug.get(post.slug).includes(t));

function isSeriesPair(a, b) {
  if (kindOf(a) !== kindOf(b)) return false;
  if (sharesStem(a, b)) return true;
  const pa = partOf(a), pb = partOf(b);
  return pa != null && pb != null && pa !== pb;
}

// ── 3. Connected components over the kept edges ─────────────────────────────
const parent = new Map();
function find(x) {
  if (!parent.has(x)) parent.set(x, x);
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));
    x = parent.get(x);
  }
  return x;
}
function union(a, b) {
  const ra = find(a), rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
}

const linked = new Set(); // every slug that survived at least one edge
const rejected = [];
for (const [slug, targets] of links) {
  for (const t of targets) {
    if (isSeriesPair(bySlug.get(slug), bySlug.get(t))) {
      union(slug, t);
      linked.add(slug);
      linked.add(t);
    } else {
      rejected.push(`${slug} → ${t}`);
    }
  }
}

const groups = new Map(); // root → [slugs]
for (const slug of linked) {
  const r = find(slug);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(slug);
}

// ── 4. Order + name each series ─────────────────────────────────────────────
function partFromSlug(slug) {
  // Explicit single-digit suffix: -1 / -2 / -3 … (a 4-digit tail is a year)
  const num = slug.match(/-(\d)$/);
  if (num) return Number(num[1]);
  // French ordinals
  const ord = slug.match(/-(premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme|septieme)-partie/);
  if (ord) return ORDINALS[ord[1]];
  // "partie-N" anywhere
  const partN = slug.match(/partie-(\d+)/);
  if (partN) return Number(partN[1]);
  return null;
}

// Case and apostrophe shape are ignored, so "Faire front par la Foi" agrees
// with "Faire front par la foi" and "l’Esprit" with "l'Esprit"; the prefix is
// returned with the first title's own spelling.
const prefixKey = (s) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'");
function commonPrefix(strings) {
  if (!strings.length) return "";
  let n = strings[0].length;
  for (const s of strings.slice(1)) {
    while (n && prefixKey(s.slice(0, n)) !== prefixKey(strings[0].slice(0, n))) n--;
    if (!n) return "";
  }
  return strings[0].slice(0, n);
}

const series = [];
for (const [root_, members] of groups) {
  const enriched = members.map((slug) => {
    const p = bySlug.get(slug);
    return {
      slug,
      title: p.title,
      published_at: p.published_at,
      explicit_part: partOf(p),
    };
  });
  // Part numbers order two members that both carry one; otherwise publication
  // date does. "Le nouveau ministère" (no number) came out a week before its
  // "deuxième partie", and must not sort after it.
  enriched.sort((a, b) => {
    if (a.explicit_part != null && b.explicit_part != null) return a.explicit_part - b.explicit_part;
    return new Date(a.published_at) - new Date(b.published_at);
  });

  // Series name = trimmed common title prefix, or fall back to first title
  let name = commonPrefix(enriched.map((e) => e.title))
    .replace(/[\s\-–—:,.(]+$/u, "")
    .trim();
  if (name.length < 8) {
    // Common prefix too short — strip a "– La paix" / "- 2" / "- partie 5" tail from first title
    name = enriched[0].title
      .replace(/\s*[–\-—]\s*(premi[èe]re|deuxi[èe]me|troisi[èe]me|quatri[èe]me|cinqui[èe]me)?\s*partie\s*\d*\s*$/i, "")
      .replace(/\s*[–\-—]\s*\d+\s*$/, "")
      .replace(/[\s\-–—:,.(]+$/u, "")
      .trim();
  }
  // Trim trailing "(1)", "(2)", "- 1", "– N" leftover from first member's title
  name = name
    .replace(/\s*\(\s*\d+\s*\)\s*$/, "")
    .replace(/\s*[–\-—]\s*\d+\s*$/, "")
    .replace(/[\s\-–—:,.(]+$/u, "")
    .trim();

  const id = enriched[0].slug.replace(/-\d+$/, "").replace(/-(premi[èe]re|deuxi[èe]me|troisi[èe]me|quatri[èe]me)-partie$/, "");
  series.push({
    id,
    name,
    members: enriched.map((e, i) => ({
      slug: e.slug,
      title: e.title,
      published_at: e.published_at,
      part: i + 1,
    })),
  });
}

series.sort((a, b) => a.id.localeCompare(b.id));

// ── 5. Write manifest ───────────────────────────────────────────────────────
const outPath = path.join(root, "manifests/mevar-series.json");
fs.writeFileSync(outPath, JSON.stringify(series, null, 2));
console.log(`detected ${series.length} series across ${series.reduce((n, s) => n + s.members.length, 0)} posts → ${path.relative(root, outPath)}`);
for (const s of series) {
  console.log(`  ${s.id}  (${s.members.length})  "${s.name}"`);
  for (const m of s.members) console.log(`      ${m.part}. ${m.slug}  —  ${m.title}`);
}
console.log(`rejected ${rejected.length} bookmark pairs (different kinds, or no shared stem or part numbers):`);
for (const r of rejected) console.log(`  ${r}`);

// ── 6. Lift series fields into every mevar markdown ─────────────────────────
// Rewritten from scratch each run: a post that leaves a series must lose its
// series fields too.
const memberOf = new Map(); // slug → { series, member }
for (const s of series) for (const m of s.members) memberOf.set(m.slug, { s, m });

let touched = 0;
const mdDir = path.join(root, "markdown/mevar");
for (const file of fs.readdirSync(mdDir).filter((f) => f.endsWith(".md"))) {
  const mdPath = path.join(mdDir, file);
  const text = fs.readFileSync(mdPath, "utf8");
  const fmMatch = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  if (!fmMatch) continue;

  let fm = fmMatch[2]
    .split("\n")
    .filter((l) => !/^(series_id|series|series_part|series_total):/.test(l))
    .join("\n");

  const hit = memberOf.get(path.basename(file, ".md"));
  if (hit) {
    fm += `\nseries_id: ${JSON.stringify(hit.s.id)}`;
    fm += `\nseries: ${JSON.stringify(hit.s.name)}`;
    fm += `\nseries_part: ${hit.m.part}`;
    fm += `\nseries_total: ${hit.s.members.length}`;
  }

  const out = fmMatch[1] + fm + fmMatch[3] + fmMatch[4];
  if (out !== text) {
    fs.writeFileSync(mdPath, out);
    touched++;
  }
}
console.log(`patched ${touched} mevar markdown files with series fields`);
