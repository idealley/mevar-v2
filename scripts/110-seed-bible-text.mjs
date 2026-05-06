#!/usr/bin/env node
// Seed bible_ref records with verse text from 4 translations:
//   - LSG: Louis Segond 1910 (FR)
//   - Darby (FR): Bible Darby
//   - Ostervald (FR)
//   - KJV: King James Version (EN)
//
// Sources are pre-downloaded into bible-data/{ls1910,darby,kjv}.json (getbible.net)
// and bible-data/ostervald.xml (Beblia/Holy-Bible-XML-Format).
//
// Strategy:
//   1. Load all four into normalized form: byCanonOrder[N][chapter][verse] = "verse text"
//   2. For each bible_ref in SurrealDB, look up the matching verse(s) across all 4
//      and merge into bible_ref.text = { lsg, darby, ost, kjv }
//   3. For ranges (verse_start..verse_end), join with " " between verses
//   4. For chapter-only refs (no verse_start), skip text (chapter-level too long)

import fs from "node:fs";
import path from "node:path";
import { Surreal, RecordId } from "surrealdb";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "bible-data");

// ─── Load translations into byCanonOrder[N][chapter][verse] = text ───────────
function loadGetBibleJson(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const byOrder = {};
  for (const book of data.books) {
    const order = book.nr;            // 1..66 = canon_order
    byOrder[order] = {};
    for (const ch of book.chapters) {
      byOrder[order][ch.chapter] = {};
      for (const v of ch.verses) {
        byOrder[order][ch.chapter][v.verse] = v.text.trim();
      }
    }
  }
  return byOrder;
}

function loadOstervaldXml(filePath) {
  const xml = fs.readFileSync(filePath, "utf8");
  const byOrder = {};
  // Parse with regex (xml is small, well-formed, no nested entities)
  const bookRe = /<book\s+number="(\d+)">([\s\S]*?)<\/book>/g;
  const chRe = /<chapter\s+number="(\d+)">([\s\S]*?)<\/chapter>/g;
  const vRe = /<verse\s+number="(\d+)">([\s\S]*?)<\/verse>/g;
  let bm;
  while ((bm = bookRe.exec(xml))) {
    const order = Number(bm[1]);
    byOrder[order] = {};
    let cm;
    while ((cm = chRe.exec(bm[2]))) {
      const chapter = Number(cm[1]);
      byOrder[order][chapter] = {};
      let vm;
      while ((vm = vRe.exec(cm[2]))) {
        const verse = Number(vm[1]);
        byOrder[order][chapter][verse] = vm[2].trim().replace(/\s+/g, " ");
      }
    }
  }
  return byOrder;
}

console.log("loading translations...");
const lsg     = loadGetBibleJson(path.join(dataDir, "ls1910.json"));
const darby   = loadGetBibleJson(path.join(dataDir, "darby.json"));
const kjv     = loadGetBibleJson(path.join(dataDir, "kjv.json"));
const ost     = loadOstervaldXml(path.join(dataDir, "ostervald.xml"));
const totalsBy = (b) => Object.values(b).reduce((s, ch) => s + Object.values(ch).reduce((a, v) => a + Object.keys(v).length, 0), 0);
console.log(`  LSG:       ${totalsBy(lsg)} verses`);
console.log(`  Darby:     ${totalsBy(darby)} verses`);
console.log(`  Ostervald: ${totalsBy(ost)} verses`);
console.log(`  KJV:       ${totalsBy(kjv)} verses`);

// ─── Connect to SurrealDB ────────────────────────────────────────────────────
const db = new Surreal();
const SURREAL_URL = process.env.SURREAL_URL ?? "http://localhost:8000";
await db.connect(`${SURREAL_URL}/rpc`);
await db.signin({ username: process.env.SURREAL_USER ?? "root", password: process.env.SURREAL_PASS ?? "root" });
await db.use({ namespace: process.env.SURREAL_NS ?? "revelation", database: process.env.SURREAL_DB ?? "main" });

// ─── Load all bible_refs joined to bible_book.canon_order ────────────────────
const refs = (await db.query(
  `SELECT id, chapter, verse_start, verse_end, book.canon_order AS order, canonical FROM bible_ref`
))[0];
console.log(`fetched ${refs.length} bible_refs from db`);

// ─── Lookup helper: get verse(s) for a ref from one translation ──────────────
function lookup(byOrder, ref) {
  const ch = byOrder[ref.order]?.[ref.chapter];
  if (!ch) return null;
  if (ref.verse_start == null) return null;          // chapter-only refs: skip text
  const start = ref.verse_start;
  const end = ref.verse_end ?? start;
  const parts = [];
  for (let v = start; v <= end; v++) {
    if (ch[v]) parts.push(ch[v]);
  }
  return parts.length ? parts.join(" ") : null;
}

// ─── Build text objects + bulk update ────────────────────────────────────────
const updates = [];
let withText = 0, missing = { lsg: 0, darby: 0, ost: 0, kjv: 0 };
for (const r of refs) {
  const text = {};
  const sLsg   = lookup(lsg,   r); if (sLsg)   text.lsg   = sLsg;   else missing.lsg++;
  const sDarby = lookup(darby, r); if (sDarby) text.darby = sDarby; else missing.darby++;
  const sOst   = lookup(ost,   r); if (sOst)   text.ost   = sOst;   else missing.ost++;
  const sKjv   = lookup(kjv,   r); if (sKjv)   text.kjv   = sKjv;   else missing.kjv++;
  if (Object.keys(text).length === 0) continue;
  updates.push({ id: r.id, text });
  withText++;
}
console.log(`built text for ${withText}/${refs.length} refs (chapter-only refs skipped)`);
console.log(`missing per translation: lsg=${missing.lsg} darby=${missing.darby} ost=${missing.ost} kjv=${missing.kjv}`);

console.log("merging into bible_ref records (batched)...");
for (let i = 0; i < updates.length; i += 200) {
  const batch = updates.slice(i, i + 200);
  // Use UPDATE … MERGE on each record (SurrealDB doesn't bulk-merge by id arrays cleanly)
  // Instead, write a single statement with a FOR loop over the batch parameter
  await db.query(
    `FOR $row IN $rows {
       UPDATE $row.id MERGE { text: $row.text };
     };`,
    { rows: batch }
  );
  if ((i + 200) % 1000 < 200) console.log(`  ${Math.min(i + 200, updates.length)}/${updates.length}`);
}

// Sample
const sample = (await db.query(
  `SELECT canonical, text FROM bible_ref WHERE canonical IN ['Matthieu 24:6', 'Apocalypse 6:1', 'Hébreux 11:1', 'John 3:16'] LIMIT 4`
))[0];
console.log("\nsample refs after seeding:");
console.log(JSON.stringify(sample, null, 2));

await db.close();
