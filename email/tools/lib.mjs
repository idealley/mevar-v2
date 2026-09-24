/*
  lib.mjs: the Resend send transport for the "Publications" email (goal 06).
  Copied from firstprinciple's packages/email-tools on 2026-09-24 and reduced
  to a scheduled broadcast to one segment; never imported across repos. Node
  built-ins only.

  Consumers: send-test.mjs (`npm run email:test`), wizard.mjs
  (`npm run email:send`). Config: email/email-tools.config.mjs. The key and
  the segment id stay in the root .env (loaded via node --env-file).
*/
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export async function loadConfig() {
  const { default: config } = await import("../email-tools.config.mjs");
  return { root: resolve(import.meta.dirname, "../.."), ...config };
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in the root .env (the npm scripts pass --env-file=.env).`);
  return value;
}

export function resendClient(apiKey) {
  const api = async (path, body) => {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${path} -> ${res.status}: ${JSON.stringify(json)}`);
    return json;
  };
  // Read-only, and never fatal: a failure here must degrade the receipt, not
  // re-raise past a broadcast that is already scheduled.
  const get = async (path) => {
    try {
      const res = await fetch(`https://api.resend.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };
  return { api, get };
}

/*
  Never two broadcasts for the same work. A receipt on disk means it was sent
  from this repo; a broadcast of the same name at Resend means it was created
  (sent, scheduled or left as a draft) from anywhere. Either one stops the
  send. An unreadable broadcast list stops it too: not knowing is not "no".
*/
export async function alreadyBroadcast(client, { name, recordPath }) {
  if (existsSync(recordPath)) return `a receipt exists: ${recordPath}`;
  const res = await client.get("/broadcasts");
  if (!Array.isArray(res?.data)) return "the Resend broadcast list could not be read";
  const same = res.data.find((b) => b.name === name);
  return same ? `Resend already has broadcast "${name}" (${same.id}, ${same.status})` : null;
}

/** email/build.mjs always writes the three files. */
export async function readIssue(htmlPath) {
  const read = (ext) => readFile(htmlPath.replace(/\.html$/, ext), "utf8");
  return { html: await read(".html"), text: await read(".txt"), subject: (await read(".subject.txt")).trim() };
}

export async function newestBuilds(distDir, limit = 5) {
  const files = (await readdir(distDir).catch(() => [])).filter((f) => f.endsWith(".html"));
  const rows = await Promise.all(
    files.map(async (file) => ({ file, path: join(distDir, file), mtimeMs: (await stat(join(distDir, file))).mtimeMs }))
  );
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}

/** "YYYY-MM-DD" at "HH:mm" in the zone, as ISO-8601 with the zone's offset at that time. */
export function scheduleOn(timeZone, day, hhmm) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${day}T${hhmm}:00Z`))
    .find((p) => p.type === "timeZoneName").value;
  const offset = part.replace("GMT", "") || "+00:00";
  return `${day}T${hhmm}:00${offset}`;
}

export function scheduleTomorrow(timeZone, hhmm) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return scheduleOn(timeZone, next.toISOString().slice(0, 10), hhmm);
}

async function segmentCounts(client, id) {
  const contacts = await client.get(`/audiences/${id}/contacts`);
  const rows = contacts?.data;
  if (!Array.isArray(rows)) {
    return {
      recipient_count: null,
      recipient_count_note:
        "the segment contact listing could not be read at send time; Resend's broadcast " +
        "object carries no recipient count, so it is not recoverable later",
    };
  }
  // Resend returns every contact in one response when no `limit` is passed.
  // If it ever reports more pages, this count is partial: state the gap
  // rather than record an understated number.
  if (contacts.has_more === true) {
    return {
      recipient_count: null,
      recipient_count_note:
        `the segment contact listing was paginated (has_more after ${rows.length} contacts), so the ` +
        "count read at send time is partial; Resend's broadcast object carries no recipient count",
    };
  }
  const subscribed = rows.filter((row) => !row.unsubscribed).length;
  return {
    recipient_count: subscribed,
    recipient_count_note:
      `subscribed contacts in the segment at send time (${rows.length} total, ` +
      `${rows.length - subscribed} unsubscribed); Resend reports no per-broadcast recipient count`,
  };
}

// The first receipt is written before the segment lookup; if the process
// stops there, this is the stated gap.
const COUNT_NOT_READ = {
  recipient_count: null,
  recipient_count_note:
    "not read: the process stopped after scheduling, before the segment contact listing was " +
    "read; Resend's broadcast object carries no recipient count",
};

/** Replace the receipt atomically: a reader never sees a half-written file. */
async function writeReceipt(recordPath, receipt) {
  await mkdir(dirname(recordPath), { recursive: true });
  await writeFile(`${recordPath}.tmp`, `${JSON.stringify(receipt, null, 2)}\n`);
  await rename(`${recordPath}.tmp`, recordPath);
}

/*
  Create a Resend Broadcast from a built email and schedule it, then write the
  receipt (committed under email/receipts/). `dryRun` creates it without
  scheduling, to review or test-send from the dashboard; no receipt then.
*/
export async function sendBroadcast({
  apiKey,
  htmlPath,
  segmentId,
  from,
  name,
  schedule,
  replyTo,
  dryRun,
  recordPath,
  log = console.log,
  client = resendClient(apiKey),
}) {
  const { html, text, subject } = await readIssue(htmlPath);

  const created = await client.api("/broadcasts", {
    audience_id: segmentId,
    from,
    subject,
    name,
    html,
    text,
    reply_to: replyTo,
  });
  log(`created broadcast ${created.id}  "${subject}"`);

  if (dryRun) {
    log("dry: not scheduled. Review, test and send it from the Resend dashboard.");
    return { id: created.id, sent: false };
  }

  await client.api(`/broadcasts/${created.id}/send`, { scheduled_at: schedule });
  log(`scheduled for ${schedule}, broadcast id ${created.id}`);

  const receiptFor = (readBack, counts) => ({
    id: created.id,
    from,
    subject,
    name,
    segment_id: segmentId,
    scheduled_at: readBack?.scheduled_at ?? schedule,
    status: readBack?.status ?? null,
    ...counts,
    html_bytes: Buffer.byteLength(html),
    text_bytes: Buffer.byteLength(text),
    html_sha256: createHash("sha256").update(html).digest("hex"),
    text_sha256: createHash("sha256").update(text).digest("hex"),
    recorded_at: new Date().toISOString(),
  });
  // The broadcast is already scheduled: persist its id and digests NOW, before
  // any further request, so an interruption still leaves the evidence and the
  // duplicate guard sees it. Then add the count, then Resend's read-back.
  await writeReceipt(recordPath, receiptFor(null, COUNT_NOT_READ));
  const counts = await segmentCounts(client, segmentId);
  await writeReceipt(recordPath, receiptFor(null, counts));
  const readBack = await client.get(`/broadcasts/${created.id}`);
  await writeReceipt(recordPath, receiptFor(readBack, counts));
  log(`receipt -> ${recordPath}`);
  // A broadcast Resend reports failed or cancelled will never go out: fail,
  // after keeping the receipt as the evidence.
  if (["failed", "canceled", "cancelled"].includes(readBack?.status)) {
    throw new Error(`broadcast ${created.id} is "${readBack.status}" at Resend. Receipt kept at ${recordPath}.`);
  }
  return { id: created.id, sent: true };
}
