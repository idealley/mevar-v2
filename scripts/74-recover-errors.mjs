#!/usr/bin/env node
// Recover stubborn-error docs by reprocessing them with smaller chunks (25k vs 45k).
// Usage: node scripts/74-recover-errors.mjs <onedrive|le-scribe|branham>

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) { console.error("DEEPSEEK_API_KEY not set"); process.exit(2); }
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

const source = process.argv[2];
if (!["onedrive", "le-scribe", "branham", "mevar-pdfs"].includes(source)) {
  console.error("usage: 74-recover-errors.mjs <onedrive|le-scribe|branham|mevar-pdfs>");
  process.exit(2);
}

const CHUNK_SIZE = 25000;            // smaller for recovery
const MAX_OUTPUT_TOKENS = 16000;
const CONCURRENCY = 2;                // gentler on upstream
const MAX_RETRIES = 6;
const REQUEST_TIMEOUT_MS = 360000;    // 6 min per request

const cacheDir = source === "onedrive" ? path.join(root, ".llm-cache") : path.join(root, `.llm-cache-${source}`);

// Reuse the prompts from 71/72 (inline, not great but ships fast)
const PROMPTS = {
  onedrive: { full: "FRENCH cleanup full schema", body: "FRENCH body chunk" },
  "le-scribe": { full: "FRENCH le-scribe full", body: "FRENCH le-scribe body" },
  branham: { full: "ENGLISH branham full", body: "ENGLISH branham body" },
};

// Read the prompt strings from the existing fanout scripts to keep them in sync
function readPromptsFrom(scriptPath) {
  const src = fs.readFileSync(path.join(root, scriptPath), "utf8");
  const m = src.match(/const SYSTEM_FULL\s*=\s*([`'"])([\s\S]*?)\1/);
  const b = src.match(/const SYSTEM_BODY\s*=\s*([`'"])([\s\S]*?)\1/);
  return { full: m?.[2], body: b?.[2] };
}
function readPromptsForSource() {
  if (source === "onedrive") return readPromptsFrom("scripts/71-llm-fanout.mjs");
  // 72 has a PROMPTS dict — extract via crude parse
  const src = fs.readFileSync(path.join(root, "scripts/72-llm-fanout-multi.mjs"), "utf8");
  const startIdx = src.indexOf(`"${source}":`);
  // Find the next "full:" backtick block within this object
  const seg = src.slice(startIdx, startIdx + 5000);
  const fullM = seg.match(/full:\s*`([\s\S]*?)`,/);
  const bodyM = seg.match(/body:\s*`([\s\S]*?)`,/);
  return { full: fullM?.[1], body: bodyM?.[1] };
}
const { full: SYSTEM_FULL, body: SYSTEM_BODY } = readPromptsForSource();
if (!SYSTEM_FULL || !SYSTEM_BODY) {
  console.error("Could not extract prompts; aborting.");
  process.exit(1);
}

// Find errored cache entries
const failed = [];
for (const f of fs.readdirSync(cacheDir)) {
  if (!f.endsWith(".json")) continue;
  const c = JSON.parse(fs.readFileSync(path.join(cacheDir, f), "utf8"));
  if (c._error || c._parse_error) failed.push(f.replace(/\.json$/, ""));
}
console.log(`recovering ${failed.length} failed ${source} docs with chunk_size=${CHUNK_SIZE}`);

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

function pathForId(id) {
  if (source === "onedrive") {
    // Look up by sermon_id in onedrive manifest
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifests/onedrive.json"), "utf8"));
    const e = m.find((x) => x.sermon_id === id);
    return e?.local_md;
  }
  if (source === "le-scribe") {
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifests/le-scribe.json"), "utf8"));
    const e = m.find((x) => x.sermon_id === id);
    if (!e) return null;
    return `markdown/le-scribe/${e.year ?? "undated"}/${e.sermon_id}.md`;
  }
  if (source === "mevar-pdfs") {
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifests/mevar-pdfs-corpus.json"), "utf8"));
    const e = m.find((x) => x.sermon_id === id);
    return e?.local_md ?? null;
  }
  if (source === "branham") {
    for (const f of fs.readdirSync(path.join(root, "manifests")).filter((f) => /^branham-\d{4}\.json$/.test(f))) {
      const arr = JSON.parse(fs.readFileSync(path.join(root, "manifests", f), "utf8"));
      const e = arr.find((x) => x.sermon_id === id);
      if (e) {
        // Check both manifest year and sermon_id year
        const yyM = id.match(/^(\d{2})-/);
        const idYear = yyM ? (Number(yyM[1]) >= 47 ? 1900 + Number(yyM[1]) : 2000 + Number(yyM[1])) : null;
        for (const y of [e.year, idYear].filter(Boolean)) {
          const p = `markdown/branham/${y}/${e.sermon_id}.md`;
          if (fs.existsSync(path.join(root, p))) return p;
        }
      }
    }
  }
  return null;
}

async function recoverDoc(id) {
  const mdPath = pathForId(id);
  if (!mdPath) return { id, status: "no_path" };
  const fullPath = path.join(root, mdPath);
  if (!fs.existsSync(fullPath)) return { id, status: "missing_file" };

  const raw = stripFrontmatter(fs.readFileSync(fullPath, "utf8"));
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
      const data = await callLLM(sysPrompt, userText);
      const parsed = safeParse(data.choices?.[0]?.message?.content);
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
  merged._meta = { model: MODEL, chunks: chunks.length, prompt_tokens: totalIn, completion_tokens: totalOut, cached_tokens: totalCached, ms: Date.now() - t0, input_chars: raw.length, recovered: true };

  const cachePath = path.join(cacheDir, `${id}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2));
  return { id, status: merged._error || merged._parse_error ? "still_failed" : "recovered", chunks: chunks.length };
}

const queue = [...failed];
let done = 0, recovered = 0, stillFailed = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift();
    if (!id) return;
    const r = await recoverDoc(id);
    done++;
    if (r.status === "recovered") recovered++;
    else stillFailed++;
    console.log(`[${done}/${failed.length}] ${id} ${r.status} (chunks=${r.chunks})`);
  }
}
const workers = Array.from({ length: CONCURRENCY }, () => worker());
await Promise.all(workers);

console.log(`\n=== recovery summary ===`);
console.log(`recovered: ${recovered}/${failed.length}`);
console.log(`still failed: ${stillFailed}`);
