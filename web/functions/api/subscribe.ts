/*
  Cloudflare Pages Function: POST /api/subscribe

  The "Publications" newsletter signup (goal 06). One list: the Resend segment
  RESEND_SEGMENT_ID, in MEVAR's own Resend account. The form posts
  { email, origin } as JSON; origin says which form it was
  ("newsletter-footer" or "newsletter-page").

  The three helpers below are copied and reduced from firstprinciple's
  packages/ui/server/resend.ts. Copied, not shared: the two repos never import
  each other.

  Testing locally: `astro dev` does not run Pages Functions, every POST here
  gets Astro's 404. Build, then `npx wrangler@4 pages dev dist` from web/.
  Without network, `node --test web/tests/subscribe.test.ts`.
*/

const RESEND = "https://api.resend.com";

interface Env {
  RESEND_API_KEY: string;
  RESEND_SEGMENT_ID: string;
}

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

/*
  Create the contact in the segment, or update it without losing what it has.

  Not a single POST, for two reasons verified against the live API by
  firstprinciple (2026-08-21):
  - POST on an existing email answers success and ignores the payload. So GET
    first: missing, POST under /audiences/{segment}/contacts (Audiences are
    aliased onto Segments, the same id; creating under it is what grants
    membership). Existing, PATCH.
  - GET returns properties wrapped as {value, type}; PATCH rejects the
    wrapper. The stored ones are unwrapped and merged under the new ones, so
    a second signup never wipes what the first (or the Ghost import) wrote.
  PATCH does not carry segments, so an existing contact joins with its own
  call (not audience-scoped: prefixed, it is a 405).

  Returns false when any call fails: the contact is the subscription, so the
  reader must not be told they subscribed when they did not.
*/
async function upsertContact(
  env: Env,
  email: string,
  properties: Record<string, string>,
): Promise<boolean> {
  const headers = {
    authorization: `Bearer ${env.RESEND_API_KEY}`,
    "content-type": "application/json",
  };
  const base = `${RESEND}/audiences/${env.RESEND_SEGMENT_ID}/contacts`;
  const byEmail = `${base}/${encodeURIComponent(email)}`;

  const existing = await fetch(byEmail, { headers });
  if (existing.status === 404) {
    const created = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, unsubscribed: false, properties }),
    });
    return created.ok;
  }
  if (!existing.ok) return false;

  const stored: Record<string, unknown> = {};
  const { properties: wrapped = {} } = (await existing.json()) as {
    properties?: Record<string, { value: unknown }>;
  };
  for (const [k, v] of Object.entries(wrapped)) stored[k] = v.value;

  const patched = await fetch(byEmail, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ unsubscribed: false, properties: { ...stored, ...properties } }),
  });
  const joined = await fetch(
    `${RESEND}/contacts/${encodeURIComponent(email)}/segments/${env.RESEND_SEGMENT_ID}`,
    { method: "POST", headers },
  );
  return patched.ok && joined.ok;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; origin?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return json({ ok: false, error: "invalid_email" }, 400);

  const origin = body.origin === "newsletter-page" ? "newsletter-page" : "newsletter-footer";
  const ok = await upsertContact(env, email, {
    origin,
    source: "site",
    consented_at: new Date().toISOString(),
  });
  return ok ? json({ ok: true }) : json({ ok: false, error: "subscribe_failed" }, 502);
}
