#!/usr/bin/env node
// Convert all .docx in onedrive/ to markdown in markdown/onedrive/, mirroring tree.

import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const root = path.resolve(import.meta.dirname, "..");
const oneRoot = path.join(root, "onedrive");
const outRoot = path.join(root, "markdown", "onedrive");

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".docx")) yield p;
  }
}

let done = 0, failed = 0;
for (const docx of walk(oneRoot)) {
  const rel = path.relative(oneRoot, docx);
  const outPath = path.join(outRoot, rel.replace(/\.docx$/i, ".md"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    const result = await mammoth.convertToMarkdown({ path: docx });
    fs.writeFileSync(outPath, result.value);
    done++;
  } catch (e) {
    console.error(`  fail: ${rel}: ${e.message}`);
    failed++;
  }
}

console.log(`docx: ${done} ok, ${failed} failed`);
