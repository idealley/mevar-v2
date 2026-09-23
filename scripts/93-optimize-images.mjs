#!/usr/bin/env node
// Re-encode every PNG, JPEG and GIF under images/ to WebP, inside 1600 px.
// Width and quality step down until the file is under 80 KB: the 8 MB budget
// for images/ over about 130 images. An animated GIF becomes an animated WebP.
// The original is removed and every link to it in markdown/ and
// manifests/mevar.json follows.
//
// Idempotent: a second run finds nothing left to re-encode.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const TARGET = 80 * 1024;
const ATTEMPTS = [[1600, 70], [1600, 55], [1200, 55], [1200, 45], [1000, 45], [800, 45], [800, 35], [600, 35]];

const renamed = new Map(); // images/.../x.png -> images/.../x.webp
for (const entry of fs.readdirSync(path.join(root, "images"), { recursive: true })) {
  const rel = path.join("images", entry);
  if (!/\.(png|jpe?g|gif)$/i.test(rel)) continue;
  const src = path.join(root, rel);
  const animated = (await sharp(src).metadata()).pages > 1;
  let out;
  for (const [size, quality] of ATTEMPTS) {
    out = await sharp(src, { animated })
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (out.length < TARGET) break;
  }
  const next = rel.replace(/\.[^.]+$/, ".webp");
  fs.writeFileSync(path.join(root, next), out);
  fs.rmSync(src);
  renamed.set(rel, next);
  console.log(`${rel}  ${(fs.statSync(path.join(root, next)).size / 1024).toFixed(0)} KB`);
}

// local_image is `images/...` (the card template adds the slash), body links
// from 92 are `/images/...`.
const relink = (text) =>
  text.replace(/(["(]\/?)(images\/[^")\s]+)/g, (_, open, rel) => open + (renamed.get(rel) ?? rel));

let files = 0;
const docs = fs.readdirSync(path.join(root, "markdown"), { recursive: true }).filter((f) => f.endsWith(".md"));
for (const doc of [...docs.map((f) => path.join("markdown", f)), "manifests/mevar.json"]) {
  const file = path.join(root, doc);
  const text = fs.readFileSync(file, "utf8");
  const next = relink(text);
  if (next !== text) { fs.writeFileSync(file, next); files++; }
}
console.log(`re-encoded: ${renamed.size}  files relinked: ${files}`);
