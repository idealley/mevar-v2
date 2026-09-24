#!/usr/bin/env node
// Links in mevar bodies that point at mevar.org become root-relative, so they
// keep working on our domain and never leave it. Run after 45 (a new Ghost
// post brings absolute links) and 92.
//
//   [Titre](https://mevar.org/<slug>/)         -> [Titre](/<slug>/)
//   https://mevar.org/articles/<slug>          -> /<slug>/   (the site before Ghost)
//   [mevar.org](mevar.org), (articles/<slug>)  -> /, /<slug>/
//   https://mevar.org/<tag>/, /authors/<slug>/ -> the target in web/public/_redirects
//
// A Ghost bookmark card was flattened by the import into one link whose text
// is the target's title, its excerpt, "MEVAR" and the author, glued, and
// consecutive cards onto one line. Each becomes a clean link with the target's
// title, alone in its paragraph; the site renders it as a card.
//
// Frontmatter (url, stream_url, feature_image, pdf_*) keeps the remote URL: it
// records where the work came from. Links to /content/ (Ghost files) are left
// alone and listed: 92 moves the ones Ghost still serves. Idempotent.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "markdown/mevar");

const titles = new Map();
for (const f of fs.readdirSync(dir)) {
  const m = fs.readFileSync(path.join(dir, f), "utf8").match(/^title: (.*)$/m);
  titles.set(f.slice(0, -3), JSON.parse(m[1]));
}

// "/from/  /to/  301" lines; ":slug" matches one path segment.
const redirects = fs
  .readFileSync(path.join(root, "web/public/_redirects"), "utf8")
  .split("\n")
  .filter((l) => l.startsWith("/"))
  .map((l) => {
    const [from, to] = l.split(/\s+/);
    const re = new RegExp(`^${from.replace(/\/?$/, "").replace(":slug", "([^/]+)")}/?$`);
    return { re, to };
  });
const sitePages = new Set(
  fs.readdirSync(path.join(root, "web/src/pages")).map((f) => f.replace(/\.astro$/, "")),
);

/** Root-relative URL for a mevar.org path, or null. */
function resolve(p) {
  const [, pathname, hash = ""] = p.match(/^([^#?]*)(?:\?[^#]*)?(#.*)?$/);
  const slug = decodeURIComponent(pathname).replace(/^\/(articles\/)?|\/$/g, "");
  if (slug === "") return "/" + hash;
  // Ghost slugs as typed by hand: "--", "œ".
  const clean = slug.replace(/-+/g, "-").replace(/œ/g, "oe");
  for (const s of [slug, clean]) if (titles.has(s) || sitePages.has(s)) return `/${s}/${hash}`;
  for (const { re, to } of redirects) {
    const m = `/${slug}`.match(re);
    if (m) return to.replace(":slug", m[1]) + hash;
  }
  return null;
}

// The excerpt may hold brackets of its own ("[l’assemblée répond Amen]").
const CARD = /\[\u200b?((?:[^[\]\n]|\[[^[\]\n]*\])*MEVAR[^[\]\n]*)\]\(https?:\/\/(?:www\.)?mevar\.org\/([^)\s/]+)\/?\)/g;
// Also typed without the scheme ("mevar.org") or relative ("articles/<slug>"),
// which a browser resolves against the page's own URL.
const LINK = /\]\(((?:(?:https?:\/\/)?(?:www\.)?mevar\.org)(\/[^)\s]*)?|(articles\/[^)\s]+))\)/g;

let files = 0, bookmarks = 0, links = 0;
const left = [];
for (const f of fs.readdirSync(dir)) {
  const file = path.join(dir, f);
  const text = fs.readFileSync(file, "utf8");
  const end = text.indexOf("\n---\n", 4) + 5;
  let body = text.slice(end);
  const before = body;

  // Consecutive cards were glued on one line: one paragraph each.
  body = body
    .split("\n")
    .map((line) => {
      const cards = [...line.matchAll(CARD)].filter(([, , slug]) => titles.has(slug));
      if (!cards.length || line.replace(CARD, "").replace(/[\s\u200b]/g, "")) return line;
      bookmarks += cards.length;
      return cards.map(([, , slug]) => `[${titles.get(slug)}](/${slug}/)`).join("\n\n");
    })
    .join("\n");
  body = body.replace(LINK, (link, url, abs = "/", rel) => {
    const p = rel ? `/${rel}` : abs;
    const to = p.startsWith("/content/") ? null : resolve(p);
    if (!to) {
      left.push(`${f.slice(0, -3)}: ${url}`);
      return link;
    }
    links++;
    return `](${to})`;
  });

  if (body !== before) {
    fs.writeFileSync(file, text.slice(0, end) + body);
    files++;
  }
}

console.log(`files changed: ${files}`);
console.log(`bookmark cards: ${bookmarks}`);
console.log(`links made root-relative: ${links}`);
console.log(`links left to mevar.org: ${left.length}`);
for (const l of left) console.log(`  ${l}`);
