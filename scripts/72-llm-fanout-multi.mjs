#!/usr/bin/env node
// Multi-source LLM cleanup. Usage:
//   node scripts/72-llm-fanout-multi.mjs <source>
// where <source> is one of: le-scribe | branham
//
// Writes per-doc JSON cache to .llm-cache-<source>/ and reads from
// manifests/<source>-*.json (or all manifests/<source>*.json files).

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) { console.error("DEEPSEEK_API_KEY not set"); process.exit(2); }
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

const source = process.argv[2];
if (!source || !["le-scribe", "branham", "mevar-pdfs"].includes(source)) {
  console.error("usage: 72-llm-fanout-multi.mjs <le-scribe|branham|mevar-pdfs>");
  process.exit(2);
}

const CHUNK_SIZE = 45000;
const MAX_OUTPUT_TOKENS = 16000;
const CONCURRENCY = 4;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 240000;

// ── Source-specific prompts ──────────────────────────────────────────────────
const PROMPTS = {
  "le-scribe": {
    full: `Tu es un éditeur expert qui prépare des résumés français de prédications de William Branham (site le-scribe.org) pour publication propre. Tu reçois du texte brut extrait de PDF et dois le nettoyer en Markdown bien formaté et extraire des métadonnées structurées.

Règles strictes :
- PRÉSERVE les mots originaux exactement. NE PARAPHRASE PAS, NE RÉSUME PAS, NE RÉÉCRIS PAS — uniquement le formatage.
- PRÉSERVE les NUMÉROS DE PARAGRAPHE s'ils existent (ex: "1.", "2.") — ce sont des marqueurs de citation. Format markdown : "**1.** texte du paragraphe…"
- Recolle les paragraphes coupés au milieu d'une phrase (extraction PDF).
- Mets en blockquote (>) les citations bibliques clairement délimitées.
- Les références bibliques sont au format "Matthieu 24:6" — NE LES MODIFIE PAS.
- Conserve les majuscules sur les noms propres : Dieu, Seigneur, Christ, Jésus, Esprit, Église, Parole.
- Supprime numéros de page, en-têtes/pieds répétitifs, bruit (URLs, signatures site).
- L'en-tête de doc indique souvent date et lieu de la prédication source — garde-le formaté en italique.

Réponse : JSON STRICT uniquement. Schéma :
{
  "title": "Titre de la prédication résumée",
  "subtitle": "Sous-titre ou sermon ID (ex: 65-0117) ou null",
  "date": "YYYY-MM-DD ou null",
  "location": "Ville/lieu de la prédication originale ou null",
  "preacher": "William Branham par défaut, sinon nom alternatif",
  "summary": "Résumé 2-3 phrases du contenu",
  "tags": ["1-5 tags thématiques en français"],
  "persons": ["personnes bibliques et historiques"],
  "places": ["lieux mentionnés"],
  "themes": ["3-7 concepts thématiques"],
  "cleaned_markdown": "Le corps complet en markdown propre"
}`,
    body: `Tu nettoies un résumé français de prédication de William Branham. C'est UNE PARTIE d'un document plus long. Préserve les numéros de paragraphe (ex: "1.", "2.") en format **N.**. Préserve mots originaux. Mets bibles en blockquote. Réponse : JSON STRICT { "cleaned_markdown": "..." }.`,
  },
  "mevar-pdfs": {
    full: `Tu es un éditeur expert qui prépare des prédications/exhortations françaises de mevar.org pour publication propre. Tu reçois du texte brut extrait de PDF et dois le nettoyer en Markdown bien formaté et extraire des métadonnées structurées.

Règles strictes :
- PRÉSERVE les mots originaux exactement. NE PARAPHRASE PAS, NE RÉSUME PAS, NE RÉÉCRIS PAS — uniquement le formatage.
- Recolle les paragraphes coupés au milieu d'une phrase (extraction PDF).
- Mets en blockquote (>) les citations bibliques clairement délimitées (numéros de versets en gras dans la citation).
- Les références bibliques sont déjà standardisées en forme "Matthieu 24:6" — NE LES MODIFIE PAS.
- Conserve les majuscules sur les noms propres : Dieu, Seigneur, Christ, Jésus, Esprit, Eglise, Parole, etc.
- Supprime les numéros de page, en-têtes/pieds répétitifs, et bruits évidents (page X sur Y, MEVAR, dates de publication isolées, URLs).
- Si le texte commence par un en-tête type "prêché à Koumassi le 23 février 2014 par le frère M'BRA Parfait", garde-le formaté en italique.

Réponse : JSON STRICT uniquement. Schéma :
{
  "title": "Titre principal",
  "subtitle": "Sous-titre ou null",
  "date": "YYYY-MM-DD ou null",
  "location": "Ville ou null",
  "preacher": "Nom du prédicateur ou null",
  "summary": "Résumé 2-3 phrases",
  "tags": ["1-5 tags style mevar"],
  "persons": ["personnes bibliques et historiques"],
  "places": ["lieux mentionnés"],
  "themes": ["3-7 concepts thématiques"],
  "cleaned_markdown": "Le corps complet en markdown propre"
}`,
    body: `Tu nettoies une prédication/exhortation française. C'est UNE PARTIE d'un document plus long. Préserve mots originaux. Bibles en blockquote. Réponse : JSON STRICT { "cleaned_markdown": "..." }.`,
  },
  "branham": {
    full: `You are an expert editor preparing English transcripts of William Branham sermons for clean publication. You receive raw text extracted from PDF and must clean it into well-formatted Markdown and extract structured metadata.

Strict rules:
- PRESERVE the original words EXACTLY. DO NOT paraphrase, summarize, or rewrite — only formatting.
- PRESERVE PARAGRAPH NUMBERS if present (e.g., "1", "2", "1." or "E-1", "E-2") — these are citation markers used to reference Branham sermons. Format in markdown as "**1.** paragraph text…"
- Reflow paragraphs that were broken mid-sentence by PDF extraction.
- Use blockquote (>) for clearly delimited Bible quotations.
- Bible references should be standardized to "Matthew 24:6" form. If you find variants like "Matt. 24:6" / "Mt 24,6" / "Matthew 24, verse 6", normalize them.
- Keep proper nouns capitalized: God, Lord, Christ, Jesus, Spirit, Word, Bride, Church, etc.
- Strip page numbers, repeated headers/footers, copyright notices, and obvious noise.
- Sermon headers often have title + date + location at top — keep but format italicized under the title.

Response: STRICT JSON only (no \`\`\`, no commentary). Schema:
{
  "title": "Sermon title",
  "subtitle": "Sermon ID (e.g., 65-0117) or null",
  "date": "YYYY-MM-DD or null",
  "location": "City/region or null",
  "preacher": "William Branham (or alternative if mentioned)",
  "summary": "2-3 sentence English summary",
  "tags": ["1-5 thematic tags in English"],
  "persons": ["biblical and historical persons mentioned"],
  "places": ["geographical places"],
  "themes": ["3-7 key thematic concepts in English"],
  "cleaned_markdown": "Full body as clean markdown"
}`,
    body: `You clean an English Branham sermon transcript. This is ONE PART of a longer document. Preserve paragraph numbers (1, 2, E-1) as **N.**. Preserve original words. Quote Bible verses as blockquotes. Bible refs canonical (Matthew 24:6). Response: STRICT JSON { "cleaned_markdown": "..." }.`,
  },
};

const SYSTEM_FULL = PROMPTS[source].full;
const SYSTEM_BODY = PROMPTS[source].body;

// ── Doc list ─────────────────────────────────────────────────────────────────
function loadDocs() {
  if (source === "le-scribe") {
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifests/le-scribe.json"), "utf8"));
    return m.map((e) => ({ id: e.sermon_id, mdPath: `markdown/le-scribe/${e.year ?? "undated"}/${e.sermon_id}.md` }));
  }
  if (source === "mevar-pdfs") {
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar-pdfs-corpus.json"), "utf8"));
    return m.map((e) => ({ id: e.sermon_id, mdPath: e.local_md }));
  }
  if (source === "branham") {
    const docs = [];
    const dir = path.join(root, "manifests");
    for (const f of fs.readdirSync(dir).filter((f) => /^branham-\d{4}\.json$/.test(f))) {
      const arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const e of arr) docs.push({ id: e.sermon_id, mdPath: `markdown/branham/${e.year}/${e.sermon_id}.md` });
    }
    return docs;
  }
  return [];
}

const cacheDir = path.join(root, `.llm-cache-${source}`);
fs.mkdirSync(cacheDir, { recursive: true });

// ── Boilerplate (same as 71) ────────────────────────────────────────────────
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
    try { return await callLLMOnce(systemPrompt, userText); }
    catch (e) {
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

function safeParse(content) { try { return JSON.parse(content); } catch { return null; } }
function stripFrontmatter(s) { return s.replace(/^---\n[\s\S]*?\n---\n+/, ""); }

async function processDoc(doc) {
  const cachePath = path.join(cacheDir, `${doc.id}.json`);
  if (fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (cached.cleaned_markdown && !cached._parse_error && !cached._error) {
      return { id: doc.id, status: "cached", meta: cached._meta };
    }
  }
  const fullPath = path.join(root, doc.mdPath);
  if (!fs.existsSync(fullPath)) return { id: doc.id, status: "missing" };
  const raw = stripFrontmatter(fs.readFileSync(fullPath, "utf8"));
  if (raw.length < 50) return { id: doc.id, status: "empty" };

  const chunks = chunkAtParagraph(raw, CHUNK_SIZE);
  let merged = null;
  let totalIn = 0, totalOut = 0, totalCached = 0;
  const t0 = Date.now();

  try {
    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const sysPrompt = isFirst ? SYSTEM_FULL : SYSTEM_BODY;
      const userText = chunks.length > 1
        ? `[Part ${i + 1} of ${chunks.length}]\n\n${chunks[i]}`
        : chunks[i];
      let data = await callLLM(sysPrompt, userText);
      let parsed = safeParse(data.choices?.[0]?.message?.content);
      if (!parsed && chunks[i].length > 30000) {
        data = await callLLM(sysPrompt, chunks[i].slice(0, 30000));
        parsed = safeParse(data.choices?.[0]?.message?.content);
      }
      if (!parsed) { merged ??= {}; merged._parse_error = `chunk ${i + 1} failed`; break; }
      const u = data.usage ?? {};
      totalIn += u.prompt_tokens ?? 0;
      totalOut += u.completion_tokens ?? 0;
      totalCached += u.prompt_cache_hit_tokens ?? 0;
      if (isFirst) merged = { ...parsed };
      else merged.cleaned_markdown = (merged.cleaned_markdown ?? "") + "\n\n" + (parsed.cleaned_markdown ?? "");
    }
  } catch (e) {
    merged ??= {};
    merged._error = e.message;
  }
  merged ??= {};
  merged._meta = { model: MODEL, chunks: chunks.length, prompt_tokens: totalIn, completion_tokens: totalOut, cached_tokens: totalCached, ms: Date.now() - t0, input_chars: raw.length };
  fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2));
  return { id: doc.id, status: merged._error || merged._parse_error ? "error" : "ok", meta: merged._meta };
}

const docs = loadDocs();
const queue = [...docs];
const total = queue.length;
let done = 0, ok = 0, err = 0, cached = 0, empty = 0, sumIn = 0, sumOut = 0, sumCached = 0;
const startTime = Date.now();

async function worker() {
  while (queue.length) {
    const doc = queue.shift();
    if (!doc) return;
    const r = await processDoc(doc);
    done++;
    if (r.status === "ok") ok++;
    else if (r.status === "cached") cached++;
    else if (r.status === "empty" || r.status === "missing") empty++;
    else err++;
    if (r.meta) { sumIn += r.meta.prompt_tokens; sumOut += r.meta.completion_tokens; sumCached += r.meta.cached_tokens; }
    const eta = done > cached ? Math.round((Date.now() - startTime) / (done - cached) * (total - done) / 1000) : 0;
    if (done % 10 === 0 || r.status === "error") {
      console.log(`[${source} ${done}/${total}] ${r.id} ${r.status} | ok=${ok} cached=${cached} err=${err} empty=${empty} | eta ~${eta}s`);
    }
  }
}

const workers = Array.from({ length: CONCURRENCY }, () => worker());
await Promise.all(workers);

const inMissCost = (sumIn - sumCached) / 1_000_000 * 0.27;
const inHitCost = sumCached / 1_000_000 * 0.07;
const outCost = sumOut / 1_000_000 * 1.10;
console.log(`\n=== ${source} fanout summary ===`);
console.log(`processed: ${done}/${total} (ok=${ok} cached=${cached} err=${err} empty=${empty})`);
console.log(`tokens: ${sumIn} in (${sumCached} cached) + ${sumOut} out`);
console.log(`cost: $${(inMissCost + inHitCost + outCost).toFixed(2)}`);
console.log(`wall time: ${Math.round((Date.now() - startTime) / 60000)}m`);
