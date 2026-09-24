// node --test web/tests/subscribe.test.ts
//
// The signup against an in-memory Resend: no network, no key. The live check
// (wrangler pages dev against the real account) is in DEPLOY.md.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/subscribe.ts";

const env = { RESEND_API_KEY: "re_test", RESEND_SEGMENT_ID: "seg1" };
let contacts: Map<string, { properties: Record<string, string>; segments: Set<string> }>;

beforeEach(() => {
  contacts = new Map();
  globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const byEmail = url.pathname.match(/^\/audiences\/seg1\/contacts\/(.+)$/);
    const join = url.pathname.match(/^\/contacts\/(.+)\/segments\/seg1$/);
    if (byEmail && method === "GET") {
      const c = contacts.get(decodeURIComponent(byEmail[1]));
      if (!c) return new Response("{}", { status: 404 });
      // Resend wraps every stored property as {value, type}.
      const wrapped = Object.fromEntries(
        Object.entries(c.properties).map(([k, v]) => [k, { value: v, type: "string" }]),
      );
      return Response.json({ properties: wrapped });
    }
    if (url.pathname === "/audiences/seg1/contacts" && method === "POST") {
      contacts.set(body.email, { properties: body.properties, segments: new Set(["seg1"]) });
      return Response.json({ id: "c1" }, { status: 201 });
    }
    if (byEmail && method === "PATCH") {
      const c = contacts.get(decodeURIComponent(byEmail[1]))!;
      for (const v of Object.values(body.properties)) assert.equal(typeof v, "string", "PATCH takes bare values");
      c.properties = body.properties;
      return Response.json({ id: "c1" });
    }
    if (join && method === "POST") {
      contacts.get(decodeURIComponent(join[1]))!.segments.add("seg1");
      return Response.json({ id: "seg1" }, { status: 201 });
    }
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
});

const post = (body: unknown) =>
  onRequestPost({
    request: new Request("https://mevar.org/api/subscribe", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  });

test("a valid address creates the contact in the segment with its properties", async () => {
  const res = await post({ email: "Lecteur@Example.org ", origin: "newsletter-page" });
  assert.equal(res.status, 200);
  const c = contacts.get("lecteur@example.org")!;
  assert.deepEqual([...c.segments], ["seg1"]);
  assert.equal(c.properties.origin, "newsletter-page");
  assert.equal(c.properties.source, "site");
  assert.match(c.properties.consented_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("an invalid address or body is a 400 and never reaches Resend", async () => {
  for (const body of [{ email: "pas-une-adresse" }, {}, "not json"]) {
    const res = await post(body);
    assert.equal(res.status, 400);
  }
  assert.equal(contacts.size, 0);
});

test("a second signup does not duplicate the contact nor wipe its properties", async () => {
  contacts.set("membre@example.org", {
    properties: { origin: "ghost-import", source: "ghost", consented_at: "2021-03-04T10:00:00.000Z", note: "kept" },
    segments: new Set(),
  });
  const res = await post({ email: "membre@example.org" });
  assert.equal(res.status, 200);
  assert.equal(contacts.size, 1);
  const c = contacts.get("membre@example.org")!;
  assert.equal(c.properties.note, "kept");
  assert.equal(c.properties.origin, "newsletter-footer");
  assert.deepEqual([...c.segments], ["seg1"]);
});

test("a Resend failure is a 502, not a false success", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 401 })) as typeof fetch;
  const res = await post({ email: "lecteur@example.org" });
  assert.equal(res.status, 502);
});
