// Cloudflare Pages refuses a deploy over its limits: 20,000 files on the free
// plan, 25 MiB per file. Run after the build (Pagefind included), before
// wrangler; exits 1 when dist/ would be refused.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_FILES = 20_000;
const MAX_BYTES = 25 * 1024 * 1024;

let count = 0;
let largest = { path: "", size: 0 };
for (const name of readdirSync("dist", { recursive: true })) {
  const path = join("dist", name);
  const stat = statSync(path);
  if (!stat.isFile()) continue;
  count++;
  if (stat.size > largest.size) largest = { path, size: stat.size };
}

const mib = (b) => (b / 1024 / 1024).toFixed(2);
console.log(`files: ${count} (limit ${MAX_FILES})`);
console.log(`largest: ${largest.path}, ${mib(largest.size)} MiB (limit 25 MiB)`);
if (count >= MAX_FILES || largest.size > MAX_BYTES) {
  console.error("dist/ is over a Cloudflare Pages limit");
  process.exit(1);
}
