// The CMPP's PDFs as the scripts that read them find them (21, 22, 75, 76b,
// 76c): where 20 put each one, and its text.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
export const cache = path.join(root, ".parse-cache/cmpp");
fs.mkdirSync(cache, { recursive: true });

// 20 files a PDF under the year the manifest had when it ran, and 73 may have
// changed that year since: a PDF is found by its name. id → path
export const pdfs = new Map(fs.readdirSync(path.join(root, "pdfs/cmpp"), { recursive: true }).filter((f) => f.endsWith(".pdf")).map((f) => [path.basename(f, ".pdf"), path.join(root, "pdfs/cmpp", f)]));

/** The text of a work's PDF, .parse-cache/cmpp/<id>.txt: 21's for a booklet, 22's for a PDF with lost signs (run them first), LiteParse's for any other, made here if it is not there. */
export function extraction(id) {
  const file = path.join(cache, `${id}.txt`);
  // LiteParse writes its OCR model where it runs: in the cache, not in the repo
  if (!fs.existsSync(file)) execFileSync(path.join(root, "node_modules/.bin/lit"), ["parse", pdfs.get(id), "-q", "-o", file], { cwd: path.join(root, ".parse-cache"), stdio: "ignore" });
  return fs.readFileSync(file, "utf8");
}

// ─── What a PDF prints ──────────────────────────────────────────────────────
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
/** A text without case or accent, its runs of spaces single: what « prints » is tested on. */
export const fold = (t) => (t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[ \t]+/g, " ");
const linesOf = (text) => fold(text).split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * A work's date as its PDF prints it: the day when a line of a title page or
 * of a signature prints it (« 17 mars 1963, matin », « Abidjan, le 14 février
 * 2006 »: a line of 45 characters at most; a day inside a sentence is an
 * event the text tells); else the month ("2013-01") when the file name says
 * it (video_01_2013, lc_mars_1974), or such a line, or the first 40 or the
 * last 25 lines; else null.
 */
export function printedDate(id, date, text) {
  const [, year, mm, dd] = date.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  const month = MONTHS[mm - 1], lines = linesOf(text), name = fold(id);
  const dateLines = lines.filter((l) => l.length <= 45).join("\n");
  if (dd && new RegExp(`(^|\\D)0?${Number(dd)} ?(er|ᵉʳ)? ${month} ${year}`, "m").test(dateLines)) return date;
  const inName = name.includes(month + year) || name.includes(`${month}_${year}`) || name.startsWith(`video_${mm}_${year}`);
  return inName || new RegExp(`${month}\\W{1,3}${year}`).test([...lines.slice(0, 40), ...lines.slice(-25), dateLines].join("\n")) ? `${year}-${mm}` : null;
}

/** Whether a PDF prints a place: one of its names at least (« Branham Tabernacle, Jeffersonville, Indiana, U.S.A. »), anywhere. */
export function printsPlace(location, text) {
  const all = fold(text);
  return fold(location).split(/[,(]/).map((p) => p.replace(/[^a-z .'’-]/g, "").trim()).some((p) => p.length >= 4 && all.includes(p));
}

// The names an author is printed under: « c’est frère Frank qui vous parle », a signature, a title page
const AUTHORS = { "William Branham": /branham/, "Ewald Frank": /frank/, "Alexis Barilier": /barilier/, "Parfait M'bra": /m[’' ]?bra\b/ };
// A line that is a name and no more: « WILLIAM MARRION BRANHAM », « Missionnaire Ewald Frank », « Fr. A. Barilier »
const NAME_ONLY = /^((par|de|du|frere|fr|missionnaire|pasteur|rev|l|auteur|william|marrion|w|m|ewald|e|alexis|a|parfait|bra|branham|frank|barilier) ?)+$/;
/**
 * Who a PDF names as its author, against the `preacher` a work has:
 * "confirmed" when the preacher's name is in the first 40 or the last 40
 * lines or in a short line (a name inside the text is someone it speaks
 * of); else "contradicted", with the line, when a line of those 80 is
 * another author's name and no more (not the end of a sentence); else
 * "not printed".
 */
export function printedAuthor(preacher, text) {
  const lines = linesOf(text), edge = [...lines.slice(0, 40), ...lines.slice(-40)];
  if (AUTHORS[preacher].test([...edge, ...lines.filter((l) => l.length <= 45)].join("\n"))) return ["confirmed"];
  for (const [name, re] of Object.entries(AUTHORS)) {
    const line = name !== preacher && edge.find((l) => re.test(l) && !/[.,;:)]$/.test(l) && NAME_ONLY.test(l.replace(/[^a-z]+/g, " ").trim()));
    if (line) return ["contradicted", `${name}: « ${line} »`];
  }
  return ["not printed"];
}
