// A Bible reference in a work's body links to its verse page: "(Éphésiens
// 4:13)" to /bible/ephesiens/4/#v13. The references are the ones 65 (French)
// and 66 (English, Branham) recognise and record for this work in
// manifests/bible-refs.json, so every link has its page and its anchor; the
// text does not change, and a reference they do not recognise stays plain.
// Runs on every work's body at build time.

import fs from "node:fs";
import path from "node:path";
import { citations as french } from "../../../scripts/65-normalize-bible.mjs";
import { citations as english } from "../../../scripts/66-normalize-bible-en.mjs";
import { chapterUrl, parseRef } from "./bible.mjs";

// Relative to web/, where the build runs.
const recorded = JSON.parse(fs.readFileSync("../manifests/bible-refs.json", "utf8"));
const root = path.resolve("..");

function href(ref) {
  const { book, chapter, verses } = parseRef(ref);
  return chapterUrl(book, chapter) + (verses.length ? `#v${verses[0]}` : "");
}

export function rehypeBibleLinks() {
  return (tree, file) => {
    const rel = path.relative(root, file.path);
    const refs = new Set(recorded[rel]);
    if (!refs.size) return;
    const citations = rel.startsWith("markdown/branham/") ? english : french;

    // A text node becomes text and links. Citations in order, none inside another.
    function link(text) {
      const nodes = [];
      let at = 0;
      const found = [...citations(text)].filter((c) => refs.has(c.ref)).sort((a, b) => a.index - b.index);
      for (const c of found) {
        if (c.index < at) continue;
        if (c.index > at) nodes.push({ type: "text", value: text.slice(at, c.index) });
        nodes.push({
          type: "element",
          tagName: "a",
          properties: { href: href(c.ref), className: ["underline", "decoration-dotted", "underline-offset-4"] },
          children: [{ type: "text", value: c.text }],
        });
        at = c.index + c.text.length;
      }
      if (at < text.length) nodes.push({ type: "text", value: text.slice(at) });
      return nodes;
    }

    (function walk(node) {
      node.children = node.children.flatMap((child) => {
        if (child.type === "text") return link(child.value);
        // Not inside a link the text already has.
        if (child.type === "element" && child.tagName !== "a") walk(child);
        return [child];
      });
    })(tree);
  };
}
