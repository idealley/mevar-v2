// « Cité dans ce texte » cards. A paragraph that is nothing but a link to a Ghost post
// (what scripts/94 made of Ghost's bookmark cards) becomes a card with the
// post's title and summary. Runs on every work's body at build time.

import fs from "node:fs";
import path from "node:path";
import { frenchSpacing } from "./french-typography.mjs";
import icons from "./icons.json" with { type: "json" };

// Relative to web/, as the content collection's base is.
const dir = "../markdown/mevar";

/** The first ~200 characters of a markdown body's first paragraph of text: Ghost's excerpt, with French typography (a Ghost post is French; the feed reads it raw). */
export function excerpt(markdown) {
  const para = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|!|\*\s\*|-{3}|\||<)/.test(p));
  if (!para) return undefined;
  const text = para
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/[*_`\\]/g, "")
    .replace(/\s+/g, " ");
  return frenchSpacing(text.length <= 200 ? text : `${text.slice(0, text.lastIndexOf(" ", 200))}…`);
}

/** Published Ghost posts: slug -> { title, summary }. */
const posts = new Map();
for (const f of fs.readdirSync(dir)) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const end = text.indexOf("\n---\n", 4);
  const fm = text.slice(0, end);
  if (!/^type: "post"$/m.test(fm) || !/^status: "published"$/m.test(fm)) continue;
  const field = (k) => {
    const m = fm.match(new RegExp(`^${k}: (.*)$`, "m"));
    return m ? JSON.parse(m[1]) : undefined;
  };
  posts.set(f.slice(0, -3), { title: field("title"), summary: field("summary") ?? excerpt(text.slice(end + 5)) });
}

const el = (tagName, className, children, properties = {}) => ({
  type: "element", tagName, properties: { ...properties, className }, children,
});
const txt = (value) => ({ type: "text", value });
// A Lucide icon, as components/Icon.astro draws it.
const icon = (name, size) => ({
  type: "raw",
  value: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`,
});

export function rehypeBookmarks() {
  return (tree) => {
    tree.children = tree.children.map((node) => {
      if (node.tagName !== "p") return node;
      const kids = node.children.filter((c) => !(c.type === "text" && !c.value.trim()));
      const a = kids[0];
      const slug = kids.length === 1 && a.tagName === "a" && String(a.properties.href).match(/^\/([a-z0-9-]+)\/$/)?.[1];
      const post = slug && posts.get(slug);
      if (!post) return node;
      // Another post's title and summary: not this page's text for search.
      return el("aside", [], [
        el("a", ["flex", "items-center", "gap-4", "rounded-2xl", "bg-tint", "p-5", "font-sans", "no-underline!"], [
          el("span", ["flex", "size-[38px]", "shrink-0", "items-center", "justify-center", "rounded-xl", "bg-surface", "text-accent"], [icon("corner-down-right", 17)]),
          el("span", ["flex", "min-w-0", "flex-1", "flex-col", "gap-[3px]"], [
            el("span", ["text-[10px]", "leading-3", "font-semibold", "tracking-[1.6px]", "text-ink-2", "uppercase"], [txt("Cité dans ce texte")]),
            el("span", ["font-display", "text-[23px]", "leading-[30px]", "text-ink"], [txt(post.title)]),
            ...(post.summary ? [el("span", ["line-clamp-2", "text-[13px]", "leading-5", "text-ink-2"], [txt(post.summary)])] : []),
          ]),
          el("span", ["text-ink"], [icon("arrow-up-right", 18)]),
        ], { href: `/${slug}/` }),
      ], { dataPagefindIgnore: "" });
    });
  };
}
