import { test } from "node:test";
import assert from "node:assert/strict";
import { frenchSpacing, rehypeFrenchTypography } from "../web/src/lib/french-typography.mjs";

const N = "\u202f";

test("a space before « : ; ? ! » becomes a narrow one", () => {
  assert.equal(frenchSpacing("Il dit : venez ; qui ? Amen !"), `Il dit${N}: venez${N}; qui${N}? Amen${N}!`);
  assert.equal(frenchSpacing("Il dit\u00a0: venez"), `Il dit${N}: venez`);
  assert.equal(frenchSpacing(`Il dit${N}: venez`), `Il dit${N}: venez`);
  assert.equal(frenchSpacing(`avez${N} ; car`), `avez${N}; car`);
});

test("a word or a closing mark gets one", () => {
  assert.equal(frenchSpacing("Dieu! Qui? Voici: rien; fin"), `Dieu${N}! Qui${N}? Voici${N}: rien${N}; fin`);
  assert.equal(frenchSpacing("« Viens »! (Luc 9)? [sic]: l’homme’?"), `« Viens »${N}! (Luc 9)${N}? [sic]${N}: l’homme’${N}?`);
});

test("references, times, addresses and doubled marks stay", () => {
  assert.equal(frenchSpacing("Jean 3:16 à 10:30"), "Jean 3:16 à 10:30");
  assert.equal(frenchSpacing("voir https://mevar.org/page?id=3 et www.mevar.org/x?y"), "voir https://mevar.org/page?id=3 et www.mevar.org/x?y");
  assert.equal(frenchSpacing("Quoi?!"), `Quoi${N}?!`);
  assert.equal(frenchSpacing("Quoi ?!"), `Quoi${N}?!`);
});

test("the space around the mark, not the line's own, changes", () => {
  assert.equal(frenchSpacing("  ? début"), "  ? début");
  assert.equal(frenchSpacing("fin\n: suite"), "fin\n: suite");
});

test("a mark at the start of a text sees the text before it", () => {
  assert.equal(frenchSpacing("! Amen", "Dieu"), `${N}! Amen`);
  assert.equal(frenchSpacing("!", "Dieu"), `${N}!`);
  assert.equal(frenchSpacing(" !", "Dieu"), `${N}!`);
  assert.equal(frenchSpacing("!", "3"), "!");
});

test("the plugin spaces a mark across text nodes", () => {
  const p = (...values) => ({ type: "element", tagName: "p", children: values.map((v) => ({ type: "element", tagName: "strong", children: [{ type: "text", value: v }] })) });
  const run = (tree, path = "/x/markdown/mevar/a.md") => (rehypeFrenchTypography()(tree, { path }), JSON.stringify(tree).match(/"value":"[^"]*"/g).map((v) => v.slice(9, -1)));
  const gap = { type: "text", value: " " };
  const tree = { type: "root", children: [{ type: "element", tagName: "p", children: [{ type: "element", tagName: "strong", children: [{ type: "text", value: "Amen" }] }, gap, { type: "element", tagName: "strong", children: [{ type: "text", value: "!" }] }] }] };
  assert.deepEqual(run(tree), ["Amen", N, "!"]);
  assert.deepEqual(run(p("Dieu", "! Amen")), ["Dieu", `${N}! Amen`]);
  assert.deepEqual(run(p("Laodicée ", ": tu es pauvre")), [`Laodicée${N}`, ": tu es pauvre"]);
  assert.deepEqual(run(p("Laodicée ", ": tu"), "/x/markdown/branham/a.md"), ["Laodicée ", ": tu"]);
});

test("a paragraph does not reach into the one before", () => {
  const para = (v) => ({ type: "element", tagName: "p", children: [{ type: "text", value: v }] });
  const tree = { type: "root", children: [para("fin "), para(": suite")] };
  rehypeFrenchTypography()(tree, { path: "/x/markdown/mevar/a.md" });
  assert.deepEqual(tree.children.map((c) => c.children[0].value), ["fin ", ": suite"]);
});
