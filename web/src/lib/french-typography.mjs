// French puts a narrow no-break space (U+202F) before « : ; ? ! » (goal 17).
// The files keep their spacing; the site and the emails add it when they
// render. A space before the mark (ordinary, no-break, thin) becomes the
// narrow one; a letter or a closing mark directly before it gets one. Not
// after a digit (« Jean 3:16 », « 10:30 »), not between two marks (« ?! »),
// not in a web address. In a Bible reference, as 65 reads them, « : » takes
// no space at all: Word adds one to « Philippiens 2 :3-8 » (Samuel), which
// reads « 2:3-8 »; « juin 1933 : 1) » or « verset 24 : 24 Car » are not
// references and keep theirs.

import { citations } from "../../../scripts/65-normalize-bible.mjs";

const NARROW = "\u202f";
const BLOCKS = new Set(["p", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "div", "figure", "figcaption"]);
const ADDRESS = /(\S*(?:https?:\/\/|www\.)\S*)/;

/**
 * `before` is the text just before this one (the previous text node of the
 * same paragraph: « **Dieu**! »), so a mark at its start is spaced too.
 */
export function frenchSpacing(text, before = "") {
  if (!text) return text;
  return text
    .split(ADDRESS)
    .map((part, i) => {
      if (i % 2) return part;
      const prev = i === 0 ? before.slice(-1) : "";
      return joinReferences(prev + part)
        .replace(/(?<=\S)[ \u00a0\u2009\u202f]+(?=[;?!:])/g, NARROW)
        .replace(/(?<=[\p{L}»)\]’])(?=[;?!]|:(?!\/\/))/gu, NARROW)
        .slice(prev.length);
    })
    .join("");
}

function joinReferences(text) {
  let out = "";
  let at = 0;
  // in order; of two at the same place, the longer, as the Bible links
  for (const c of [...citations(text)].sort((a, b) => a.index - b.index || b.text.length - a.text.length)) {
    if (c.index < at) continue;
    out += text.slice(at, c.index) + c.text.replace(/(?<=\d)[ \u00a0\u2009\u202f]*:[ \u00a0\u2009\u202f]*(?=\d)/g, ":");
    at = c.index + c.text.length;
  }
  return out + text.slice(at);
}

// Rehype: every text of a French work's body, in reading order, so a mark
// that opens a text node sees the text before it: the letter that closed the
// previous node (« **Dieu**! »), or the space between two bold runs
// (« **Amen** **!** », as some Ghost posts bold word by word), which becomes
// the narrow one. Code is left alone; Branham's text is English.
export function rehypeFrenchTypography() {
  return (tree, file) => {
    if (file.path?.includes("/markdown/branham/")) return;
    let last = null;
    (function walk(node) {
      if (node.type === "element" && ["code", "pre", "script", "style"].includes(node.tagName)) {
        last = null;
        return;
      }
      // a paragraph, a list item, a cell, a line break…: what it opens with
      // is not spaced from what closed the one before
      if (node.type === "element" && (BLOCKS.has(node.tagName) || node.tagName === "br")) last = null;
      if (node.type === "text" && node.value) {
        const lead = node.value.match(/^[ \u00a0\u2009]*(?=[;?!]|:(?!\/\/))/)?.[0];
        const trail = last?.value.match(/[ \u00a0\u2009\u202f]+$/)?.[0];
        if (lead !== undefined && trail) {
          last.value = last.value.slice(0, -trail.length) + NARROW;
          node.value = node.value.slice(lead.length);
        }
        node.value = frenchSpacing(node.value, last?.value ?? "");
        last = node;
      }
      node.children?.forEach(walk);
    })(tree);
  };
}
