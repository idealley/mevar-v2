#!/usr/bin/env node
// Detect mevar article series from Ghost HTML kg-bookmark cards.
//
// Source of truth: Ghost's "internal link" cards rendered as
//   <figure class="kg-card kg-bookmark-card">
//     <a class="kg-bookmark-container" href="__GHOST_URL__/<slug>/">…</a>
//   </figure>
// — the `__GHOST_URL__` prefix is unambiguous: it's an internal site link.
//
// Approach:
//   1. Walk Ghost JSON posts; extract internal-bookmark targets per post.
//   2. Build an undirected graph (each bookmark = edge).
//   3. Connected components = series.
//   4. Order members chronologically (published_at), and parse explicit
//      part numbers from slugs (-1, -2, -3, -premiere/-deuxieme/-partie-N)
//      to override when present.
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

// ── 2. Connected components ─────────────────────────────────────────────────
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
for (const [slug, targets] of links) {
  for (const t of targets) union(slug, t);
}

const groups = new Map(); // root → [slugs]
for (const slug of links.keys()) {
  const r = find(slug);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(slug);
}

// ── 3. Order + name each series ─────────────────────────────────────────────
function partFromSlug(slug) {
  // Explicit numeric suffix: -1 / -2 / -3 …
  const num = slug.match(/-(\d+)$/);
  if (num) return Number(num[1]);
  // French ordinals
  const ord = slug.match(/-(premi[èe]re|deuxi[èe]me|troisi[èe]me|quatri[èe]me|cinqui[èe]me|sixi[èe]me|septi[èe]me)-partie/);
  if (ord) {
    const map = { premiere: 1, première: 1, deuxieme: 2, deuxième: 2, troisieme: 3, troisième: 3, quatrieme: 4, quatrième: 4, cinquieme: 5, cinquième: 5, sixieme: 6, sixième: 6, septieme: 7, septième: 7 };
    return map[ord[1]] ?? null;
  }
  // "partie-N" anywhere
  const partN = slug.match(/partie-(\d+)/);
  if (partN) return Number(partN[1]);
  return null;
}

function commonPrefix(strings) {
  if (!strings.length) return "";
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return "";
  }
  return prefix;
}

const series = [];
for (const [root_, members] of groups) {
  if (members.length < 2) continue;
  const enriched = members.map((slug) => {
    const p = bySlug.get(slug);
    return {
      slug,
      title: p.title,
      published_at: p.published_at,
      explicit_part: partFromSlug(slug),
    };
  });
  enriched.sort((a, b) => {
    if (a.explicit_part != null && b.explicit_part != null) return a.explicit_part - b.explicit_part;
    if (a.explicit_part != null) return -1;
    if (b.explicit_part != null) return 1;
    return new Date(a.published_at) - new Date(b.published_at);
  });

  // Series name = trimmed common title prefix, or fall back to first title
  let name = commonPrefix(enriched.map((e) => e.title))
    .replace(/[\s\-–—:,.]+$/u, "")
    .trim();
  if (name.length < 8) {
    // Common prefix too short — strip a "– La paix" / "- 2" / "- partie 5" tail from first title
    name = enriched[0].title
      .replace(/\s*[–\-—]\s*(premi[èe]re|deuxi[èe]me|troisi[èe]me|quatri[èe]me|cinqui[èe]me)?\s*partie\s*\d*\s*$/i, "")
      .replace(/\s*[–\-—]\s*\d+\s*$/, "")
      .replace(/[\s\-–—:,.]+$/u, "")
      .trim();
  }
  // Trim trailing "(1)", "(2)", "- 1", "– N" leftover from first member's title
  name = name
    .replace(/\s*\(\s*\d+\s*\)\s*$/, "")
    .replace(/\s*[–\-—]\s*\d+\s*$/, "")
    .replace(/[\s\-–—:,.]+$/u, "")
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

// ── 4. Write manifest ───────────────────────────────────────────────────────
const outPath = path.join(root, "manifests/mevar-series.json");
fs.writeFileSync(outPath, JSON.stringify(series, null, 2));
console.log(`detected ${series.length} series across ${series.reduce((n, s) => n + s.members.length, 0)} posts → ${path.relative(root, outPath)}`);
for (const s of series) {
  console.log(`  ${s.id}  (${s.members.length})  "${s.name}"`);
}

// ── 5. Lift series fields into each member's frontmatter ────────────────────
let touched = 0;
for (const s of series) {
  for (const m of s.members) {
    const mdPath = path.join(root, "markdown/mevar", `${m.slug}.md`);
    if (!fs.existsSync(mdPath)) continue;
    const text = fs.readFileSync(mdPath, "utf8");
    const fmMatch = text.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
    if (!fmMatch) continue;
    let fm = fmMatch[2];
    const body = fmMatch[4];

    // Strip prior series_id / series / series_part lines (so re-runs stay clean)
    fm = fm
      .split("\n")
      .filter((l) => !/^(series_id|series|series_part|series_total):/.test(l))
      .join("\n");

    fm += `\nseries_id: ${JSON.stringify(s.id)}`;
    fm += `\nseries: ${JSON.stringify(s.name)}`;
    fm += `\nseries_part: ${m.part}`;
    fm += `\nseries_total: ${s.members.length}`;

    fs.writeFileSync(mdPath, fmMatch[1] + fm + fmMatch[3] + body);
    touched++;
  }
}
console.log(`patched ${touched} mevar markdown files with series fields`);
