#!/usr/bin/env node
// Process the Ghost export into clean per-post markdown with proper frontmatter.
//
// Additive: markdown/mevar/ is ours once written. Only slugs with no file yet
// are created; posts Ghost has edited since their file was imported are
// printed so a human can decide what to carry over. manifests/mevar.json keeps
// the Ghost `updated_at` of the version each file was imported from, and it
// only moves when 45 writes the file, so an edited post stays listed. File
// mtimes would not do: they are checkout times on a fresh clone.
//
// Usage:
//   node scripts/45-process-ghost.mjs [export.json]   # default: newest mevar.ghost.*.json at the repo root
//
// Output:
//   markdown/mevar/<slug>.md (new slugs only)
//   manifests/mevar.json (new structure with tags, authors, status, type)
//   manifests/mevar-tags.json (tag taxonomy)
//   manifests/mevar-authors.json (author roster)

import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";
import { resolveGhostExport } from "./ghost-export.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "markdown", "mevar");

const ghostFile = resolveGhostExport(root);
console.log(`ghost export: ${path.relative(root, ghostFile)}`);

const exp = JSON.parse(fs.readFileSync(ghostFile, "utf8"));
const data = exp.db[0].data;
const posts = data.posts ?? [];
const tags = data.tags ?? [];
const users = data.users ?? [];
const postsTags = data.posts_tags ?? [];
const postsAuthors = data.posts_authors ?? [];

// Build lookup maps
const tagById = new Map(tags.map((t) => [t.id, t]));
const userById = new Map(users.map((u) => [u.id, u]));

const tagsByPost = new Map(); // post_id → [tag, ...]
for (const pt of postsTags.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
  const t = tagById.get(pt.tag_id);
  if (!t) continue;
  if (!tagsByPost.has(pt.post_id)) tagsByPost.set(pt.post_id, []);
  tagsByPost.get(pt.post_id).push(t);
}

const authorsByPost = new Map(); // post_id → [user, ...]
for (const pa of postsAuthors.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
  const u = userById.get(pa.author_id);
  if (!u) continue;
  if (!authorsByPost.has(pa.post_id)) authorsByPost.set(pa.post_id, []);
  authorsByPost.get(pa.post_id).push(u);
}

// HTML → markdown
const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});
// Strip Ghost's empty <figure> wrappers and bookmark cards that turn into noise
td.addRule("ghost-bookmark", {
  filter: (n) => n.nodeName === "FIGURE" && n.classList?.contains("kg-bookmark-card"),
  replacement: (_content, node) => {
    const a = node.querySelector("a");
    return a ? `[${a.textContent.trim()}](${a.getAttribute("href")})` : "";
  },
});

function yamlString(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(String(v));
}

fs.mkdirSync(outDir, { recursive: true });

function replaceGhostUrls(s) {
  return (s ?? "").replace(/__GHOST_URL__/g, "https://mevar.org");
}

const IMPORT_TAG_RE = /^#Import\b/;

// Existing manifest entries carry fields added downstream (local_image, …).
// Ghost owns the fields it exports; everything else is preserved.
const manifestPath = path.join(root, "manifests/mevar.json");
const existingBySlug = new Map(
  JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    .map((e) => [e.sermon_id, e]),
);

const manifest = [];
const newSlugs = [];
const editedOnGhost = [];
for (const post of posts) {
  const html = replaceGhostUrls(post.html ?? "");
  const md = html ? td.turndown(html) : replaceGhostUrls(post.plaintext ?? "");

  const allTags = tagsByPost.get(post.id) ?? [];
  const postTags = allTags.filter((t) => !IMPORT_TAG_RE.test(t.name));
  const importTags = allTags.filter((t) => IMPORT_TAG_RE.test(t.name));
  const postAuthors = authorsByPost.get(post.id) ?? [];

  const prev = existingBySlug.get(post.slug);
  const url = post.canonical_url || `https://mevar.org/${post.slug}/`;
  const publishedAt = post.published_at ?? post.created_at;
  const publishedDate = publishedAt ? publishedAt.slice(0, 10) : null;

  // content_year: prefer a year-tag (e.g. "2008") since published_at is often migration date.
  let contentYear = null;
  for (const t of postTags) {
    if (/^(19|20)\d{2}$/.test(t.name)) { contentYear = Number(t.name); break; }
  }
  const year = contentYear ?? (publishedDate ? Number(publishedDate.slice(0, 4)) : null);

  // Frontmatter
  const fm = ["---"];
  fm.push(`source: "mevar"`);
  fm.push(`sermon_id: ${yamlString(post.slug)}`);
  fm.push(`title: ${yamlString(post.title)}`);
  if (year) fm.push(`year: ${year}`);
  if (publishedDate) fm.push(`published_at: ${yamlString(publishedDate)}`);
  fm.push(`type: ${yamlString(post.type)}`);
  fm.push(`status: ${yamlString(post.status)}`);
  fm.push(`url: ${yamlString(url)}`);
  if (post.featured) fm.push(`featured: true`);
  if (post.feature_image) fm.push(`feature_image: ${yamlString(replaceGhostUrls(post.feature_image))}`);
  if (post.custom_excerpt) fm.push(`excerpt: ${yamlString(post.custom_excerpt)}`);
  if (post.visibility && post.visibility !== "public") fm.push(`visibility: ${yamlString(post.visibility)}`);
  if (postTags.length) {
    fm.push("tags:");
    for (const t of postTags) fm.push(`  - ${yamlString(t.name)}`);
  }
  if (postAuthors.length) {
    fm.push("authors:");
    for (const a of postAuthors) fm.push(`  - ${yamlString(a.name)}`);
  }
  fm.push(`ghost_id: ${yamlString(post.id)}`);
  fm.push(`uuid: ${yamlString(post.uuid)}`);
  fm.push("---");
  fm.push("");

  const filePath = path.join(outDir, `${post.slug}.md`);
  const exists = fs.existsSync(filePath);
  // A file with no manifest entry (imported by hand) adopts this export's version.
  const imported = exists ? prev?.updated_at ?? post.updated_at : post.updated_at;
  if (exists) {
    // Existing markdown is ours — cleaned, patched, hand-edited. Never overwrite.
    if (post.updated_at > imported) {
      editedOnGhost.push({ slug: post.slug, was: imported, now: post.updated_at });
    }
  } else {
    fs.writeFileSync(filePath, fm.join("\n") + md + "\n");
    newSlugs.push(post.slug);
  }

  const entry = {
    source: "mevar",
    sermon_id: post.slug,
    title: post.title,
    year,
    published_at: publishedDate,
    type: post.type,
    status: post.status,
    featured: !!post.featured,
    visibility: post.visibility,
    excerpt: post.custom_excerpt,
    feature_image: post.feature_image ? replaceGhostUrls(post.feature_image) : null,
    tags: postTags.map((t) => t.name),
    tag_slugs: postTags.map((t) => t.slug),
    authors: postAuthors.map((a) => a.name),
    pdf_url: null,
    audio_url: null,
    stream_url: url,
    pathname: new URL(url).pathname.replace(/\/$/, "") || "/",
    ghost_id: post.id,
    uuid: post.uuid,
    updated_at: imported,
    has_import_tag: importTags.length > 0,
  };
  manifest.push(prev ? { ...prev, ...entry } : entry);
}

manifest.sort((a, b) => {
  const ya = a.year ?? 0, yb = b.year ?? 0;
  if (ya !== yb) return yb - ya;
  return (b.published_at ?? "").localeCompare(a.published_at ?? "");
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Tag taxonomy + author roster
const tagsOut = tags
  .filter((t) => !IMPORT_TAG_RE.test(t.name))
  .map((t) => ({
    name: t.name,
    slug: t.slug,
    description: t.description,
    visibility: t.visibility,
    post_count: [...tagsByPost.values()].filter((arr) => arr.some((x) => x.id === t.id)).length,
  }))
  .sort((a, b) => b.post_count - a.post_count);
fs.writeFileSync(path.join(root, "manifests/mevar-tags.json"), JSON.stringify(tagsOut, null, 2));

const authorsOut = users.map((u) => ({
  name: u.name,
  slug: u.slug,
  email: u.email,
  status: u.status,
  post_count: [...authorsByPost.values()].filter((arr) => arr.some((x) => x.id === u.id)).length,
})).filter((a) => a.post_count > 0).sort((a, b) => b.post_count - a.post_count);
fs.writeFileSync(path.join(root, "manifests/mevar-authors.json"), JSON.stringify(authorsOut, null, 2));

console.log(`mevar markdown:`);
console.log(`  posts in export: ${posts.length}`);
console.log(`  new slugs written: ${newSlugs.length}`);
for (const slug of newSlugs) console.log(`    + ${slug}`);
console.log(`  edited on Ghost since their file was imported: ${editedOnGhost.length}`);
for (const e of editedOnGhost) console.log(`    ~ ${e.slug} (${e.was} → ${e.now})`);
console.log(`  tags: ${tagsOut.length} (${tagsOut.filter((t) => t.post_count > 0).length} in use)`);
console.log(`  authors: ${authorsOut.length}`);
console.log(`  date range: ${manifest.at(-1)?.published_at} → ${manifest[0]?.published_at}`);
