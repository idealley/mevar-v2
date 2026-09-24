// node --test email/tools/lib.test.mjs
//
// The send receipt's sent_at is Resend's confirmation that the broadcast went
// out. Resend reports an immediate send as `queued` first and sets sent_at
// tens of seconds later (firstprinciple 2026-W37: ~45 s), so a single read-back straight after
// /send records null and the delivered-record capture refuses it. These tests
// pin the bounded wait, with a fake client and a fake sleep: no network, no
// real waiting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alreadyBroadcast, awaitSendConfirmation, sendBroadcast } from "./lib.mjs";

test("a receipt on disk stops a second broadcast of the same work", async () => {
  const { recordPath } = builtIssue();
  writeFileSync(recordPath, "{}");
  const why = await alreadyBroadcast(fakeClient([]), { name: "Publications x", recordPath });
  assert.match(why, /a receipt exists/);
});

test("a broadcast of the same name at Resend stops a second one; another name does not", async () => {
  const { recordPath } = builtIssue();
  const client = { get: async () => ({ data: [{ id: "b0", name: "Publications x", status: "draft" }] }) };
  assert.match(await alreadyBroadcast(client, { name: "Publications x", recordPath }), /already has broadcast/);
  assert.equal(await alreadyBroadcast(client, { name: "Publications y", recordPath }), null);
});

test("an unreadable broadcast list stops the send", async () => {
  const { recordPath } = builtIssue();
  const why = await alreadyBroadcast({ get: async () => null }, { name: "Publications x", recordPath });
  assert.match(why, /could not be read/);
});

test("a paginated contact listing gives a stated gap, not a partial count", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const inner = fakeClient([SENT]);
  const client = {
    ...inner,
    get: async (path, opts) =>
      path === "/audiences/a1/contacts"
        ? { object: "list", has_more: true, data: [{ unsubscribed: false }] }
        : inner.get(path, opts),
  };
  const clock = recordingSleep();
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    recordPath,
    client,
    confirmation: { sleep: clock.sleep, now: clock.now },
    log: () => {},
  });
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(receipt.recipient_count, null);
  assert.match(receipt.recipient_count_note, /paginated/);
});

function builtIssue() {
  const dir = mkdtempSync(join(tmpdir(), "email-tools-"));
  const htmlPath = join(dir, "2026-W37.html");
  writeFileSync(htmlPath, "<p>hello</p>");
  writeFileSync(join(dir, "2026-W37.txt"), "hello");
  writeFileSync(join(dir, "2026-W37.subject.txt"), "The Brief W37\n");
  return { dir, htmlPath, recordPath: join(dir, "2026-W37.send-receipt.json") };
}

/** A Resend stand-in: each GET of the broadcast returns the next read-back. */
function fakeClient(readBacks) {
  const calls = { api: [], broadcastGets: 0 };
  return {
    calls,
    api: async (path, body) => {
      calls.api.push([path, body]);
      return { id: "b1" };
    },
    get: async (path) => {
      if (path === "/audiences/a1/contacts") {
        return { data: [{ unsubscribed: false }, { unsubscribed: false }, { unsubscribed: true }] };
      }
      if (path === "/broadcasts/b1") {
        const next = readBacks[Math.min(calls.broadcastGets, readBacks.length - 1)];
        calls.broadcastGets += 1;
        return next;
      }
      return null;
    },
  };
}

const QUEUED = { id: "b1", status: "queued", sent_at: null, scheduled_at: null };
const SENT = { id: "b1", status: "sent", sent_at: "2026-09-14 10:50:46.792281+00", scheduled_at: null };

/** A fake clock: sleeping advances it, nothing really waits. */
function recordingSleep() {
  const slept = [];
  const clock = { t: 0 };
  return {
    slept,
    clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock.t += ms;
    },
    now: () => clock.t,
  };
}

test("an immediate send waits for Resend's confirmed sent_at before writing the receipt", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const client = fakeClient([QUEUED, QUEUED, SENT]);
  const { slept, sleep, now } = recordingSleep();
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    name: "The Brief 2026-W37",
    recordPath,
    client,
    confirmation: { intervalMs: 5000, timeoutMs: 180000, sleep, now },
    log: () => {},
  });
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(receipt.sent_at, SENT.sent_at, "sent_at is the provider's confirmation");
  assert.match(receipt.sent_at_source, /confirmed/);
  assert.deepEqual(slept, [5000, 5000], "polled until confirmed, then stopped");
  assert.equal(receipt.recipient_count, 2);
});

test("a send Resend never confirms within the bound still writes sent_at: null", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const client = fakeClient([QUEUED]);
  const { slept, sleep, now } = recordingSleep();
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    recordPath,
    client,
    confirmation: { intervalMs: 5000, timeoutMs: 20000, sleep, now },
    log: () => {},
  });
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(receipt.sent_at, null, "never synthesized: an unconfirmed send stays null");
  assert.match(receipt.sent_at_source, /unconfirmed/);
  assert.equal(slept.reduce((a, b) => a + b, 0), 20000, "the wait is bounded");
});

test("a scheduled send does not wait: its slot is not a delivery", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const client = fakeClient([{ ...QUEUED, status: "scheduled", scheduled_at: "2026-09-21 04:45:00+00" }]);
  const { slept, sleep, now } = recordingSleep();
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    schedule: "2026-09-21T06:45:00+02:00",
    recordPath,
    client,
    confirmation: { intervalMs: 5000, timeoutMs: 180000, sleep, now },
    log: () => {},
  });
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.deepEqual(slept, []);
  assert.equal(client.calls.broadcastGets, 1);
  assert.equal(receipt.sent_at, null);
  assert.deepEqual(client.calls.api[1], ["/broadcasts/b1/send", { scheduled_at: "2026-09-21T06:45:00+02:00" }]);
});

test("a provisional receipt is on disk before the wait, so an interrupted wait loses nothing", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const clock = recordingSleep();
  const duringWait = [];
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    recordPath,
    client: fakeClient([QUEUED, SENT]),
    confirmation: {
      intervalMs: 5000,
      timeoutMs: 180000,
      now: clock.now,
      sleep: async (ms) => {
        duringWait.push(JSON.parse(readFileSync(recordPath, "utf8")));
        await clock.sleep(ms);
      },
    },
    log: () => {},
  });
  assert.equal(duringWait.length, 1);
  assert.equal(duringWait[0].id, "b1");
  assert.equal(duringWait[0].sent_at, null);
  assert.match(duringWait[0].sent_at_source, /provisional/);
  assert.equal(duringWait[0].recipient_count, 2);
  assert.match(duringWait[0].html_sha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.parse(readFileSync(recordPath, "utf8")).sent_at, SENT.sent_at, "then replaced by the confirmation");
});

test("the receipt is on disk before the audience lookup, the first request after /send", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const inner = fakeClient([SENT]);
  let atLookup;
  const client = {
    ...inner,
    get: async (path, opts) => {
      if (path === "/audiences/a1/contacts") atLookup = JSON.parse(readFileSync(recordPath, "utf8"));
      return inner.get(path, opts);
    },
  };
  const clock = recordingSleep();
  await sendBroadcast({
    htmlPath,
    audienceId: "a1",
    from: "Brief <brief@example.com>",
    recordPath,
    client,
    confirmation: { sleep: clock.sleep, now: clock.now },
    log: () => {},
  });
  assert.equal(atLookup.id, "b1");
  assert.match(atLookup.html_sha256, /^[0-9a-f]{64}$/);
  assert.equal(atLookup.recipient_count, null, "no count yet: a stated gap, never a guess");
  assert.match(atLookup.recipient_count_note, /not read/);
  assert.equal(JSON.parse(readFileSync(recordPath, "utf8")).recipient_count, 2);
});

test("no read-back outlives the deadline: each request is capped by the time left", async () => {
  const clock = recordingSleep();
  const timeouts = [];
  // A Resend that never answers: every request hangs until its timeout.
  const hung = {
    get: async (_path, opts) => {
      timeouts.push({ timeoutMs: opts?.timeoutMs, left: 60000 - clock.clock.t });
      clock.clock.t += opts?.timeoutMs ?? 10 ** 9;
      return null;
    },
  };
  await awaitSendConfirmation(hung, "b1", { intervalMs: 5000, timeoutMs: 60000, sleep: clock.sleep, now: clock.now });
  assert.ok(clock.clock.t <= 60000, `returned at ${clock.clock.t} ms, past the 60 s bound`);
  assert.ok(timeouts.length > 1);
  for (const { timeoutMs, left } of timeouts) {
    assert.ok(timeoutMs <= left && timeoutMs <= 15000, `a ${timeoutMs} ms read with ${left} ms left`);
  }
});

test("the wait stops at a terminal status and survives a failed read-back", async () => {
  const { sleep, slept, now } = recordingSleep();
  const failed = await awaitSendConfirmation(fakeClient([QUEUED, null, { ...QUEUED, status: "failed" }]), "b1", {
    intervalMs: 1000,
    timeoutMs: 60000,
    sleep,
    now,
  });
  assert.equal(failed.status, "failed");
  assert.equal(slept.length, 2, "a null read-back (network blip) keeps polling rather than ending the wait");
});

test("read-back timeouts are whole milliseconds, even on a fractional clock", async () => {
  // AbortSignal.timeout(1.5) throws ERR_OUT_OF_RANGE, which get() would
  // swallow as a null read: the last reads before the deadline would never run.
  const clock = recordingSleep();
  const timeouts = [];
  const client = {
    get: async (_path, opts) => {
      timeouts.push(opts?.timeoutMs);
      clock.clock.t += 1000;
      return QUEUED;
    },
  };
  await awaitSendConfirmation(client, "b1", {
    intervalMs: 5000,
    timeoutMs: 12345.678,
    sleep: clock.sleep,
    now: () => clock.clock.t + 0.25,
  });
  assert.ok(timeouts.length > 1);
  for (const ms of timeouts) assert.ok(Number.isInteger(ms), `timeout ${ms} is not an integer`);
});

test("a broadcast Resend reports failed fails the send, after writing the receipt", async () => {
  const { htmlPath, recordPath } = builtIssue();
  const clock = recordingSleep();
  await assert.rejects(
    sendBroadcast({
      htmlPath,
      audienceId: "a1",
      from: "Brief <brief@example.com>",
      recordPath,
      client: fakeClient([QUEUED, { ...QUEUED, status: "failed" }]),
      confirmation: { intervalMs: 5000, timeoutMs: 180000, sleep: clock.sleep, now: clock.now },
      log: () => {},
    }),
    /broadcast b1 ended "failed" at Resend: nothing was delivered/,
  );
  const receipt = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(receipt.status, "failed");
  assert.equal(receipt.sent_at, null);
});
