// node --test email/tools/lib.test.mjs
//
// The send transport with a fake Resend: no network. Adapted from
// firstprinciple's email-tools tests, reduced with the library to a scheduled
// broadcast and its receipt, plus the duplicate guard MEVAR adds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alreadyBroadcast, scheduleOn, sendBroadcast } from "./lib.mjs";

function builtEmail() {
  const dir = mkdtempSync(join(tmpdir(), "email-tools-"));
  const htmlPath = join(dir, "ce-qui-arrive.html");
  writeFileSync(htmlPath, "<p>bonjour</p>");
  writeFileSync(join(dir, "ce-qui-arrive.txt"), "bonjour");
  writeFileSync(join(dir, "ce-qui-arrive.subject.txt"), "Ce qui arrive\n");
  return { htmlPath, recordPath: join(dir, "receipts", "ce-qui-arrive.json") };
}

/** A Resend stand-in that records every write. */
function fakeClient() {
  const calls = [];
  return {
    calls,
    api: async (path, body) => {
      calls.push([path, body]);
      return { id: "b1" };
    },
  };
}

const send = (opts) =>
  sendBroadcast({
    segmentId: "s1",
    from: "MEVAR <publications@example.org>",
    name: "Publications ce-qui-arrive",
    schedule: "2026-09-25T07:00:00+00:00",
    log: () => {},
    ...opts,
  });

test("a receipt on disk stops a second broadcast of the same work", async () => {
  const { recordPath } = builtEmail();
  await send({ ...builtEmail(), recordPath, client: fakeClient() });
  const why = await alreadyBroadcast({ get: async () => ({ data: [] }) }, { name: "Publications x", recordPath });
  assert.match(why, /a receipt exists/);
});

test("a broadcast of the same name at Resend stops a second one; another name does not", async () => {
  const { recordPath } = builtEmail();
  const client = { get: async () => ({ data: [{ id: "b0", name: "Publications x", status: "draft" }] }) };
  assert.match(await alreadyBroadcast(client, { name: "Publications x", recordPath }), /already has broadcast/);
  assert.equal(await alreadyBroadcast(client, { name: "Publications y", recordPath }), null);
});

test("an unreadable broadcast list stops the send", async () => {
  const { recordPath } = builtEmail();
  const why = await alreadyBroadcast({ get: async () => null }, { name: "Publications x", recordPath });
  assert.match(why, /could not be read/);
});

test("the broadcast is scheduled, never sent now, and the receipt records it", async () => {
  const { htmlPath, recordPath } = builtEmail();
  const client = fakeClient();
  await send({ htmlPath, recordPath, client, replyTo: "contact@example.org" });
  assert.equal(client.calls[0][1].reply_to, "contact@example.org");
  assert.equal(client.calls[0][1].audience_id, "s1");
  assert.deepEqual(client.calls[1], ["/broadcasts/b1/send", { scheduled_at: "2026-09-25T07:00:00+00:00" }]);
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(receipt.id, "b1");
  assert.equal(receipt.scheduled_at, "2026-09-25T07:00:00+00:00");
  assert.match(receipt.html_sha256, /^[0-9a-f]{64}$/);
});

test("dry creates the broadcast without scheduling it and writes no receipt", async () => {
  const { htmlPath, recordPath } = builtEmail();
  const client = fakeClient();
  await send({ htmlPath, recordPath, client, dryRun: true });
  assert.deepEqual(client.calls.map(([p]) => p), ["/broadcasts"]);
  assert.throws(() => readFileSync(recordPath));
});

test("the schedule carries the zone's offset", () => {
  assert.equal(scheduleOn("Africa/Abidjan", "2026-09-25", "07:00"), "2026-09-25T07:00:00+00:00");
  assert.equal(scheduleOn("Europe/Zurich", "2026-09-25", "07:00"), "2026-09-25T07:00:00+02:00");
});
