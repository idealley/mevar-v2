#!/usr/bin/env node
// Candidates for the concept map: which terms of the French message deserve
// an entry, with the evidence a curator needs to decide.
//
// The corpus has three layers and a term means something different in each:
//   branham      the English transcripts, the source
//   translation  Branham in French (le-scribe, the CMPP's Branham booklets)
//   french       the message preached in French (Frank, Barilier, MEVAR)
// A term frequent in `french` and absent from `branham` is a coinage of the
// French reception ("huitième"); one present in the Bible is a quotation
// before it is a concept ("cri de minuit" is not, in Segond).
//
// Two lists come out:
//   1. seeded terms (Samuel's list), each with per-variant counts, the first
//      French work, the works that carry it most, the English phrases found
//      in Branham and the KJV, and whether Segond or Darby has the phrase;
//   2. automatic candidates: the 2- and 3-word phrases most frequent across
//      the French works, with the same layer counts, for curation.
//
// Reads index.json and markdown/; writes manifests/concept-candidates.json
// and docs/concept-candidates.md. Read-only on the corpus.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));

const SEEDS = [
  { id: "cri-de-minuit", fr: ["cri de minuit"], en: ["midnight cry"] },
  { id: "chant-du-coq", fr: ["chant du coq"], en: ["cock crow", "cock crowing", "crowing of the cock"] },
  { id: "fils-male", fr: ["fils mâle", "enfant mâle"], en: ["man child", "manchild", "male child"] },
  { id: "epouse", fr: ["épouse de christ", "épouse du christ", "épouse"], en: ["bride of christ", "bride"] },
  { id: "jour-du-seigneur", fr: ["jour du seigneur"], en: ["day of the lord"] },
  { id: "temoignage-de-l-epouse", fr: ["témoignage de l'épouse"], en: ["testimony of the bride", "bride's testimony"] },
  { id: "preparation", fr: ["préparation de l'épouse", "préparation"], en: ["preparation of the bride", "preparation"] },
  { id: "huitieme", fr: ["huitième messager", "huitième"], en: ["eighth messenger", "eighth"] },
  { id: "septieme-messager", fr: ["septième messager", "septième ange"], en: ["seventh messenger", "seventh angel"] },
  { id: "combat-spirituel", fr: ["combat spirituel", "combat de la foi"], en: ["spiritual warfare", "spiritual battle", "spiritual fight"] },
  { id: "verge-de-fer", fr: ["verge de fer"], en: ["rod of iron"] },
  { id: "filiation", fr: ["filiation"], en: ["lineage", "succession"] },
];

const layerOf = (row) =>
  row.source === "branham" ? "branham"
  : row.source === "le-scribe" || (row.source === "cmpp" && row.preacher === "William Branham") ? "translation"
  : "french";

const norm = (s) => s.toLowerCase().replace(/[’‘´]/g, "'").replace(/\s+/g, " ").normalize("NFC");
const body = (md) => norm(md.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/\]\([^)]*\)/g, "]"));
const res = new Map();
const phraseRe = (phrase) => {
  let re = res.get(phrase);
  if (!re) res.set(phrase, (re = new RegExp(`(?<!\\p{L})${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "gu")));
  return re;
};
const count = (text, phrase) => (text.match(phraseRe(phrase)) ?? []).length;
const t0 = Date.now();
const log = (msg) => console.error(`${((Date.now() - t0) / 1000).toFixed(0)}s ${msg}`);

// ── Corpus ──────────────────────────────────────────────────────────────────
// A OneDrive or PDF copy of a Ghost post (`mevar_match`) is the same work twice.
const works = index.filter((row) => !row.mevar_match).map((row) => ({
  path: row.local_md,
  source: row.source,
  layer: layerOf(row),
  title: row.title,
  preacher: row.preacher ?? null,
  year: row.year ?? (row.date ? Number(String(row.date).slice(0, 4)) : null),
  text: body(fs.readFileSync(path.join(root, row.local_md), "utf8")),
}));

const bibleText = (file) => {
  const raw = fs.readFileSync(path.join(root, "bible-data", file), "utf8");
  const data = JSON.parse(raw);
  return norm(data.books.flatMap((b) => b.chapters.flatMap((c) => c.verses.map((v) => v.text))).join(" "));
};
log(`${works.length} works read`);
const bible = { lsg: bibleText("ls1910.json"), darby: bibleText("darby.json"), kjv: bibleText("kjv.json") };

// ── 1. Seeded terms ─────────────────────────────────────────────────────────
const workRef = (w, n) => ({ path: w.path, title: w.title, year: w.year, preacher: w.preacher, source: w.source, count: n });

function seedReport(seed) {
  const variants = seed.fr.map((phrase) => {
    const hits = [];
    for (const w of works) {
      if (w.layer === "branham") continue;
      const n = count(w.text, phrase);
      if (n) hits.push(workRef(w, n));
    }
    const per = (layer) => hits.filter((h) => layerOf(h) === layer);
    const french = per("french").filter((h) => h.year).sort((a, b) => a.year - b.year || b.count - a.count);
    return {
      phrase,
      works: { french: per("french").length, translation: per("translation").length },
      mentions: { french: sum(per("french")), translation: sum(per("translation")) },
      first_fr: french[0] ?? null,
      top: hits.sort((a, b) => b.count - a.count).slice(0, 8),
      in_bible: { lsg: count(bible.lsg, phrase), darby: count(bible.darby, phrase) },
    };
  });
  const english = seed.en.map((phrase) => {
    const hits = [];
    for (const w of works) {
      if (w.layer !== "branham") continue;
      const n = count(w.text, phrase);
      if (n) hits.push(workRef(w, n));
    }
    return { phrase, works: hits.length, mentions: sum(hits), top: hits.sort((a, b) => b.count - a.count).slice(0, 5), in_kjv: count(bible.kjv, phrase) };
  });
  return { id: seed.id, variants, english };
}
const sum = (hits) => hits.reduce((n, h) => n + h.count, 0);

// ── 2. Automatic candidates ─────────────────────────────────────────────────
const STOP = new Set(`le la les de du des un une et à au aux en dans sur pour par que qui ne pas plus ce cet cette ces se sa son ses
leur leurs nous vous ils elles il elle je tu on est sont a ont été être avoir avec sans sous comme mais ou où donc car ni si y lui
eux moi toi me te ma mon mes ta ton tes votre vos notre nos tout tous toute toutes quand même aussi très bien là ici cela ça celui
celle ceux celles dont ainsi alors après avant autre autres chaque encore entre jusque peu puis quel quelle quels quelles rien soit
voici voilà vers déjà dit fait va vais dire faire peut avait était sera fut furent avons avez aient ait soient étaient seront
parce oui non or ceci lorsque comment pourquoi combien depuis pendant contre chez selon afin ainsi trop donc toujours jamais
hommes homme chose choses fois temps jour jours là-bas frères frère sœurs sœur amen alléluia faut doit veut savez voyez
comprenez important aujourd'hui proprement chacun penser quoi lettre circulaire télécharger document files mevar béni bénisse
allons voudrais devons est-ce prions prêché dimanche mois exhortation`.split(/\s+/));
const ELISION = /^(l|d|qu|s|n|c|j|m|t)'/;
const MIN_WORKS = 8;

// Count in the French layer only; the translation layer is then checked by
// membership against the phrases that made the cut, which keeps the map small.
const gramsOf = (w) => {
  const tokens = (w.text.match(/[\p{L}'-]+/gu) ?? []).map((t) => t.replace(ELISION, "")).filter((t) => t.length > 1);
  const seen = new Set();
  for (let i = 0; i + 1 < tokens.length; i++) {
    const first = tokens[i];
    if (first.length < 4 || STOP.has(first)) continue;
    const second = tokens[i + 1];
    if (second.length >= 4 && !STOP.has(second)) seen.add(first + " " + second);
    const third = tokens[i + 2];
    if (third && third.length >= 4 && !STOP.has(third)) seen.add(first + " " + second + " " + third);
  }
  return seen;
};
const grams = new Map(); // phrase → French works
for (const w of works) {
  if (w.layer !== "french") continue;
  for (const g of gramsOf(w)) grams.set(g, (grams.get(g) ?? 0) + 1);
}
log(`${grams.size} phrases in the French layer`);
const kept = new Map([...grams].filter(([, n]) => n >= MIN_WORKS).map(([g, n]) => [g, { french: n, translation: 0 }]));
grams.clear();
for (const w of works) {
  if (w.layer !== "translation") continue;
  for (const g of gramsOf(w)) { const c = kept.get(g); if (c) c.translation++; }
}
log(`${kept.size} phrases in ${MIN_WORKS}+ French works`);
const bibleGrams = { lsg: gramsOf({ text: bible.lsg }), darby: gramsOf({ text: bible.darby }) };
const candidates = [...kept]
  .map(([phrase, c]) => ({ phrase, works: c, in_bible: { lsg: bibleGrams.lsg.has(phrase), darby: bibleGrams.darby.has(phrase) } }))
  .sort((a, b) => b.works.french - a.works.french);

// ── Output ──────────────────────────────────────────────────────────────────
const seeds = SEEDS.map((seed) => { const r = seedReport(seed); log(`seed ${seed.id}`); return r; });
const totals = { branham: 0, translation: 0, french: 0 };
for (const w of works) totals[w.layer]++;
fs.writeFileSync(path.join(root, "manifests", "concept-candidates.json"), JSON.stringify({ generated: new Date().toISOString(), totals, seeds, candidates }, null, 2));

const md = [];
md.push("# Concept candidates", "", `Generated by \`scripts/160-concept-candidates.mjs\` on ${new Date().toISOString().slice(0, 10)}. Layers: ${totals.branham} Branham transcripts (English), ${totals.translation} Branham translations (French), ${totals.french} French works (Frank, Barilier, MEVAR). "Works" counts documents, "mentions" counts occurrences.`, "");
md.push("## Seeded terms", "");
for (const s of seeds) {
  md.push(`### ${s.id}`, "");
  md.push("| French phrase | French works (mentions) | Translation works (mentions) | First French work | Segond | Darby |", "|---|---|---|---|---|---|");
  for (const v of s.variants) {
    const first = v.first_fr ? `${v.first_fr.year} · ${v.first_fr.title} (${v.first_fr.preacher ?? v.first_fr.source})` : "";
    md.push(`| ${v.phrase} | ${v.works.french} (${v.mentions.french}) | ${v.works.translation} (${v.mentions.translation}) | ${first} | ${v.in_bible.lsg} | ${v.in_bible.darby} |`);
  }
  md.push("", "| English phrase | Branham works (mentions) | KJV | Top Branham sermons |", "|---|---|---|---|");
  for (const e of s.english) {
    md.push(`| ${e.phrase} | ${e.works} (${e.mentions}) | ${e.in_kjv} | ${e.top.map((t) => `${path.basename(t.path, ".md")} ${t.title} (${t.count})`).join("; ")} |`);
  }
  const top = s.variants[0].top.filter((t) => t.source !== "le-scribe");
  if (top.length) md.push("", `Most mentions of « ${s.variants[0].phrase} »: ` + top.map((t) => `${t.title} (${t.year ?? "?"}, ${t.preacher ?? t.source}, ${t.count})`).join("; "));
  md.push("");
}
md.push("## Automatic candidates", "", `Two- and three-word phrases found in at least ${MIN_WORKS} French works, by number of French works. Absent from the translations and from the Bible means a phrase of the French message.`, "");
md.push("| Phrase | French works | Translation works | Segond | Darby |", "|---|---|---|---|---|");
for (const c of candidates.slice(0, 400)) md.push(`| ${c.phrase} | ${c.works.french} | ${c.works.translation} | ${c.in_bible.lsg ? "yes" : ""} | ${c.in_bible.darby ? "yes" : ""} |`);
md.push("", "### Present in French preaching, absent from the Branham translations", "");
md.push("| Phrase | French works | Segond | Darby |", "|---|---|---|---|");
for (const c of candidates.filter((c) => c.works.translation === 0).slice(0, 150)) md.push(`| ${c.phrase} | ${c.works.french} | ${c.in_bible.lsg ? "yes" : ""} | ${c.in_bible.darby ? "yes" : ""} |`);
fs.writeFileSync(path.join(root, "docs", "concept-candidates.md"), md.join("\n") + "\n");
console.log(`${seeds.length} seeds, ${candidates.length} candidates (${candidates.filter((c) => c.works.translation === 0).length} absent from the translations)`);
