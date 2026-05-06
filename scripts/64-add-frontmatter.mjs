#!/usr/bin/env node
// Walk markdown/onedrive/, prepend YAML frontmatter from manifests/onedrive.json
// to each file. Strip already-existing frontmatter first (idempotent).

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));

function yamlString(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  // Always quote strings to be safe with French apostrophes/accents
  return JSON.stringify(String(v));
}

function makeFrontmatter(e) {
  const lines = ["---"];
  lines.push(`source: ${yamlString(e.source)}`);
  lines.push(`sermon_id: ${yamlString(e.sermon_id)}`);
  if (e.title) lines.push(`title: ${yamlString(e.title)}`);
  if (e.subtitle) lines.push(`subtitle: ${yamlString(e.subtitle)}`);
  if (e.date) lines.push(`date: ${yamlString(e.date)}`);
  if (e.year) lines.push(`year: ${e.year}`);
  if (e.location) lines.push(`location: ${yamlString(e.location)}`);
  if (e.preacher) lines.push(`preacher: ${yamlString(e.preacher)}`);
  if (e.source_path) lines.push(`source_path: ${yamlString(e.source_path)}`);
  if (e.hash) lines.push(`hash: ${yamlString(e.hash)}`);
  if (e.aliases?.length) {
    lines.push("aliases:");
    for (const a of e.aliases) lines.push(`  - ${yamlString(a)}`);
  }
  if (e.mevar_match) {
    lines.push("mevar_match:");
    lines.push(`  url: ${yamlString(e.mevar_match.url)}`);
    lines.push(`  title: ${yamlString(e.mevar_match.title)}`);
    lines.push(`  similarity: ${e.mevar_match.similarity}`);
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

let updated = 0;
for (const e of manifest) {
  const mdPath = path.join(root, e.local_md);
  if (!fs.existsSync(mdPath)) continue;
  let body = fs.readFileSync(mdPath, "utf8");
  // Strip existing frontmatter
  body = body.replace(/^---\n[\s\S]*?\n---\n+/, "");
  const fm = makeFrontmatter(e);
  fs.writeFileSync(mdPath, fm + body);
  updated++;
}
console.log(`prepended frontmatter to ${updated} files`);
