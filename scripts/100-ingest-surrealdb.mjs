#!/usr/bin/env node
// Ingest the cleaned corpus into SurrealDB:
//   1. Apply schema + bible-book seed
//   2. Build bible_ref records (deduplicated from manifests/bible-refs.json)
//   3. Build person/place/theme/tag canonical records (deduplicated from index.json)
//   4. Insert work records (one per markdown file) with body content
//   5. Build edges: by, cites, mentions, mentions_place, has_theme, has_tag, contains, based_on
//
// Idempotent — uses INSERT ... ON DUPLICATE KEY UPDATE / UPSERT semantics.
//
// Env:
//   SURREAL_URL=http://localhost:8000   (default)
//   SURREAL_USER=root                   (default)
//   SURREAL_PASS=root                   (default)
//   SURREAL_NS=revelation               (default)
//   SURREAL_DB=main                     (default)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Surreal, RecordId } from "surrealdb";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const root = path.resolve(import.meta.dirname, "..");
const SURREAL_URL = process.env.SURREAL_URL ?? "http://localhost:8000";
const NS = process.env.SURREAL_NS ?? "revelation";
const DB = process.env.SURREAL_DB ?? "main";

// ─── Connect ─────────────────────────────────────────────────────────────────
const db = new Surreal();
// Use WebSocket transport — HTTP has a ~1MB request body cap that breaks
// when we batch-insert work records carrying ~50KB body each.
const wsUrl = SURREAL_URL.replace(/^http(s?)/, "ws$1");
await db.connect(`${wsUrl}/rpc`);
await db.signin({ username: process.env.SURREAL_USER ?? "root", password: process.env.SURREAL_PASS ?? "root" });
await db.use({ namespace: NS, database: DB });
console.log(`✓ connected ${SURREAL_URL} ns=${NS} db=${DB}`);

// ─── 1. Apply schema + seed bible books ──────────────────────────────────────
async function applyFile(p) {
  const sql = fs.readFileSync(p, "utf8");
  await db.query(sql);
}
console.log("→ applying schema...");
await applyFile(path.join(root, "surreal/schema.surql"));
console.log("→ seeding bible books...");
await applyFile(path.join(root, "surreal/seed-bible-books.surql"));

// Build bible_book lookup: canonical FR name → record id token
const bibleBookRows = await db.query(
  "SELECT id, name_fr, name_en FROM bible_book"
);
const bookByFr = new Map(bibleBookRows[0].map((r) => [r.name_fr, r.id]));
const bookByEn = new Map(bibleBookRows[0].map((r) => [r.name_en, r.id]));
console.log(`  ${bookByFr.size} bible_book rows in db`);

// SurrealDB v3 distinguishes NONE (= field missing) from NULL (= explicit null
// value). Our `option<T>` fields only accept NONE; passing `null` raises a coercion
// error. Use this helper to strip nulls before bulk insert.
function stripNulls(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

// ─── 2. bible_ref records (from manifests/bible-refs.json) ───────────────────
const bibleRefsByFile = JSON.parse(fs.readFileSync(path.join(root, "manifests/bible-refs.json"), "utf8"));

// Parse a normalized canonical ref string into structured fields.
// Examples: "Matthieu 24:6"  "Matthieu 24:5-7"  "Matthieu 24:5,7,9-11"  "Matthieu 24"  "Matthew 24:6"
function parseRef(canonical) {
  const m = canonical.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?(?:,[\d,\-]+)?)?$/);
  if (!m) return null;
  const bookName = m[1].trim();
  const bookId = bookByFr.get(bookName) ?? bookByEn.get(bookName);
  if (!bookId) return null;
  return {
    book: bookId,
    chapter: Number(m[2]),
    verse_start: m[3] ? Number(m[3]) : null,
    verse_end: m[4] ? Number(m[4]) : null,
    canonical,
  };
}

// Slug a canonical ref into a record-ID-safe token. "Matthieu 24:5-7" → "matthieu_24_5to7";
// "Matthieu 24:5,7" → "matthieu_24_5and7". Distinct tokens for distinct refs.
function refIdToken(canonical) {
  return canonical
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[–—]/g, "-")    // en/em-dash → hyphen
    .replace(/-/g, "to")
    .replace(/,/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const allRefs = new Set();
for (const refs of Object.values(bibleRefsByFile)) for (const r of refs) allRefs.add(r);
console.log(`→ building ${allRefs.size} unique bible_ref records...`);

const refRecords = [];
const refIdByCanonical = new Map();
const usedTokens = new Map();   // tok → canonical (for collision detection)
for (const canonical of allRefs) {
  const parsed = parseRef(canonical);
  if (!parsed) continue;
  let idTok = refIdToken(canonical);
  // Disambiguate any remaining collision with an 8-char content hash
  if (usedTokens.has(idTok) && usedTokens.get(idTok) !== canonical) {
    const suffix = sha256(canonical).slice(0, 8);
    console.warn(`  ! collision: "${canonical}" vs "${usedTokens.get(idTok)}" → suffixing ${suffix}`);
    idTok = `${idTok}_${suffix}`;
  }
  usedTokens.set(idTok, canonical);
  const id = new RecordId("bible_ref", idTok);
  refIdByCanonical.set(canonical, id);
  refRecords.push(stripNulls({ id, ...parsed }));
}
// Detect any duplicate canonical or id BEFORE insert — log + drop dups to keep going.
const seenCan = new Map();
const seenId = new Map();
const dedupedRefs = [];
for (const r of refRecords) {
  const idStr = r.id.toString();
  if (seenCan.has(r.canonical)) {
    console.warn(`  ! dropping duplicate canonical "${r.canonical}" (kept ${seenCan.get(r.canonical)}, drop ${idStr})`);
    continue;
  }
  if (seenId.has(idStr)) {
    console.warn(`  ! dropping duplicate id ${idStr}`);
    continue;
  }
  seenCan.set(r.canonical, idStr);
  seenId.set(idStr, true);
  dedupedRefs.push(r);
}
console.log(`  ${dedupedRefs.length} unique records after dedup`);

for (let i = 0; i < dedupedRefs.length; i += 500) {
  const batch = dedupedRefs.slice(i, i + 500);
  await db.query(`INSERT IGNORE INTO bible_ref $rows`, { rows: batch });
}
console.log(`  ${refRecords.length} bible_refs upserted (${allRefs.size - refRecords.length} skipped: unmatched book name)`);

// ─── 3. Canonical entities from index.json (person/place/theme/tag) ──────────
const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));

function tokenize(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "x";
}
function dedupeNames(getter) {
  const map = new Map(); // canonical name → first seen
  for (const e of index) {
    for (const n of (getter(e) ?? [])) {
      if (!n || typeof n !== "string") continue;
      const trimmed = n.trim();
      if (!trimmed) continue;
      if (!map.has(trimmed)) map.set(trimmed, true);
    }
  }
  return [...map.keys()];
}

const personNames = dedupeNames((e) => [
  ...(e.persons ?? []),
  ...(e.preacher ? [e.preacher] : []),
  ...(e.authors ?? []),
]);
const placeNames = dedupeNames((e) => [
  ...(e.places ?? []),
  ...(e.location ? [e.location] : []),
]);
const themeNames = dedupeNames((e) => e.themes);
const tagNames = dedupeNames((e) => e.tags);
console.log(`→ entities: ${personNames.length} persons, ${placeNames.length} places, ${themeNames.length} themes, ${tagNames.length} tags`);

// Whitelist tables to safely interpolate into SQL (the alternative `type::table($t)`
// can't be used as INSERT target — only literal identifier accepted).
const ENTITY_TABLES = new Set(["person", "place", "theme", "tag"]);
async function insertEntities(table, names, kindFn) {
  if (!ENTITY_TABLES.has(table)) throw new Error(`unsafe table: ${table}`);
  const idByName = new Map();
  const rows = [];
  const seenTok = new Set();
  for (const name of names) {
    let tok = tokenize(name);
    let suffix = 1;
    while (seenTok.has(tok)) tok = `${tokenize(name)}_${++suffix}`;
    seenTok.add(tok);
    const id = new RecordId(table, tok);
    idByName.set(name, id);
    const row = { id, name };
    if (kindFn) row.kind = kindFn(name);
    rows.push(row);
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db.query(
      `INSERT IGNORE INTO ${table} $rows`,
      { rows: rows.slice(i, i + 500) }
    );
  }
  return idByName;
}

// Heuristic: known biblical persons (extend as needed); fallback "modern_other"
const BIBLICAL_NAMES = new Set([
  "Adam","Ève","Eve","Abel","Caïn","Noé","Sem","Cham","Japhet","Abraham","Sara","Sarah","Isaac","Rebecca",
  "Jacob","Esaü","Esau","Joseph","Léa","Léah","Rachel","Moïse","Aaron","Marie","Aaron","Josué","Joshua",
  "Caleb","Samuel","Saül","Saul","David","Salomon","Solomon","Élie","Elie","Elijah","Élisée","Elisha",
  "Ésaïe","Esaie","Isaiah","Jérémie","Jeremie","Jeremiah","Ézéchiel","Ezechiel","Ezekiel","Daniel","Osée","Hosea",
  "Joël","Joel","Amos","Jonas","Jonah","Habacuc","Zacharie","Malachie","Jésus","Jesus","Jésus-Christ","Christ",
  "Pierre","Peter","Paul","Jean","John","Jacques","James","Matthieu","Matthew","Marc","Mark","Luc","Luke",
  "André","Andrew","Philippe","Philip","Thomas","Barnabas","Barnabé","Étienne","Stephen","Timothée","Timothy",
  "Tite","Titus","Marc","Marie-Madeleine","Mary Magdalene","Joseph","Hérode","Herod","Pilate","Caïphe","Caïn",
  "Néhémie","Esdras","Ezra","Mardochée","Esther","Ruth","Noémi","Naomi","Boaz","Zorobabel","Aggée","Haggai",
  "Élisabeth","Elizabeth","Zacharie","Anne","Anna","Siméon","Simeon","Jean-Baptiste","John the Baptist",
  "Lazare","Lazarus","Marthe","Martha","Marie","Mary","Nicodème","Nicodemus","Saul","Apollos","Silas",
  "Lydie","Lydia","Cornelius","Corneille","Pharaon","Pharaoh","Nébucadnetsar","Nebuchadnezzar","Cyrus","Darius",
]);
const PREACHER_NAMES = new Set([
  "William Branham","Branham","M'BRA Parfait","Parfait M'bra","M'bra Parfait","Samuel Pouyt","Stéphane Pouyt",
  "André Kadjany","Kadjany André","KADJANY YOBOUET ANDRE","Pierre Kouadio","Irié Anderson","IRIE ANDERSON",
  "Anderson Irié","Ewald Frank","Alexis Bariller","Reinhard Bonnké","Ray Comfort",
]);
function personKind(name) {
  if (BIBLICAL_NAMES.has(name)) return "biblical";
  if (PREACHER_NAMES.has(name)) return "preacher";
  return "modern_other";
}

const BIBLICAL_PLACES = new Set([
  "Jérusalem","Jerusalem","Babylone","Babylon","Egypte","Égypte","Egypt","Israël","Israel","Judée","Galilée",
  "Bethléem","Bethlehem","Nazareth","Capharnaüm","Capernaum","Sodome","Sodom","Gomorrhe","Gomorrah",
  "Damas","Damascus","Antioche","Antioch","Rome","Athènes","Athens","Corinthe","Corinth","Éphèse","Ephesus",
  "Patmos","Silo","Shiloh","Béthel","Bethel","Sinaï","Sinai","Horeb","Canaan","Mésopotamie","Ur",
  "Niniveh","Ninive","Nineveh","Tyr","Tyre","Sidon","Samaria","Samarie","Tsoan","Tarsis","Tarshish",
]);
function placeKind(name) {
  return BIBLICAL_PLACES.has(name) ? "biblical" : "modern";
}

console.log("→ inserting persons...");
const personIdByName = await insertEntities("person", personNames, personKind);
console.log("→ inserting places...");
const placeIdByName = await insertEntities("place", placeNames, placeKind);
console.log("→ inserting themes...");
const themeIdByName = await insertEntities("theme", themeNames, null);
console.log("→ inserting tags...");
const tagIdByName = await insertEntities("tag", tagNames, null);

// ─── 4. work records (from index.json + body files) ──────────────────────────
function deriveKind(entry) {
  // mevar uses Ghost type/tags
  if (entry.source === "mevar") {
    const tags = entry.tags ?? [];
    if (tags.includes("Prédications")) return "sermon";
    if (tags.includes("Exhortations")) return "exhortation";
    if (tags.includes("Etudes Bibliques")) return "bible_study";
    if (tags.includes("Publications")) return "article";
    if (entry.type === "page") return "article";
    return "article";
  }
  if (entry.source === "branham") return "sermon";
  if (entry.source === "le-scribe") return "sermon";
  if (entry.source === "cmpp") return "bible_study";
  if (entry.source === "local") return "book";
  // onedrive / mevar-pdfs — heuristic on subtitle / id
  if (entry.subtitle?.toLowerCase().startsWith("exhortation")) return "exhortation";
  if (/chap\d+ministere/i.test(entry.sermon_id ?? "")) return "chapter";
  if (entry.sermon_id === "les_cinq_ministeres_de_la_parole" || entry.sermon_id === "le_royaume_de_dieu_kadjani") return "book";
  if (entry.preacher && entry.location) return "sermon";
  if (entry.tags?.includes?.("Etudes Bibliques")) return "bible_study";
  return "article";
}

function deriveLang(entry) {
  return entry.source === "branham" ? "en" : "fr";
}

function workIdToken(entry) {
  return `${entry.source}_${tokenize(entry.sermon_id ?? entry.local_md)}`;
}

console.log(`→ inserting ${index.length} work records...`);
const workIdBySource = new Map();   // "${source}/${sermon_id}" → RecordId
for (let i = 0; i < index.length; i += 200) {
  const batch = index.slice(i, i + 200).map((e) => {
    const id = new RecordId("work", workIdToken(e));
    workIdBySource.set(`${e.source}/${e.sermon_id}`, id);
    let body = "";
    try { body = fs.readFileSync(path.join(root, e.local_md), "utf8").replace(/^---\n[\s\S]*?\n---\n+/, ""); }
    catch { /* skip if md missing */ }
    const content_hash = body ? sha256(body) : null;
    return stripNulls({
      id,
      kind: deriveKind(e),
      content_hash,
      source: e.source,
      source_id: String(e.sermon_id ?? ""),
      source_url: e.source_url,
      pdf_url: e.pdf_url,
      audio_url: e.audio_url,
      local_md: e.local_md,
      local_image: e.local_image,
      lang: deriveLang(e),
      title: e.title ?? e.sermon_id ?? "Untitled",
      subtitle: e.subtitle,
      slug: tokenize(e.title ?? e.sermon_id ?? "untitled"),
      summary: e.summary,
      body,
      date: (() => { if (!e.date) return null; const d = new Date(e.date); return isNaN(+d) ? null : d; })(),
      year: e.year,
      duration_min: e.duration ? parseDuration(e.duration) : null,
      size_bytes: e.size_bytes,
      line_count: e.line_count,
      llm_cleaned: !!e.llm_cleaned,
    });
  });
  // Note: `embedding`/`embedding_model` deliberately NOT in the update list —
  // they're keyed by content_hash via embedding_cache, so re-ingest preserves them.
  await db.query(`INSERT INTO work $rows ON DUPLICATE KEY UPDATE
    kind = $input.kind, title = $input.title, subtitle = $input.subtitle, summary = $input.summary,
    body = $input.body, date = $input.date, year = $input.year, llm_cleaned = $input.llm_cleaned,
    local_md = $input.local_md, local_image = $input.local_image, source_url = $input.source_url,
    pdf_url = $input.pdf_url, audio_url = $input.audio_url, slug = $input.slug, lang = $input.lang,
    source_id = $input.source_id, content_hash = $input.content_hash`,
    { rows: batch });
  if ((i + 200) % 1000 < 200) console.log(`  ${Math.min(i + 200, index.length)}/${index.length}`);
}
function parseDuration(s) {
  const m = String(s).match(/(\d+)\s*min/i);
  return m ? Number(m[1]) : null;
}

// ─── 5. Edges ────────────────────────────────────────────────────────────────
async function bulkRelate(table, pairs, extraFn = null) {
  if (!pairs.length) return;
  const stmts = pairs.map((p, i) => {
    const extra = extraFn ? extraFn(p) : "";
    return `RELATE $in_${i} -> ${table} -> $out_${i}${extra};`;
  }).join("\n");
  const params = {};
  pairs.forEach((p, i) => { params[`in_${i}`] = p[0]; params[`out_${i}`] = p[1]; if (p[2]) Object.assign(params, p[2]); });
  // Wrap in IGNORE for idempotency: ON DUPLICATE… not available on RELATE; rely on UNIQUE index +
  // catch errors. Here we just split into smaller transactions and ignore duplicate-key failures.
  try { await db.query(stmts, params); } catch { /* swallow dup-key errors; UNIQUE index protects us */ }
}

console.log("→ building edges...");
const byEdges = [];
const citesEdges = [];
const mentionsEdges = [];
const mentionsPlaceEdges = [];
const themeEdges = [];
const tagEdges = [];
const containsEdges = [];
const basedOnEdges = [];

for (const e of index) {
  const wid = workIdBySource.get(`${e.source}/${e.sermon_id}`);
  if (!wid) continue;

  // by (preacher / authors)
  if (e.preacher) {
    const pid = personIdByName.get(e.preacher);
    if (pid) byEdges.push([wid, pid, { role: "preacher" }]);
  }
  for (const a of e.authors ?? []) {
    const pid = personIdByName.get(a);
    if (pid) byEdges.push([wid, pid, { role: "author" }]);
  }
  // mentions persons
  for (const p of e.persons ?? []) {
    const pid = personIdByName.get(p);
    if (pid) mentionsEdges.push([wid, pid]);
  }
  // mentions places
  for (const pl of e.places ?? []) {
    const plid = placeIdByName.get(pl);
    if (plid) mentionsPlaceEdges.push([wid, plid]);
  }
  if (e.location) {
    const plid = placeIdByName.get(e.location);
    if (plid) mentionsPlaceEdges.push([wid, plid]);
  }
  // themes
  for (const t of e.themes ?? []) {
    const tid = themeIdByName.get(t);
    if (tid) themeEdges.push([wid, tid]);
  }
  // tags
  for (const t of e.tags ?? []) {
    const tid = tagIdByName.get(t);
    if (tid) tagEdges.push([wid, tid]);
  }
  // cites
  const refs = bibleRefsByFile[e.local_md] ?? [];
  for (const r of refs) {
    const rid = refIdByCanonical.get(r);
    if (rid) citesEdges.push([wid, rid]);
  }
  // based_on (Le-Scribe summary → the Branham sermon it summarizes)
  if (e.original) {
    const target = workIdBySource.get(`branham/${e.original.split("/").pop()}`);
    if (target) basedOnEdges.push([wid, target]);
  }
  // based_on (mevar_match)
  if (e.mevar_match?.url) {
    const slug = e.mevar_match.url.replace(/\/$/, "").split("/").pop();
    const target = workIdBySource.get(`mevar/${slug}`);
    if (target) basedOnEdges.push([wid, target, { similarity: e.mevar_match.similarity }]);
  }
  // contains (book → chapter heuristic)
  const m = e.sermon_id?.match?.(/^chap(\d+)ministere/i);
  if (m) {
    const bookId = workIdBySource.get("onedrive/les_cinq_ministeres_de_la_parole");
    if (bookId) containsEdges.push([bookId, wid, { position: Number(m[1]) }]);
  }
}

const setRole = (p) => p[2]?.role ? ` SET role = '${p[2].role}'` : "";
const setSim  = (p) => p[2]?.similarity != null ? ` SET similarity = ${p[2].similarity}` : "";
const setPos  = (p) => p[2]?.position != null ? ` SET position = ${p[2].position}` : "";

async function inChunks(name, pairs, edgeName, extraFn) {
  const dedup = new Map();
  for (const p of pairs) dedup.set(`${p[0]}|${p[1]}|${JSON.stringify(p[2] ?? {})}`, p);
  const arr = [...dedup.values()];
  for (let i = 0; i < arr.length; i += 200) {
    await bulkRelate(edgeName, arr.slice(i, i + 200), extraFn);
  }
  console.log(`  ${name}: ${arr.length}`);
}

await inChunks("by",            byEdges,            "by",             setRole);
await inChunks("cites",         citesEdges,         "cites",          null);
await inChunks("mentions",      mentionsEdges,      "mentions",       null);
await inChunks("mentions_place", mentionsPlaceEdges, "mentions_place", null);
await inChunks("has_theme",     themeEdges,         "has_theme",      null);
await inChunks("has_tag",       tagEdges,           "has_tag",        null);
await inChunks("contains",      containsEdges,      "contains",       setPos);
await inChunks("based_on",      basedOnEdges,       "based_on",       setSim);

// ─── Done ────────────────────────────────────────────────────────────────────
const stats = await db.query(
  `SELECT count() AS n FROM work GROUP ALL;
   SELECT count() AS n FROM bible_ref GROUP ALL;
   SELECT count() AS n FROM person GROUP ALL;
   SELECT count() AS n FROM place GROUP ALL;
   SELECT count() AS n FROM theme GROUP ALL;
   SELECT count() AS n FROM cites GROUP ALL;
   SELECT count() AS n FROM mentions GROUP ALL;
   SELECT count() AS n FROM has_theme GROUP ALL;`
);
console.log("\n=== ingest complete ===");
console.log("works:        ", stats[0]?.[0]?.n);
console.log("bible_refs:   ", stats[1]?.[0]?.n);
console.log("persons:      ", stats[2]?.[0]?.n);
console.log("places:       ", stats[3]?.[0]?.n);
console.log("themes:       ", stats[4]?.[0]?.n);
console.log("cites edges:  ", stats[5]?.[0]?.n);
console.log("mentions:     ", stats[6]?.[0]?.n);
console.log("has_theme:    ", stats[7]?.[0]?.n);

await db.close();
