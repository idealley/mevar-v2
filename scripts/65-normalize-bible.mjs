#!/usr/bin/env node
// Normalize French Bible references to a single canonical form: "Book chap:verse[-verse]".
// Examples handled (illustrative — full list in BOOK_VARIANTS):
//   "Mt 24:6" "Math. 24, 6" "Matth 24:5-7" "Matthieu 24 :5-7"
//   "1Cor 5:20-21" "I Cor. 5:20-21" "1 Cor 5:20-21" "Première Corinthiens 5:20"
//   "Apoc 18:1-3" "Apo 18 :1-3" "Ap. 18:1" "Apocalypse 18:1-3"
//   "Esa 35:1-2" "Esaïe 35,1-2" "ÉSAÏE 35:1-2" "Is 35:1-2"
//
// Strategy:
//   1) Build a single regex of all book-name forms (sorted longest-first to avoid
//      matching "Jean" inside "1 Jean"; numbered books detected with a prefix).
//   2) Run replace() over every markdown body; emit canonical form.
//   3) Collect found refs per file into manifests.
//
// CLI:
//   node scripts/65-normalize-bible.mjs               # process all 5 sources
//   node scripts/65-normalize-bible.mjs <glob>        # process matched files only
//   node scripts/65-normalize-bible.mjs --dry         # report only, don't write

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// ─── Book dictionary ─────────────────────────────────────────────────────────
// First entry of each row is the canonical name. Subsequent are accepted
// variants (case-insensitive, diacritic-insensitive — see normForMatch()).
// Trailing period and surrounding whitespace handled by the regex builder.
const BOOKS = [
  // Old Testament
  ["Genèse", "Genese", "Gen", "Gn", "Gé", "Ge"],
  ["Exode", "Ex", "Exo", "Exod"],
  ["Lévitique", "Levitique", "Lev", "Lév", "Lv"],
  ["Nombres", "Nb", "Nbr", "Nom", "Nombr", "Nomb"],
  ["Deutéronome", "Deuteronome", "Deut", "Deu", "Dt"],
  ["Josué", "Josue", "Jos", "Js"],
  ["Juges", "Jug", "Jg", "Jgs"],
  ["Ruth", "Rt", "Ru"],
  ["1 Samuel", "1 Sam", "1Sam", "1S", "1Sm", "I Samuel", "I Sam"],
  ["2 Samuel", "2 Sam", "2Sam", "2S", "2Sm", "II Samuel", "II Sam"],
  ["1 Rois", "1 Roi", "1Roi", "1R", "1Rs", "I Rois"],
  ["2 Rois", "2 Roi", "2Roi", "2R", "2Rs", "II Rois"],
  ["1 Chroniques", "1 Chr", "1Chr", "1Ch", "1Chro", "I Chroniques", "I Chr"],
  ["2 Chroniques", "2 Chr", "2Chr", "2Ch", "2Chro", "II Chroniques", "II Chr"],
  ["Esdras", "Esd"],
  ["Néhémie", "Nehemie", "Néh", "Neh", "Ne"],
  ["Esther", "Est", "Esth"],
  ["Job", "Jb"],
  ["Psaumes", "Psaume", "Ps", "Psa", "Psau"],
  ["Proverbes", "Prov", "Pro", "Pr", "Prv"],
  ["Ecclésiaste", "Ecclesiaste", "Eccl", "Ecc", "Ec", "Qoh", "Qohélet", "Qo"],
  ["Cantique des cantiques", "Cantique", "Cant", "Ct"],
  ["Ésaïe", "Esaie", "Esaïe", "Esa", "Esaï", "Es", "És", "Is", "Isa", "Isaïe", "Isaie"],
  ["Jérémie", "Jeremie", "Jér", "Jer", "Jr"],
  ["Lamentations", "Lam", "Lm"],
  ["Ézéchiel", "Ezechiel", "Ézéch", "Ezech", "Ez", "Éz"],
  ["Daniel", "Dan", "Dn"],
  ["Osée", "Osee", "Os", "Osé", "Hos"],
  ["Joël", "Joel", "Jl", "Joe"],
  ["Amos", "Am"],
  ["Abdias", "Abd", "Ab"],
  ["Jonas", "Jon", "Jna"],
  ["Michée", "Michee", "Mich", "Mic", "Mi"],
  ["Nahum", "Nah", "Na"],
  ["Habacuc", "Hab", "Ha", "Hb"],
  ["Sophonie", "Soph", "Sph", "So"],
  ["Aggée", "Aggee", "Agg", "Ag"],
  ["Zacharie", "Zach", "Zac", "Za"],
  ["Malachie", "Mal", "Ml"],
  // New Testament
  ["Matthieu", "Matth", "Math", "Matt", "Mt"],
  ["Marc", "Mc", "Mr"],
  ["Luc", "Lc", "Lu"],
  ["Jean", "Jn", "Je"],
  ["Actes", "Actes des Apôtres", "Act", "Ac", "Actes des apotres"],
  ["Romains", "Romain", "Rom", "Rm", "Ro"],
  ["1 Corinthiens", "1 Corinthien", "1 Cor", "1Cor", "1Co", "1C", "I Corinthiens", "I Corinthien", "I Cor"],
  ["2 Corinthiens", "2 Corinthien", "2 Cor", "2Cor", "2Co", "2C", "II Corinthiens", "II Corinthien", "II Cor"],
  ["Galates", "Galate", "Gal", "Ga"],
  ["Éphésiens", "Ephesiens", "Ephesien", "Éphésien", "Eph", "Éph", "Ep"],
  ["Philippiens", "Phil", "Phl", "Php", "Ph"],
  ["Colossiens", "Col", "Co"],
  ["1 Thessaloniciens", "1 Thes", "1Thes", "1 Th", "1Th", "I Thessaloniciens", "I Thes"],
  ["2 Thessaloniciens", "2 Thes", "2Thes", "2 Th", "2Th", "II Thessaloniciens", "II Thes"],
  ["1 Timothée", "1 Tim", "1Tim", "1Ti", "1T", "I Timothée", "I Tim"],
  ["2 Timothée", "2 Tim", "2Tim", "2Ti", "2T", "II Timothée", "II Tim"],
  ["Tite", "Tt", "Tit", "Ti"],
  ["Philémon", "Philemon", "Phm", "Phlm", "Phlmn"],
  ["Hébreux", "Hebreux", "Hebreu", "Hébreu", "Héb", "Heb", "He"],
  ["Jacques", "Jac", "Jacq", "Jc", "Jq"],
  ["1 Pierre", "1 P", "1P", "1Pi", "1Pe", "I Pierre", "I P"],
  ["2 Pierre", "2 P", "2P", "2Pi", "2Pe", "II Pierre", "II P"],
  ["1 Jean", "1 Jn", "1Jn", "1J", "I Jean"],
  ["2 Jean", "2 Jn", "2Jn", "2J", "II Jean"],
  ["3 Jean", "3 Jn", "3Jn", "3J", "III Jean"],
  ["Jude", "Jd"],
  ["Apocalypse", "Apocal", "Apoc", "Apo", "Ap"],
];

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

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
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
  "(?:\\s*[\\-\\u2013\\u2014]\\s*(\\d{1,3}))?" +  // optional verse end (group 4)
  "(?:\\s*[,;]\\s*(\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?(?:\\s*[,;]\\s*\\d{1,3}(?:\\s*[\\-\\u2013\\u2014]\\s*\\d{1,3})?)*))?" + // additional verse list (group 5)
  ")?" +
  "(?![\\d])",                            // not followed by another digit (avoids 24:55 partial match in 24:555)
  "giu",
);

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

function normalize(md) {
  const found = [];
  const out = md.replace(REF_RE, (match, bookVariant, chap, verseStart, verseEnd, extra) => {
    const canonical = VARIANT_TO_CANONICAL.get(normForMatch(bookVariant));
    if (!canonical) return match;
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

// ─── Driver ──────────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && p.endsWith(".md")) yield p;
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const targets = args.filter((a) => !a.startsWith("--"));

const sources = targets.length > 0
  ? targets.map((t) => path.resolve(t))
  : ["mevar", "onedrive", "branham", "le-scribe", "cmpp", "local"]
      .map((s) => path.join(root, "markdown", s))
      .filter((d) => fs.existsSync(d));

const refsBySource = {};
const refsByFile = {};
let totalFiles = 0, totalRefs = 0, modified = 0;

for (const source of sources) {
  const sourceName = path.basename(source);
  refsBySource[sourceName] = { files: 0, refs: 0, unique: new Set() };

  for (const file of walk(source)) {
    totalFiles++;
    refsBySource[sourceName].files++;
    const text = fs.readFileSync(file, "utf8");
    // Skip frontmatter; only normalize body
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

// Output stats
console.log(`bible refs normalized:`);
console.log(`  files scanned: ${totalFiles}`);
console.log(`  files modified: ${modified}`);
console.log(`  total ref instances: ${totalRefs}`);
console.log(`  by source:`);
for (const [src, s] of Object.entries(refsBySource)) {
  console.log(`    ${src}: ${s.files} files, ${s.refs} refs (${s.unique.size} unique)`);
}

// Persist per-file refs for later use (frontmatter integration etc.)
if (!dryRun) {
  fs.writeFileSync(
    path.join(root, "manifests/bible-refs.json"),
    JSON.stringify(refsByFile, null, 2),
  );
  console.log(`  wrote manifests/bible-refs.json`);
}
