#!/usr/bin/env node
/*
  wizard.mjs: the interactive send. `npm run email:send` from the repo root.

  Walks through: newest built email -> the duplicate check (a receipt, or a
  broadcast of the same name at Resend, stops here) -> live segment pick
  (RESEND_SEGMENT_ID preselected) -> schedule (default: tomorrow at the
  configured time) -> recap -> type "send" to fire, "dry" to create the
  broadcast without sending. Writes the receipt to email/receipts/<slug>.json;
  commit it.

  The broadcast is named "Publications <slug>", never typed: the name is what
  the duplicate check looks for at Resend.
*/
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join, basename } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  loadConfig,
  requireApiKey,
  resendClient,
  listSegments,
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
  const apiKey = requireApiKey(config.envKey);
  const client = resendClient(apiKey);

  // 1 · built email (newest first)
  const distDir = join(config.root, product.distDir);
  const builds = await newestBuilds(distDir);
  if (builds.length === 0) throw new Error(`No built .html in ${distDir}. Run email/build.mjs first.`);
  const fmt = (b) =>
    `${b.file}  (built ${new Date(b.mtimeMs).toLocaleString("fr-FR", { timeZone: tz })})`;
  const build = await pick("Which email?", builds, fmt, 0);
  const { subject } = await readIssue(build.path);
  if (!subject) throw new Error(`Missing ${build.file.replace(/\.html$/, ".subject.txt")}. Rebuild first.`);
  const slug = basename(build.file, ".html");
  const name = `${product.label} ${slug}`;
  const recordDir = join(config.root, product.recordDir);
  const recordPath = join(recordDir, `${slug}.json`);

  // 2 · never twice
  const why = await alreadyBroadcast(client, { name, recordPath });
  if (why) throw new Error(`Not sending "${subject}": ${why}.`);

  // 3 · segment, fetched live; falls back to manual entry if the API is unreachable
  let audienceId;
  let audienceLabel;
  const segments = await listSegments(client);
  if (segments && segments.length > 0) {
    const defIdx = Math.max(0, segments.findIndex((s) => s.id === process.env.RESEND_SEGMENT_ID));
    const chosen = await pick("Which segment?", segments, (s) => `${s.name}  (${s.id})`, defIdx);
    audienceId = chosen.id;
    audienceLabel = chosen.name;
  } else {
    console.log("\nCould not list segments from the Resend API.");
    audienceId = await ask("Segment id:", process.env.RESEND_SEGMENT_ID || undefined);
    audienceLabel = audienceId;
    if (!audienceId) throw new Error("A segment id is required.");
  }

  // 4 · schedule
  const hhmm = product.defaultSendTime;
  const tomorrow = scheduleTomorrow(tz, hhmm);
  const mode = await pick(
    "When?",
    [
      { key: "tomorrow", label: `Tomorrow at ${hhmm} (${tz})  ->  ${tomorrow}` },
      { key: "now", label: "Send now" },
      { key: "custom", label: `Custom date + time (${tz})` },
    ],
    (m) => m.label,
    0
  );
  let schedule;
  if (mode.key === "tomorrow") schedule = tomorrow;
  if (mode.key === "custom") {
    const day = await ask("Date (YYYY-MM-DD):");
    const time = await ask("Time (HH:mm):", hhmm);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time))
      throw new Error("Bad date or time format.");
    schedule = scheduleOn(tz, day, time);
  }
  await mkdir(recordDir, { recursive: true });

  // 5 · recap + confirmation
  console.log("\n--- Recap -------------------------------------------");
  console.log(`  file      ${build.path}`);
  console.log(`  subject   ${subject}`);
  console.log(`  name      ${name}`);
  console.log(`  from      ${product.from}`);
  console.log(`  reply-to  ${product.replyTo}`);
  console.log(`  segment   ${audienceLabel}  (${audienceId})`);
  console.log(`  when      ${schedule || "send immediately"}`);
  console.log(`  receipt   ${recordPath}`);
  console.log("-----------------------------------------------------");
  const go = await ask('Type "send" to proceed, "dry" to create without sending, anything else aborts:');
  if (go !== "send" && go !== "dry") {
    console.log("Aborted. Nothing was created.");
    return;
  }

  await sendBroadcast({
    apiKey,
    htmlPath: build.path,
    audienceId,
    from: product.from,
    name,
    schedule,
    replyTo: product.replyTo,
    dryRun: go === "dry",
    recordPath: go === "dry" ? undefined : recordPath,
  });
}

main()
  .catch((err) => {
    console.error("wizard failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
