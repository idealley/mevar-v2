// French puts a narrow no-break space (U+202F) before « : ; ? ! » (goal 17).
// The files keep their spacing; the site and the emails add it when they
// render. A space before the mark (ordinary, no-break, thin) becomes the
// narrow one; a letter or a closing mark directly before it gets one. Not
// after a digit (« Jean 3:16 », « 10:30 »), not between two marks (« ?! »),
// not in a web address.

const NARROW = " ";
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
      return (prev + part)
        .replace(/(?<=\S)[   ]+(?=[;?!:])/g, NARROW)
        .replace(/(?<=[\p{L}»)\]’])(?=[;?!]|:(?!\/\/))/gu, NARROW)
        .slice(prev.length);
    })
    .join("");
}

// Rehype: every text of a French work's body, in reading order, so a mark
// that opens a text node sees the letter that closed the previous one. Code
// is left alone; Branham's text is English.
export function rehypeFrenchTypography() {
  return (tree, file) => {
    if (file.path?.includes("/markdown/branham/")) return;
    let last = "";
    (function walk(node) {
      if (node.type === "element" && ["code", "pre", "script", "style"].includes(node.tagName)) return;
      if (node.type === "text") {
        node.value = frenchSpacing(node.value, last);
        last = node.value || last;
      }
      node.children?.forEach(walk);
    })(tree);
  };
}
