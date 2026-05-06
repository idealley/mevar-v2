#!/usr/bin/env node
// Build manifests/mevar-pdfs-corpus.json with one entry per genuinely-new mevar PDF.
// Cross-link to its source mevar post for context (title, tags, year already in mevar manifest).

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const triage = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar-pdfs-triage.json"), "utf8"));
const mevarManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar.json"), "utf8"));
const mevarBySlug = new Map(mevarManifest.map((e) => [e.sermon_id, e]));

// Group by post_slug — all PDFs in unique bucket; multiple PDFs may have same post
const byPost = new Map();
for (const e of triage.buckets.unique) {
  const arr = byPost.get(e.post_slug) ?? [];
  arr.push(e);
  byPost.set(e.post_slug, arr);
}

const corpus = [];
for (const [slug, pdfs] of byPost) {
  const post = mevarBySlug.get(slug);
  for (const pdf of pdfs) {
    const filename = path.basename(pdf.local_path).replace(/\.pdf$/i, "");
    const sermonId = filename.replace(/[\s-]+/g, "_").replace(/__+/g, "_");
    corpus.push({
      source: "mevar-pdfs",
      sermon_id: sermonId,
      title: post?.title ?? filename.replace(/_/g, " "),
      year: post?.year ?? null,
      published_at: post?.published_at ?? null,
      pdf_url: pdf.pdf_url,
      pdf_path: pdf.local_path,
      mevar_post_slug: slug,
      mevar_post_url: post?.stream_url,
      tags: post?.tags ?? null,
      authors: post?.authors ?? null,
      local_md: `markdown/mevar-pdfs/${filename}.md`,
      sha1: pdf.sha1,
      size: pdf.size,
    });
  }
}

corpus.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));
fs.writeFileSync(path.join(root, "manifests/mevar-pdfs-corpus.json"), JSON.stringify(corpus, null, 2));
console.log(`mevar-pdfs corpus: ${corpus.length} truly-new PDFs`);
console.log(`  date range: ${corpus[0]?.published_at} → ${corpus.at(-1)?.published_at}`);
console.log(`  unique posts: ${byPost.size}`);
