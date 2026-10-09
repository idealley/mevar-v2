// The opening of a work for its email (goal 34): its own words, never
// rewritten. Whole blocks (paragraphs, quotations) in reading order up to
// LIMIT words; the block that crosses it is cut at a sentence end, unless
// FLOOR words are already in, then the excerpt ends on the block before.
// `from` starts it at the first block holding that phrase, at the phrase.
// A cut is marked « … ». Only the reading counts: paragraphs, quotations and
// verse blocks; a list (an audio post's « Sur le même sujet ») or a rule is
// passed over, and so is a heading, unless FLOOR words are in: then it ends
// the excerpt, which never shows a section's text without its title. Returns mdast blocks for email/build.mjs to draw,
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

// A phrase as Samuel types or copies it: any apostrophe for either, any
// space or none between two characters, so « avoir ? » as the site shows it
// finds « avoir? » as the file has it.
const pattern = (from) =>
  new RegExp([...from.replace(/\s/g, "")].map((c) => (/['’]/.test(c) ? "['’]" : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("\\s*"));

export function excerpt(body, from) {
  let blocks = fromMarkdown(body).children.filter((b) => (READ.has(b.type) || b.type === "heading") && text(b).trim());
  let lead = false;
  if (from) {
    const re = pattern(from);
    const i = blocks.findIndex((b) => READ.has(b.type) && re.test(text(b)));
    if (i === -1) throw new Error(`--from: « ${from} » is not in the text`);
    const at = text(blocks[i]).search(re);
    blocks = [slice(blocks[i], at, Infinity), ...blocks.slice(i + 1)];
    lead = at > 0;
  }

  const out = [];
  let used = 0;
  let trail = false;
  for (const b of blocks) {
    if (b.type === "heading") {
      if (used >= FLOOR) break;
      continue;
    }
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
