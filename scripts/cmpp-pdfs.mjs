// The CMPP's PDFs as the scripts that read them find them (21, 22, 75, 76b,
// 76c): where 20 put each one, its text, and what that text prints of a date
// or a place.

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
const fold = (t) => (t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[ \t]+/g, " ");
/** The lines of a text that are not empty, without case or accent. */
export const linesOf = (text) => fold(text).split("\n").map((l) => l.trim()).filter(Boolean);

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

/**
 * Whether a PDF prints a place as the text's own: one of its names at least
 * (« Branham Tabernacle, Jeffersonville, Indiana, U.S.A. ») in a line of a
 * title page or of a signature, as for a date (45 characters at most:
 * « Krefeld, juillet 1986 », « Missionnaire Ewald Frank, Krefeld
 * (Allemagne) »), or in one of the first ten lines (« Traduction de la vidéo
 * mensuelle du Centre Missionnaire de Krefeld »). A place inside a sentence
 * is one the text speaks of.
 */
export function printsPlace(location, text) {
  const lines = linesOf(text);
  const where = [...lines.slice(0, 10), ...lines.filter((l) => l.length <= 45)].join("\n");
  return fold(location).split(/[,(]/).map((p) => p.replace(/[^a-z .'’-]/g, "").trim()).some((p) => p.length >= 4 && where.includes(p));
}
