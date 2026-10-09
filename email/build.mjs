#!/usr/bin/env node
// The "Publications" email for one work (goals 06 and 34):
//
//   node email/build.mjs markdown/mevar/<slug>.md [--from "Une phrase du texte"] [--note "Une phrase."]
//
// writes email/dist/<slug>.html, .txt and .subject.txt, then prints their
// sizes. The kind of text, the title, the preacher and date, the first texts
// it cites, the opening of its own words (email/excerpt.mjs; --from starts
// it at a phrase Samuel picks), then « Lire la suite », the PDF and the
// recording when there are. The rest stays on the page: readers are on
// metered phones, and the page stays readable offline once opened. Send with
// `npm run email:test` then `npm run email:send`. --note puts one sentence
// from Samuel above the title (the first Resend broadcast says the letter
// has a new sender).
//
// The site's light theme, inline: mail clients drop <style> and web fonts,
// so Georgia stands in for the serifs and the eagle is a PNG. The HTML is
// pure ASCII (every other character is an entity) so a client that guesses
// the charset wrong still shows the accents. The unsubscribe link is
// Resend's merge tag, filled in per reader by the broadcast.

import fs from "node:fs";
import path from "node:path";
import { frenchSpacing } from "../web/src/lib/french-typography.mjs";
import { deriveKind, formatDateFr } from "../web/src/lib/utils.ts";
import { excerpt, text } from "./excerpt.mjs";

const SITE = "https://mevar.org";
const MAX_HTML = 40 * 1024;
const MAX_IMAGE = 100 * 1024;
const root = path.resolve(import.meta.dirname, "..");
// web/src/lib/works.ts, KIND_LABEL
const KIND_LABEL = {
  sermon: "Prédication",
  exhortation: "Exhortation",
  bible_study: "Étude biblique",
  book: "Livre",
  chapter: "Chapitre",
  article: "Article",
};

const flag = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
};
const [file] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
if (!file) {
  console.error('usage: node email/build.mjs markdown/<source>/<slug>.md [--from "Une phrase du texte"] [--note "Une phrase."]');
  process.exit(1);
}
const note = frenchSpacing(flag("--note"));
const rel = path.relative(path.join(root, "markdown"), path.resolve(file)).replace(/\.md$/, "");
const [, front, ...rest] = fs.readFileSync(file, "utf8").split(/^---$/m);
const body = rest.join("---");
const field = (k) => {
  const m = front.match(new RegExp(`^${k}: (.*)$`, "m"));
  return m ? JSON.parse(m[1]) : undefined;
};
const list = (k) => [...(front.match(new RegExp(`^${k}:\\n((?: {2}- .*\\n)+)`, "m"))?.[1].matchAll(/^ {2}- (.*)$/gm) ?? [])].map((m) => JSON.parse(m[1]));

if (field("status") !== "published") throw new Error(`${rel} is not published: a draft is never emailed`);
const title = frenchSpacing(field("title"));
const preacher = field("preacher") ?? list("authors")[0];
const kind = KIND_LABEL[deriveKind({ kind: field("kind"), tags: list("tags"), source: field("source"), subtitle: field("subtitle"), sermon_id: field("sermon_id"), preacher, original: field("original") })];
const refs = list("bible_refs").slice(0, 3).map((r) => frenchSpacing(r));
const image = field("local_image");
// The PDF the page offers first (WorkPage.astro), and the recording on R2.
const pdf = field("text_pdf") ?? field("local_pdf");
const audio = field("local_audio");
// The site's own rule (web/src/lib/works.ts, workUrl).
const url = `${SITE}${rel.startsWith("mevar/") ? `/${rel.slice("mevar/".length)}/` : `/works/${rel}/`}`;
const blocks = excerpt(body, flag("--from"));

if (image) {
  const bytes = fs.statSync(path.join(root, image)).size;
  if (bytes > MAX_IMAGE) throw new Error(`${image} is ${bytes} bytes, over ${MAX_IMAGE}: optimize it first (scripts/93)`);
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[^\x00-\x7F]/g, (c) => `&#${c.codePointAt(0)};`);

// global.css, light theme
const C = { bg: "#fbfaf8", surface: "#ffffff", ink: "#141110", ink2: "#5e574f", read: "#2a2521", accent: "#c64a26", onAccent: "#fff6f1", line: "#e5e0d7" };
const serif = "font-family:Georgia, 'Times New Roman', serif;";
const sans = "font-family:Arial, Helvetica, sans-serif;";
const small = `${sans} font-size:13px; line-height:1.5; color:${C.ink2};`;
const reading = `${serif} font-size:17px; line-height:1.7; color:${C.read}; margin:0 0 18px;`;

// One block of the excerpt. `last` is the text before, so a mark that opens a
// text node is spaced too (french-typography.mjs). In a quotation, bold and
// italics are dropped, as on the site.
function draw(block) {
  let last = "";
  const inline = (nodes, plain) =>
    nodes
      .map((n) => {
        if ("value" in n) {
          const out = esc(frenchSpacing(n.value, last));
          last = n.value;
          return n.type === "code" ? out.replace(/\n/g, "<br>") : out;
        }
        if (n.type === "break") return "<br>";
        const inner = inline(n.children ?? [], plain);
        if (plain) return inner;
        if (n.type === "strong") return `<strong>${inner}</strong>`;
        if (n.type === "emphasis") return `<em>${inner}</em>`;
        return inner;
      })
      .join("");
  if (block.type === "blockquote")
    return `<div style="border-left:3px solid ${C.accent}; padding:2px 0 2px 16px; margin:0 0 18px;">${block.children.map((p) => `<p style="${serif} font-size:18px; line-height:1.5; color:${C.ink}; margin:0 0 8px;">${inline(p.children ?? [p], true)}</p>`).join("")}</div>`;
  return `<p style="${reading}">${inline(block.children ?? [block], false)}</p>`;
}

const more = blocks.length ? "Lire la suite" : "Ouvrir la page";
const preheader = blocks.length ? frenchSpacing(text(blocks[0])).slice(0, 140) : title;
const byline = [preacher, formatDateFr(field("published_at"))].filter(Boolean).join(" · ");
const pill = (href, label) =>
  `<a href="${href}" style="display:inline-block; ${sans} font-size:14px; font-weight:bold; color:${C.ink}; text-decoration:none; border:1px solid ${C.line}; border-radius:999px; padding:10px 18px; margin:0 8px 8px 0;">${esc(label)}</a>`;

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background:${C.bg};">
<div style="display:none; max-height:0; overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:${C.surface}; border:1px solid ${C.line}; border-radius:12px;">
<tr><td style="padding:20px 24px 0;"><a href="${SITE}/" style="${sans} font-size:15px; font-weight:bold; letter-spacing:2.4px; color:${C.ink}; text-decoration:none;"><img src="${SITE}/brand/icon-192.png" width="24" height="24" alt="" style="vertical-align:middle; border:0; margin-right:8px;">MEVAR</a></td></tr>
${image ? `<tr><td style="padding:18px 0 0;"><a href="${url}"><img src="${SITE}/${image}" width="600" alt="" style="display:block; width:100%; max-width:600px; height:auto; border:0;"></a></td></tr>\n` : ""}<tr><td style="padding:26px 24px 0;">
${note ? `<p style="${sans} font-size:15px; line-height:1.5; color:${C.ink}; margin:0 0 22px;">${esc(note)}</p>\n` : ""}<p style="${sans} font-size:12px; font-weight:bold; letter-spacing:1.6px; text-transform:uppercase; color:${C.accent}; margin:0 0 10px;">${esc(kind)}</p>
<h1 style="${serif} font-size:28px; font-weight:normal; line-height:1.2; color:${C.ink}; margin:0 0 10px;">${esc(title)}</h1>
<p style="${small} margin:0;">${esc(byline)}</p>
${refs.length ? `<p style="${small} margin:4px 0 0;">${esc(`Textes : ${refs.join(" · ")}`)}</p>\n` : ""}</td></tr>
${blocks.length ? `<tr><td style="padding:22px 24px 0;"><div style="border-top:1px solid ${C.line}; padding-top:22px;">
${blocks.map(draw).join("\n")}
</div></td></tr>\n` : ""}<tr><td style="padding:${blocks.length ? 4 : 22}px 24px 26px;">
<a href="${url}" style="display:inline-block; ${sans} font-size:15px; font-weight:bold; color:${C.onAccent}; background:${C.accent}; text-decoration:none; border-radius:999px; padding:12px 24px; margin:0 8px 8px 0;">${esc(more)}</a>
${pdf ? `${pill(`${SITE}${pdf}`, "Télécharger le PDF")}\n` : ""}${audio ? `${pill(audio, "Écouter")}\n` : ""}</td></tr>
<tr><td style="padding:18px 24px; border-top:1px solid ${C.line}; ${small} font-size:12px;">
${esc("Vous recevez cet e-mail car votre adresse est inscrite à la newsletter de mevar.org.")}
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${C.ink2};">${esc("Se désinscrire")}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const txt = `${note ? `${note}\n\n` : ""}${kind.toUpperCase()}
${title}
${byline}
${refs.length ? `Textes : ${refs.join(" · ")}\n` : ""}
${blocks.map((b) => `${b.type === "blockquote" ? b.children.map((p) => `    ${frenchSpacing(text(p))}`).join("\n") : frenchSpacing(text(b))}\n\n`).join("")}${more} : ${url}
${pdf ? `Télécharger le PDF : ${SITE}${pdf}\n` : ""}${audio ? `Écouter : ${audio}\n` : ""}
--
Vous recevez cet e-mail car votre adresse est inscrite à la newsletter de mevar.org.
Se désinscrire : {{{RESEND_UNSUBSCRIBE_URL}}}
`;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
if (Buffer.byteLength(html) > MAX_HTML) throw new Error(`HTML is ${kb(Buffer.byteLength(html))}, over ${kb(MAX_HTML)}`);

const slug = path.basename(rel);
const out = path.join(import.meta.dirname, "dist");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `${slug}.html`), html);
fs.writeFileSync(path.join(out, `${slug}.txt`), txt);
fs.writeFileSync(path.join(out, `${slug}.subject.txt`), `${title}\n`);

console.log(`email/dist/${slug}.html  ${kb(Buffer.byteLength(html))}`);
console.log(`email/dist/${slug}.txt   ${kb(Buffer.byteLength(txt))}`);
if (image) console.log(`image ${image}  ${kb(fs.statSync(path.join(root, image)).size)}`);
