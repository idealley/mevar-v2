#!/usr/bin/env node
// Goal 10: the text of a OneDrive work as its original has it, before 65's
// old canonical rewrites and the DeepSeek cleanup, into
// .parse-cache/<path under markdown/>. The editorial pass starts from there,
// and the check compares against it.
//
// The PDF's own text layer through pdftohtml (poppler, the engine of
// pdftotext): the same words as LiteParse, and the preacher's bold, which he
// uses for what he holds important, as **…**. A bold run that starts or ends
// inside a word covers the whole word; a run is closed at the end of each
// line. (LlamaParse was tried and rewrites words: "vends" → "vendis".)
// Lines are the PDF's; the pass rejoins them.
//
// A text already in .parse-cache/ is not extracted again.
//
// Usage: node scripts/84-extract-originals.mjs <batch>   (a key of
// scripts/mevar-editorial-batches.json, e.g. 01). Needs pdftohtml
// (brew install poppler) and the OneDrive folder at onedrive/ (gitignored).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[process.argv[2]];

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] !== "#" ? entities[e] ?? m : String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))));

function text(pdf) {
  const html = spawnSync("pdftohtml", ["-i", "-noframes", "-stdout", "-q", pdf], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (html.status !== 0) throw new Error(`${pdf}: ${html.stderr}`);
  const B = "\u0001", E = "\u0002"; // bold start and end, until they become **
  const t = decode(html.stdout.slice(html.stdout.indexOf(">", html.stdout.indexOf("<body")) + 1)
    .replace(/<a name=\d+><\/a>|<hr\/?>|<br\/>/g, "\n")
    .replace(/<b>/g, B).replace(/<\/b>/g, E)
    .replace(/<[^>]+>/g, ""))
    .replace(/ /g, " ");
  // Bold never crosses a line: it is closed at the end of each line and
  // opened again on the next, so every line is balanced.
  let on = false;
  const lines = t.split("\n").map((l) => {
    const opened = on;
    for (const c of l) if (c === B) on = true; else if (c === E) on = false;
    return (opened ? B : "") + l + (on ? E : "");
  });
  return lines.join("\n")
    .replace(new RegExp(`${E}([ \\t]*)${B}`, "g"), "$1")                       // one run within a line
    .replace(new RegExp(`${B}([^\\p{L}\\p{N}${B}${E}]*)${E}`, "gu"), "$1")      // bold with no word in it, first
    .replace(new RegExp(`${B}(\\s*)`, "g"), `$1${B}`).replace(new RegExp(`(\\s*)${E}`, "g"), `${E}$1`)
    .replace(new RegExp(`([\\p{L}\\p{N}]+)${B}(?=[\\p{L}\\p{N}])`, "gu"), `${B}$1`) // inside a word: to its start
    .replace(new RegExp(`(?<=[\\p{L}\\p{N}])${E}([\\p{L}\\p{N}]+)`, "gu"), `$1${E}`) // inside a word: to its end
    .replace(new RegExp(`[${B}${E}]`, "g"), "**");
}

for (const md of batch) {
  const out = path.join(root, ".parse-cache", md.slice("markdown/".length));
  if (fs.existsSync(out)) continue;
  const stem = "onedrive/" + md.slice("markdown/onedrive/".length, -".md".length);
  const hits = inventory.filter((e) => [e.canonical_path, ...e.aliases].some((p) => p.replace(/\.[^.]+$/, "") === stem));
  const pick = hits.find((e) => e.ext === ".pdf");
  if (!pick) throw new Error(`${md}: no PDF original in manifests/onedrive-inventory.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text(path.join(root, pick.canonical_path)));
  console.log(`${md} ← ${pick.canonical_path}`);
}
