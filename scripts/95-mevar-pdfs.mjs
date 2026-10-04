#!/usr/bin/env node
// Goal 23: every Mevar text offers a PDF, and its original where it has one.
//
// - A text goal 10 edited (editorial_pass) from the OneDrive folder or the
//   mevar.org PDFs, not a duplicate and not a draft: its original, the
//   OneDrive PDF it was edited from (a work 86 split off: the PDF it was
//   printed in), copied to files/onedrive/ and named in `local_pdf` (a
//   mevar.org PDF already has its own); and the PDF of its text.
// - A Ghost post (source mevar, a post, not a page) that had no PDF: the
//   OneDrive original of the same work, where one of its OneDrive
//   duplicates has it; otherwise the PDF of its text.
// The PDF of a text: the text as the site shows it, with its title,
// subtitle, preacher, date and place, and its page numbers, written to
// files/mevar-text/<slug>.pdf and named in `text_pdf`.
// Samuel (2026-10-03): « Both »; the originals are published as they are;
// for the Ghost posts, « 50 originals + 96 generated ».
//
// Deterministic: a PDF's dates are the text's editorial_pass or publication
// date, so a second run writes nothing. It deletes only a PDF of a text it
// made, in files/mevar-text/, that no text names any more.
//
// Usage: node scripts/90-mevar-pdfs.mjs [--dry]. Needs the OneDrive folder
// at onedrive/ (gitignored) for the originals.

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frenchSpacing } from "../web/src/lib/french-typography.mjs";

import { frontmatter, field, setField } from "./frontmatter.mjs";
const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const FONTS = path.join(root, "node_modules/@expo-google-fonts/noto-serif");
const font = (w) => path.join(FONTS, w, `NotoSerif_${w}.ttf`);
const hebrew = (w) => path.join(root, "node_modules/@expo-google-fonts/noto-serif-hebrew", w, `NotoSerifHebrew_${w}.ttf`);
const ORIGINALS = "files/onedrive";
const TEXT = "files/mevar-text";

const slug = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The texts, by path
const texts = new Map();
for (const dir of ["markdown/mevar", "markdown/onedrive", "markdown/mevar-pdfs"])
  for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true }).sort()) {
    if (!rel.endsWith(".md")) continue;
    const md = `${dir}/${rel}`;
    const text = fs.readFileSync(path.join(root, md), "utf8");
    const fm = frontmatter(text);
    texts.set(md, { md, text, fm });
  }
const byWork = (work) => texts.get(`markdown/${work}.md`);

// The OneDrive PDF a text was edited from
const stemOf = (t) => (field(t.fm, "source_path") ?? t.md.slice("markdown/".length)).replace(/\.md$/, "");
function originalOf(t) {
  // a work 86 split off (its path is its first work's, a dash, its slug):
  // the PDF it was printed in, its first work's
  const first = byWork(field(t.fm, "published_with") ?? "");
  const stem = first && stemOf(t).startsWith(`${stemOf(first)}-`) ? stemOf(first) : stemOf(t);
  return inventory.find((e) => e.ext === ".pdf" && [e.canonical_path, ...e.aliases].some((p) => p.replace(/\.[^.]+$/, "") === stem))?.canonical_path ?? null;
}

// The PDF of a text: the frontmatter's header, then the body
function inline(doc, nodes, style, opts) {
  const parts = [];
  (function walk(ns, s) {
    for (const n of ns) {
      if (n.type === "text") parts.push([n.value, s]);
      else if (n.type === "strong") walk(n.children, { ...s, bold: true });
      else if (n.type === "emphasis") walk(n.children, { ...s, italic: true });
      else if (n.type === "break") parts.push(["\n", s]);
      else if (n.type === "link") walk(n.children, s);
      // a footnote's anchor in a Ghost post (« <a id="_ftn1" href="#_ftnref1"> »): its number stays
      else if (n.type === "html" && /^<\/?a(\s[^>]*)?>$/.test(n.value)) continue;
      // anything else (HTML, code) would lose or garble words: refused
      else throw new Error(`a ${n.type} in the text, which the PDF does not render: ${JSON.stringify(n.value ?? "").slice(0, 60)}`);
    }
  })(nodes, style);
  if (!parts.length) return;
  // French typography as the site sets it (goal 17): the narrow space before
  // « : ; ? ! », a reference without Word's space (« 2 :3 » reads « 2:3 »)
  let before = "";
  const runs = parts.map(([t, s]) => { const out = frenchSpacing(t, before); before += t; return [out, s]; });
  // pdfkit breaks lines run by run: a mark that opens a run (« . » ») would
  // start a line of its own after a bold run, so it joins the run before
  for (let i = runs.length - 1; i > 0; i--) {
    const lead = runs[i][0].match(/^(?:[\u202f\u00a0 ]*[.,;:!?…»)\]])+/u)?.[0];
    if (lead) { runs[i - 1][0] += lead; runs[i][0] = runs[i][0].slice(lead.length); }
  }
  // a line break (« Fr. M’BRA Parfait  ⏎Missionnaire ») ends a line
  const lines = [[]];
  for (const r of runs) if (r[0] === "\n") lines.push([]); else if (r[0]) lines.at(-1).push(r);
  // a Hebrew word in the Hebrew font, which sets it right to left; « n◦ »
  // is a misprint for « n° », a glyph the font has
  for (const line of lines.filter((l) => l.length)) {
    const segs = line.flatMap(([t, s]) => t.replace(/◦/g, "°").split(/([\u0590-\u05ff]+(?:[ \u05be][\u0590-\u05ff]+)*)/).filter(Boolean).map((x) => [x, s]));
    segs.forEach(([t, s], i) => {
      doc.font(/[\u0590-\u05ff]/.test(t) ? (s.bold ? "heb" : "he") : s.bold ? (s.italic ? "bi" : "b") : s.italic ? "i" : "r");
      doc.text(t, { ...opts, continued: i < segs.length - 1 });
    });
  }
}

async function textPdf(t) {
  // the images a Ghost post shows, as PNG (pdfkit reads no WebP)
  const images = new Map();
  for (const m of t.text.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) images.set(m[1], await sharp(path.join(root, m[1])).png().toBuffer());
  return new Promise((resolve) => {
    const title = field(t.fm, "title");
    const author = field(t.fm, "preacher") ?? t.fm.match(/^authors:\n  - "(.+)"$/m)?.[1];
    const day = new Date(`${(field(t.fm, "editorial_pass") ?? field(t.fm, "published_at")).slice(0, 10)}T00:00:00Z`);
    const doc = new PDFDocument({
      size: "A4", margins: { top: 64, bottom: 64, left: 70, right: 70 }, bufferPages: true,
      info: { Title: title, ...(author && { Author: author }), CreationDate: day, ModDate: day, Producer: "mevar.org", Creator: "mevar.org" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont("r", font("400Regular"));
    doc.registerFont("b", font("700Bold"));
    doc.registerFont("i", font("400Regular_Italic"));
    doc.registerFont("bi", font("700Bold_Italic"));
    doc.registerFont("he", hebrew("400Regular"));
    doc.registerFont("heb", hebrew("700Bold"));
    const width = doc.page.width - 140;
    doc.font("b").fontSize(20).text(frenchSpacing(title), { align: "left" });
    const subtitle = field(t.fm, "subtitle");
    if (subtitle) doc.moveDown(0.3).font("i").fontSize(13).text(frenchSpacing(subtitle));
    const date = field(t.fm, "date") ?? field(t.fm, "published_at")?.slice(0, 10);
    const when = date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : field(t.fm, "year");
    const line = [author, when, field(t.fm, "location")].filter(Boolean).join(" · ");
    if (line) doc.moveDown(0.4).font("r").fontSize(11).fillColor("#555555").text(line).fillColor("#000000");
    doc.moveDown(1.2).fontSize(11.5);
    const body = t.text.slice(t.text.indexOf("\n---\n", 4) + 5);
    const tree = fromMarkdown(body);
    const block = (n, indent = 0, quote = false) => {
      // left-aligned, as on the site: justified text gapes where bold and roman alternate
      const opts = { width: width - indent, align: "left", lineGap: 2 };
      const x = 70 + indent;
      if (n.type === "heading") {
        doc.moveDown(0.6).fontSize({ 2: 16, 3: 14, 4: 12.5 }[n.depth]);
        doc.x = x; inline(doc, n.children, { bold: true }, opts);
        doc.moveDown(0.4).fontSize(11.5);
      } else if (n.type === "paragraph") {
        // an image, on its own: the page's width at most
        const words = n.children.filter((c) => c.type !== "image");
        if (words.some((c) => c.type !== "text" || c.value.trim())) { doc.x = x; inline(doc, words, { italic: quote }, opts); doc.moveDown(0.6); }
        for (const c of n.children.filter((c) => c.type === "image")) {
          doc.image(images.get(c.url), x, undefined, { fit: [width - indent, 360] });
          doc.moveDown(0.6);
        }
      } else if (n.type === "blockquote") {
        for (const c of n.children) block(c, indent + 18, true);
      } else if (n.type === "list") {
        n.children.forEach((item, i) => {
          const mark = n.ordered ? `${(n.start ?? 1) + i}. ` : "– ";
          item.children.forEach((c, j) => {
            if (c.type === "paragraph") {
              doc.x = x + 14; inline(doc, [{ type: "text", value: j ? "" : mark }, ...c.children], { italic: quote }, { ...opts, width: width - indent - 14 });
              doc.moveDown(0.3);
            } else block(c, indent + 14, quote);
          });
        });
        doc.moveDown(0.3);
      } else if (n.type === "thematicBreak") {
        doc.moveDown(0.5).text("* * *", 70, undefined, { width, align: "center" }).moveDown(0.5);
      } else throw new Error(`a ${n.type} in the text, which the PDF does not render`);
    };
    for (const n of tree.children) block(n);
    // the page number at each page's foot
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("r").fontSize(9).fillColor("#777777").text(String(i + 1), 70, doc.page.height - 40, { width, align: "center", lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

const sameBytes = (file, buf) => fs.existsSync(file) && fs.readFileSync(file).equals(buf);

const named = new Set();
const from = new Map(); // an original's file name, and the PDF it was copied from
let written = 0, copied = 0, frontmatters = 0;
const missing = [];
// an original copied to files/onedrive/, named in the text
function copyOriginal(original, text) {
  const dest = `${ORIGINALS}/${slug(path.basename(original, ".pdf"))}.pdf`;
  if (from.has(dest) && from.get(dest) !== original) throw new Error(`${dest}: both ${from.get(dest)} and ${original}`);
  from.set(dest, original);
  named.add(dest);
  const buf = fs.readFileSync(path.join(root, original));
  if (!sameBytes(path.join(root, dest), buf)) {
    copied++;
    if (!dry) { fs.mkdirSync(path.join(root, ORIGINALS), { recursive: true }); fs.writeFileSync(path.join(root, dest), buf); }
  }
  return setField(text, "local_pdf", `/${dest}`);
}
// the PDF of the text, named in it
async function writeText(t, text) {
  const dest = `${TEXT}/${path.basename(t.md, ".md")}.pdf`;
  named.add(dest);
  const buf = await textPdf(t);
  if (!sameBytes(path.join(root, dest), buf)) {
    written++;
    if (!dry) { fs.mkdirSync(path.join(root, TEXT), { recursive: true }); fs.writeFileSync(path.join(root, dest), buf); }
  }
  return setField(text, "text_pdf", `/${dest}`);
}
// the OneDrive duplicates of each work
const duplicates = new Map();
for (const t of texts.values()) {
  const of = field(t.fm, "duplicate_of");
  if (of && t.md.startsWith("markdown/onedrive/")) duplicates.set(`markdown/${of}.md`, [...(duplicates.get(`markdown/${of}.md`) ?? []), t]);
}
for (const t of texts.values()) {
  const source = field(t.fm, "source");
  if (/^duplicate_of:/m.test(t.fm) || field(t.fm, "status") === "draft") continue;
  let text = t.text;
  if (/^editorial_pass:/m.test(t.fm) && (source === "onedrive" || source === "mevar-pdfs")) {
    if (source === "onedrive") {
      const original = originalOf(t);
      // none found: what the text names stays, and is listed
      if (original) text = copyOriginal(original, text);
      else missing.push(t.md);
    }
    text = await writeText(t, text);
  } else if (source === "mevar" && field(t.fm, "type") === "post" && !field(t.fm, "pdf_url") && !field(t.fm, "local_pdf")?.startsWith("/files/mevar/")) {
    // a Ghost post without a PDF of its own: its OneDrive duplicate's original, or its text
    const original = (duplicates.get(t.md) ?? []).map(originalOf).find(Boolean);
    text = original ? copyOriginal(original, text) : await writeText(t, text);
  } else continue;
  if (text !== t.text) { frontmatters++; if (!dry) fs.writeFileSync(path.join(root, t.md), text); }
}
// a PDF of a text it made that no text names any more (a text renamed by
// 88); never an original, never a file another text names
const anyNames = new Set([...texts.values()].flatMap((t) => [...t.fm.matchAll(/^(?:local_pdf|text_pdf): "\/(.+)"$/gm)].map((m) => m[1])));
let removed = 0;
if (fs.existsSync(path.join(root, TEXT)))
  for (const f of fs.readdirSync(path.join(root, TEXT))) {
    const rel = `${TEXT}/${f}`;
    if (!f.endsWith(".pdf") || named.has(rel) || anyNames.has(rel)) continue;
    removed++;
    if (!dry) fs.rmSync(path.join(root, rel));
  }
console.log(`${named.size} PDFs named; ${copied} originals copied, ${written} text PDFs written, ${frontmatters} frontmatters, ${removed} removed${dry ? " (dry)" : ""}`);
if (missing.length) console.log(`no original found for: ${missing.join(", ")}`);
