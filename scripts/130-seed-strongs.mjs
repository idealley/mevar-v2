#!/usr/bin/env node
// Parse STEPBible-Data's TAGNT (Greek NT) and TAHOT (Hebrew OT) files and
// merge per-verse Strong's number arrays into bible_ref records.
//
// Prereq: bible-data/STEPBible-Data/  (run scripts/120-clone-stepbible.sh first)
//
// What we extract per verse: a deduplicated array of Strong's tokens like
//   ["G2316", "G3056", ...]   (NT — Greek)
//   ["H0430", "H1697", ...]   (OT — Hebrew, zero-padded to 4 digits)
//
// Strategy:
//   1. Parse TSV files → buildkey "<canon_order>.<chapter>.<verse>" → Set<strong>
//   2. Pull bible_ref records from SurrealDB (id, book.canon_order, chapter, verse_start, verse_end)
//   3. For each ref, union Strong's across the verse range; merge into ref.strong

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Surreal } from "surrealdb";

const root = path.resolve(import.meta.dirname, "..");
const stepDir = path.join(root, "bible-data/STEPBible-Data");

// STEPBible English book abbreviations → canon_order.
// Source: STEPBible-Data README + standard Bible.org/SBL abbreviations.
const ABBR_TO_ORDER = {
  // OT
  Gen: 1, Exo: 2, Lev: 3, Num: 4, Deu: 5, Jos: 6, Jdg: 7, Rut: 8,
  "1Sa": 9, "2Sa": 10, "1Ki": 11, "2Ki": 12, "1Ch": 13, "2Ch": 14,
  Ezr: 15, Neh: 16, Est: 17, Job: 18, Psa: 19, Pro: 20, Ecc: 21, Sng: 22,
  Isa: 23, Jer: 24, Lam: 25, Ezk: 26, Dan: 27, Hos: 28, Jol: 29, Amo: 30,
  Oba: 31, Jon: 32, Mic: 33, Nam: 34, Hab: 35, Zep: 36, Hag: 37, Zec: 38, Mal: 39,
  // NT
  Mat: 40, Mrk: 41, Luk: 42, Jhn: 43, Act: 44, Rom: 45,
  "1Co": 46, "2Co": 47, Gal: 48, Eph: 49, Php: 50, Col: 51,
  "1Th": 52, "2Th": 53, "1Ti": 54, "2Ti": 55, Tit: 56, Phm: 57,
  Heb: 58, Jas: 59, "1Pe": 60, "2Pe": 61, "1Jn": 62, "2Jn": 63, "3Jn": 64,
  Jud: 65, Rev: 66,
  // Common alternate spellings encountered in STEPBible variants
  Mat_New: 40, Mar: 41, Joh: 43,
};

// ─── Locate input files ──────────────────────────────────────────────────────
// Real layout in upstream repo: Translators Amalgamated OT+NT/ contains
//   TAGNT Mat-Jhn ...txt        — Greek Matthew-John
//   TAGNT Act-Rev ...txt        — Greek Acts-Revelation
//   TAHOT Gen-Deu ...txt        — Hebrew Genesis-Deuteronomy
//   TAHOT Jos-Est, Job-Sng, Isa-Mal — rest of Hebrew OT
const tasrDir = path.join(stepDir, "Translators Amalgamated OT+NT");
function findAll(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => n.startsWith(prefix) && n.endsWith(".txt"))
    .map((n) => path.join(dir, n));
}
const tagntFiles = findAll(tasrDir, "TAGNT");
const tahotFiles = findAll(tasrDir, "TAHOT");
if (tagntFiles.length === 0 && tahotFiles.length === 0) {
  console.error(`No STEPBible TAGNT/TAHOT files found in ${tasrDir}`);
  console.error(`Run: bash scripts/120-clone-stepbible.sh`);
  process.exit(1);
}
console.log(`found ${tagntFiles.length} Greek + ${tahotFiles.length} Hebrew files`);

// ─── Parse TSV file → Map<"order.ch.v", Set<strong>> ─────────────────────────
async function parseTagged(filePath, prefixLetter) {
  if (!filePath) return new Map();
  console.log(`parsing ${path.basename(filePath)} ...`);
  const out = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  // STEPBible tag files are heavily commented at the top. The data section starts
  // when columns appear. Parse defensively: each line, find a token matching
  // `<Abbr>.<chap>.<verse>` and another matching the Strong's pattern.
  const refRe = /\b([A-Za-z0-9]{1,5})\.(\d{1,3})[.:](\d{1,3})/;
  const strongRe = new RegExp(`\\b${prefixLetter}\\d{4,5}\\b`, "g");

  let parsed = 0, skipped = 0;
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("==")) continue;
    const refM = line.match(refRe);
    if (!refM) { skipped++; continue; }
    const order = ABBR_TO_ORDER[refM[1]];
    if (!order) { skipped++; continue; }
    const chapter = Number(refM[2]);
    const verse = Number(refM[3]);
    const strongs = line.match(strongRe);
    if (!strongs) continue;
    const key = `${order}.${chapter}.${verse}`;
    if (!out.has(key)) out.set(key, new Set());
    const set = out.get(key);
    for (const s of strongs) set.add(s);
    parsed++;
  }
  console.log(`  parsed=${parsed} skipped=${skipped} verses=${out.size}`);
  return out;
}

// Parse all files, merging by-verse maps
const byVerse = new Map();
for (const f of tagntFiles) {
  const m = await parseTagged(f, "G");
  for (const [k, v] of m) {
    if (!byVerse.has(k)) byVerse.set(k, new Set());
    for (const s of v) byVerse.get(k).add(s);
  }
}
for (const f of tahotFiles) {
  const m = await parseTagged(f, "H");
  for (const [k, v] of m) {
    if (!byVerse.has(k)) byVerse.set(k, new Set());
    for (const s of v) byVerse.get(k).add(s);
  }
}
console.log(`combined: ${byVerse.size} verses tagged`);

// ─── Connect to SurrealDB + pull bible_ref records ──────────────────────────
const db = new Surreal();
// Use WS for larger payload allowance
const surrealUrl = (process.env.SURREAL_URL ?? "http://localhost:8000").replace(/^http(s?)/, "ws$1");
await db.connect(`${surrealUrl}/rpc`);
await db.signin({ username: process.env.SURREAL_USER ?? "root", password: process.env.SURREAL_PASS ?? "root" });
await db.use({ namespace: process.env.SURREAL_NS ?? "revelation", database: process.env.SURREAL_DB ?? "main" });

const refs = (await db.query(
  `SELECT id, chapter, verse_start, verse_end, book.canon_order AS order, canonical FROM bible_ref`
))[0];
console.log(`fetched ${refs.length} bible_refs from db`);

// ─── For each ref, union Strong's across the verse range ────────────────────
const updates = [];
let withStrongs = 0;
for (const r of refs) {
  if (r.verse_start == null) continue;       // chapter-only refs have too many words to attribute
  const start = r.verse_start;
  const end = r.verse_end ?? start;
  const set = new Set();
  for (let v = start; v <= end; v++) {
    const ks = byVerse.get(`${r.order}.${r.chapter}.${v}`);
    if (ks) for (const s of ks) set.add(s);
  }
  if (set.size === 0) continue;
  updates.push({ id: r.id, strong: [...set].sort() });
  withStrongs++;
}
console.log(`refs with Strong's data: ${withStrongs}/${refs.length}`);

console.log("merging Strong's into bible_ref records ...");
for (let i = 0; i < updates.length; i += 200) {
  const batch = updates.slice(i, i + 200);
  await db.query(
    `FOR $row IN $rows {
       UPDATE $row.id MERGE { strong: $row.strong };
     };`,
    { rows: batch }
  );
  if ((i + 200) % 1000 < 200) console.log(`  ${Math.min(i + 200, updates.length)}/${updates.length}`);
}

// Sample
const sample = (await db.query(
  `SELECT canonical, strong FROM bible_ref
   WHERE canonical IN ['Matthieu 24:6', 'Apocalypse 6:1', 'Hébreux 11:1', 'John 3:16']
   AND strong != NONE LIMIT 4`
))[0];
console.log("\nsample after seeding:");
console.log(JSON.stringify(sample, null, 2));

await db.close();
