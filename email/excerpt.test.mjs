import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpt, text } from "./excerpt.mjs";

const para = (n, word = "mot") => `${Array.from({ length: n }, () => word).join(" ")}.`;
const read = (blocks) => blocks.map(text);
const count = (s) => s.split(/\s+/).filter(Boolean).length;

test("whole blocks while they fit in 200 words", () => {
  const blocks = excerpt([para(80), para(80), para(30), para(50)].join("\n\n"));
  assert.equal(blocks.length, 3);
  assert.ok(!read(blocks).at(-1).endsWith("…"));
});

test("past 120 words, the excerpt ends on the block before the one that crosses 200", () => {
  const blocks = excerpt([para(130), para(100)].join("\n\n"));
  assert.deepEqual(read(blocks), [para(130)]);
});

test("under 120 words, the crossing block is cut at its last sentence end and marked", () => {
  const long = `${para(50)} ${para(50)} ${para(50)}`;
  const [first, second] = read(excerpt([para(60), long].join("\n\n")));
  assert.equal(first, para(60));
  assert.equal(second, `${para(50)} ${para(50)} …`);
});

test("one long sentence is cut at the 200th word", () => {
  const [only] = read(excerpt(para(500)));
  assert.equal(count(only), 201); // 200 words and « … »
  assert.ok(only.endsWith(" …"));
});

test("bold, italics and quotations keep their shape, the words unchanged", () => {
  const [p, quote] = excerpt("Il dit : **venez** et _voyez_.\n\n> _Approchez-vous de Dieu._");
  assert.deepEqual(p.children.map((c) => c.type), ["text", "strong", "text", "emphasis", "text"]);
  assert.equal(quote.type, "blockquote");
  assert.equal(text(quote), "Approchez-vous de Dieu.");
});

test("--from starts at the phrase, across bold and a curly apostrophe", () => {
  const body = `${para(10)}\n\nOn arrive. Il y a beaucoup **d’appelés**, mais peu d’élus.\n\n${para(10)}`;
  const [first, second] = read(excerpt(body, "Il y a beaucoup d'appelés"));
  assert.equal(first, "… Il y a beaucoup d’appelés, mais peu d’élus.");
  assert.equal(second, para(10));
});

test("--from on a phrase the text does not hold stops the build", () => {
  assert.throws(() => excerpt(para(10), "introuvable"), /not in the text/);
});

test("headings, lists and rules are passed over; a work without text has no excerpt", () => {
  assert.deepEqual(read(excerpt(`## Partie 6\n\n${para(5)}\n\n* * *\n\n- [Un lien](/a/)`)), [para(5)]);
  assert.deepEqual(excerpt("## Partie 6\n\n* * *\n\n### Sur le même sujet\n\n- [Un lien](/a/)"), []);
});
