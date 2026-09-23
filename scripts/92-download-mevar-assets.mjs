#!/usr/bin/env node
// Download every asset markdown/mevar/ and markdown/mevar-pdfs/ link on the
// two Ghost hosts, and point the markdown at our copy.
//
//   images -> images/mevar/content/<name>   files -> files/mevar/<name>
//
// The original file name is kept; two URLs with the same name are both
// prefixed with their `YYYY-MM` path segment. A mevar.org file already in
// pdfs/mevar-cdn/ (80-download-mevar-pdfs.mjs) is copied instead of fetched.
//
// Rewrite: body links become root-relative. Frontmatter keeps the remote URL
// as provenance and gains `local_pdf:` after `pdf_download:` / `pdf_url:`.
// `feature_image:` is 90-download-mevar-images.mjs's. A URL that does not
// answer 200 is left as it is and listed.
//
// Idempotent: files on disk are not fetched again, a rewritten file is only
// written when it changes.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const DIRS = ["markdown/mevar", "markdown/mevar-pdfs"];
const URL_RE = /https:\/\/(?:mevar\.org\/content\/(?:images|files)|digitalpress\.fra1\.cdn\.digitaloceanspaces\.com)\/[^)"\s<>\]]+/g;
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;

const docs = DIRS.flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".md")).map((f) => path.join(root, dir, f)),
);
const split = (text) => text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/).slice(1);
const assetLines = (fm) => fm.split("\n").filter((l) => !l.startsWith("feature_image:"));

const urls = new Set();
for (const file of docs) {
  const [fm, body] = split(fs.readFileSync(file, "utf8"));
  for (const u of [...assetLines(fm).join("\n").matchAll(URL_RE), ...body.matchAll(URL_RE)]) urls.add(u[0]);
}

const nameOf = (url) => decodeURIComponent(url.split("/").pop());
const byName = new Map();
for (const url of urls) byName.set(nameOf(url), (byName.get(nameOf(url)) ?? 0) + 1);

const local = new Map(); // url -> { disk, href }
for (const url of urls) {
  let name = nameOf(url);
  if (byName.get(name) > 1) name = `${url.match(/\/(\d{4})\/(\d{2})\/[^/]+$/).slice(1).join("-")}-${name}`;
  const dir = IMAGE_RE.test(name) ? "images/mevar/content" : "files/mevar";
  local.set(url, { disk: path.join(root, dir, name), href: `/${dir}/${encodeURIComponent(name)}` });
}

let fetched = 0, copied = 0, onDisk = 0;
const dead = [];
const queue = [...local];
async function worker() {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const [url, { disk }] = item;
    if (fs.existsSync(disk)) { onDisk++; continue; }
    fs.mkdirSync(path.dirname(disk), { recursive: true });
    const cdn = path.join(root, "pdfs/mevar-cdn", nameOf(url));
    if (url.startsWith("https://mevar.org/content/files/") && fs.existsSync(cdn)) {
      fs.copyFileSync(cdn, disk);
      copied++;
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) { dead.push(`${res.status} ${url}`); local.delete(url); continue; }
    fs.writeFileSync(disk, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

let rewritten = 0;
for (const file of docs) {
  const text = fs.readFileSync(file, "utf8");
  const [fm, body] = split(text);
  const lines = fm.split("\n").filter((l) => !l.startsWith("local_pdf:"));
  const out = [];
  for (const line of lines) {
    out.push(line);
    const url = line.match(/^(?:pdf_download|pdf_url): "(.*)"$/)?.[1];
    if (local.has(url)) out.push(`local_pdf: ${JSON.stringify(local.get(url).href)}`);
  }
  const next = out.join("\n") + body.replace(URL_RE, (u) => local.get(u)?.href ?? u);
  if (next !== text) { fs.writeFileSync(file, next); rewritten++; }
}

console.log(`urls: ${urls.size}  fetched: ${fetched}  copied from pdfs/: ${copied}  already on disk: ${onDisk}`);
console.log(`markdown files rewritten: ${rewritten}`);
console.log(`dead (${dead.length}):${dead.sort().map((d) => `\n  ${d}`).join("")}`);
