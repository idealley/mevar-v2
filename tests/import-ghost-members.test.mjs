// node --test tests/import-ghost-members.test.mjs
//
// scripts/150 against the fixture and an in-memory Resend: the live run
// against a test segment needs a full-access key (DEPLOY.md, email section).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, importMembers } from "../scripts/150-import-ghost-members.mjs";

const rows = parseCsv(fs.readFileSync(new URL("fixtures/members.csv", import.meta.url), "utf8"));
const subscribed = rows.filter((r) => r.subscribed_to_emails === "true");

test("the Ghost CSV parses, quoted commas and newlines included", () => {
  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, "Kouassi, Marie");
  assert.match(rows[0].note, /convention\nde 2021/);
  assert.equal(rows[1].labels, "Import, 2023");
  assert.equal(subscribed.length, 2);
});

test("--send creates the subscribed members once; a rerun writes 0", async () => {
  const contacts = new Map();
  globalThis.fetch = async (url, init = {}) => {
    const { pathname } = new URL(url);
    if ((init.method ?? "GET") === "GET") {
      const email = decodeURIComponent(pathname.split("/").at(-1));
      return new Response("{}", { status: contacts.has(email) ? 200 : 404 });
    }
    assert.equal(pathname, "/audiences/seg1/contacts");
    const body = JSON.parse(init.body);
    contacts.set(body.email, body);
    return new Response("{}", { status: 201 });
  };
  const opts = { apiKey: "re_test", segmentId: "seg1", sleep: async () => {} };

  const first = await importMembers(subscribed, opts);
  assert.deepEqual(first, { written: 2, existing: 0, failed: [] });
  assert.deepEqual([...contacts.keys()], ["marie@example.org", "jean@example.org"]);
  assert.deepEqual(contacts.get("marie@example.org").properties, {
    origin: "ghost-import",
    source: "ghost",
    consented_at: "2021-03-04T10:00:00.000Z",
  });

  const rerun = await importMembers(subscribed, opts);
  assert.deepEqual(rerun, { written: 0, existing: 2, failed: [] });
});

test("a Resend error is counted by status, and the address is not kept", async () => {
  globalThis.fetch = async () => new Response("{}", { status: 429 });
  const counts = await importMembers(subscribed, { apiKey: "k", segmentId: "s", sleep: async () => {} });
  assert.deepEqual(counts, { written: 0, existing: 0, failed: [429, 429] });
});
