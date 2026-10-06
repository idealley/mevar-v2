#!/usr/bin/env node
// The CMPP's texts from its own HTML pages (goal 31). A work of
// manifests/cmpp.json that has an `html_url` (12b) takes its body from that
// page, as the publisher set it: no extraction of a PDF, no model. The PDF
// stays the work's document (`pdf_url`, `local_pdf`).
//
// A page of cmpp.ch is a <header> (the title page), a <main> and an <article>
// (the text, then the links to the PDF and the epub). <main> holds the number
// and the month of a circular letter (« LETTRE CIRCULAIRE N° 56 », « JANVIER
// 2005 »), which are its title page too, or the opening of the text: an
// introduction, an epigraph, the addressees of an open letter.
//
// What <main> holds beyond that number and month, then the article, become
// the body: paragraphs, bold, italics, headings (one of two lines is one
// heading), line breaks and rules as the page has them; a verse set apart
// (p.vec, a <blockquote>) is a quotation; a table is a table. The page's own
// numbering (« 1) Actes 2.38 », « 39. ») is text, not a list. The site's own
// furniture goes: the links to print or download, the arrows back to a table
// of contents, the images. A capital the page sets apart for its size
// (« <span>D</span>IEU DEVOILE ») is the first letter of its word. A link
// keeps its words. Nothing is corrected: a misprint of the page is the
// page's.
//
// A heading the page prints in capitals is written in sentence case, with
// the accents capitals lack, as goal 18 decided for every section heading of
// the site (« ## EDITION SPECIALE DECISIVE » is « ## Édition spéciale
// décisive »): the decisions are 87's (`87 --pages`), kept in
// scripts/mevar-section-headings.json, and applied here; a heading 87 has not
// decided stays as the page prints it. Its words do not change, and nothing
// that is not a heading does.
//
// The title page goes to the frontmatter and to the manifest, not into the
// body. `title_page` holds its lines as printed, all of them (a circular
// letter's motto, a book's « Titre original de l’ouvrage »), so that no word
// of the page is lost; and from those lines:
//   - « (Unveiling of God) », a title in parentheses, capitalised and without
//     an accent, is `original_title`;
//   - « 14 juin 1964, matin » is `date` and `time_of_day` (« matin », or
//     « dimanche matin » as printed; 49b reads it); the lines under it in the
//     same block, « Branham Tabernacle », « Jeffersonville — Indiana,
//     U.S.A. », are `location`;
//   - « JANVIER 2005 », « Mars 2010 », « Juillet 1954 » alone on a line is a
//     month: `date: "2005-01"`, and the lines under it are `location`.
// What the header does not print is left as it is. `html_url` is written in
// the frontmatter too. `title`, `subtitle`, `summary`, `tags`, `persons`, `places`,
// `themes`, `preacher`, `pdf_url`, `local_pdf` are not touched.
//
// A duplicate (83b) and a draft have no `html_url` and keep their body.
// Idempotent: a second run changes nothing. Run it after 12b; then 76b, 49b,
// 83b, 65, 47, 50.
//
//   node scripts/43-import-cmpp-html.mjs

import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";
import { dropField, setField } from "./frontmatter.mjs";
import { page } from "./12b-pair-cmpp-pages.mjs";
import { applyHeadings } from "./87-section-headings.mjs";

const root = path.resolve(import.meta.dirname, "..");

// ─── The article ────────────────────────────────────────────────────────────
const turndown = new TurndownService({ headingStyle: "atx", hr: "---", emDelimiter: "*", strongDelimiter: "**", bulletListMarker: "-" });
// Only what would change the meaning of a line: an asterisk or an underscore
// in the text, a « < » or an « & » markdown would read as a tag or an entity
// (the page of lc2 prints « <Amen> »), and a line that would start a list, a
// heading or a quotation.
turndown.escape = (text) => text.replace(/([*_\\<])/g, "\\$1").replace(/&(?=#?\w+;)/g, "\\&").replace(/^([-+>#])(?=\s)/gm, "\\$1").replace(/^(\d+)\.(?=\s)/gm, "$1\\.");
const cls = (node) => node.getAttribute?.("class") ?? "";
const inline = (content) => content.replace(/\s*\n\s*/g, " ").trim();
// (« summary » is the label that opens an audio's transcription, and the line under an <audio> its caption)
turndown.remove(["nav", "script", "style", "audio", "button", "summary"]);
turndown.addRule("caption", { filter: (node) => node.nodeName === "SPAN" && /<audio/.test(node.previousElementSibling?.nodeName === "BR" ? node.previousElementSibling.previousElementSibling?.innerHTML ?? "" : node.previousElementSibling?.innerHTML ?? ""), replacement: () => "" });
// « LES SAINTES ECRITURES,<br>LA TRADITION ET LES INTERPRETATIONS » is one heading
turndown.addRule("heading", { filter: ["h1", "h2", "h3", "h4", "h5", "h6"], replacement: (content, node) => (inline(content) ? `\n\n${"#".repeat(Number(node.nodeName[1]))} ${inline(content)}\n\n` : "") });
turndown.addRule("image", { filter: "img", replacement: () => "" });
turndown.addRule("link", { filter: "a", replacement: (content) => content });
// Bold and italics. Markdown reads « mot.**Suite » or « 11.25*: “En… » as asterisks, not as the end or the start of a
// run: where a run touches a word on a side where it has punctuation, that punctuation is written outside the run.
// The words and what is bold or italic among them do not change.
const WORD = /[\p{L}\p{N}]/u;
// the text that touches a run on one side, in its paragraph: its sibling's, or its parent's when it opens or closes a run that holds it
function neighbour(node, side) {
  for (let n = node; n && /^(B|I|EM|STRONG|SPAN|U|A)$/.test(n.nodeName); n = n.parentNode) if (n[side]) return n[side].textContent ?? "";
  return "";
}
const emphasis = (mark) => (content, node) => {
  // a run of signs alone (« 27.45<i>-</i>54 ») has nothing markdown can mark
  if (!WORD.test(content)) return content;
  const before = neighbour(node, "previousSibling").slice(-1), after = neighbour(node, "nextSibling").slice(0, 1);
  // (a space inside the run on that side already parts it from the word: turndown writes it outside)
  const lead = WORD.test(before) && !/^\s/.test(node.textContent) ? content.match(/^[^\p{L}\p{N}*]+/u)?.[0] ?? "" : "";
  const rest = content.slice(lead.length);
  const trail = WORD.test(after) && !/\s$/.test(node.textContent) ? rest.match(/[^\p{L}\p{N}*]+$/u)?.[0] ?? "" : "";
  const run = rest.slice(0, rest.length - trail.length);
  // a run over several lines of the page is marked line by line: a mark cannot open before a line break and close after it
  return lead + run.split(/(\s*\n\s*)/).map((part, n) => (n % 2 || !WORD.test(part) ? part : `${mark}${part}${mark}`)).join("") + trail;
};
turndown.addRule("bold", { filter: ["b", "strong"], replacement: emphasis("**") });
turndown.addRule("italics", { filter: ["i", "em"], replacement: emphasis("*") });
// the rules around the download links (« barre ») and under a title page are the layout's
turndown.addRule("rule", { filter: (node) => node.nodeName === "HR" && (node.getAttribute("id") || /shadow|hrart/.test(cls(node))), replacement: () => "" });
turndown.addRule("verse", { filter: (node) => node.nodeName === "P" && /\bvec/.test(cls(node)), replacement: (content) => `\n\n${content.trim().replace(/^/gm, "> ")}\n\n` });
// A table is a markdown table: its first row the heading row markdown asks for, every row as wide as the widest.
turndown.addRule("cell", { filter: ["td", "th"], replacement: (content) => ` ${inline(content).replace(/\|/g, "\\|")} |` });
turndown.addRule("row", { filter: "tr", replacement: (content) => `|${content}\n` });
turndown.addRule("rows", { filter: ["tbody", "thead"], replacement: (content) => content });
turndown.addRule("table", {
  filter: "table",
  replacement: (content) => {
    const rows = content.trim().split("\n").filter(Boolean).map((row) => row.split(/(?<!\\)\|/).slice(1, -1));
    const width = Math.max(...rows.map((cells) => cells.length));
    const line = (cells) => `|${[...cells, ...Array(width - cells.length).fill(" ")].join("|")}|`;
    return `\n\n${[line(rows[0]), line(Array(width).fill(" --- ")), ...rows.slice(1).map(line)].join("\n")}\n\n`;
  },
});
// What the page's own <style> hides at full width (`#tab600{ display:none; }`, `.responsive-table .stacked-table`)
// is the narrow-screen copy of a block the page also sets as a table: a reader at a desk sees one, and the body has
// that one. (The site's shared stylesheets hide only parts of its menus.)
let hidden = []; // the selectors of the page being converted, each a chain of compounds: [[{ tag, id, classes }]]
function hiddenBy(html) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, s]) => s).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...css.matchAll(/([^{}]+)\{[^{}]*display\s*:\s*none[^{}]*\}/g)].flatMap(([, selectors]) => selectors.split(",")).map((selector) => selector.trim().split(/\s+/).map((compound) => ({ tag: compound.match(/^[a-z][a-z0-9]*/i)?.[0].toUpperCase(), id: compound.match(/#([\w-]+)/)?.[1], classes: [...compound.matchAll(/\.([\w-]+)/g)].map(([, c]) => c) })));
}
const is = (node, { tag, id, classes }) => node.nodeType === 1 && (!tag || node.nodeName === tag) && (!id || node.getAttribute("id") === id) && classes.every((c) => cls(node).split(/\s+/).includes(c));
function matches(node, chain) {
  if (!is(node, chain.at(-1))) return false;
  let k = chain.length - 2;
  for (let up = node.parentNode; up && k >= 0; up = up.parentNode) if (is(up, chain[k])) k--;
  return k < 0;
}
turndown.addRule("hidden", { filter: (node) => hidden.some((chain) => matches(node, chain)), replacement: () => "" });

/** A page in its two parts: its title page (the <header>, and a circular letter's number and month in <main>), and its text (the rest of <main>, then the <article>). */
function partsOf(html) {
  let titled = "";
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "")
    .replace(/<h1[^>]*>\s*LETTRE CIRCULAIRE[\s\S]*?<\/h1>\s*(?:<h2[^>]*>[\s\S]*?<\/h2>)?/, (found) => { titled = found; return ""; })
    .replace(/<hr[^>]*>/g, ""); // the rules of <main> part the title page from the text
  return { top: `${html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ""}${titled}`, text: `${main}${html.match(/<article[^>]*>([\s\S]*)<\/article>/)[1]}` };
}

function bodyOf(text) {
  const html = text
    // A line break that opens or closes a run of emphasis is outside it: « <i> cela!)<br></i> ».
    .replace(/(<br\s*\/?>\s*)<\/(i|b)>/g, "</$2>$1")
    .replace(/<(i|b)>(\s*<br\s*\/?>)/g, "$2<$1>")
    // Runs of emphasis that touch are written so that markdown can say them: nothing changes for the reader.
    // « <b><i>A</i></b><i>”</i> » is « <i><b>A</b>”</i> », and the same before, and with bold outside;
    .replace(/<(b|i)><(i|b)>([^<]*)<\/\2><\/\1>(\s*)<\2>/g, "<$2><$1>$3</$1>$4")
    .replace(/<\/(i|b)>(\s*)<(b|i)><\1>([^<]*)<\/\1><\/\3>/g, "$2<$3>$4</$3></$1>")
    // an empty run is none, and two runs of italics, or of bold, that touch are one (« *a**b* » would read as bold).
    .replace(/<(i|b)>(\s*)<\/\1>/g, "$2")
    .replace(/<\/(i|b)>(\s*)<\1>/g, "$2");
  return `${turndown.turndown(html)
    .replace(/\u00a0+ | \u00a0+/g, " ") // « 20&nbsp; Au quatrième chapitre »: one space
    .replace(/[ \t\u00a0]+$/gm, (end) => (end === "  " ? end : "")) // a line's trailing spaces, but a line break's two
    .replace(/^[\u00a0 ]+(?=\S)/gm, "") // the spaces that indent a paragraph
    .replace(/ {2}\n(?=\n|$)/g, "\n") // a line break that ends a paragraph
    .replace(/^((?:> ?)*)(\d+)([.)])(?=\s)/gm, "$1$2\\$3") // « 1) Actes 2.38 », « 39. Concernant… »: the page's numbering, not a list
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^(---\n+)+|(\n+---)+$/g, "")}\n`; // a rule that opens or closes the text is the layout's
}

// ─── The header ─────────────────────────────────────────────────────────────
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const noAccent = (t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const monthOf = (name) => String(MONTHS.map(noAccent).indexOf(noAccent(name)) + 1).padStart(2, "0");
const M = MONTHS.map(noAccent).join("|");
// (the page types « 14 octobre1962, matin » three times)
const DAY = new RegExp(`^(\\d{1,2})\\s*(?:er|ᵉʳ)?\\s+(${M})\\s*(\\d{4})(?:,?\\s*((?:\\p{L}+ )?(?:matin|apres-midi|soir)))?$`, "u");
const MONTH = new RegExp(`^(${M})(?:\\s*[–—-]\\s*(?:${M}))?\\s+(\\d{4})$`);

const lineOf = (html) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/\s+/g, " ").trim();
/** What a title page prints: { title_page, original_title, date, time_of_day, location }, each only if it is there. */
function headerOf(top) {
  // each block of the title page, as its lines
  const blocks = [...top.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , inner]) => inner.split(/<br\s*\/?>/).map(lineOf).filter(Boolean));
  // every line it prints, a block or a line break a line
  const all = top.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").split(/<br\s*\/?>|<\/?(?:h[1-6]|p|div|li|tr|hr)\b[^>]*>/).map(lineOf).filter(Boolean);
  const printed = all.length ? { title_page: all } : {};
  for (const lines of blocks) {
    // « (Unveiling of God) », « (discerning the Body of The Lord) »: in parentheses, without an accent, and no French
    // (« (Texte du film) », « (fin) »); the page forgets a parenthesis twice (« Questions And Answers On The Seal) »)
    const english = lines.map((l) => !/\b(du|des|de la|le|la|les|et|pas|en|sans|une?|pour|que|qui|dans)\b/i.test(l) && /^\(|\)$/.test(l) && l.match(/^\(?((?:[A-Z]|[a-z]+ )[A-Za-z0-9 ,.'’?!:-]*?)\)?$/)).find(Boolean);
    if (english) printed.original_title ??= english[1];
    const at = lines.findIndex((l) => DAY.test(noAccent(l)) || MONTH.test(noAccent(l)));
    if (at < 0 || printed.date) continue;
    const day = noAccent(lines[at]).match(DAY), month = noAccent(lines[at]).match(MONTH);
    printed.date = day ? `${day[3]}-${monthOf(day[2])}-${day[1].padStart(2, "0")}` : `${month[2]}-${monthOf(month[1])}`;
    // the words after the comma, with the page's accents
    if (day?.[4]) printed.time_of_day = lines[at].slice(lines[at].lastIndexOf(",") + 1).trim();
    if (lines.length > at + 1) printed.location = lines.slice(at + 1).join(", ");
  }
  return printed;
}

// ─── Each work that has a page ──────────────────────────────────────────────
const manifestPath = path.join(root, "manifests/cmpp.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const headings = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-section-headings.json"), "utf8"));
let works = 0, bodies = 0, fields = 0;
for (const entry of manifest) {
  const file = path.join(root, entry.local_md);
  const before = fs.readFileSync(file, "utf8");
  if (!entry.html_url) {
    // a work that lost its page (a duplicate since) says so no more; its body stays
    let text = before;
    for (const key of ["html_url", "title_page", "original_title", "time_of_day"]) { text = dropField(text, key); delete entry[key]; }
    if (text !== before) fs.writeFileSync(file, text);
    continue;
  }
  works++;
  const html = await page(new URL(entry.html_url).pathname.slice(1));
  hidden = hiddenBy(html);
  const { top, text: article } = partsOf(html);
  const body = applyHeadings(bodyOf(article), headings[entry.local_md]).body;
  const start = before.indexOf("\n---\n", 4) + 5;
  let text = before.slice(0, start);
  const printed = { ...headerOf(top), html_url: entry.html_url };
  // the three fields only a title page gives go when it no longer prints them
  for (const key of ["title_page", "original_title", "time_of_day"]) if (!(key in printed) && key in entry) { delete entry[key]; text = dropField(text, key); fields++; }
  for (const [key, value] of Object.entries(printed)) {
    // One header's date is not its work's: the booklet's « 4 mars 1960 » is the American 4/3/60, and the sermon is 60-0403 (76b has the evidence).
    if (entry.sermon_id === "les_aigles_de_dieu" && key === "date") continue;
    if (JSON.stringify(entry[key]) !== JSON.stringify(value) && key !== "html_url") fields++;
    entry[key] = value;
    text = setField(text, key, value);
  }
  if (before.slice(start) !== body) bodies++;
  if (text + body !== before) fs.writeFileSync(file, text + body);
}
const out = JSON.stringify(manifest, null, 2);
if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);
console.log(`${works} works have a page of cmpp.ch: ${bodies} bodies and ${fields} header fields changed`);
