#!/usr/bin/env node
// Find French Bible references and record them in one canonical form,
// "Book chap:verse[-verse]", in manifests/bible-refs.json. The text is never
// changed: the preacher's words stay as written, only the ref is canonical.
// Examples handled (illustrative — full list in BOOK_VARIANTS):
//   "Mt 24:6" "Math. 24, 6" "Matth 24:5-7" "Matthieu 24 :5-7"
//   "1Cor 5:20-21" "I Cor. 5:20-21" "1 Cor 5:20-21" "Première Corinthiens 5:20"
//   "Apoc 18:1-3" "Apo 18 :1-3" "Ap. 18:1" "Apocalypse 18:1-3"
//   "Esa 35:1-2" "Esaïe 35,1-2" "ÉSAÏE 35:1-2" "Is 35:1-2"
//
// Strategy:
//   1) Build a single regex of all book-name forms (sorted longest-first to avoid
//      matching "Jean" inside "1 Jean"; numbered books detected with a prefix).
//   2) Match every markdown body; render each hit in canonical form.
//   3) Collect found refs per file into manifests.
//
// CLI:
//   node scripts/65-normalize-bible.mjs               # process all 5 French sources
//   node scripts/65-normalize-bible.mjs <glob>        # process matched files only
//   node scripts/65-normalize-bible.mjs --dry         # report only, don't write

import fs from "node:fs";
import path from "node:path";
import { BOOKS_FR as BOOKS, escRe } from "./bible-books.mjs";

const root = path.resolve(import.meta.dirname, "..");

// Match-key normalization: lowercase, strip diacritics, drop trailing periods,
// collapse whitespace. Used both for building the lookup map AND when matching
// against text.
function normForMatch(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build canonical lookup: normForMatch(variant) → canonical book name
const VARIANT_TO_CANONICAL = new Map();
for (const row of BOOKS) {
  const canonical = row[0];
  for (const v of row) VARIANT_TO_CANONICAL.set(normForMatch(v), canonical);
}

// Build the regex pattern for the BOOK name part. Variants are sorted
// longest-first so the regex prefers "1 Corinthiens" over "1 Cor", and so on.
// We escape variants and join with `|`. Use a 5-group structure:
//   group 1: numeric prefix variant ("1", "I", "Première", etc.) — optional
//   group 2: book stem variant
const ALL_VARIANTS = new Set();
for (const row of BOOKS) for (const v of row) ALL_VARIANTS.add(v);
const variantsSorted = [...ALL_VARIANTS]
  .map((v) => v.trim())
  .sort((a, b) => b.length - a.length);

const BOOK_ALT = variantsSorted.map(escRe).join("|");

// Allow optional trailing period and optional spaces before chapter number.
// Chapter:verse separator can be `:`, `,`, or `.` (with optional surrounding space).
// Verse range can use `-` or `–` or `–`.
const REF_RE = new RegExp(
  // word boundary or paren / opening punct
  "(?<![\\p{L}])" +
  "(" + BOOK_ALT + ")" +                // book variant (group 1)
  "\\.?" +                                // optional trailing period
  "\\s*" +
  "(\\d{1,3})" +                          // chapter (group 2)
  "(?:" +
  "\\s*[:,]\\s*" +                        // chap-verse separator
  "(\\d{1,3})" +                          // verse start (group 3)
  // optional verse end (group 4) — not one that is itself followed by
  // ":<digit>", a new chapter:verse. A bare colon is fine: French writes
  // "Jean 17:22-26 : « … »" with a space before the colon.
  // So "Hébreux 8:13-13:8" does not read "13" as the end of a range.
  "(?:\\s*[\\-\\u2013\\u2014]\\s*(\\d{1,3})(?!\\s*:\\s*\\d))?" +  // optional verse end (group 4)
  "(?:\\s*[,;]\\s*(\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?(?:\\s*[,;]\\s*\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?)*))?" + // additional verse list (group 5)
  ")?" +
  "(?![\\d])",                            // not followed by another digit (avoids 24:55 partial match in 24:555)
  "giu",
);

// ─── Impossible references ───────────────────────────────────────────────────
// "Sophonie 155" is a book name followed by a paragraph number, not a chapter.
// Max chapter per book.
const MAX_CHAPTER = {
  "Genèse": 50, "Exode": 40, "Lévitique": 27, "Nombres": 36, "Deutéronome": 34,
  "Josué": 24, "Juges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Rois": 22, "2 Rois": 25, "1 Chroniques": 29, "2 Chroniques": 36,
  "Esdras": 10, "Néhémie": 13, "Esther": 10, "Job": 42, "Psaumes": 150,
  "Proverbes": 31, "Ecclésiaste": 12, "Cantique des cantiques": 8, "Ésaïe": 66,
  "Jérémie": 52, "Lamentations": 5, "Ézéchiel": 48, "Daniel": 12, "Osée": 14,
  "Joël": 4, "Amos": 9, "Abdias": 1, "Jonas": 4, "Michée": 7, "Nahum": 3,
  "Habacuc": 3, "Sophonie": 3, "Aggée": 2, "Zacharie": 14, "Malachie": 4,
  "Matthieu": 28, "Marc": 16, "Luc": 24, "Jean": 21, "Actes": 28, "Romains": 16,
  "1 Corinthiens": 16, "2 Corinthiens": 13, "Galates": 6, "Éphésiens": 6,
  "Philippiens": 4, "Colossiens": 4, "1 Thessaloniciens": 5,
  "2 Thessaloniciens": 3, "1 Timothée": 6, "2 Timothée": 4, "Tite": 3,
  "Philémon": 1, "Hébreux": 13, "Jacques": 5, "1 Pierre": 5, "2 Pierre": 3,
  "1 Jean": 5, "2 Jean": 1, "3 Jean": 1, "Jude": 1, "Apocalypse": 22,
};
const MAX_VERSE = 176; // Psaume 119

let dropped = 0;
function isPossible(book, chapter, verses) {
  if (Number(chapter) > MAX_CHAPTER[book]) return false;
  return !verses.some((v) => Number(v) > MAX_VERSE);
}

// Render a canonical reference. We always emit "Book chap:verse[-verse][,verse...]".
function renderRef({ book, chapter, verseStart, verseEnd, extra }) {
  let out = `${book} ${chapter}`;
  if (verseStart !== undefined && verseStart !== null) {
    out += `:${verseStart}`;
    if (verseEnd !== undefined && verseEnd !== null) out += `-${verseEnd}`;
    if (extra) {
      // Normalize the extra list: split on , or ;, trim, replace en/em-dash with hyphen
      const parts = extra
        .split(/\s*[,;]\s*/)
        .map((p) => p.replace(/\s*[-–—]\s*/g, "-").trim())
        .filter(Boolean);
      if (parts.length) out += "," + parts.join(",");
    }
  }
  return out;
}

// A preacher reading his text aloud: "Luc chapitre 18 verset 9", "2 Corinthiens,
// chapitre 3", "le verset 15 du chapitre 3 de la Genèse". Only the full book
// name: the abbreviations are words ("on a lu le chapitre 11", "c'est au
// chapitre 17", "le texte hébreu, au chapitre 18"). Any case: the transcripts
// write "dans apocalypse chapitre 12".
const FULL_ALT = variantsSorted // "II Rois" is "2 Rois" in full
  .filter((v) => normForMatch(v).replace(/^(i{1,3}) /, (m, i) => `${i.length} `).startsWith(normForMatch(VARIANT_TO_CANONICAL.get(normForMatch(v)))))
  .map(escRe)
  .join("|");
const BOOK_END = "(?![\\p{L}\\-'’])"; // not "Jean-Baptiste"
// "verset 9", "le verset 38", "(versets 13-14", "versets 19 à 33", "à partir du
// premier verset", "du verset 1 au verset 6", "depuis le verset 25 jusqu'au
// verset 35", "et au verset 18", "versets 12 et 15". The reading's first
// verse, its last when it is said, and a second verse or range after "et".
const VERSES =
  "(?:[\\s,(]+(?:(?:à\\s+partir\\s+)?d[ue]s?\\s+|(?:depuis|dès)\\s+le\\s+|(?:et\\s+)?aux?\\s+|les?\\s+)?" +
  "(?:versets?\\s+(\\d{1,3})|(premier)\\s+verset|verset\\s+(premier))" +
  "(?:\\s*(?:[\\-\\u2013\\u2014]|à)\\s*(\\d{1,3})|\\s+(?:au|jusqu['’]au)\\s+verset\\s+(\\d{1,3}))?(?!\\d)" +
  "(?:\\s+et\\s+(\\d{1,3}(?:\\s*(?:[\\-\\u2013\\u2014]|à)\\s*\\d{1,3})?)(?!\\d|\\s*:\\s*\\d))?)?";
const SPOKEN = [
  new RegExp(`(?<![\\p{L}\\d])(${FULL_ALT})${BOOK_END},?\\s+(?:au\\s+|le\\s+)?chapitre\\s+(\\d{1,3})(?!\\d)${VERSES}`, "giu"),
  new RegExp(
    "(?:(?:le|au)\\s+verset\\s+(\\d{1,3})\\s+du\\s+)?chapitre\\s+(\\d{1,3})\\s+" +
    "(?:du\\s+livre\\s+|de\\s+l['’]\\s*(?:[ée]p[iî]tre|[ée]vangile)\\s+)?" +
    `(?:de\\s+la\\s+|de\\s+l['’]\\s*|des\\s+|de\\s+|d['’]\\s*|aux\\s+|selon\\s+)(${FULL_ALT})${BOOK_END}${VERSES}`,
    "giu",
  ),
];

function spoken(bookVariant, chapter, [verse, first, firstAfter, end, endSaid, more]) {
  const book = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
  const verseStart = first || firstAfter ? "1" : verse;
  const verseEnd = Number(end ?? endSaid) > Number(verseStart) ? end ?? endSaid : undefined;
  const extra = more?.replace(/\s*à\s*/, "-");
  if (!isPossible(book, chapter, [verseStart, verseEnd, ...(extra ?? "").split(/\D+/)].filter(Boolean))) {
    dropped++;
    return null;
  }
  return renderRef({ book, chapter, verseStart, verseEnd, extra });
}

function normalize(md) {
  const found = [];
  for (const m of md.matchAll(SPOKEN[0])) found.push(spoken(m[1], m[2], m.slice(3)));
  for (const m of md.matchAll(SPOKEN[1])) found.push(spoken(m[3], m[2], m[1] ? [m[1]] : m.slice(4)));
  for (const match of md.matchAll(REF_RE)) {
    const [, bookVariant, , , verseEnd, extra] = match;
    let [, , chap, verseStart] = match;
    const canonical = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
    if (!canonical) continue;
    // A one-chapter book cited without a verse ("Jude 23"): the number is the
    // verse. "Jude 1" alone stays the chapter, which is the whole book.
    if (MAX_CHAPTER[canonical] === 1 && !verseStart && chap !== "1") [chap, verseStart] = ["1", chap];
    const verses = [verseStart, verseEnd, ...(extra ?? "").split(/\D+/)].filter(Boolean);
    if (!isPossible(canonical, chap, verses)) {
      // A paragraph number, not a chapter — leave the text alone, record nothing.
      dropped++;
      continue;
    }
    const rendered = renderRef({
      book: canonical,
      chapter: chap,
      verseStart: verseStart ?? null,
      verseEnd: verseEnd ?? null,
      extra: extra ?? null,
    });
    found.push(rendered);
  }
  return [...new Set(found.filter(Boolean))].sort();
}

// ─── Driver ──────────────────────────────────────────────────────────────────
function* walk(target) {
  if (fs.statSync(target).isFile()) {
    if (target.endsWith(".md")) yield target;
    return;
  }
  for (const ent of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const targets = args.filter((a) => !a.startsWith("--"));

const sources = targets.length > 0
  ? targets.map((t) => path.resolve(t))
  : ["mevar", "onedrive", "le-scribe", "cmpp", "local"] // branham is English: 66 owns it
      .map((s) => path.join(root, "markdown", s))
      .filter((d) => fs.existsSync(d));

const refsBySource = {};
const refsByFile = {};
const scanned = [];
let totalFiles = 0, totalRefs = 0;

for (const source of sources) {
  const sourceName = path.basename(source);
  refsBySource[sourceName] = { files: 0, refs: 0, unique: new Set() };

  for (const file of walk(source)) {
    totalFiles++;
    scanned.push(path.relative(root, file));
    refsBySource[sourceName].files++;
    const text = fs.readFileSync(file, "utf8");
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");

    const refs = normalize(body);
    if (refs.length) {
      totalRefs += refs.length;
      refsBySource[sourceName].refs += refs.length;
      for (const r of refs) refsBySource[sourceName].unique.add(r);
      refsByFile[path.relative(root, file)] = refs;
    }
  }
}

// Output stats
console.log(`bible refs normalized:`);
console.log(`  files scanned: ${totalFiles}`);
console.log(`  total ref instances: ${totalRefs}`);
console.log(`  impossible refs dropped: ${dropped}`);
console.log(`  by source:`);
for (const [src, s] of Object.entries(refsBySource)) {
  console.log(`    ${src}: ${s.files} files, ${s.refs} refs (${s.unique.size} unique)`);
}

// Persist per-file refs for later use (frontmatter integration etc.).
// Merge, so a targeted run only rewrites the files it scanned — with no
// target this is still a full rebuild of every French source.
if (!dryRun) {
  const outPath = path.join(root, "manifests/bible-refs.json");
  const merged = JSON.parse(fs.readFileSync(outPath, "utf8"));
  for (const rel of scanned) {
    if (refsByFile[rel]) merged[rel] = refsByFile[rel];
    else delete merged[rel];
  }
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`  merged ${scanned.length} scanned files into manifests/bible-refs.json (${Object.keys(merged).length} keys)`);
}
