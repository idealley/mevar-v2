#!/usr/bin/env node
// Goal 10: the text of a OneDrive work as its original has it, before 65's
// old canonical rewrites and the DeepSeek cleanup, into
// .parse-cache/<path under markdown/>. The editorial pass starts from there,
// and the check compares against it.
//
// The PDF through LiteParse without OCR: its own text layer, word for word
// (LlamaParse was tried and rewrites words: "vends" → "vendis").
//
// A text already in .parse-cache/ is not extracted again. The originals are
// the OneDrive folder at onedrive/ (gitignored, as for 60 and 61).
//
// Usage: node scripts/84-extract-originals.mjs <batch>   (a key of
// scripts/mevar-editorial-batches.json, e.g. 01)

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[process.argv[2]];

for (const md of batch) {
  const out = path.join(root, ".parse-cache", md.slice("markdown/".length));
  if (fs.existsSync(out)) continue;
  const stem = "onedrive/" + md.slice("markdown/onedrive/".length, -".md".length);
  const hits = inventory.filter((e) => [e.canonical_path, ...e.aliases].some((p) => p.replace(/\.[^.]+$/, "") === stem));
  const pick = hits.find((e) => e.ext === ".pdf");
  if (!pick) throw new Error(`${md}: no PDF original in manifests/onedrive-inventory.json`);
  const src = path.join(root, pick.canonical_path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // Through a temporary file, so a failed parse never leaves a text 85 and 86 would trust.
  const lit = spawnSync(path.join(root, "node_modules/.bin/lit"), ["parse", "-q", "--no-ocr", "-o", `${out}.part`, src], { encoding: "utf8" });
  if (lit.status !== 0) throw new Error(`${src}: ${lit.stderr}`);
  fs.renameSync(`${out}.part`, out);
  console.log(`${md} ← ${pick.canonical_path}`);
}
