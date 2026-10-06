#!/usr/bin/env node
// The CMPP's texts from its own HTML pages (goal 31). A work of
// manifests/cmpp.json that has an `html_url` (12b) takes its body from that
// page, as the publisher set it: no extraction of a PDF, no model. The PDF
// stays the work's document (`pdf_url`, `local_pdf`).
//
// A page of cmpp.ch is a <header> (the title page), a <main> (the number and
// the month of a circular letter) and an <article> (the text, then the links
// to the PDF and the epub).
//
// The article becomes the body: its paragraphs, bold, italics, headings,
// line breaks and rules as the page has them; a verse set apart (p.vec, a
// <blockquote>) is a quotation; a table is a line a row. The site's own
// furniture goes: the links to print or download, the arrows back to a table
// of contents, the images. A capital the page sets apart for its size
// (« <span>D</span>IEU DEVOILE ») is the first letter of its word. A link
// keeps its words. Nothing is corrected: a misprint of the page is the
// page's.
//
// A heading is as the page prints it, in capitals where it prints capitals.
// Goal 18 had put the headings of the bodies these replace in sentence case,
// with the accents capitals lack (scripts/mevar-section-headings.json): those
// decisions name lines that are gone, and are not applied here, since they
// would write « Église » where the page prints « EGLISE ». 87 can decide the
// page's headings again; it asks a model.
//
// The header goes to the frontmatter and to the manifest, not into the body:
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

const root = path.resolve(import.meta.dirname, "..");
// A header's field that is not the work's: the booklet's « 4 mars 1960 » is
// the American 4/3/60, and the sermon is 60-0403 (76b has the evidence).
const NOT_THE_HEADERS = { les_aigles_de_dieu: ["date"] };

// ─── The article ────────────────────────────────────────────────────────────
const turndown = new TurndownService({ headingStyle: "atx", hr: "---", emDelimiter: "*", strongDelimiter: "**", bulletListMarker: "-" });
// Only what would change the meaning of a line: an asterisk or an underscore
// in the text, and a line that would start a list, a heading or a quotation.
turndown.escape = (text) => text.replace(/([*_\\])/g, "\\$1").replace(/^([-+>#])(?=\s)/gm, "\\$1").replace(/^(\d+)\.(?=\s)/gm, "$1\\.");
const cls = (node) => node.getAttribute?.("class") ?? "";
const href = (node) => node.getAttribute("href") ?? "";
const inline = (content) => content.replace(/\s*\n\s*/g, " ").trim();
turndown.remove(["nav", "script", "style", "audio", "button"]);
turndown.addRule("image", { filter: "img", replacement: () => "" });
// the links to print, to download, and back to the top or to a table of contents
turndown.addRule("furniture", {
  // (a « flex » block is the menu of downloads when it holds a <nav>; others hold a table of promises and fulfilments, or a photograph's caption)
  filter: (node) => (node.nodeName === "DIV" && /\bflex\b/.test(cls(node)) && node.querySelector("nav")) || (node.nodeName === "A" && (/\.(pdf|epub)$/i.test(href(node)) || (href(node).startsWith("#") && /^(retour|haut)/i.test(`${node.getAttribute("title") ?? ""}${node.textContent.trim()}`)))),
  replacement: () => "",
});
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
turndown.addRule("cell", { filter: ["td", "th"], replacement: (content) => `${inline(content)} | ` });
turndown.addRule("row", { filter: "tr", replacement: (content) => `${content.trim().replace(/( \|)+$/, "")}\n` });
turndown.addRule("table", { filter: ["table", "tbody", "thead"], replacement: (content) => `\n\n${content.trim()}\n\n` });
turndown.addRule("term", { filter: "dt", replacement: (content) => `${inline(content)} ` });
turndown.addRule("definition", { filter: "dd", replacement: (content) => `${inline(content)}\n` });

function bodyOf(html) {
  const article = html.match(/<article[^>]*>([\s\S]*)<\/article>/)[1]
    // Runs of emphasis that touch are written so that markdown can say them: nothing changes for the reader.
    // « <b><i>A</i></b><i>”</i> » is « <i><b>A</b>”</i> », and the same before, and with bold outside;
    .replace(/<(b|i)><(i|b)>([^<]*)<\/\2><\/\1>(\s*)<\2>/g, "<$2><$1>$3</$1>$4")
    .replace(/<\/(i|b)>(\s*)<(b|i)><\1>([^<]*)<\/\1><\/\3>/g, "$2<$3>$4</$3></$1>")
    // an empty run is none, and two runs of italics, or of bold, that touch are one (« *a**b* » would read as bold).
    .replace(/<(i|b)>(\s*)<\/\1>/g, "$2")
    .replace(/<\/(i|b)>(\s*)<\1>/g, "$2");
  return `${turndown.turndown(article)
    .replace(/<\/?font[^>]*>/g, "") // a tag the page closes and never opened (serie4no3)
    .replace(/\u00a0+ | \u00a0+/g, " ") // « 20&nbsp; Au quatrième chapitre »: one space
    .replace(/[ \t\u00a0]+$/gm, (end) => (end === "  " ? end : "")) // a line's trailing spaces, but a line break's two
    .replace(/^[\u00a0 ]+(?=\S)/gm, "") // the spaces that indent a paragraph
    .replace(/ {2}\n(?=\n|$)/g, "\n") // a line break that ends a paragraph
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^(---\n+)+|(\n+---)+$/g, "")}\n`; // a rule that opens or closes the article is the layout's
}

// ─── The header ─────────────────────────────────────────────────────────────
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const noAccent = (t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const monthOf = (name) => String(MONTHS.map(noAccent).indexOf(noAccent(name)) + 1).padStart(2, "0");
const M = MONTHS.map(noAccent).join("|");
const DAY = new RegExp(`^(\\d{1,2})\\s*(?:er|ᵉʳ)?\\s+(${M})\\s+(\\d{4})(?:,?\\s*((?:\\p{L}+ )?(?:matin|apres-midi|soir)))?$`, "u");
const MONTH = new RegExp(`^(${M})(?:\\s*[–—-]\\s*(?:${M}))?\\s+(\\d{4})$`);

/** What the title page of a page prints: { original_title, date, time_of_day, location }, each only if it is there. */
function headerOf(html) {
  const top = `${html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ""}${html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ""}`;
  // each block of the header, as its lines
  const blocks = [...top.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , inner]) => inner.split(/<br\s*\/?>/).map((l) => l.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()).filter(Boolean));
  const printed = {};
  for (const lines of blocks) {
    // « (Unveiling of God) », not « (Texte du film) » nor « (fin) »; the page forgets a parenthesis twice (« Questions And Answers On The Seal) »)
    const english = lines.length === 1 && !/\b(du|des|de la|le|la|les|et)\b/i.test(lines[0]) && /^\(|\)$/.test(lines[0]) && lines[0].match(/^\(?([A-Z][A-Za-z0-9 ,.'’?!:-]*?)\)?$/);
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
let works = 0, bodies = 0, fields = 0;
for (const entry of manifest) {
  const file = path.join(root, entry.local_md);
  const before = fs.readFileSync(file, "utf8");
  if (!entry.html_url) {
    // a work that lost its page (a duplicate since) says so no more; its body stays
    const text = dropField(before, "html_url");
    if (text !== before) fs.writeFileSync(file, text);
    continue;
  }
  works++;
  const html = await page(new URL(entry.html_url).pathname.slice(1));
  const body = bodyOf(html);
  const start = before.indexOf("\n---\n", 4) + 5;
  let text = before.slice(0, start);
  const printed = { ...headerOf(html), html_url: entry.html_url };
  // the two fields only a header gives go when the header no longer prints them
  for (const key of ["original_title", "time_of_day"]) if (!(key in printed) && key in entry) { delete entry[key]; text = dropField(text, key); fields++; }
  for (const [key, value] of Object.entries(printed)) {
    if (NOT_THE_HEADERS[entry.sermon_id]?.includes(key)) continue;
    if (entry[key] !== value && key !== "html_url") fields++;
    entry[key] = value;
    text = setField(text, key, value);
  }
  if (before.slice(start) !== body) bodies++;
  if (text + body !== before) fs.writeFileSync(file, text + body);
}
const out = JSON.stringify(manifest, null, 2);
if (out !== fs.readFileSync(manifestPath, "utf8")) fs.writeFileSync(manifestPath, out);
console.log(`${works} works have a page of cmpp.ch: ${bodies} bodies and ${fields} header fields changed`);
