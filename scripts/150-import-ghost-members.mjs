#!/usr/bin/env node
// The Ghost members who asked for the newsletter become contacts in MEVAR's
// Resend segment (goal 06). Samuel runs it, once, at the cutover:
//
//   node scripts/150-import-ghost-members.mjs <members.csv>                    # dry run
//   node --env-file=.env scripts/150-import-ghost-members.mjs <members.csv> --send
//
// The CSV is Ghost Admin, Members, Export. It is personal data: it stays where
// Samuel saved it, is passed by path, and this script prints counts only,
// never an address. The fixture is tests/fixtures/members.csv.
//
// A member is kept when `subscribed_to_emails` is true: MEVAR's two Ghost
// newsletters are both active and merge into "Publications", and Ghost sets
// the flag when a member is subscribed to any of them.
//
// A member already in Resend is left alone (a reader who unsubscribed there
// stays unsubscribed), so a rerun writes 0. Resend allows 2 requests a second
// per key by default; each member costs one or two.

import fs from "node:fs";

const RESEND = "https://api.resend.com";
const GAP_MS = 600;

/** RFC 4180: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text) {
  const rows = [[]];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") rows.at(-1).push(field), (field = "");
    else if (c === "\n") rows.at(-1).push(field.replace(/\r$/, "")), rows.push([]), (field = "");
    else field += c;
  }
  rows.at(-1).push(field);
  const [header, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export async function importMembers(members, { apiKey, segmentId, sleep }) {
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
  const base = `${RESEND}/audiences/${segmentId}/contacts`;
  const counts = { written: 0, existing: 0, failed: [] };
  for (const m of members) {
    const email = m.email.trim().toLowerCase();
    const found = await fetch(`${base}/${encodeURIComponent(email)}`, { headers });
    await sleep(GAP_MS);
    if (found.ok) {
      counts.existing++;
      continue;
    }
    if (found.status !== 404) {
      counts.failed.push(found.status);
      continue;
    }
    const created = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        unsubscribed: false,
        properties: { origin: "ghost-import", source: "ghost", consented_at: m.created_at },
      }),
    });
    await sleep(GAP_MS);
    if (created.ok) counts.written++;
    else counts.failed.push(created.status);
  }
  return counts;
}

if (import.meta.main) {
  const [csvPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const send = process.argv.includes("--send");
  if (!csvPath) {
    console.error("usage: node scripts/150-import-ghost-members.mjs <members.csv> [--send]");
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  for (const col of ["email", "subscribed_to_emails", "created_at"]) {
    if (rows.length && !(col in rows[0])) throw new Error(`no "${col}" column: is this Ghost's members export?`);
  }
  const subscribed = rows.filter((r) => r.subscribed_to_emails === "true");

  let counts = { written: 0, existing: 0, failed: [] };
  if (send) {
    const { RESEND_API_KEY: apiKey, RESEND_SEGMENT_ID: segmentId } = process.env;
    if (!apiKey || !segmentId) throw new Error("set RESEND_API_KEY and RESEND_SEGMENT_ID (node --env-file=.env)");
    counts = await importMembers(subscribed, {
      apiKey,
      segmentId,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
  }
  console.log(`${rows.length} read, ${subscribed.length} subscribed, ${counts.written} written`);
  if (send) console.log(`${counts.existing} already in Resend, ${counts.failed.length} failed`);
  else console.log("dry run: nothing sent to Resend. Add --send to write.");
  if (counts.failed.length) {
    console.log(`failed with HTTP ${[...new Set(counts.failed)].join(", ")}; rerun to retry them`);
    process.exitCode = 1;
  }
}
