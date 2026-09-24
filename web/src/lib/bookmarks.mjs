// "À lire aussi" cards. A paragraph that is nothing but a link to a Ghost post
// (what scripts/94 made of Ghost's bookmark cards) becomes a card with the
// post's title and summary. Runs on every work's body at build time.

import fs from "node:fs";
import path from "node:path";

// Relative to web/, as the content collection's base is.
const dir = "../markdown/mevar";

/** The first ~200 characters of a markdown body's first paragraph of text: Ghost's excerpt. */
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
  return text.length <= 200 ? text : `${text.slice(0, text.lastIndexOf(" ", 200))}…`;
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
      return el("aside", ["my-6"], [
        el("a", ["block", "rounded-lg", "border", "bg-card", "p-4", "hover:border-primary/50", "transition"], [
          el("span", ["block", "text-xs", "uppercase", "tracking-wide", "text-muted-foreground", "font-sans"], [txt("À lire aussi")]),
          el("span", ["block", "font-semibold", "mt-1"], [txt(post.title)]),
          ...(post.summary ? [el("span", ["block", "text-sm", "text-muted-foreground", "mt-1"], [txt(post.summary)])] : []),
        ], { href: `/${slug}/` }),
      ], { dataPagefindIgnore: "" });
    });
  };
}
