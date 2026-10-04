#!/usr/bin/env node
// Goal 25: the Ghost posts' recordings and videos, back on their pages.
//
// The Ghost ingest kept a post's text and dropped its SoundCloud or YouTube
// embed; the SoundCloud tracks are gone. Samuel found the recordings
// (audio/, gitignored); scripts/mevar-media.json names the one each post
// gets, and its YouTube video. For each recording, this script makes a mono
// 64 kbit/s MP3 named after the post (audio/mp3/<slug>.mp3: Safari does not
// play the Ogg Vorbis most of them are), uploads it to the R2 bucket as
// audio/<slug>.mp3 when the bucket does not hold the same bytes, and names
// it in the post's `local_audio`; each video goes in its `video_url`.
//
// Idempotent: an MP3 already made is kept (ffmpeg's bit-exact output is the
// same each run anyway), a second run uploads nothing and changes no
// frontmatter. It deletes nothing, in the bucket or elsewhere.
//
// Usage: node scripts/97-mevar-media.mjs [--dry]. Needs ffmpeg, and the `cf`
// CLI logged in to the account that holds the bucket.

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setField } from "./frontmatter.mjs";
import { put, url } from "./r2.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const media = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-media.json"), "utf8"));

const fields = new Map(); // post → [[key, value]]
const add = (slug, k, v) => fields.set(slug, [...(fields.get(slug) ?? []), [k, v]]);

let made = 0, uploaded = 0;
const queue = Object.entries(media.audio);
async function worker() {
  for (let r; (r = queue.shift()); ) {
    const [slug, recording] = r;
    const mp3 = path.join(root, "audio/mp3", `${slug}.mp3`);
    const key = `audio/${slug}.mp3`;
    add(slug, "local_audio", url(key));
    if (!fs.existsSync(mp3)) {
      made++;
      if (dry) { uploaded++; continue; }
      fs.mkdirSync(path.dirname(mp3), { recursive: true });
      await promisify(execFile)("ffmpeg", ["-v", "error", "-y", "-i", path.join(root, "audio", recording), "-vn", "-ac", "1", "-b:a", "64k",
        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", `${mp3}.part.mp3`]);
      fs.renameSync(`${mp3}.part.mp3`, mp3);
    }
    if (await put(key, mp3, "audio/mpeg", dry)) uploaded++;
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
for (const [slug, video] of Object.entries(media.video)) add(slug, "video_url", video);

let frontmatters = 0;
for (const [slug, kv] of fields) {
  const md = path.join(root, "markdown/mevar", `${slug}.md`);
  const text = fs.readFileSync(md, "utf8");
  const next = kv.reduce((t, [k, v]) => setField(t, k, v), text);
  if (next !== text) { frontmatters++; if (!dry) fs.writeFileSync(md, next); }
}
console.log(`${Object.keys(media.audio).length} recordings, ${Object.keys(media.video).length} videos; ${made} MP3s made, ${uploaded} uploaded, ${frontmatters} frontmatters${dry ? " (dry)" : ""}`);
