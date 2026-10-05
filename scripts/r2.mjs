// The R2 bucket that serves our files on files.mevar.org, as the scripts that
// upload to it use it (96, 97), through the `cf` CLI logged in to the
// account that holds it.

import fs from "node:fs";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const BUCKET = "mevar-files";
// each part of the key percent-encoded: Le Scribe's names hold « & » (18)
// and a literal « %20 » (two)
export const url = (key) => `https://files.mevar.org/${key.split("/").map(encodeURIComponent).join("/")}`;

const exec = promisify(execFile);
// a call the API rate-limits (429) is tried again, a little later each time
async function run(args, opts) {
  for (let wait = 2000; ; wait *= 2) {
    try { return await exec("cf", args, opts); }
    catch (e) { if (!/429/.test(e.message) || wait > 64000) throw e; await new Promise((r) => setTimeout(r, wait)); }
  }
}

// what the bucket holds under a prefix: key → etag
// (the listing's promise is kept, so the workers share one call per prefix)
const held = new Map();
function list(prefix) {
  if (!held.has(prefix)) held.set(prefix, listed(prefix));
  return held.get(prefix);
}
async function listed(prefix) {
  const { stdout } = await run(["r2", "objects", "list", "--bucket-name", BUCKET, "--prefix", prefix, "--per-page", "1000"], { maxBuffer: 1 << 26 });
  const objects = JSON.parse(stdout);
  if (objects.length >= 1000) throw new Error(`${prefix}: 1000 objects or more, past one page`);
  return new Map(objects.map((o) => [o.key, o.etag]));
}

// Uploads a file as `key` unless the bucket holds the same bytes (its etag
// is the MD5); says whether it did (or, dry, would have)
export async function put(key, file, contentType, dry) {
  const objects = await list(`${key.slice(0, key.lastIndexOf("/"))}/`);
  if (objects.get(key) === crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex")) return false;
  if (!dry) await run(["r2", "objects", "put", key, "--bucket-name", BUCKET, "--file", file, "--content-type", contentType, "-q"], { maxBuffer: 1 << 24 });
  return true;
}
