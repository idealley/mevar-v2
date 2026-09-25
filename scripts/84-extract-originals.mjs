#!/usr/bin/env node
// Goal 10: the text of a OneDrive or PDF work as its original has it, before
// 65's old canonical rewrites and the DeepSeek cleanup, into
// .parse-cache/<path under markdown/>. The editorial pass starts from there.
//
//   .docx (preferred when OneDrive has both) → mammoth
//   .pdf → LlamaParse, tier cost_effective (3 credits a page)
//
// A text already in .parse-cache/ is never parsed again, so a rerun spends
// nothing. The originals are the OneDrive folder at onedrive/ (gitignored, as
// for 60 and 61) and the mevar.org PDFs under web/public/files/.
//
// Usage: node scripts/84-extract-originals.mjs <batch>   (a key of
// scripts/mevar-editorial-batches.json, e.g. 01)
// Needs LLAMAPARSE_API_KEY (the root .env; from a worktree,
// DOTENV_CONFIG_PATH=<root>/.env).

import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const LLAMA = "https://api.cloud.llamaindex.ai/api/v2/parse";
const auth = { Authorization: `Bearer ${process.env.LLAMAPARSE_API_KEY}` };

function original(md) {
  if (md.startsWith("markdown/mevar-pdfs/")) {
    const localPdf = fs.readFileSync(path.join(root, md), "utf8").match(/^local_pdf: "(.+)"$/m)[1];
    return path.join(root, "web/public", localPdf);
  }
  const stem = "onedrive/" + md.slice("markdown/onedrive/".length, -".md".length);
  const hits = inventory.filter((e) => [e.canonical_path, ...e.aliases].some((p) => p.replace(/\.[^.]+$/, "") === stem));
  const pick = hits.find((e) => e.ext === ".docx") ?? hits.find((e) => e.ext === ".pdf");
  if (!pick) throw new Error(`${md}: no original in manifests/onedrive-inventory.json`);
  return path.join(root, pick.canonical_path);
}

async function llamaParse(pdf) {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(pdf)], { type: "application/pdf" }), path.basename(pdf));
  form.append("configuration", JSON.stringify({ tier: "cost_effective", version: "latest" }));
  const job = await (await fetch(`${LLAMA}/upload`, { method: "POST", headers: auth, body: form })).json();
  if (!job.id) throw new Error(`${pdf}: ${JSON.stringify(job).slice(0, 300)}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await (await fetch(`${LLAMA}/${job.id}?expand=markdown`, { headers: auth })).json();
    if (res.job.status === "COMPLETED") return res.markdown.pages.map((p) => p.markdown);
    if (res.job.status === "FAILED" || res.job.status === "CANCELLED") throw new Error(`${pdf}: ${res.job.status}`);
  }
}

let pages = 0;
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[process.argv[2]];
await Promise.all(batch.map(async (md) => {
  const out = path.join(root, ".parse-cache", md.slice("markdown/".length));
  if (fs.existsSync(out)) return;
  const src = original(md);
  let text;
  if (src.endsWith(".docx")) text = (await mammoth.convertToMarkdown({ path: src })).value;
  else {
    const p = await llamaParse(src);
    pages += p.length;
    text = p.join("\n\n");
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log(`${md} ← ${path.relative(root, src)}`);
}));
console.log(`LlamaParse: ${pages} pages, ${pages * 3} credits`);
