#!/usr/bin/env node
// Hash all PDFs and DOCX in onedrive/. Group by hash. Choose canonical:
// preference order: publication verified/ > top-level pdf/ > Not republished/.
// Writes manifests/onedrive-inventory.json with { canonical: [aliases...] } and stats.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const oneRoot = path.join(root, "onedrive");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".DS_Store") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile()) yield p;
  }
}

function hashFile(p) {
  const h = crypto.createHash("sha1");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}

function pathRank(p) {
  // Lower = preferred canonical
  if (p.includes("/publication verified/")) return 0;
  if (p.includes("/Not republished/")) return 2;
  return 1;
}

const all = [];
for (const f of walk(oneRoot)) {
  const ext = path.extname(f).toLowerCase();
  if (![".pdf", ".docx"].includes(ext)) continue;
  all.push({ path: f, ext, size: fs.statSync(f).size, hash: hashFile(f) });
}

// Group by hash
const byHash = new Map();
for (const f of all) {
  const arr = byHash.get(f.hash) ?? [];
  arr.push(f);
  byHash.set(f.hash, arr);
}

const groups = [...byHash.values()].map((files) => {
  files.sort((a, b) => pathRank(a.path) - pathRank(b.path) || a.path.localeCompare(b.path));
  return { canonical: files[0], aliases: files.slice(1), files };
});

const dupGroups = groups.filter((g) => g.aliases.length > 0);
const totalDupFiles = dupGroups.reduce((n, g) => n + g.aliases.length, 0);

const inventory = groups.map((g) => ({
  hash: g.canonical.hash,
  canonical_path: path.relative(root, g.canonical.path),
  ext: g.canonical.ext,
  size: g.canonical.size,
  aliases: g.aliases.map((a) => path.relative(root, a.path)),
}));

fs.mkdirSync(path.join(root, "manifests"), { recursive: true });
fs.writeFileSync(
  path.join(root, "manifests/onedrive-inventory.json"),
  JSON.stringify(inventory, null, 2),
);

console.log(`scanned: ${all.length} files`);
console.log(`unique:  ${groups.length} hashes`);
console.log(`dup groups: ${dupGroups.length}, redundant copies: ${totalDupFiles}`);
console.log(`by ext:`, [...new Set(inventory.map((i) => i.ext))]
  .map((e) => `${e}=${inventory.filter((i) => i.ext === e).length}`).join(" "));
