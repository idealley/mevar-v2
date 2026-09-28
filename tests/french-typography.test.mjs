import { test } from "node:test";
import assert from "node:assert/strict";
import { frenchSpacing } from "../web/src/lib/french-typography.mjs";

const N = " ";

test("a space before « : ; ? ! » becomes a narrow one", () => {
  assert.equal(frenchSpacing("Il dit : venez ; qui ? Amen !"), `Il dit${N}: venez${N}; qui${N}? Amen${N}!`);
  assert.equal(frenchSpacing("Il dit : venez"), `Il dit${N}: venez`);
  assert.equal(frenchSpacing(`Il dit${N}: venez`), `Il dit${N}: venez`);
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
