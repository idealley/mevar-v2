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
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
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
  // Read-only, and never fatal: the caller decides what a null means.
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

export async function newestBuilds(distDir) {
  const files = (await readdir(distDir).catch(() => [])).filter((f) => f.endsWith(".html"));
  const rows = await Promise.all(
    files.map(async (file) => ({ file, path: join(distDir, file), mtimeMs: (await stat(join(distDir, file))).mtimeMs }))
  );
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 5);
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

/*
  Create a Resend Broadcast from a built email and schedule it, then write the
  receipt (committed under email/receipts/). `dryRun` creates it without
  scheduling, to review or test-send from the dashboard; no receipt then.
*/
export async function sendBroadcast({ client, htmlPath, segmentId, from, name, schedule, replyTo, dryRun, recordPath, log = console.log }) {
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
    return;
  }

  await client.api(`/broadcasts/${created.id}/send`, { scheduled_at: schedule });
  await mkdir(dirname(recordPath), { recursive: true });
  await writeFile(
    recordPath,
    `${JSON.stringify(
      {
        id: created.id,
        name,
        subject,
        from,
        segment_id: segmentId,
        scheduled_at: schedule,
        html_sha256: createHash("sha256").update(html).digest("hex"),
        text_sha256: createHash("sha256").update(text).digest("hex"),
        recorded_at: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
  log(`scheduled for ${schedule}, receipt -> ${recordPath}`);
}
