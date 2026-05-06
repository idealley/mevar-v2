#!/usr/bin/env node
// Production LLM cleanup over all onedrive docs.
// - chunks docs > 45K chars at paragraph boundaries
// - concurrency=8 (DeepSeek allows 100+ concurrent), retry once on truncation
// - resumable: skips docs that already have a complete cache entry
// - on chunk merge: metadata from chunk 1, body = concat(chunked cleaned_markdown), NER fields = union

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) { console.error("DEEPSEEK_API_KEY not set"); process.exit(2); }
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

const CHUNK_SIZE = 45000;     // chars per chunk
const MAX_OUTPUT_TOKENS = 16000; // DeepSeek V3 cap
const CONCURRENCY = 4;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 240000; // 4 min per request

const SYSTEM_FULL = `Tu es un éditeur expert qui prépare des textes religieux français pour publication propre. Le corpus est du contenu chrétien (message du temps de la fin, suiveurs de William Branham). Tu reçois du texte brut extrait de PDF/DOCX et dois le nettoyer en Markdown bien formaté et extraire des métadonnées structurées.

Règles strictes :
- PRÉSERVE les mots originaux exactement. NE PARAPHRASE PAS, NE RÉSUME PAS, NE RÉÉCRIS PAS le contenu — uniquement le formatage.
- Recolle les paragraphes coupés au milieu d'une phrase (extraction PDF).
- Mets en blockquote (>) les citations bibliques clairement délimitées (numéros de versets en gras dans la citation).
- Les références bibliques sont déjà standardisées en forme "Matthieu 24:6" — NE LES MODIFIE PAS, ne change pas le pluriel/singulier (Psaumes reste Psaumes, pas Psaume).
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

const SYSTEM_BODY = `Tu nettoies du texte religieux français extrait de PDF en Markdown propre. C'est UNE PARTIE d'un document plus long ; tu reçois seulement le corps à formater, pas le début.

Règles strictes :
- PRÉSERVE les mots originaux exactement.
- Recolle les paragraphes coupés ; supprime numéros de page et bruits.
- Mets en blockquote (>) les citations bibliques (versets numérotés en gras).
- Les références bibliques sont déjà au format "Matthieu 24:6" — NE LES MODIFIE PAS.
- Conserve les majuscules : Dieu, Seigneur, Christ, etc.

Réponse : JSON STRICT { "cleaned_markdown": "..." } — rien d'autre.`;

function chunkAtParagraph(text, size) {
  if (text.length <= size) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= size) { chunks.push(text.slice(start)); break; }
    let end = start + size;
    const para = text.lastIndexOf("\n\n", end);
    if (para > start + size * 0.5) end = para;
    else {
      const sent = text.lastIndexOf(". ", end);
      if (sent > start + size * 0.5) end = sent + 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

async function callLLMOnce(systemPrompt, userText) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function callLLM(systemPrompt, userText) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callLLMOnce(systemPrompt, userText);
    } catch (e) {
      lastErr = e;
      const msg = e.message || String(e);
      const retriable = /terminated|aborted|timeout|ECONNRESET|EPIPE|HTTP\s*[\/]?\d?\.?\d?\s*[45]\d\d|HTTP 429|Unexpected token|fetch failed|network/i.test(msg);
      if (!retriable || attempt === MAX_RETRIES - 1) throw e;
      const backoff = Math.min(60000, 2000 * Math.pow(2, attempt)) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

function safeParse(content) {
  try { return JSON.parse(content); } catch { return null; }
}

function stripFrontmatter(s) { return s.replace(/^---\n[\s\S]*?\n---\n+/, ""); }

async function processDoc(mdPath) {
  const id = path.basename(mdPath, ".md");
  const cachePath = path.join(root, ".llm-cache", `${id}.json`);
  if (fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (cached.cleaned_markdown && !cached._parse_error) return { id, status: "cached", meta: cached._meta };
  }

  const fullPath = path.join(root, mdPath);
  if (!fs.existsSync(fullPath)) return { id, status: "missing" };
  const raw = stripFrontmatter(fs.readFileSync(fullPath, "utf8"));
  if (raw.length < 50) return { id, status: "empty" };

  const chunks = chunkAtParagraph(raw, CHUNK_SIZE);
  let merged = null;
  let totalIn = 0, totalOut = 0, totalCached = 0;
  const t0 = Date.now();

  try {
    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const sysPrompt = isFirst ? SYSTEM_FULL : SYSTEM_BODY;
      const userText = isFirst && chunks.length > 1
        ? `[Partie 1 de ${chunks.length}]\n\n${chunks[i]}`
        : !isFirst
          ? `[Partie ${i + 1} de ${chunks.length}]\n\n${chunks[i]}`
          : chunks[i];

      let data = await callLLM(sysPrompt, userText);
      let parsed = safeParse(data.choices?.[0]?.message?.content);

      // Retry once on parse failure with a smaller input slice
      if (!parsed && chunks[i].length > 30000) {
        const sliced = chunks[i].slice(0, 30000);
        data = await callLLM(sysPrompt, sliced);
        parsed = safeParse(data.choices?.[0]?.message?.content);
      }
      if (!parsed) {
        merged ??= {};
        merged._parse_error = `chunk ${i + 1} failed`;
        break;
      }

      const u = data.usage ?? {};
      totalIn += u.prompt_tokens ?? 0;
      totalOut += u.completion_tokens ?? 0;
      totalCached += u.prompt_cache_hit_tokens ?? 0;

      if (isFirst) {
        merged = { ...parsed };
      } else {
        merged.cleaned_markdown = (merged.cleaned_markdown ?? "") + "\n\n" + (parsed.cleaned_markdown ?? "");
      }
    }
  } catch (e) {
    merged ??= {};
    merged._error = e.message;
  }

  merged ??= {};
  merged._meta = {
    model: MODEL,
    chunks: chunks.length,
    prompt_tokens: totalIn,
    completion_tokens: totalOut,
    cached_tokens: totalCached,
    ms: Date.now() - t0,
    input_chars: raw.length,
  };
  fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2));
  return { id, status: merged._error || merged._parse_error ? "error" : "ok", meta: merged._meta };
}

// Concurrent worker pool over the onedrive doc list
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));
const queue = manifest.map((e) => e.local_md);
const total = queue.length;
let done = 0, ok = 0, err = 0, cached = 0, empty = 0, sumIn = 0, sumOut = 0, sumCached = 0;
const startTime = Date.now();

async function worker(workerId) {
  while (queue.length) {
    const mdPath = queue.shift();
    if (!mdPath) return;
    const r = await processDoc(mdPath);
    done++;
    if (r.status === "ok") ok++;
    else if (r.status === "cached") cached++;
    else if (r.status === "empty" || r.status === "missing") empty++;
    else err++;
    if (r.meta) { sumIn += r.meta.prompt_tokens; sumOut += r.meta.completion_tokens; sumCached += r.meta.cached_tokens; }
    const eta = done > cached ? Math.round((Date.now() - startTime) / (done - cached) * (total - done) / 1000) : 0;
    if (done % 10 === 0 || r.status === "error") {
      console.log(`[${done}/${total}] ${r.id} ${r.status} | ok=${ok} cached=${cached} err=${err} empty=${empty} | eta ~${eta}s`);
    }
  }
}

const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
await Promise.all(workers);

const inMissCost = (sumIn - sumCached) / 1_000_000 * 0.27;
const inHitCost = sumCached / 1_000_000 * 0.07;
const outCost = sumOut / 1_000_000 * 1.10;
console.log(`\n=== fanout summary ===`);
console.log(`processed: ${done}/${total} (ok=${ok} cached=${cached} err=${err} empty=${empty})`);
console.log(`tokens: ${sumIn} in (${sumCached} cached) + ${sumOut} out`);
console.log(`cost: $${(inMissCost + inHitCost + outCost).toFixed(2)}`);
console.log(`wall time: ${Math.round((Date.now() - startTime) / 60000)}m`);
