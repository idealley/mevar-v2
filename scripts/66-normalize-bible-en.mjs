#!/usr/bin/env node
// English-Bible reference normalizer for the Branham corpus.
// Same architecture as 65-normalize-bible.mjs, but with English book names + aliases.
//
// Output canonical form: "Book chap:verse[-end][,extras]"
// e.g. "Matt 24:6", "1 Cor. 5,20-21" → "Matthew 24:6", "1 Corinthians 5:20-21"
//
// CLI:
//   node scripts/66-normalize-bible-en.mjs                # process branham markdown
//   node scripts/66-normalize-bible-en.mjs <path...>      # process specific files/dirs
//   node scripts/66-normalize-bible-en.mjs --dry          # report only

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// ─── Book dictionary ─────────────────────────────────────────────────────────
// First entry of each row is the canonical name. Subsequent are accepted variants.
// Includes both standard and aggressive abbreviations seen in transcribed sermons.
const BOOKS = [
  // Old Testament
  ["Genesis", "Gen", "Gn", "Ge"],
  ["Exodus", "Exo", "Ex", "Exod"],
  ["Leviticus", "Lev", "Lv", "Levit"],
  ["Numbers", "Num", "Nm", "Nb", "Nu"],
  ["Deuteronomy", "Deut", "Dt", "De"],
  ["Joshua", "Josh", "Jos", "Js", "Jsh"],
  ["Judges", "Judg", "Jdg", "Jg", "Jgs"],
  ["Ruth", "Rt", "Ru"],
  ["1 Samuel", "1 Sam", "1Sam", "1S", "1Sm", "I Samuel", "I Sam", "First Samuel"],
  ["2 Samuel", "2 Sam", "2Sam", "2S", "2Sm", "II Samuel", "II Sam", "Second Samuel"],
  ["1 Kings", "1 Kgs", "1Kgs", "1K", "1Ki", "I Kings", "I Kgs", "First Kings"],
  ["2 Kings", "2 Kgs", "2Kgs", "2K", "2Ki", "II Kings", "II Kgs", "Second Kings"],
  ["1 Chronicles", "1 Chr", "1Chr", "1Ch", "I Chronicles", "I Chr", "First Chronicles"],
  ["2 Chronicles", "2 Chr", "2Chr", "2Ch", "II Chronicles", "II Chr", "Second Chronicles"],
  ["Ezra", "Ezr"],
  ["Nehemiah", "Neh", "Ne"],
  ["Esther", "Est", "Esth"],
  ["Job", "Jb"],
  ["Psalms", "Psalm", "Ps", "Psa", "Pss", "Psm"],
  ["Proverbs", "Prov", "Prv", "Pr", "Pro"],
  ["Ecclesiastes", "Eccl", "Ecc", "Ec", "Qoh", "Qoheleth"],
  ["Song of Solomon", "Song of Songs", "Song", "SoS", "Cant", "Canticles"],
  ["Isaiah", "Isa", "Is"],
  ["Jeremiah", "Jer", "Jr"],
  ["Lamentations", "Lam", "Lm", "La"],
  ["Ezekiel", "Ezek", "Ez", "Eze"],
  ["Daniel", "Dan", "Dn", "Da"],
  ["Hosea", "Hos", "Ho"],
  // "Joël" is what the French pass left in these English transcripts —
  // 47 of its 48 occurrences here are real Joel citations, mostly Joel 2:28.
  ["Joel", "Joël", "Jl"],
  ["Amos", "Am"],
  ["Obadiah", "Obad", "Ob"],
  ["Jonah", "Jon", "Jnh"],
  ["Micah", "Mic", "Mi"],
  ["Nahum", "Nah", "Na"],
  ["Habakkuk", "Hab", "Hb"],
  ["Zephaniah", "Zeph", "Zep", "Zp"],
  ["Haggai", "Hag", "Hg"],
  ["Zechariah", "Zech", "Zec", "Zc"],
  ["Malachi", "Mal", "Ml"],
  // New Testament
  ["Matthew", "Saint Matthew", "St. Matthew", "St Matthew", "Matt", "Math", "Mt"],
  ["Mark", "Saint Mark", "St. Mark", "St Mark", "Mk", "Mr"],
  ["Luke", "Saint Luke", "St. Luke", "St Luke", "Lk", "Lu"],
  ["John", "Saint John", "St. John", "St John", "Jn", "Joh", "Jhn"],
  ["Acts", "Ac", "Act", "Acts of the Apostles"],
  ["Romans", "Rom", "Rm", "Ro"],
  ["1 Corinthians", "1 Cor", "1Cor", "1Co", "1C", "I Corinthians", "I Cor", "First Corinthians"],
  ["2 Corinthians", "2 Cor", "2Cor", "2Co", "2C", "II Corinthians", "II Cor", "Second Corinthians"],
  ["Galatians", "Gal", "Ga"],
  ["Ephesians", "Eph", "Ephes", "Ep"],
  ["Philippians", "Phil", "Php", "Phl", "Ph"],
  ["Colossians", "Col", "Cl"],
  ["1 Thessalonians", "1 Thess", "1Thess", "1 Thes", "1Thes", "1 Th", "1Th", "I Thessalonians", "I Thess", "First Thessalonians"],
  ["2 Thessalonians", "2 Thess", "2Thess", "2 Thes", "2Thes", "2 Th", "2Th", "II Thessalonians", "II Thess", "Second Thessalonians"],
  ["1 Timothy", "1 Tim", "1Tim", "1Ti", "1T", "I Timothy", "I Tim", "First Timothy"],
  ["2 Timothy", "2 Tim", "2Tim", "2Ti", "2T", "II Timothy", "II Tim", "Second Timothy"],
  ["Titus", "Tit", "Ti"],
  ["Philemon", "Phlm", "Phm", "Philem"],
  ["Hebrews", "Heb", "Hbr", "He"],
  ["James", "Jas", "Jm"],
  ["1 Peter", "1 Pet", "1Pet", "1 Pt", "1Pt", "1P", "1Pe", "I Peter", "I Pet", "First Peter"],
  ["2 Peter", "2 Pet", "2Pet", "2 Pt", "2Pt", "2P", "2Pe", "II Peter", "II Pet", "Second Peter"],
  ["1 John", "1 Jn", "1Jn", "1Jo", "1J", "I John", "I Jn", "First John"],
  ["2 John", "2 Jn", "2Jn", "2Jo", "2J", "II John", "II Jn", "Second John"],
  ["3 John", "3 Jn", "3Jn", "3Jo", "3J", "III John", "III Jn", "Third John"],
  ["Jude", "Jud", "Jd"],
  ["Revelation", "Revelations", "Rev", "Rv", "Re", "Apoc", "Apocalypse"],
];

function normForMatch(s) {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VARIANT_TO_CANONICAL = new Map();
for (const row of BOOKS) {
  const canonical = row[0];
  for (const v of row) VARIANT_TO_CANONICAL.set(normForMatch(v), canonical);
}

const ALL_VARIANTS = new Set();
for (const row of BOOKS) for (const v of row) ALL_VARIANTS.add(v);
const variantsSorted = [...ALL_VARIANTS]
  .map((v) => v.trim())
  .sort((a, b) => b.length - a.length);

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const BOOK_ALT = variantsSorted.map(escRe).join("|");

const REF_RE = new RegExp(
  "(?<![\\p{L}])" +
  "(" + BOOK_ALT + ")" +
  "\\.?" +
  "\\s*" +
  "(\\d{1,3})" +
  "(?:" +
  "\\s*[:,]\\s*" +
  "(\\d{1,3})" +
  "(?:\\s*[\\-\\u2013\\u2014]\\s*(\\d{1,3}))?" +
  "(?:\\s*[,;]\\s*(\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?(?:\\s*[,;]\\s*\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?)*))?" +
  ")?" +
  "(?![\\d])",
  "giu",
);

// ─── Impossible references ───────────────────────────────────────────────────
// "Zephaniah 155" is a book name followed by a paragraph number, not a chapter.
// Max chapter per book; for the one-chapter books the number that follows the
// name is a verse, so their entry is the verse count instead.
const MAX_CHAPTER = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
  "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31,
  "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29,
  "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42,
  "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
  "Hosea": 14, "Joel": 4, "Amos": 9, "Obadiah": 21, "Jonah": 4, "Micah": 7,
  "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14,
  "Malachi": 4, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
  "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5,
  "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3,
  "Philemon": 25, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3,
  "1 John": 5, "2 John": 13, "3 John": 15, "Jude": 25, "Revelation": 22,
};
const MAX_VERSE = 176; // Psalm 119

let dropped = 0;
function isPossible(book, chapter, verses) {
  if (Number(chapter) > MAX_CHAPTER[book]) return false;
  return !verses.some((v) => Number(v) > MAX_VERSE);
}

function renderRef({ book, chapter, verseStart, verseEnd, extra }) {
  let out = `${book} ${chapter}`;
  if (verseStart !== undefined && verseStart !== null) {
    out += `:${verseStart}`;
    if (verseEnd !== undefined && verseEnd !== null) out += `-${verseEnd}`;
    if (extra) {
      const parts = extra
        .split(/\s*[,;]\s*/)
        .map((p) => p.replace(/\s*[-–—]\s*/g, "-").trim())
        .filter(Boolean);
      if (parts.length) out += "," + parts.join(",");
    }
  }
  return out;
}

function normalize(md) {
  const found = [];
  const out = md.replace(REF_RE, (match, bookVariant, chap, verseStart, verseEnd, extra) => {
    const canonical = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
    if (!canonical) return match;
    const verses = [verseStart, verseEnd, ...(extra ?? "").split(/\D+/)].filter(Boolean);
    if (!isPossible(canonical, chap, verses)) {
      // A paragraph number, not a chapter — leave the text alone, record nothing.
      dropped++;
      return match;
    }
    const rendered = renderRef({
      book: canonical,
      chapter: chap,
      verseStart: verseStart ?? null,
      verseEnd: verseEnd ?? null,
      extra: extra ?? null,
    });
    found.push(rendered);
    return rendered;
  });
  return { md: out, refs: [...new Set(found)].sort() };
}

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
  : [path.join(root, "markdown", "branham")];

const refsByFile = {};
const scanned = [];
let totalFiles = 0, totalRefs = 0, modified = 0;
const refsBySource = {};

for (const sourceDir of sources) {
  const sourceName = path.basename(sourceDir);
  refsBySource[sourceName] = { files: 0, refs: 0, unique: new Set() };
  for (const file of walk(sourceDir)) {
    totalFiles++;
    scanned.push(path.relative(root, file));
    refsBySource[sourceName].files++;
    const text = fs.readFileSync(file, "utf8");
    const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    const fm = fmMatch ? fmMatch[1] : "";
    const body = fmMatch ? fmMatch[2] : text;
    const { md: cleanedBody, refs } = normalize(body);
    if (refs.length) {
      totalRefs += refs.length;
      refsBySource[sourceName].refs += refs.length;
      for (const r of refs) refsBySource[sourceName].unique.add(r);
      refsByFile[path.relative(root, file)] = refs;
    }
    if (cleanedBody !== body && !dryRun) {
      fs.writeFileSync(file, fm + cleanedBody);
      modified++;
    }
  }
}

console.log(`English bible refs normalized:`);
console.log(`  files scanned: ${totalFiles}`);
console.log(`  files modified: ${modified}`);
console.log(`  total ref instances: ${totalRefs}`);
console.log(`  impossible refs dropped: ${dropped}`);
console.log(`  by source:`);
for (const [src, s] of Object.entries(refsBySource)) {
  console.log(`    ${src}: ${s.files} files, ${s.refs} refs (${s.unique.size} unique)`);
}

if (!dryRun) {
  // Merge with existing bible-refs.json (don't overwrite French refs).
  // A scanned file with no refs left loses its key.
  const outPath = path.join(root, "manifests/bible-refs.json");
  const merged = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  for (const rel of scanned) {
    if (refsByFile[rel]) merged[rel] = refsByFile[rel];
    else delete merged[rel];
  }
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`  merged ${scanned.length} scanned files into manifests/bible-refs.json (${Object.keys(merged).length} keys)`);
}
