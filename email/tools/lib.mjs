/*
  lib.mjs: the Resend send transport for the "Publications" email (goal 06).
  Copied from firstprinciple's packages/email-tools on 2026-09-24 and reduced;
  never imported across repos. Node built-ins only.

  Consumers: send-test.mjs (`npm run email:test`), wizard.mjs
  (`npm run email:send`). Config: email/email-tools.config.mjs. The key stays
  in the root .env (loaded via node --env-file).
*/
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function flag(args, name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

export async function loadConfig() {
  const { default: config } = await import("../email-tools.config.mjs");
  return { root: resolve(import.meta.dirname, "../.."), ...config };
}

export function requireApiKey(envKey = "RESEND_API_KEY") {
  const key = process.env[envKey];
  if (!key) {
    throw new Error(
      `Set ${envKey}. Run via the root npm scripts (they pass --env-file=.env), ` +
        `or export it in your shell.`
    );
  }
  return key;
}

// Longest a single read-only request may run.
const READ_TIMEOUT_MS = 15000;

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
  // Read-only, and never fatal: a failure here must degrade the RECEIPT (or a
  // wizard listing), not re-raise past a completed send.
  const get = async (path, { timeoutMs = READ_TIMEOUT_MS } = {}) => {
    try {
      const res = await fetch(`https://api.resend.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        // A stalled read must not hold up the receipt after a completed send.
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };
  return { api, get };
}

export async function listSegments(client) {
  const res = await client.get("/segments");
  return Array.isArray(res?.data) ? res.data : null;
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

export async function readIssue(htmlPath) {
  const html = await readFile(resolve(htmlPath), "utf8");
  const text = await readFile(resolve(htmlPath.replace(/\.html$/, ".txt")), "utf8").catch(
    () => undefined
  );
  const subject = (
    await readFile(resolve(htmlPath.replace(/\.html$/, ".subject.txt")), "utf8").catch(() => "")
  ).trim();
  return { html, text, subject };
}

export async function newestBuilds(distDir, limit = 5) {
  const entries = await readdir(distDir).catch(() => []);
  const rows = [];
  for (const f of entries) {
    if (!f.endsWith(".html")) continue;
    const s = await stat(join(distDir, f)).catch(() => null);
    if (s?.isFile()) rows.push({ file: f, path: join(distDir, f), mtimeMs: s.mtimeMs });
  }
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return rows.slice(0, limit);
}

export function tzOffset(date, timeZone) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const off = (part || "GMT+00:00").replace("GMT", "");
  return off === "" ? "+00:00" : off;
}

// "tomorrow at HH:mm" in the given zone, as an ISO-8601 string with the
// zone's offset resolved for that wall time (DST-safe).
export function scheduleTomorrow(timeZone, hhmm) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return scheduleOn(timeZone, next.toISOString().slice(0, 10), hhmm);
}

// The offset is resolved for the requested LOCAL wall time, not for noon, so
// a custom time on a DST-transition day carries the right offset (e.g. Zurich
// 2026-03-29 01:30 is +01:00 even though noon that day is +02:00). Iterative:
// the first guess can shift once applied; real times converge in <= 2 steps,
// and a nonexistent spring-forward time settles on the post-shift offset.
export function scheduleOn(timeZone, day, hhmm) {
  let offset = tzOffset(new Date(`${day}T12:00:00Z`), timeZone);
  for (let i = 0; i < 3; i++) {
    const at = tzOffset(new Date(`${day}T${hhmm}:00${offset}`), timeZone);
    if (at === offset) break;
    offset = at;
  }
  return `${day}T${hhmm}:00${offset}`;
}

async function audienceCounts(client, id) {
  const contacts = await client.get(`/audiences/${id}/contacts`);
  const rows = contacts?.data;
  if (!Array.isArray(rows)) {
    return {
      recipient_count: null,
      recipient_count_note:
        "the audience contact listing could not be read at send time; Resend's broadcast " +
        "object carries no recipient count, so it is not recoverable later",
    };
  }
  // Resend returns every contact in one response when no `limit` is passed
  // (list-contacts docs). If it ever reports more pages, this count is partial:
  // state the gap rather than record an understated number.
  if (contacts.has_more === true) {
    return {
      recipient_count: null,
      recipient_count_note:
        `the audience contact listing was paginated (has_more after ${rows.length} contacts), so the ` +
        "count read at send time is partial; Resend's broadcast object carries no recipient count",
    };
  }
  const subscribed = rows.filter((row) => !row.unsubscribed).length;
  return {
    recipient_count: subscribed,
    recipient_count_note:
      `subscribed contacts in the audience at send time (${rows.length} total, ` +
      `${rows.length - subscribed} unsubscribed); Resend reports no per-broadcast recipient count`,
  };
}

// Statuses after which waiting longer cannot produce a sent_at.
const FAILED_STATUSES = new Set(["failed", "canceled", "cancelled"]);
const SETTLED_STATUSES = new Set(["sent", ...FAILED_STATUSES]);

/*
  Poll the broadcast read-back until Resend confirms the send (sent_at set) or
  the broadcast settles. Resend reports an immediate send as `queued` first:
  firstprinciple's 2026-W37 send confirmed ~45 s after /send, so a single read-back recorded
  sent_at: null and the delivered-record capture refused it.
  The bound is a deadline on a monotonic clock: sleeps are clamped to the time
  left and each read-back's timeout is capped by it, so the wait returns by
  the deadline however slow Resend is.
  Returns the last read-back it got; the caller still decides from sent_at
  alone, so an unconfirmed send stays unconfirmed.
*/
export async function awaitSendConfirmation(
  client,
  id,
  {
    intervalMs = 5000,
    timeoutMs = 180000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => performance.now(),
  } = {}
) {
  const deadline = now() + timeoutMs;
  const left = () => deadline - now();
  // AbortSignal.timeout() throws on a fractional delay, and performance.now()
  // is fractional: round down so the last reads are made, not swallowed.
  const read = () =>
    client.get(`/broadcasts/${id}`, {
      timeoutMs: Math.min(READ_TIMEOUT_MS, Math.max(0, Math.floor(left()))),
    });
  let readBack = await read();
  while (!readBack?.sent_at && !SETTLED_STATUSES.has(readBack?.status)) {
    if (left() <= 0) break;
    await sleep(Math.min(intervalMs, left()));
    if (left() <= 0) break;
    // A failed read-back (network blip) keeps the last answer and keeps waiting.
    readBack = (await read()) ?? readBack;
  }
  return readBack;
}

// The first provisional receipt is written before the audience lookup; if the
// process stops there, this is the stated gap the capture passes on.
const COUNT_NOT_READ = {
  recipient_count: null,
  recipient_count_note:
    "not read: the process stopped after the send, before the audience contact listing was " +
    "read; Resend's broadcast object carries no recipient count",
};

/** Replace the receipt atomically: a reader never sees a half-written file. */
async function writeReceipt(recordPath, receipt) {
  const path = resolve(recordPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(receipt, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

/*
  Create and send/schedule a Resend Broadcast from a built email, and write
  the send receipt (committed under email/receipts/).
*/
export async function sendBroadcast({
  apiKey,
  htmlPath,
  audienceId,
  from,
  name,
  schedule,
  replyTo,
  dryRun,
  recordPath,
  log = console.log,
  client = resendClient(apiKey),
  confirmation = {},
}) {
  const { html, text, subject } = await readIssue(htmlPath);
  if (!subject) throw new Error("Missing subject (<slug>.subject.txt). Rebuild first.");

  const created = await client.api("/broadcasts", {
    audience_id: audienceId,
    from,
    subject,
    name: name || htmlPath,
    html,
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  log(`created broadcast ${created.id}  "${subject}"`);

  if (dryRun) {
    log("--dry-run: not sending. Review + send it from the Resend dashboard.");
    return { id: created.id, sent: false };
  }

  await client.api(`/broadcasts/${created.id}/send`, schedule ? { scheduled_at: schedule } : {});
  log(schedule ? `scheduled for ${schedule}` : "sending now");
  log(`broadcast id: ${created.id}`);

  if (recordPath) {
    // sent_at is the provider's CONFIRMATION that the broadcast went out, never
    // synthesized. An immediate send waits (bounded) for that confirmation. A
    // scheduled broadcast does not wait and leaves it null on purpose; the
    // downstream capture refuses a null and says to re-run after the slot.
    const receiptFor = (readBack, counts, { provisional = false } = {}) => ({
      id: created.id,
      from,
      subject,
      name: name || htmlPath,
      audience_id: audienceId,
      sent_at: readBack?.sent_at ?? null,
      sent_at_source: readBack?.sent_at
        ? "resend.sent_at (confirmed)"
        : provisional
          ? "unconfirmed -- provisional receipt, written before Resend's read-back"
          : schedule
            ? "unconfirmed -- scheduled; re-read after the slot"
            : `unconfirmed -- Resend did not report a send within the wait (last status: ${readBack?.status ?? "unreadable"})`,
      scheduled_at: readBack?.scheduled_at ?? schedule ?? null,
      status: readBack?.status ?? null,
      ...counts,
      html_bytes: Buffer.byteLength(html),
      text_bytes: text === undefined ? null : Buffer.byteLength(text),
      html_sha256: createHash("sha256").update(html).digest("hex"),
      text_sha256: text === undefined ? null : createHash("sha256").update(text).digest("hex"),
      recorded_at: new Date().toISOString(),
    });
    // The broadcast is already out: persist its id and digests NOW, before any
    // further request, so an interruption anywhere after /send still leaves
    // the evidence a capture needs. Then add the count, then the confirmation.
    await writeReceipt(recordPath, receiptFor(null, COUNT_NOT_READ, { provisional: true }));
    const counts = await audienceCounts(client, audienceId);
    await writeReceipt(recordPath, receiptFor(null, counts, { provisional: true }));
    if (!schedule) log("waiting for Resend to confirm the send ...");
    const readBack = schedule
      ? await client.get(`/broadcasts/${created.id}`)
      : await awaitSendConfirmation(client, created.id, confirmation);
    await writeReceipt(recordPath, receiptFor(readBack, counts));
    log(`send receipt -> ${recordPath}`);
    // A broadcast Resend reports failed or cancelled was not delivered and never
    // will be: fail the send, after keeping the receipt as the evidence.
    if (!readBack?.sent_at && FAILED_STATUSES.has(readBack?.status)) {
      throw new Error(
        `broadcast ${created.id} ended "${readBack.status}" at Resend: nothing was delivered. ` +
          `Receipt kept at ${recordPath}.`
      );
    }
  }
  return { id: created.id, sent: true };
}
