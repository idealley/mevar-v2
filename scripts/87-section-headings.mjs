#!/usr/bin/env node
// Goal 18: a line that stands alone as a section title becomes a heading,
// « POURQUOI LA CONFESSION ET LA REPENTANCE ? » → « ## Pourquoi la
// confession et la repentance ? ». Its words stay, in sentence case; its bold
// goes. Capitals for emphasis inside a paragraph stay; no heading is invented.
//
// A candidate is a paragraph of one line, in capitals, or wholly bold and
// short (it may be the preacher's emphasis on a sentence, « **La victoire est
// pour nous** ! »). The model decides each one, heading or not, `##` or
// `###`, and its words in sentence case, from the paragraphs around it; the
// decisions are kept in scripts/mevar-section-headings.json, reviewed data
// beside scripts/mevar-editorial-fixes.json, and a line already decided is
// not sent again; a proposal refused is kept in `refused`. A heading whose words are not the line's, up to case and accents, is
// refused.
//
// It writes the headings into the texts goal 10 does not check (le-scribe,
// cmpp, local, and mevar's lines in capitals: the rest of a Ghost post's
// layout is Samuel's). Goal 10's texts are read as 86 reads them, the pass
// with the editor's fixes and title (a split-off work's lines are its
// original's), and get their headings from 86, which applies the same
// decisions (applyHeadings) before it compares; `87 <batch>` does one batch.
//
// Usage: node scripts/87-section-headings.mjs [<batch>] [--dry]
// Needs OPENAI_API_KEY (the root .env; from a worktree,
// DOTENV_CONFIG_PATH=<root>/.env).

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MODEL = "gpt-6-sol";
const DECISIONS = path.join(root, "scripts/mevar-section-headings.json");

const plain = (t) => t.replace(/^#+\s*/, "").replace(/[*_]/g, "").trim();
const key = (c) => c.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const letters = (t) => key(plain(t)).replace(/œ/g, "oe").replace(/æ/g, "ae").match(/\p{L}+|\p{N}+/gu) ?? [];
const sameWords = (a, b) => letters(a).join(" ") === letters(b).join(" ");
const alnum = (c) => /[\p{L}\p{N}]/u.test(c);
const isHeading = (p) => /^#{1,4} /.test(p);

/**
 * The heading, rebuilt on the line's own characters: its punctuation, spaces
 * and references as the line has them (« 2 Pierre 2:5 », « JUSTE? »), and
 * the model's letters, which may differ only in case and accents (and « œ »
 * for « OE »). Null when they do not align: the model changed a word.
 */
function headingOf(line, proposed) {
  // a line already a heading keeps its level
  const level = line.match(/^(#{1,4}) /)?.[1] ?? proposed.match(/^(#{2,3}) /)?.[1];
  if (!isHeading(proposed)) return null;
  const from = [...plain(line)];
  const to = [...plain(proposed)].filter(alnum);
  if (!level) return null;
  let out = "";
  let j = 0;
  for (let i = 0; i < from.length; i++) {
    if (!alnum(from[i])) { out += from[i]; continue; }
    const t = to[j++];
    if (t === undefined) return null;
    if (/[œæ]/i.test(t) && key(from[i] + (from[i + 1] ?? "")) === key(t).replace("œ", "oe").replace("æ", "ae")) { out += t; i++; continue; }
    if (key(from[i]) !== key(t)) return null;
    out += t;
  }
  return j === to.length ? `${level} ${out}` : null;
}

/**
 * The candidate lines of a body: paragraphs of one line that may be a
 * section title; and a heading already there that is in capitals, to recase
 * (not in a Ghost post, whose layout is Samuel's).
 */
function candidates(body, title, subtitle, capsOnly) {
  return [...new Set(body.split(/\n{2,}/).map((p) => p.trim()))].filter((p) => {
    if (!p || p.includes("\n")) return false;
    if (isHeading(p)) {
      const ls = [...plain(p)].filter((c) => /\p{L}/u.test(c));
      return !capsOnly && ls.length >= 4 && ls.every((c) => c === c.toUpperCase());
    }
    if (/^(>|- |\d+\.\s)/.test(p) || sameWords(p, title) || sameWords(p, subtitle)) return false;
    const text = plain(p);
    const ls = [...text].filter((c) => /\p{L}/u.test(c));
    const n = letters(p).length;
    if (ls.length < 4 || n > 15) return false;
    if (ls.every((c) => c === c.toUpperCase())) return true;
    return !capsOnly && n <= 10 && /^\*\*[^*]+\*\*\s*[!?:]?$/.test(p) && !/[.,;]$/.test(text);
  });
}

/**
 * The body with each decided line, where it stands alone, as its heading
 * (a heading in capitals, as its recased heading); and what could not be
 * applied.
 */
export function applyHeadings(body, decisions = []) {
  const refused = [];
  const paras = body.split(/(\n{2,})/);
  for (const { line, heading } of decisions) {
    if (!heading) continue;
    if (headingOf(line, heading) !== heading) {
      refused.push(`the heading « ${heading} » is not the line « ${line} »`);
      continue;
    }
    let found = false;
    for (let i = 0; i < paras.length; i += 2) if (paras[i].trim() === line) { paras[i] = heading; found = true; }
    if (!found && !paras.some((p) => p.trim() === heading)) refused.push(`the line « ${line} » does not stand alone in the text`);
  }
  return { body: paras.join(""), refused };
}

const SYSTEM = `Tu mets en forme des prédications et des textes chrétiens en français (MEVAR, le Message du temps de la fin). On te donne, dans l'ordre du texte, des lignes qui sont chacune un paragraphe à elle seule, avec la fin du paragraphe d'avant et le début de celui d'après.

Une ligne qui commence déjà par # est déjà un titre : réponds avec le même nombre de #, ses mots en casse normale (règles ci-dessous).

Pour chaque autre ligne, dis si c'est un titre de section du texte :
- un titre de section annonce ce qui suit (« POURQUOI LA CONFESSION ET LA REPENTANCE ? », « Sujets de prière pour la famille », « TÉMOIGNAGE ») : réponds ## ou ###. ## par défaut ; ### seulement quand la ligne est une sous-section visible d'un ## qui précède (« Sujets de prière » puis « Sujets de prière pour la famille »).
- une phrase du prédicateur qu'il met en valeur (« **La victoire est pour nous** ! », « IL FAUT QUE LE SIÈGE SOIT DÉGAGÉ ! »), une signature (« Fr M'BRA Parfait »), une formule (« Amen ! »), une ligne d'en-tête de document (date, lieu) ou tout ce qui n'annonce pas une section : réponds -.

Pour un titre, écris ses mots exactement, dans le même ordre, sans en ajouter ni en enlever, en minuscules sauf la première lettre et les noms propres, avec les accents sur les majuscules, en typographie française. Garde les majuscules de la maison : « Dieu », « Jésus-Christ », « le Saint-Esprit », « la Bible », « la Parole » (de Dieu), « l'Église », « l'Épouse », « Message » quand c'est le Message du temps de la fin. Enlève le gras (**) : le titre est déjà mis en forme.

Réponds une ligne par ligne donnée, sans rien d'autre : son numéro, une tabulation, puis « ## titre », « ### titre » ou « - ».`;

async function decide(lines) {
  const user = lines.map((l, i) => `${i + 1}. ${l.line}\n   avant : …${l.before}\n   après : ${l.after}…`).join("\n\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_completion_tokens: 16000, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`${MODEL}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const answers = new Map(json.choices[0].message.content.split("\n").map((l) => l.match(/^(\d+)\.?\t\s*(.+)$/)).filter(Boolean).map((m) => [Number(m[1]), m[2].trim()]));
  if (answers.size !== lines.length) throw new Error(`${MODEL}: ${answers.size} answers for ${lines.length} lines`);
  return { decisions: lines.map((l, i) => ({ line: l.line, heading: answers.get(i + 1) === "-" ? null : answers.get(i + 1) })), usage: json.usage };
}

// Only when run, not when 86 imports applyHeadings().
if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  const [batchId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry");
  const all = fs.existsSync(DECISIONS) ? JSON.parse(fs.readFileSync(DECISIONS, "utf8")) : {};
  const batches = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"));
  const fixes = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-fixes.json"), "utf8"));
  const fm = (text) => text.slice(4, text.indexOf("\n---\n", 4));
  const fieldOf = (f, k) => JSON.parse(f.match(new RegExp(`^${k}: (.*)$`, "m"))?.[1] ?? '""');

  // [markdown path, body, title, subtitle, write?, capsOnly?]
  const works = [];
  // goal 10's texts as 86 reads them: the pass, the editor's fixes applied
  // from the end, the editor's title and subtitle
  for (const md of batchId ? batches[batchId] : Object.values(batches).flat()) {
    const cache = path.join(root, ".pass-cache", md.slice("markdown/".length).replace(/\.md$/, ".json"));
    if (!fs.existsSync(cache)) continue;
    const pass = JSON.parse(fs.readFileSync(cache, "utf8"));
    const edits = fixes[md] ?? { fixes: [] };
    let body = pass.body;
    const at = (f) => pass.body.indexOf(f.find);
    for (const f of edits.fixes.filter((f) => pass.body.split(f.find).length === 2).sort((a, b) => at(b) - at(a)))
      body = body.slice(0, at(f)) + f.replace + body.slice(at(f) + f.find.length);
    works.push([md, body, edits.title ?? pass.title, edits.subtitle ?? fieldOf(fm(fs.readFileSync(path.join(root, md), "utf8")), "subtitle"), false, false]);
  }
  if (!batchId)
    for (const rel of fs.readdirSync(path.join(root, "markdown"), { recursive: true }).sort()) {
      if (!rel.endsWith(".md") || /^(branham|onedrive|mevar-pdfs)\//.test(rel)) continue;
      const md = `markdown/${rel}`;
      const text = fs.readFileSync(path.join(root, md), "utf8");
      const f = fm(text);
      if (/^duplicate_of:/m.test(f)) continue;
      works.push([md, text.slice(text.indexOf("\n---\n", 4) + 5), fieldOf(f, "title"), fieldOf(f, "subtitle"), true, rel.startsWith("mevar/")]);
    }
  // a decision is kept under the path 86 and 87 read, once per line
  if (!batchId) for (const md of Object.keys(all)) if (!works.some(([w]) => w === md)) delete all[md];
  for (const md of Object.keys(all)) all[md] = all[md].filter((d, i, a) => a.findIndex((e) => e.line === d.line) === i);

  // A title or subtitle can change after its lines were decided (86 takes
  // the editor's): a line that repeats one is no heading.
  for (const [md, , title, subtitle] of works)
    for (const d of all[md] ?? []) if (!isHeading(d.line) && (sameWords(d.line, title) || sameWords(d.line, subtitle))) d.heading = null;

  const pending = works.map(([md, body, title, subtitle, , capsOnly]) => {
    const done = new Set((all[md] ?? []).map((d) => d.line));
    const paras = body.split(/\n{2,}/).map((p) => p.trim());
    const lines = candidates(body, title, subtitle, capsOnly).filter((l) => !done.has(l)).map((line) => {
      const i = paras.indexOf(line);
      return { line, before: (paras[i - 1] ?? "").slice(-160), after: (paras[i + 1] ?? "").slice(0, 160) };
    });
    return [md, lines];
  }).filter(([, lines]) => lines.length);
  const count = pending.reduce((a, [, l]) => a + l.length, 0);
  console.log(`${works.length} works, ${pending.length} with ${count} lines to decide`);
  if (dry) {
    const bySource = {};
    for (const [md, l] of pending) bySource[md.split("/")[1]] = (bySource[md.split("/")[1]] ?? 0) + l.length;
    console.log(bySource);
    process.exit(0);
  }

  let [tin, tout] = [0, 0];
  for (const [md, lines] of pending) {
    const { decisions, usage } = await decide(lines);
    // a heading that is not its line, case and accents aside, stays a line
    all[md] = [...(all[md] ?? []), ...decisions.map((d) => {
      const heading = d.heading && headingOf(d.line, d.heading);
      if (d.heading && !heading) console.log(`  kept, the model changed a word: ${md}: « ${d.line} » → « ${d.heading} »`);
      return d.heading && !heading ? { line: d.line, heading: null, refused: d.heading } : { line: d.line, heading };
    })];
    [tin, tout] = [tin + usage.prompt_tokens, tout + usage.completion_tokens];
    fs.writeFileSync(DECISIONS, JSON.stringify(Object.fromEntries(Object.entries(all).sort()), null, 2) + "\n");
  }

  let written = 0;
  const refused = [];
  if (!pending.length) fs.writeFileSync(DECISIONS, JSON.stringify(Object.fromEntries(Object.entries(all).sort()), null, 2) + "\n");
  for (const [md, body, , , write] of works) {
    if (!write || !all[md]) continue;
    const r = applyHeadings(body, all[md]);
    refused.push(...r.refused.map((x) => `${md}: ${x}`));
    if (r.body === body) continue;
    const text = fs.readFileSync(path.join(root, md), "utf8");
    fs.writeFileSync(path.join(root, md), text.slice(0, text.length - body.length) + r.body);
    written++;
  }
  // gpt-6-sol, per million tokens: $2 in, $10 out
  console.log(`decided ${count} lines (${tin} tokens in, ${tout} out: $${((tin * 2 + tout * 10) / 1e6).toFixed(2)}); ${written} texts written; refused: ${refused.length}`);
  for (const x of refused) console.log(`  ${x}`);
}
