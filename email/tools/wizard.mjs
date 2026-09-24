#!/usr/bin/env node
/*
  wizard.mjs: the interactive send. `npm run email:send` from the repo root.

  Walks through: newest built email -> the duplicate check (a receipt, or a
  broadcast of the same name at Resend, stops here) -> schedule (default:
  tomorrow at the configured time) -> recap -> type "send" to schedule it,
  "dry" to create the broadcast without scheduling. Always a scheduled
  broadcast to RESEND_SEGMENT_ID, the one list. Writes the receipt to
  email/receipts/<slug>.json; commit it.

  The broadcast is named "Publications <slug>", never typed: the name is what
  the duplicate check looks for at Resend.
*/
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join, basename } from "node:path";
import {
  loadConfig,
  requireEnv,
  resendClient,
  alreadyBroadcast,
  newestBuilds,
  readIssue,
  scheduleTomorrow,
  scheduleOn,
  sendBroadcast,
} from "./lib.mjs";

const rl = readline.createInterface({ input, output });
const ask = async (q, def) => {
  const a = (await rl.question(def !== undefined ? `${q} [${def}] ` : `${q} `)).trim();
  return a || (def !== undefined ? String(def) : "");
};

async function pick(title, rows, render, defIndex = 0) {
  console.log(`\n${title}`);
  rows.forEach((r, i) =>
    console.log(`  ${i + 1}. ${render(r)}${i === defIndex ? "   <- default" : ""}`)
  );
  const a = await ask("Pick a number:", defIndex + 1);
  const i = Number(a) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= rows.length) throw new Error("Invalid choice.");
  return rows[i];
}

async function main() {
  const config = await loadConfig();
  const { product, timezone: tz } = config;
  const apiKey = requireEnv("RESEND_API_KEY");
  const segmentId = requireEnv("RESEND_SEGMENT_ID");
  const client = resendClient(apiKey);

  // 1 · built email (newest first)
  const distDir = join(config.root, product.distDir);
  const builds = await newestBuilds(distDir);
  if (builds.length === 0) throw new Error(`No built .html in ${distDir}. Run email/build.mjs first.`);
  const fmt = (b) =>
    `${b.file}  (built ${new Date(b.mtimeMs).toLocaleString("fr-FR", { timeZone: tz })})`;
  const build = await pick("Which email?", builds, fmt, 0);
  const { subject } = await readIssue(build.path);
  const slug = basename(build.file, ".html");
  const name = `${product.label} ${slug}`;
  const recordDir = join(config.root, product.recordDir);
  const recordPath = join(recordDir, `${slug}.json`);

  // 2 · never twice
  const why = await alreadyBroadcast(client, { name, recordPath });
  if (why) throw new Error(`Not sending "${subject}": ${why}.`);

  // 3 · schedule
  const hhmm = product.defaultSendTime;
  const tomorrow = scheduleTomorrow(tz, hhmm);
  const mode = await pick(
    "When?",
    [
      { key: "tomorrow", label: `Tomorrow at ${hhmm} (${tz})  ->  ${tomorrow}` },
      { key: "custom", label: `Custom date + time (${tz})` },
    ],
    (m) => m.label,
    0
  );
  let schedule = tomorrow;
  if (mode.key === "custom") {
    const day = await ask("Date (YYYY-MM-DD):");
    const time = await ask("Time (HH:mm):", hhmm);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time))
      throw new Error("Bad date or time format.");
    schedule = scheduleOn(tz, day, time);
  }
  // 4 · recap + confirmation
  console.log("\n--- Recap -------------------------------------------");
  console.log(`  file      ${build.path}`);
  console.log(`  subject   ${subject}`);
  console.log(`  name      ${name}`);
  console.log(`  from      ${product.from}`);
  console.log(`  reply-to  ${product.replyTo}`);
  console.log(`  segment   ${segmentId}`);
  console.log(`  when      ${schedule}`);
  console.log(`  receipt   ${recordPath}`);
  console.log("-----------------------------------------------------");
  const go = await ask('Type "send" to schedule it, "dry" to create without scheduling, anything else aborts:');
  if (go !== "send" && go !== "dry") {
    console.log("Aborted. Nothing was created.");
    return;
  }

  await sendBroadcast({
    apiKey,
    htmlPath: build.path,
    segmentId,
    from: product.from,
    name,
    schedule,
    replyTo: product.replyTo,
    dryRun: go === "dry",
    recordPath,
  });
}

main()
  .catch((err) => {
    console.error("wizard failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
