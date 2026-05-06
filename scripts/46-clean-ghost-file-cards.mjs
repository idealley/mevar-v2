#!/usr/bin/env node
// Clean Ghost CMS file-card embeds in mevar markdown bodies.
// Pattern looks like:
//
//   [
//   Le chant du coq et les sons...
//   le-chant-du-coq-et-les-sons-...pdf
//
//   343 KB
//
//   .a{fill:none;stroke:currentColor;...}download-circle
//
//   ](https://...pdf "Download")
//
// We extract the URL, lift it into frontmatter as `pdf_download:`,
// and replace the multi-line embed with a clean inline link line.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "markdown/mevar");

// Match the multi-line file-card markdown link.
// Group 1: inner content (title + filename + size + svg style + name)
// Group 2: URL
const FILE_CARD = /\[\s*\n([\s\S]*?download-circle[\s\S]*?)\n\]\(([^)]+?\.pdf)(?:\s+"[^"]*")?\)/g;

let modified = 0;
let extracted = 0;
let totalCards = 0;

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".md")) continue;
  const filePath = path.join(dir, f);
  const text = fs.readFileSync(filePath, "utf8");

  // Split frontmatter + body
  const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (!fmMatch) continue;
  let fm = fmMatch[1];
  let body = fmMatch[2];

  let firstUrl = null;
  let removed = 0;

  body = body.replace(FILE_CARD, (_match, _inner, url) => {
    totalCards++;
    removed++;
    firstUrl ??= url.trim();
    // Replace with a clean download line — markdown anchor only
    return `[Télécharger le PDF](${url.trim()})`;
  });

  if (removed === 0) continue;

  // Lift first PDF URL into frontmatter as pdf_download (don't overwrite existing
  // pdf_url, which usually points at a different asset like the cover image).
  if (firstUrl && !/^pdf_download:/m.test(fm)) {
    fm = fm.replace(/^---\n/, `---\npdf_download: ${JSON.stringify(firstUrl)}\n`);
    extracted++;
  }

  fs.writeFileSync(filePath, fm + body);
  modified++;
}

console.log(`mevar file-cards cleaned:`);
console.log(`  files modified:  ${modified}`);
console.log(`  cards replaced:  ${totalCards}`);
console.log(`  pdf_download lifted to frontmatter: ${extracted}`);
