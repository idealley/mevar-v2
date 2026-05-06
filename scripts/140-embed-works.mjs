#!/usr/bin/env node
// Embed work bodies via OpenAI text-embedding-3-small (1536-d, multilingual).
//
// Cache architecture:
//   - sha256(body) is the cache key (in `embedding_cache` table)
//   - Re-running this script reuses cached vectors — only NEW or CHANGED bodies hit the API
//   - Re-running scripts/100-ingest-surrealdb.mjs preserves both work.embedding AND embedding_cache
//
// Cost estimate: 3,103 works × ~10K tokens avg = 31M tokens × $0.02/M = ~$0.62 total.
//
// Env: OPENAI_API_KEY (required), SURREAL_URL/USER/PASS/NS/DB (defaults match boot script).

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Surreal, RecordId } from "surrealdb";

const MODEL = process.env.EMBED_MODEL ?? "text-embedding-3-small";    // 1536-d
const DIM = MODEL === "text-embedding-3-large" ? 3072 : 1536;
const CONCURRENCY = 5;
// OpenAI text-embedding-3 hard cap is 8192 tokens. For mixed French/English religious text,
// observed ratio is ~3 chars/token (French is denser than English's 4). Use ~7500 tokens
// → 22500 chars to leave headroom against accent-heavy passages.
const MAX_INPUT_CHARS = 22500;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY not set"); process.exit(2); }

const root = path.resolve(import.meta.dirname, "..");
const SURREAL_URL = process.env.SURREAL_URL ?? "http://localhost:8000";
const wsUrl = SURREAL_URL.replace(/^http(s?)/, "ws$1");

const db = new Surreal();
await db.connect(`${wsUrl}/rpc`);
await db.signin({ username: process.env.SURREAL_USER ?? "root", password: process.env.SURREAL_PASS ?? "root" });
await db.use({ namespace: process.env.SURREAL_NS ?? "revelation", database: process.env.SURREAL_DB ?? "main" });

// 1. Pull all works that need embeddings
const works = (await db.query(
  `SELECT id, content_hash, title, source, source_id, body
   FROM work
   WHERE content_hash != NONE AND (embedding = NONE OR embedding_model != $model)`,
  { model: MODEL }
))[0];
console.log(`works to embed: ${works.length}`);

// 2. Pre-load existing cache for these hashes — saves API calls on re-run
const hashes = [...new Set(works.map((w) => w.content_hash))];
const cached = new Map();
for (let i = 0; i < hashes.length; i += 500) {
  const batch = hashes.slice(i, i + 500);
  const rows = (await db.query(
    `SELECT content_hash, vector FROM embedding_cache WHERE model = $m AND content_hash IN $hashes`,
    { m: MODEL, hashes: batch }
  ))[0];
  for (const r of rows) cached.set(r.content_hash, r.vector);
}
console.log(`cache hits available: ${cached.size}/${hashes.length}`);

// 3. Embed (with cache hit fast-path)
async function embedOne(text) {
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: truncated, dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.data[0].embedding;
}

const queue = [...works];
let done = 0, hits = 0, miss = 0, fail = 0;
const startTime = Date.now();

async function worker() {
  while (queue.length) {
    const w = queue.shift();
    if (!w) return;
    let vector = cached.get(w.content_hash);
    try {
      if (!vector) {
        vector = await embedOne(w.body);
        miss++;
        // Write to cache (one row per content_hash+model)
        await db.query(
          `INSERT INTO embedding_cache $row ON DUPLICATE KEY UPDATE vector = $input.vector`,
          { row: {
            content_hash: w.content_hash, model: MODEL, dim: vector.length,
            vector, source_hint: `${w.source}/${w.source_id}`, title_hint: w.title,
          }}
        );
        cached.set(w.content_hash, vector);  // share within run
      } else {
        hits++;
      }
      // Copy denormalized vector + model name into work
      await db.query(
        `UPDATE $id SET embedding = $vector, embedding_model = $model`,
        { id: w.id, vector, model: MODEL }
      );
    } catch (e) {
      console.error(`  ✗ ${w.id}: ${e.message}`);
      fail++;
    }
    done++;
    if (done % 50 === 0 || done === works.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const eta = (works.length - done) / rate;
      console.log(`[${done}/${works.length}] hits=${hits} miss=${miss} fail=${fail} | ${rate.toFixed(1)}/s eta ${eta.toFixed(0)}s`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// 4. Add the HNSW index now that all rows have embeddings (idempotent)
console.log("\nbuilding HNSW index ...");
try {
  await db.query(
    `DEFINE INDEX OVERWRITE work_embedding ON work FIELDS embedding
       HNSW DIMENSION ${DIM} TYPE F32 DIST COSINE EFC 200 M 16`
  );
  console.log(`  ✓ HNSW index built (dim=${DIM})`);
} catch (e) {
  console.error(`  ✗ HNSW: ${e.message}`);
}

// 5. Optional: dump cache to disk for portable backup
const dumpPath = path.join(root, "bible-data/embedding-cache.jsonl");
const lines = [];
for (const [hash, vector] of cached) lines.push(JSON.stringify({ hash, model: MODEL, vector }));
fs.writeFileSync(dumpPath, lines.join("\n"));
console.log(`\ncache dump: ${dumpPath} (${lines.length} entries, ${(fs.statSync(dumpPath).size / 1e6).toFixed(1)} MB)`);

console.log(`\ndone in ${((Date.now() - startTime) / 60000).toFixed(1)}m: hits=${hits} miss=${miss} fail=${fail}`);
await db.close();
