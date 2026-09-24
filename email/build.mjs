#!/usr/bin/env node
// The "Publications" email for one work (goal 06):
//
//   node email/build.mjs markdown/mevar/<slug>.md [--note "Une phrase."]
//
// writes email/dist/<slug>.html, .txt and .subject.txt, then prints their
// sizes. Title, preacher, date, the `summary:` when there is one, the feature
// image, a button to the page and a link to the PDF when there is one. Not the
// text: readers are on metered phones, and the page stays readable offline
// once opened. Send with `npm run email:test` then `npm run email:send`.
// --note puts one sentence from Samuel above the title (the first Resend
// broadcast says the letter has a new sender).
//
// The HTML is pure ASCII (every other character is an entity) so a client that
// guesses the charset wrong still shows the accents. The unsubscribe link is
// Resend's merge tag, filled in per reader by the broadcast.

import fs from "node:fs";
import path from "node:path";

const SITE = "https://mevar.org";
const MAX_HTML = 40 * 1024;
const MAX_IMAGE = 100 * 1024;
const root = path.resolve(import.meta.dirname, "..");

const [file] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--note");
const noteAt = process.argv.indexOf("--note");
const note = noteAt === -1 ? undefined : process.argv[noteAt + 1];
if (!file) {
  console.error('usage: node email/build.mjs markdown/<source>/<slug>.md [--note "Une phrase."]');
  process.exit(1);
}
const rel = path.relative(path.join(root, "markdown"), path.resolve(file)).replace(/\.md$/, "");
const front = fs.readFileSync(file, "utf8").split(/^---$/m)[1];
const field = (k) => {
  const m = front.match(new RegExp(`^${k}: (.*)$`, "m"));
  return m ? JSON.parse(m[1]) : undefined;
};

if (field("status") !== "published") throw new Error(`${rel} is not published: a draft is never emailed`);
const title = field("title");
// `preacher` is the one display name goal 08 writes; until then, the first author.
const preacher = field("preacher") ?? front.match(/^authors:\n {2}- (.*)$/m)?.[1]?.replace(/^"|"$/g, "");
const date = new Date(`${field("published_at")}T00:00:00Z`).toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const summary = field("summary");
const image = field("local_image");
const pdf = field("local_pdf");
// The site's own rule (web/src/lib/works.ts, workUrl).
const url = `${SITE}${rel.startsWith("mevar/") ? `/${rel.slice("mevar/".length)}/` : `/works/${rel}/`}`;

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

const byline = [preacher, date].filter(Boolean).join(" · ");
const font = "font-family:Georgia, 'Times New Roman', serif;";
const small = "font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#57534e;";

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background:#fafaf9;">
<div style="display:none; max-height:0; overflow:hidden;">${esc(summary ?? `Nouvelle publication\u00a0: ${title}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border:1px solid #e7e5e4;">
<tr><td style="padding:20px 28px 0; ${small} letter-spacing:0.15em; text-transform:uppercase;">Mevar</td></tr>
${image ? `<tr><td style="padding:16px 0 0;"><a href="${url}"><img src="${SITE}/${image}" width="600" alt="" style="display:block; width:100%; max-width:600px; height:auto; border:0;"></a></td></tr>\n` : ""}<tr><td style="padding:24px 28px 0;">
${note ? `<p style="${small} font-size:15px; line-height:1.5; color:#1c1917; margin:0 0 20px;">${esc(note)}</p>\n` : ""}<h1 style="${font} font-size:26px; line-height:1.25; color:#1c1917; margin:0 0 8px;">${esc(title)}</h1>
<p style="${small} margin:0 0 16px;">${esc(byline)}</p>
${summary ? `<p style="${font} font-size:17px; line-height:1.6; color:#1c1917; margin:0 0 16px;">${esc(summary)}</p>\n` : ""}</td></tr>
<tr><td style="padding:8px 28px 28px;">
<a href="${url}" style="display:inline-block; background:#1c1917; ${small} color:#fafaf9; font-size:15px; font-weight:bold; text-decoration:none; padding:12px 22px; border-radius:6px;">${esc("Lire la prédication")}</a>
${pdf ? `<p style="${small} margin:16px 0 0;"><a href="${SITE}${pdf}" style="color:#1c1917;">${esc("Télécharger le PDF")}</a></p>\n` : ""}</td></tr>
<tr><td style="padding:20px 28px; border-top:1px solid #e7e5e4; ${small} font-size:12px; line-height:1.5;">
${esc("Vous recevez cet e-mail car votre adresse est inscrite à la newsletter de mevar.org.")}
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#57534e;">${esc("Se désinscrire")}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const text = `${note ? `${note}\n\n` : ""}${title}
${byline}
${summary ? `\n${summary}\n` : ""}
Lire la prédication\u00a0: ${url}
${pdf ? `Télécharger le PDF\u00a0: ${SITE}${pdf}\n` : ""}
--
Vous recevez cet e-mail car votre adresse est inscrite à la newsletter de mevar.org.
Se désinscrire\u00a0: {{{RESEND_UNSUBSCRIBE_URL}}}
`;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
if (Buffer.byteLength(html) > MAX_HTML) throw new Error(`HTML is ${kb(Buffer.byteLength(html))}, over ${kb(MAX_HTML)}`);

const slug = path.basename(rel);
const out = path.join(import.meta.dirname, "dist");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `${slug}.html`), html);
fs.writeFileSync(path.join(out, `${slug}.txt`), text);
fs.writeFileSync(path.join(out, `${slug}.subject.txt`), `${title}\n`);

console.log(`email/dist/${slug}.html  ${kb(Buffer.byteLength(html))}`);
console.log(`email/dist/${slug}.txt   ${kb(Buffer.byteLength(text))}`);
if (image) console.log(`image ${image}  ${kb(fs.statSync(path.join(root, image)).size)}`);
