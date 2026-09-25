#!/usr/bin/env node
// English-Bible reference normalizer for the Branham corpus.
// Same architecture as 65-normalize-bible.mjs, but with English book names + aliases.
//
// Records each ref in canonical form, "Book chap:verse[-end][,extras]", e.g.
// "Matt 24:6", "First Corinthians 5, 20-21" → "Matthew 24:6", "1 Corinthians 5:20-21".
// The text is never changed: the preacher's words stay, only the ref is canonical.
//
// CLI:
//   node scripts/66-normalize-bible-en.mjs                # process branham markdown
//   node scripts/66-normalize-bible-en.mjs <path...>      # process specific files/dirs
//   node scripts/66-normalize-bible-en.mjs --dry          # report only

import fs from "node:fs";
import path from "node:path";
import { BOOKS_EN as BOOKS, escRe } from "./bible-books.mjs";

const root = path.resolve(import.meta.dirname, "..");

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

const BOOK_ALT = variantsSorted.map(escRe).join("|");

const LIST_SEP = "(?:\\s*[,;]\\s*|\\s+and\\s+)";
const NUMBERED = [...new Set(BOOKS.filter((row) => /^\d /.test(row[0])).map((row) => escRe(row[0].slice(2))))].join("|");
const LIST_NUM = `\\d{1,3}(?!\\s*:\\s*\\d|\\s+(?:${NUMBERED})(?!\\p{L}))`;

const REF_RE = new RegExp(
  "(?<![\\p{L}\\d])" +  // not "2 John" inside a paragraph number "212 John"
  "(" + BOOK_ALT + ")" +
  // no optional period: in the Branham text "job. 9" is a sentence end and a
  // paragraph number, never a citation
  "\\s*" +
  "(\\d{1,3})" +
  "(?:" +
  "\\s*[:,]\\s*" +
  "(\\d{1,3})" +
  // optional verse end (group 4) — not one that is itself followed by
  // ":<digit>", a new chapter:verse, so "Hebrews 8:13-13:8" does not read
  // "13" as the end of a range.
  "(?:\\s*[\\-\\u2013\\u2014]\\s*(\\d{1,3})(?!\\s*:\\s*\\d))?" +
  // additional verses (group 5), after "," ";" or "and" ("Hebrews 13:12 and
  // 13"). A number that starts the next citation is not one of them: "and 2
  // Corinthians", ", 1 Peter", "and 4:2".
  `(?:${LIST_SEP}(${LIST_NUM}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?(?:${LIST_SEP}${LIST_NUM}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?)*))?` +
  ")?" +
  "(?![\\d])",
  "giu",
);

// ─── Impossible references ───────────────────────────────────────────────────
// "Zephaniah 155" is a book name followed by a paragraph number, not a chapter.
// Max chapter per book.
const MAX_CHAPTER = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
  "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31,
  "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29,
  "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42,
  "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
  "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7,
  "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14,
  "Malachi": 4, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
  "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5,
  "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3,
  "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3,
  "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22,
};
const MAX_VERSE = 176; // Psalm 119

let dropped = 0, notCitations = 0, spokenRefs = 0;
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
        .split(/\s*[,;]\s*|\s+and\s+/)
        .map((p) => p.replace(/\s*[-–—]\s*/g, "-").trim())
        .filter(Boolean);
      if (parts.length) out += "," + parts.join(",");
    }
  }
  return out;
}

// Branham reads his text aloud: "Saint John the 4th chapter, the 23rd verse",
// "In the 20th chapter of Numbers". Case-sensitive, like the rule above: a
// lowercase book name is prose.
// The grammar words may be capitalized and a line may break anywhere; "the" is
// often dropped ("First John, 1st chapter", "the 19th chapter, 42nd verse"),
// and "and" can join the book to its chapter ("Revelation and the 6th chapter").
// Verses may be a list. A book cut off and restated,
// "the 13th chapter of Ex-…of Genesis", is the restated one.
const ORD = "(\\d{1,3})(?:st|nd|rd|th)";
const THE = "(?:[Tt]he\\s+)?";
const ORDN = "\\d{1,3}(?:st|nd|rd|th)";
const AND = "(?:,?\\s+(?:and\\s+)?)";
// "the 3rd and 4th verses", or each with its own "verse": "34th verse and 35th verse".
const VERSES = `(?:${AND}${THE}(${ORDN}(?:${AND}${THE}${ORDN})*\\s+[Vv]erses?(?:${AND}${THE}${ORDN}\\s+[Vv]erses?)*))?`;
const SPOKEN = [
  new RegExp(`(?<![\\p{L}\\d])(${BOOK_ALT})(?:['’]s\\s+Gospel)?(?:,|\\s+and)?\\s+${THE}${ORD}\\s+[Cc]hapter${VERSES}`, "gu"),
  new RegExp(`[Tt]he\\s+${ORD}\\s+[Cc]hapter\\s+of\\s+(${BOOK_ALT})(?:-[….]*\\s*of\\s+(${BOOK_ALT}))?(?!\\p{L})${VERSES}`, "gu"),
];

/**
 * Every reference this script records in a text: where it is and its
 * canonical form. The site links the same ones (web/src/lib/bible-links.mjs).
 */
export function* citations(md) {
  for (const match of md.matchAll(REF_RE)) {
    const [, bookVariant, , , verseEnd, extra] = match;
    let [, , chap, verseStart] = match;
    const canonical = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
    if (!canonical) continue;
    // The branham.org text never writes a citation with a lowercase book name:
    // "is 65", "my job 9" are prose followed by a paragraph number.
    if (/^\p{Ll}/u.test(bookVariant)) {
      notCitations++;
      continue;
    }
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
    yield { index: match.index, text: match[0], ref: rendered };
  }
  for (const m of md.matchAll(SPOKEN[0])) yield* spoken(m, m[1], m[2], m[3]);
  for (const m of md.matchAll(SPOKEN[1])) yield* spoken(m, m[3] ?? m[2], m[1], m[4]);
  function* spoken(match, bookVariant, chapter, verseList) {
    const book = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
    const verses = verseList?.match(/\d+/g) ?? [];
    if (!isPossible(book, chapter, verses)) return;
    const ref = renderRef({ book, chapter, verseStart: verses[0] ?? null, verseEnd: null, extra: verses.slice(1).join(",") || null });
    spokenRefs++;
    yield { index: match.index, text: match[0], ref };
  }
}

// Only when run, not when the site imports citations().
if (process.argv[1] === import.meta.filename) {
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
  let totalFiles = 0, totalRefs = 0;
  const refsBySource = {};

  for (const sourceDir of sources) {
    const sourceName = path.basename(sourceDir);
    refsBySource[sourceName] = { files: 0, refs: 0, unique: new Set() };
    for (const file of walk(sourceDir)) {
      totalFiles++;
      scanned.push(path.relative(root, file));
      refsBySource[sourceName].files++;
      const text = fs.readFileSync(file, "utf8");
      const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");
      // In the order the work cites them: by position, the longer match first
      // at the same position (as web/src/lib/bible-links.mjs), first occurrence.
      const refs = [...new Set([...citations(body)].sort((a, b) => a.index - b.index || b.text.length - a.text.length).map((c) => c.ref))];
      if (refs.length) {
        totalRefs += refs.length;
        refsBySource[sourceName].refs += refs.length;
        for (const r of refs) refsBySource[sourceName].unique.add(r);
        refsByFile[path.relative(root, file)] = refs;
      }
    }
  }

  console.log(`English bible refs normalized:`);
  console.log(`  files scanned: ${totalFiles}`);
  console.log(`  total ref instances: ${totalRefs}`);
  console.log(`  impossible refs dropped: ${dropped}`);
  console.log(`  lowercase book names skipped: ${notCitations}`);
  console.log(`  spoken citations recorded: ${spokenRefs}`);
  console.log(`  by source:`);
  for (const [src, s] of Object.entries(refsBySource)) {
    console.log(`    ${src}: ${s.files} files, ${s.refs} refs (${s.unique.size} unique)`);
  }

  if (!dryRun) {
    // Merge with existing bible-refs.json (don't overwrite French refs).
    // A scanned file with no refs left loses its key.
    const outPath = path.join(root, "manifests/bible-refs.json");
    const merged = JSON.parse(fs.readFileSync(outPath, "utf8"));
    for (const rel of scanned) {
      if (refsByFile[rel]) merged[rel] = refsByFile[rel];
      else delete merged[rel];
    }
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
    console.log(`  merged ${scanned.length} scanned files into manifests/bible-refs.json (${Object.keys(merged).length} keys)`);
  }
}
