#!/usr/bin/env node
// Goal 23: every text goal 10 edited offers two PDFs.
//
// For each promoted text (editorial_pass) from the OneDrive folder or the
// mevar.org PDFs, not a duplicate and not a draft:
//   - the original: the OneDrive PDF the text was edited from (for a work
//     86 split off, the PDF it was printed in, its published_with's),
//     copied to files/onedrive/, named in `local_pdf`; a mevar.org PDF
//     already has its `local_pdf`, under files/mevar/;
//   - the edited PDF: the text as the site shows it, with its title,
//     subtitle, preacher, date and place, written to
//     files/mevar-edited/<slug>.pdf and named in `edited_pdf`.
// Samuel (2026-10-03): « Both »; the originals are published as they are.
//
// Deterministic: the PDF's creation date is the text's editorial_pass, so a
// second run writes nothing. It deletes only files in files/onedrive/ and
// files/mevar-edited/ that no text names any more (it made them).
//
// Usage: node scripts/90-mevar-pdfs.mjs [--dry]. Needs the OneDrive folder
// at onedrive/ (gitignored) for the originals.

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frenchSpacing } from "../web/src/lib/french-typography.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dry = process.argv.includes("--dry");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive-inventory.json"), "utf8"));
const FONTS = path.join(root, "node_modules/@expo-google-fonts/noto-serif");
const font = (w) => path.join(FONTS, w, `NotoSerif_${w}.ttf`);
const ORIGINALS = "files/onedrive";
const EDITED = "files/mevar-edited";

const frontmatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)[1];
const field = (fm, k) => { const m = fm.match(new RegExp(`^${k}: (.*)$`, "m")); return m ? JSON.parse(m[1]) : undefined; };
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
const stemOf = (t) => field(t.fm, "source_path").replace(/\.md$/, "");
function originalOf(t) {
  // a work 86 split off (its path is its first work's, a dash, its slug):
  // the PDF it was printed in, its first work's
  const first = byWork(field(t.fm, "published_with") ?? "");
  const stem = first && stemOf(t).startsWith(`${stemOf(first)}-`) ? stemOf(first) : stemOf(t);
  return inventory.find((e) => e.ext === ".pdf" && [e.canonical_path, ...e.aliases].some((p) => p.replace(/\.[^.]+$/, "") === stem))?.canonical_path ?? null;
}

// The edited PDF: the frontmatter's header, then the body
function inline(doc, nodes, style, opts) {
  const parts = [];
  (function walk(ns, s) {
    for (const n of ns) {
      if (n.type === "text") parts.push([n.value, s]);
      else if (n.type === "strong") walk(n.children, { ...s, bold: true });
      else if (n.type === "emphasis") walk(n.children, { ...s, italic: true });
      else if (n.type === "break") parts.push(["\n", s]);
      else if (n.type === "link") walk(n.children, s);
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
  for (const line of lines.filter((l) => l.length)) line.forEach(([t, s], i) => {
    doc.font(s.bold ? (s.italic ? "bi" : "b") : s.italic ? "i" : "r");
    doc.text(t, { ...opts, continued: i < line.length - 1 });
  });
}

function edited(t) {
  return new Promise((resolve) => {
    const title = field(t.fm, "title");
    const doc = new PDFDocument({
      size: "A4", margins: { top: 64, bottom: 64, left: 70, right: 70 }, bufferPages: true,
      info: { Title: title, ...(field(t.fm, "preacher") && { Author: field(t.fm, "preacher") }), CreationDate: new Date(`${field(t.fm, "editorial_pass")}T00:00:00Z`), ModDate: new Date(`${field(t.fm, "editorial_pass")}T00:00:00Z`), Producer: "mevar.org", Creator: "mevar.org" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont("r", font("400Regular"));
    doc.registerFont("b", font("700Bold"));
    doc.registerFont("i", font("400Regular_Italic"));
    doc.registerFont("bi", font("700Bold_Italic"));
    const width = doc.page.width - 140;
    doc.font("b").fontSize(20).text(frenchSpacing(title), { align: "left" });
    const subtitle = field(t.fm, "subtitle");
    if (subtitle) doc.moveDown(0.3).font("i").fontSize(13).text(frenchSpacing(subtitle));
    const date = field(t.fm, "date");
    const when = date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : field(t.fm, "year");
    const line = [field(t.fm, "preacher"), when, field(t.fm, "location")].filter(Boolean).join(" · ");
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
        doc.x = x; inline(doc, n.children, { italic: quote }, opts);
        doc.moveDown(0.6);
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

// Writes `key: value` in a frontmatter, in place or appended
function setField(text, key, value) {
  const fm = frontmatter(text);
  const lineRe = new RegExp(`^${key}: .*$`, "m");
  const next = lineRe.test(fm) ? fm.replace(lineRe, `${key}: ${JSON.stringify(value)}`) : `${fm}\n${key}: ${JSON.stringify(value)}`;
  return text.replace(fm, () => next);
}
const sameBytes = (file, buf) => fs.existsSync(file) && fs.readFileSync(file).equals(buf);

const named = new Set();
const from = new Map(); // an original's file name, and the PDF it was copied from
let written = 0, copied = 0, frontmatters = 0;
const missing = [];
for (const t of texts.values()) {
  const source = field(t.fm, "source");
  if (!/^editorial_pass:/m.test(t.fm) || /^duplicate_of:/m.test(t.fm) || field(t.fm, "status") === "draft") continue;
  if (source !== "onedrive" && source !== "mevar-pdfs") continue;
  let text = t.text;
  // the original
  if (source === "onedrive") {
    const original = originalOf(t);
    // none found: what the text names stays, and is listed
    if (!original) missing.push(t.md);
    else {
      const dest = `${ORIGINALS}/${slug(path.basename(original, ".pdf"))}.pdf`;
      if (from.has(dest) && from.get(dest) !== original) throw new Error(`${dest}: both ${from.get(dest)} and ${original}`);
      from.set(dest, original);
      named.add(dest);
      const buf = fs.readFileSync(path.join(root, original));
      if (!sameBytes(path.join(root, dest), buf)) {
        copied++;
        if (!dry) { fs.mkdirSync(path.join(root, ORIGINALS), { recursive: true }); fs.writeFileSync(path.join(root, dest), buf); }
      }
      text = setField(text, "local_pdf", `/${dest}`);
    }
  }
  // the edited text
  const dest = `${EDITED}/${path.basename(t.md, ".md")}.pdf`;
  named.add(dest);
  const buf = await edited(t);
  if (!sameBytes(path.join(root, dest), buf)) {
    written++;
    if (!dry) { fs.mkdirSync(path.join(root, EDITED), { recursive: true }); fs.writeFileSync(path.join(root, dest), buf); }
  }
  text = setField(text, "edited_pdf", `/${dest}`);
  if (text !== t.text) { frontmatters++; if (!dry) fs.writeFileSync(path.join(root, t.md), text); }
}
// an edited PDF it made that no text names any more (a text renamed by 88);
// never an original, never a file another text names
const anyNames = new Set([...texts.values()].flatMap((t) => [...t.fm.matchAll(/^(?:local_pdf|edited_pdf): "\/(.+)"$/gm)].map((m) => m[1])));
let removed = 0;
if (fs.existsSync(path.join(root, EDITED)))
  for (const f of fs.readdirSync(path.join(root, EDITED))) {
    const rel = `${EDITED}/${f}`;
    if (!f.endsWith(".pdf") || named.has(rel) || anyNames.has(rel)) continue;
    removed++;
    if (!dry) fs.rmSync(path.join(root, rel));
  }
console.log(`${named.size} PDFs named; ${copied} originals copied, ${written} edited PDFs written, ${frontmatters} frontmatters, ${removed} removed${dry ? " (dry)" : ""}`);
if (missing.length) console.log(`no original found for: ${missing.join(", ")}`);
