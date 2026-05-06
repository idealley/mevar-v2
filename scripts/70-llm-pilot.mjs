#!/usr/bin/env node
// Pilot: clean + extract structured metadata from 10 onedrive docs using DeepSeek V3.
// - reads .pilot-list.json (array of markdown paths)
// - calls DeepSeek API with strict-JSON system prompt
// - writes results to .pilot/<basename>.json
// - prints a side-by-side comparison report

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error("DEEPSEEK_API_KEY not set in .env");
  process.exit(2);
}

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un éditeur expert qui prépare des textes religieux français pour publication propre. Le corpus est du contenu chrétien (message du temps de la fin, suiveurs de William Branham). Tu reçois du texte brut extrait de PDF/DOCX et dois le nettoyer en Markdown bien formaté et extraire des métadonnées structurées.

Règles strictes :
- PRÉSERVE les mots originaux exactement. NE PARAPHRASE PAS, NE RÉSUME PAS, NE RÉÉCRIS PAS le contenu — uniquement le formatage.
- Recolle les paragraphes coupés au milieu d'une phrase (extraction PDF).
- Mets en blockquote (>) les citations bibliques clairement délimitées (numéros de versets en gras dans la citation).
- Les références bibliques sont déjà standardisées en forme "Matthieu 24:6" — NE LES MODIFIE PAS.
- Utilise ## pour les titres de sections naturellement présents.
- Conserve les majuscules sur les noms propres : Dieu, Seigneur, Christ, Jésus, Esprit, Eglise, Parole, etc.
- Supprime les numéros de page, en-têtes/pieds répétitifs, et bruits évidents (page X sur Y, MEVAR, dates de publication isolées).
- Si le texte commence par un en-tête type "prêché à Koumassi le 23 février 2014 par le frère M'BRA Parfait", garde-le mais formate-le comme italique sur sa propre ligne juste sous le titre.

Réponse : JSON STRICT uniquement (pas de \`\`\`, pas de commentaire). Schéma :
{
  "title": "Titre principal du document",
  "subtitle": "Sous-titre ou 'Exhortation de [Mois] [Année]' si applicable, sinon null",
  "date": "YYYY-MM-DD ou null si inconnu",
  "location": "Ville/lieu si mentionné dans l'en-tête, sinon null",
  "preacher": "Nom du prédicateur si mentionné, sinon null",
  "summary": "Résumé 2-3 phrases en français du contenu",
  "tags": ["tags style mevar — choisir parmi : Prédications, Exhortations, Etudes Bibliques, Chaîne de prière, Publications, audio. + tag année (ex: '2014'). + 1-3 tags thématiques."],
  "persons": ["personnes bibliques et historiques mentionnées, forme française canonique"],
  "places": ["lieux géographiques mentionnés (sites bibliques, villes modernes, pays)"],
  "themes": ["3-7 concepts thématiques clés"],
  "cleaned_markdown": "Le corps complet en markdown propre, SANS frontmatter YAML."
}`;

async function callDeepSeek(userText) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return data;
}

function stripFrontmatter(s) {
  return s.replace(/^---\n[\s\S]*?\n---\n+/, "");
}

const pilotList = JSON.parse(fs.readFileSync(path.join(root, ".pilot-list.json"), "utf8"));
fs.mkdirSync(path.join(root, ".pilot"), { recursive: true });

let totalIn = 0, totalOut = 0, totalCachedIn = 0;
const results = [];

for (const mdPath of pilotList) {
  const fullPath = path.join(root, mdPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (missing): ${mdPath}`);
    continue;
  }
  const id = path.basename(mdPath, ".md");
  const outPath = path.join(root, ".pilot", `${id}.json`);
  if (fs.existsSync(outPath)) {
    console.log(`CACHED: ${id}`);
    const cached = JSON.parse(fs.readFileSync(outPath, "utf8"));
    results.push({ id, mdPath, ...cached });
    continue;
  }

  const raw = stripFrontmatter(fs.readFileSync(fullPath, "utf8"));
  if (raw.length < 50) {
    console.log(`SKIP (empty): ${id}`);
    continue;
  }
  // Cap input at 60000 chars (~15k tokens) to stay within model context
  const userText = raw.length > 60000 ? raw.slice(0, 60000) + "\n\n[...truncated]" : raw;

  console.log(`▶ ${id} (${raw.length} chars)`);
  const t0 = Date.now();
  try {
    const data = await callDeepSeek(userText);
    const usage = data.usage ?? {};
    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    const cachedTokens = usage.prompt_cache_hit_tokens ?? usage.cached_tokens ?? 0;
    totalIn += promptTokens;
    totalOut += completionTokens;
    totalCachedIn += cachedTokens;
    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch (e) {
      parsed = { _parse_error: e.message, _raw: data.choices?.[0]?.message?.content };
    }
    const result = {
      _meta: {
        model: MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cached_tokens: cachedTokens,
        ms: Date.now() - t0,
        input_chars: raw.length,
      },
      ...parsed,
    };
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    results.push({ id, mdPath, ...result });
    console.log(`  ✓ ${promptTokens}p+${completionTokens}c tok, cached=${cachedTokens}, ${Date.now() - t0}ms`);
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
  }
}

// Cost estimate (DeepSeek V3 pricing, USD per 1M tokens)
//   input  $0.27 (cache miss) / $0.07 (cache hit)
//   output $1.10
const inMissCost = (totalIn - totalCachedIn) / 1_000_000 * 0.27;
const inHitCost = totalCachedIn / 1_000_000 * 0.07;
const outCost = totalOut / 1_000_000 * 1.10;
const totalCost = inMissCost + inHitCost + outCost;

console.log(`\n=== pilot summary ===`);
console.log(`docs processed: ${results.length}/${pilotList.length}`);
console.log(`tokens: ${totalIn} in (${totalCachedIn} cached) + ${totalOut} out`);
console.log(`est cost: $${totalCost.toFixed(4)}`);
console.log(`extrapolated to 339 docs: $${(totalCost * 339 / results.length).toFixed(2)}`);
