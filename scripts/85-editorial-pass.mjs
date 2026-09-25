#!/usr/bin/env node
// Goal 10: goal 04's editorial pass on one batch of OneDrive and PDF texts.
//
// The model reads the original (.parse-cache/, from 84: the PDF's text layer) and returns it with
// only the changes goal 04 allows. Where the preacher announces a reading
// that the transcript does not contain, it writes a marker
// [[LECTURE: <référence>]]; this script replaces the marker with the Segond
// verses from SurrealDB (segond.mjs), never with text from the model.
//
// Output: .pass-cache/<path under markdown/>.json per text (gitignored). No
// file under markdown/ changes here: the check (86) decides what is written.
// A text already in .pass-cache/ is not sent again.
//
// Usage: node scripts/85-editorial-pass.mjs <batch>
// Needs OPENAI_API_KEY (the root .env; from a worktree,
// DOTENV_CONFIG_PATH=<root>/.env) and SurrealDB with 110 run.

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { citations } from "./65-normalize-bible.mjs";
import { connect, reading, blockquote } from "./segond.mjs";

const root = path.resolve(import.meta.dirname, "..");
const batchId = process.argv[2];
const batch = JSON.parse(fs.readFileSync(path.join(root, "scripts/mevar-editorial-batches.json"), "utf8"))[batchId];

// Chosen on a pilot of three texts against gpt-6-luna, gpt-5.6-terra,
// claude-sonnet-5 and deepseek-v4-pro: the fewest changes the check refuses,
// none of them an added word (docs/goals/goal-10-mevar-editorial.md).
const MODEL = "gpt-6-sol";

const SYSTEM = `Tu fais la passe éditoriale d'une prédication chrétienne transcrite (MEVAR, message du temps de la fin). Le texte est celui du prédicateur : ses mots ne changent pas.

Permis, et rien d'autre :
- corriger les fautes de frappe et d'orthographe du transcripteur, et ses fautes d'accord (« Dieu a vue » devient « Dieu a vu ») ;
- la ponctuation, les espaces et la typographie française : « guillemets », espace insécable avant : ; ? !, apostrophe courbe ’ ;
- les coupures de ligne et de paragraphe : le texte vient d'un PDF, ses lignes sont coupées à la largeur de la page ; recoller les lignes d'un même paragraphe et une phrase coupée par un saut de page, séparer un bloc trop long là où le prédicateur change d'idée ;
- enlever les numéros de page ;
- enlever l'en-tête du début, avant le premier paragraphe du prédicateur (le titre, « Prêché le … à … ») : le titre, la date et le lieu sont dans les métadonnées ; enlever la barre « Haut de page Retour Page d'accueil » de l'ancien site ;
- une lecture biblique ou une citation que le prédicateur lit (la Bible, frère Branham) et qui n'est pas dans sa phrase : un paragraphe à part, en citation markdown « > … », sans italique (le site la met en italique), avec les mots tels qu'ils sont (ce n'est pas toujours la Segond : ne les change pas) ; les numéros de verset qui s'y trouvent en gras (« **2** ») dans cette citation « > » seulement, jamais dans une citation entre « » au milieu d'une phrase ; la référence reste à sa place : si elle suit la lecture, elle reste à la fin, entre parenthèses, « (Apocalypse 14:7) » ;
- les courtes citations dans une phrase restent dans la phrase, entre « ».

Le gras (**…**) est celui du prédicateur : il souligne ce qu'il tient pour important. Garde-le exactement sur les mêmes mots, ni plus ni moins, dans le texte comme dans les citations. Le PDF ferme le gras à chaque fin de ligne : quand tu recolles les lignes, « **a b** » coupé en « **a** » et « **b** » redevient « **a b** ». Le gras s'arrête là où il s'arrête dans le texte : ne le prolonge jamais sur le mot qui suit, en particulier sur le premier mot du paragraphe suivant. N'ajoute du gras qu'aux numéros de verset d'une lecture en citation « > ».

Interdit : reformuler, résumer, couper une répétition ou un « Amen ! », lisser le style oral, ajouter un titre de section. N'ajoute jamais un mot et n'en enlève jamais un, même un petit mot que la grammaire demande et que l'oral a avalé : « ça commencé » reste « ça commencé », « on a plus » reste « on a plus », « Qu'en n'est-il » reste « Qu'en n'est-il », « il ne vient » reste « il ne vient » ; « il ya » devient « il y a » (une espace), jamais « il y en a ». Ne change pas un temps (« disparut » reste « disparut »). N'enlève jamais une phrase ni une ligne du prédicateur, et garde sa signature à la fin (« En Christ notre Seigneur, Fr M'BRA Parfait », « Frère … , Kinshasa le … »). Les références bibliques restent écrites comme dans le texte (« Math. 24, 6 » reste « Math. 24, 6 »).

Lecture manquante : si le prédicateur annonce une lecture avec ses versets (« Nous lisons Genèse 4 à partir du verset 1 », « Jean 3:16 ») et que le texte lu n'est pas dans la transcription, ni juste après l'annonce ni plus loin, écris à cet endroit, sur une ligne à part, [[LECTURE: <livre chapitre:verset-verset>]], par exemple [[LECTURE: Genèse 4:1-16]]. Le script y mettra le texte Segond. Ne l'écris jamais toi-même. S'il paraphrase ou cite de mémoire dans sa phrase, ce n'est pas une lecture : rien à insérer. S'il ne donne qu'un chapitre (« Nous lisons dans Jean 3 »), rien à insérer.

Une phrase que tu ne peux pas rendre intelligible sans changer de mot : laisse-la telle quelle et recopie-la dans la liste des phrases obscures.

Réponds exactement dans ce format, sans rien d'autre :
<<<TITRE>>>
le titre donné, en minuscules sauf la première lettre et les noms propres, typographie française (seulement pour la première partie ; sinon laisse vide)
<<<TEXTE>>>
le texte corrigé, en markdown
<<<OBSCUR>>>
une phrase obscure par ligne, ou rien (rien après)`;

// Parts of about 3,500 words, cut after a line that ends a sentence.
function parts(text) {
  const out = [[]];
  let words = 0;
  for (const line of text.split("\n")) {
    out.at(-1).push(line);
    words += line.split(/\s+/).filter(Boolean).length;
    if (words > 3500 && /[.!?»]\**\s*$/.test(line)) { out.push([]); words = 0; }
  }
  return out.map((ls) => ls.join("\n")).filter((p) => p.trim());
}

async function complete(user) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_completion_tokens: 32000, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`${MODEL}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const m = json.choices[0].message.content.match(/<<<TITRE>>>\n?([\s\S]*?)<<<TEXTE>>>\n?([\s\S]*?)<<<OBSCUR>>>\n?([\s\S]*)$/);
  if (!m) throw new Error(`${MODEL}: answer not in the format`);
  return { title: m[1].trim(), text: m[2].trim(), unclear: m[3].split("\n").map((s) => s.trim()).filter(Boolean), usage: json.usage };
}

const db = await connect();
for (const md of batch) {
  const out = path.join(root, ".pass-cache", md.slice("markdown/".length).replace(/\.md$/, ".json"));
  if (fs.existsSync(out)) continue;
  const original = fs.readFileSync(path.join(root, ".parse-cache", md.slice("markdown/".length)), "utf8");
  const title = JSON.parse(fs.readFileSync(path.join(root, md), "utf8").match(/^title: (.*)$/m)[1]);
  const results = [];
  for (const [i, part] of parts(original).entries())
    results.push(await complete(i === 0 ? `Titre donné : ${title}\n\n${part}` : part));

  const readings = [];
  const unresolved = [];
  let body = results.map((r) => r.text).join("\n\n");
  // The reading is its own paragraph, its reference at the end, as the published sermons have it.
  for (const m of [...body.matchAll(/^\[\[LECTURE: *(.+?)\]\]$/gm)]) {
    const ref = [...citations(m[1])][0]?.ref;
    const verses = ref && (await reading(db, ref));
    if (verses) readings.push({ said: m[1], ref });
    else unresolved.push(m[1]);
    body = body.replace(m[0], verses ? `\n\n${blockquote(verses, ref)}\n\n` : "");
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    model: MODEL,
    title: results[0].title || title,
    body: body.replace(/\n{3,}/g, "\n\n"),
    readings,
    unresolved,
    unclear: results.flatMap((r) => r.unclear),
    usage: results.map((r) => r.usage),
  }, null, 2));
  console.log(`${md}: ${readings.length} readings inserted, ${unresolved.length} unresolved`);
}
await db.close();
