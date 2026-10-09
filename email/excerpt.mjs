// The opening of a work for its email (goal 34): its own words, never
// rewritten. Whole blocks (paragraphs, quotations) in reading order up to
// LIMIT words; the block that crosses it is cut at a sentence end, unless
// FLOOR words are already in, then the excerpt ends on the block before.
// `from` starts it at the first block holding that phrase, at the phrase.
// A cut is marked « … ». Only the reading counts: paragraphs, quotations and
// verse blocks; a heading, a list (an audio post's « Sur le même sujet ») or
// a rule is passed over. Returns mdast blocks for email/build.mjs to draw,
// none for a work that has no text of its own.

import { fromMarkdown } from "mdast-util-from-markdown";

const LIMIT = 200;
const READ = new Set(["paragraph", "blockquote", "code"]);
const FLOOR = 120;

/** What a node reads, as mdast-util-to-string reads it, image alts aside. */
export const text = (n) => ("value" in n ? n.value : (n.children ?? []).map(text).join(""));

/** The node, keeping only the characters [from, to) of its text. */
function slice(node, from, to) {
  let at = 0;
  const walk = (n) => {
    if ("value" in n) {
      const start = at;
      at += n.value.length;
      const value = n.value.slice(Math.max(0, from - start), Math.max(0, to - start));
      return value ? { ...n, value } : null;
    }
    if (!n.children) return at > from && at < to ? n : null;
    const children = n.children.map(walk).filter(Boolean);
    return children.length ? { ...n, children } : null;
  };
  return walk(node);
}

/** Where to cut `t` to keep at most `budget` words: the last sentence end in them, or else the last word. */
function cutAt(t, budget) {
  const limit = [...t.matchAll(/\S+/g)][budget - 1];
  const max = limit.index + limit[0].length;
  const ends = [...t.slice(0, max).matchAll(/[.!?…][»"”’)*_]*(?=\s|$)/g)];
  return ends.length ? ends.at(-1).index + ends.at(-1)[0].length : max;
}

// « … » beside the words, outside any bold run: a text node of the paragraph
// (a quotation's first or last), or a verse block's own text. Not twice:
// a cut on a sentence that ends « … » is marked already.
function mark(block, end) {
  const p = block.type === "blockquote" ? block.children.at(end ? -1 : 0) : block;
  if (end && /(…|\.\.\.)\W*$/.test(text(p))) return;
  if (!p.children) p.value = end ? `${p.value.trimEnd()} …` : `… ${p.value.trimStart()}`;
  else if (end) p.children.push({ type: "text", value: " …" });
  else p.children.unshift({ type: "text", value: "… " });
}

// A typed phrase and the text compared with the same length: ’ is ', any space is " ".
const loose = (s) => s.replace(/’/g, "'").replace(/\s/g, " ");

export function excerpt(body, from) {
  let blocks = fromMarkdown(body).children.filter((b) => READ.has(b.type) && text(b).trim());
  let lead = false;
  if (from) {
    const phrase = loose(from).replace(/ +/g, " ");
    const i = blocks.findIndex((b) => loose(text(b)).includes(phrase));
    if (i === -1) throw new Error(`--from: « ${from} » is not in the text`);
    const at = loose(text(blocks[i])).indexOf(phrase);
    blocks = [slice(blocks[i], at, Infinity), ...blocks.slice(i + 1)];
    lead = at > 0;
  }

  const out = [];
  let used = 0;
  let trail = false;
  for (const b of blocks) {
    const n = text(b).split(/\s+/).filter(Boolean).length;
    if (used + n <= LIMIT) {
      out.push(b);
      used += n;
      continue;
    }
    if (used < FLOOR) {
      out.push(slice(b, 0, cutAt(text(b), LIMIT - used)));
      trail = true;
    }
    break;
  }

  if (lead) mark(out[0], false);
  if (trail) mark(out.at(-1), true);
  return out;
}
