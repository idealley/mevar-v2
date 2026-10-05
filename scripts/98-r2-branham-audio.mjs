#!/usr/bin/env node
// Goal 26: Branham's recordings served from our domain.
//
// Every Branham page linked its recording on branham.org's CDN, which can
// move or delete it, as goal 24 found for the PDFs. For every Branham work
// with an `audio_url`, this script takes the recording (the local copy in
// audio/branham/<path>.m4a, gitignored, downloaded once from its audio_url
// and refused unless it is an MP4 file), uploads it to the R2 bucket as
// audio/branham/<path>.m4a when the bucket does not hold the same bytes, and
// names it in the work's `local_audio`, which the page plays. The remote
// `audio_url` stays.
//
// Idempotent: a second run downloads and uploads nothing and changes no
// frontmatter. It deletes nothing, in the bucket or elsewhere. A recording
// that cannot be had fails the run.
//
// Usage: node scripts/98-r2-branham-audio.mjs [--dry]. Needs the `cf` CLI
// logged in to the account that holds the bucket.

import fs from "node:fs";
import path from "node:path";
import { frontmatter, field, setField } from "./frontmatter.mjs";
import { put, url } from "./r2.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");

// an MP4 file (.m4a) names its type, « ftyp », in bytes 4 to 8
const isMp4 = (buf) => buf.subarray(4, 8).toString() === "ftyp";
const isMp4File = (file) => { try { const h = Buffer.alloc(8); const fd = fs.openSync(file, "r"); fs.readSync(fd, h, 0, 8, 0); fs.closeSync(fd); return isMp4(h); } catch { return false; } };

async function download(from, file) {
  const res = await fetch(from);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || !isMp4(buf)) throw new Error(`${from}: HTTP ${res.status}, not an MP4 file`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.part`, buf);
  fs.renameSync(`${file}.part`, file);
}

const works = [];
for (const rel of fs.readdirSync(path.join(root, "markdown/branham"), { recursive: true }).sort()) {
  if (!rel.endsWith(".md")) continue;
  const md = path.join("markdown/branham", rel);
  const text = fs.readFileSync(path.join(root, md), "utf8");
  const audioUrl = field(frontmatter(text), "audio_url");
  if (audioUrl) works.push({ rel: rel.replace(/\.md$/, ""), md, text, audioUrl });
}

let downloaded = 0, uploaded = 0, frontmatters = 0;
const missing = [];
const queue = [...works];
async function worker() {
  for (let w; (w = queue.shift()); ) {
    const key = `audio/branham/${w.rel}.m4a`;
    const file = path.join(root, key);
    // a cached file that is not an MP4 (an error page) is downloaded again
    if (!isMp4File(file)) {
      downloaded++;
      if (dry) continue;
      try { await download(w.audioUrl, file); } catch (e) { missing.push(`${w.md} (${e.message})`); continue; }
    }
    if (await put(key, file, "audio/mp4", dry)) uploaded++;
    const text = setField(w.text, "local_audio", url(key));
    if (text !== w.text) { frontmatters++; if (!dry) fs.writeFileSync(path.join(root, w.md), text); }
  }
}
// branham.org's CDN serves about 265 KB/s a connection: 16 at a time
await Promise.all(Array.from({ length: 16 }, worker));
console.log(`${works.length} works with an audio_url; ${downloaded} downloaded, ${uploaded} uploaded, ${frontmatters} frontmatters${dry ? " (dry)" : ""}`);
// every work must have its recording: one missing fails the run
if (missing.length) { console.error(`no recording for ${missing.length}: ${missing.slice(0, 10).join(", ")}`); process.exit(1); }
