#!/usr/bin/env node
// Every local images/ or files/ link in markdown/ (local_image, local_pdf,
// body links) resolves to a file, and every work with a feature_image has a
// local_image under images/. Exit 1 if not.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];
let links = 0;
for (const f of fs.readdirSync(path.join(root, "markdown"), { recursive: true }).filter((f) => f.endsWith(".md"))) {
  const text = fs.readFileSync(path.join(root, "markdown", f), "utf8");
  for (const [, href] of text.matchAll(/["(]\/?((?:images|files)\/[^")\s]+)/g)) {
    links++;
    if (!fs.existsSync(path.join(root, decodeURIComponent(href)))) problems.push(`${f}: ${href}`);
  }
  if (/^feature_image:/m.test(text) && !/^local_image: "images\//m.test(text)) problems.push(`${f}: feature_image without a local local_image`);
}
console.log(`${links} local links checked, ${problems.length} problems${problems.map((p) => `\n  ${p}`).join("")}`);
process.exit(problems.length ? 1 : 0);
