// Resolve which Ghost export to read: argv[2] if given, else the newest
// mevar.ghost.*.json at the repo root (the names are timestamps).

import fs from "node:fs";
import path from "node:path";

export function resolveGhostExport(root) {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const files = fs.readdirSync(root).filter((f) => /^mevar\.ghost\..+\.json$/.test(f)).sort();
  if (!files.length) {
    console.error(`no mevar.ghost.*.json in ${root} — drop the Ghost export at the repo root`);
    process.exit(1);
  }
  return path.join(root, files.at(-1));
}
