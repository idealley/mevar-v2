#!/usr/bin/env node
// Rewrite every `preacher` to its display name in scripts/preachers.mjs: the
// frontmatter in markdown/ and the manifests (50 builds index.json from them,
// and 73 writes the frontmatter from them). A spelling the registry does not
// know fails the step, nothing is written: add it to preachers.mjs. The Ghost
// `authors` are checked, not rewritten: Ghost holds the display names, and the
// site matches them exactly, so any other spelling fails too.
// Idempotent. Run 50-build-index.mjs after it.
//
//   node scripts/67-normalize-preachers.mjs

import fs from "node:fs";
import path from "node:path";
import { PREACHERS, key } from "./preachers.mjs";

const root = path.resolve(import.meta.dirname, "..");

const NAME = new Map();
for (const p of PREACHERS) for (const s of [p.name, ...p.variants]) NAME.set(key(s), p.name);

const unknown = new Set();
const display = (s) => NAME.get(key(s)) ?? (unknown.add(s), s);
const author = (s) => display(s) === s || unknown.add(s);
// Our writers quote a value; YAML also reads it bare or in single quotes.
const scalar = (v) => (v.startsWith('"') ? JSON.parse(v) : v.replace(/^'(.*)'$/, "$1"));

const writes = [];

for (const f of fs.readdirSync(path.join(root, "manifests"))) {
  const p = path.join(root, "manifests", f);
  const text = fs.readFileSync(p, "utf8");
  const entries = JSON.parse(text);
  if (!Array.isArray(entries)) continue;
  for (const e of entries) {
    if (typeof e.preacher === "string") e.preacher = display(e.preacher);
    for (const a of e.authors ?? []) author(a);
  }
  const out = JSON.stringify(entries, null, 2);
  if (out !== text) writes.push([p, out]);
}

for (const rel of fs.readdirSync(path.join(root, "markdown"), { recursive: true })) {
  if (!rel.endsWith(".md")) continue;
  const p = path.join(root, "markdown", rel);
  const text = fs.readFileSync(p, "utf8");
  const end = text.indexOf("\n---\n", 4) + 1;
  const fm = text.slice(0, end)
    .replace(/^preacher: (.+)$/m, (_, v) => `preacher: ${JSON.stringify(display(scalar(v)))}`)
    .replace(/^authors:\n((?: {2}- .*\n)+)/m, (block, list) => {
      for (const [, a] of list.matchAll(/^ {2}- (.+)$/gm)) author(scalar(a));
      return block;
    });
  if (fm !== text.slice(0, end)) writes.push([p, fm + text.slice(end)]);
}

if (unknown.size) {
  console.error(`not in scripts/preachers.mjs, nothing written:\n${[...unknown].map((s) => `  ${JSON.stringify(s)}`).join("\n")}`);
  process.exit(1);
}
for (const [p, out] of writes) fs.writeFileSync(p, out);
console.log(`${writes.length} files rewritten (${writes.filter(([p]) => p.endsWith(".json")).length} manifests)`);
