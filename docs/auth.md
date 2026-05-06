# Authentication wiring (Logto + SurrealDB v3)

**Current state**: schema is ready, no end-user auth wired yet.
**Goal**: end users sign up / log in via Logto, JWT issued with namespaced custom claims, SurrealDB verifies the JWT and applies record-level permissions on user-specific tables (`progress`, `bookmarked`, `annotated`).

## What's already in place

### In `surreal/schema.surql`

```surql
DEFINE TABLE OVERWRITE user SCHEMAFULL
  PERMISSIONS
    FOR select WHERE id = $auth.id OR "admin" IN $token.roles
    FOR update WHERE id = $auth.id;
DEFINE FIELD email ON user TYPE option<string>;
DEFINE FIELD name ON user TYPE option<string>;
DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() READONLY;

DEFINE TABLE bookmarked TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, delete WHERE in = $auth.id;

DEFINE TABLE completed TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = $auth.id;
DEFINE FIELD progress ON completed TYPE float DEFAULT 0.0;
DEFINE FIELD completed_at ON completed TYPE option<datetime>;

DEFINE TABLE annotated TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = $auth.id;
DEFINE FIELD note ON annotated TYPE string;
DEFINE FIELD anchor ON annotated TYPE option<string>;
```

These tables enforce record-level access via PERMISSIONS clauses. **Today they reference `$auth.id`** — that needs to be updated to use `type::record($token.app_sub)` once Logto's custom claims are wired (see below).

### Skill knowledge

The two reference skills capture v3 / Logto specifics:

- `~/.claude/skills/surrealdb/references/auth-jwt.md` — v3 syntax (`TYPE RECORD WITH JWT`, `AUTHENTICATE` block, `ns/db/ac` claims, KEY-can't-be-parameterised)
- `~/.claude/skills/logto/references/jwt-and-claims.md` — ESM-only custom-claims runtime, immutable standard claims, namespaced shape

## Next steps to wire it up

### Step 1 — Spin up Logto (cloud or self-hosted)

**Option A: Logto Cloud (free tier, fastest)**

1. Sign up at https://cloud.logto.io
2. Create a tenant — get the endpoint URL (`https://<your-tenant>.logto.app`)

**Option B: Self-hosted (Docker)**

```bash
docker compose up -d   # uses logto's official compose
# admin at http://localhost:3002, app sign-in at http://localhost:3001
```

### Step 2 — Create a Single Page App application

In Logto admin → Applications → Create:
- Type: **Single Page App** (SPA)
- Redirect URIs: `https://your-frontend.example.com/auth/callback`
- Post-logout redirect URIs: `https://your-frontend.example.com/`
- Save the `App ID` (no secret for SPA)

### Step 3 — Create a Resource

In Logto admin → API resources → Create:
- API Identifier: `https://api.revelation.example.com` (must match `aud` claim verification)
- Add scopes: `read:works`, `write:progress`, `write:annotations`

### Step 4 — Configure custom token claims

In Logto admin → Developers → Custom token claims (access_token script):

```js
// ESM only — top-level const, no exports.
const getCustomJwtClaims = async ({ token, context, environmentVariables, api }) => {
  return {
    app_sub: `user:${context.user.id}`,           // SurrealDB-shaped record id (sub itself is immutable)
    app_roles: context.user.roles?.map((r) => r.name) ?? [],
    email_verified: context.user.primaryEmailVerified,
  };
};
```

> **Token routing claims for SurrealDB** — Logto Cloud doesn't natively emit `ns`/`db`/`ac` in the JWT. Two options:
>
> **A**. Inject them via the same custom-claims script (Logto allows arbitrary keys other than the immutable standard set):
>
> ```js
> return {
>   app_sub: `user:${context.user.id}`,
>   app_roles: ...,
>   ns: "revelation", db: "main", ac: "user",
> };
> ```
>
> Then verify in SurrealDB. If SurrealDB complains the claims must be at top level (not custom), we use option B.
>
> **B**. Front-channel: your backend issues a short-lived "exchange" token. The frontend swaps the Logto access_token for a SurrealDB-routable JWT signed with a shared secret. Adds an extra request per session but bypasses Logto's claim restrictions. Not necessary if option A works.

### Step 5 — Define SurrealDB record-level access

```surql
-- Replace the placeholder below with your actual JWKS URL
DEFINE ACCESS user ON DATABASE TYPE RECORD
  WITH JWT URL "https://<your-tenant>.logto.app/oidc/jwks"
           WITH ISSUER "https://<your-tenant>.logto.app/oidc"
  AUTHENTICATE { RETURN type::record($token.app_sub) }
  DURATION FOR SESSION 1h;
```

Then **rewrite the existing PERMISSIONS** clauses to use the namespaced claim:

```surql
DEFINE TABLE OVERWRITE user SCHEMAFULL
  PERMISSIONS
    FOR select WHERE id = type::record($token.app_sub) OR "admin" IN $token.app_roles
    FOR update WHERE id = type::record($token.app_sub);

DEFINE TABLE OVERWRITE bookmarked TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, delete WHERE in = type::record($token.app_sub);

DEFINE TABLE OVERWRITE completed TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = type::record($token.app_sub);

DEFINE TABLE OVERWRITE annotated TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = type::record($token.app_sub);
```

### Step 6 — Wire the frontend

```ts
// In your Astro / SvelteKit / React app
import LogtoClient from "@logto/browser";
import { Surreal } from "surrealdb";

const logto = new LogtoClient({
  endpoint: import.meta.env.PUBLIC_LOGTO_ENDPOINT,
  appId: import.meta.env.PUBLIC_LOGTO_APP_ID,
  resources: [import.meta.env.PUBLIC_API_RESOURCE],
});

const db = new Surreal();
await db.connect("wss://your-surreal.example.com/rpc");
await db.use({ namespace: "revelation", database: "main" });

// After Logto sign-in callback completes:
const accessToken = await logto.getAccessToken(import.meta.env.PUBLIC_API_RESOURCE);
await db.authenticate(accessToken);

// Now SurrealDB will inject $auth and $token. Bookmark a work:
await db.query("RELATE $auth -> bookmarked -> $work", { work: "work:onedrive_juin" });
```

### Step 7 — Provision the user record on first sign-in

When a brand-new user signs in, `type::record($token.app_sub)` resolves to a record id that doesn't yet exist. Two patterns:

**Pattern A — Lazy creation in AUTHENTICATE block**:

```surql
DEFINE ACCESS user ON DATABASE TYPE RECORD
  WITH JWT URL "..."
  AUTHENTICATE {
    LET $u = type::record($token.app_sub);
    UPSERT $u SET email = $token.email, name = $token.name;
    RETURN $u;
  }
  DURATION FOR SESSION 1h;
```

**Pattern B — Logto webhook → backend → INSERT**:

Subscribe to `User.Created` webhook, your backend gets HMAC-signed payload, INSERT the SurrealDB user record. Cleaner separation but requires keeping the webhook endpoint up.

Pattern A is simpler — go with it unless you need backend logic on signup.

## Testing locally without Logto

For dev iteration, mint your own HS256 tokens:

```ts
import jwt from "jsonwebtoken";

const token = jwt.sign(
  {
    sub: "abc123",                       // Logto-style opaque id
    app_sub: "user:abc123",              // SurrealDB-shaped
    app_roles: ["editor"],
    ns: "revelation", db: "main", ac: "user",   // routing
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "$dev_secret_change_in_prod",
  { algorithm: "HS256" }
);

await db.authenticate(token);
```

Define the corresponding access on the SurrealDB side:

```surql
DEFINE ACCESS user ON DATABASE TYPE RECORD
  WITH JWT ALGORITHM HS256 KEY "$dev_secret_change_in_prod"
  AUTHENTICATE { RETURN type::record($token.app_sub) }
  DURATION FOR SESSION 1h;
```

## Open questions to resolve before production

1. **JWT routing claims** — does Logto emit them via custom-claims, or do we need a token-exchange step?
2. **Where does SurrealDB run** — Fly.io / self-hosted VPS / Cloudflare? (Affects networking from Surreal to Logto JWKS endpoint.)
3. **CORS on SurrealDB** — Surreal v3 has a default-deny CORS for browser clients; configure `--web-cors` flag.
4. **Refresh token strategy** — Logto SDK refreshes transparently; we re-call `db.authenticate(newJwt)` after each refresh. Need a wrapper that intercepts.
5. **Admin role** — One Logto role `admin` mapped to `app_roles` claim, then SurrealDB tables grant elevated access. Or use a separate Logto resource for admin-only endpoints.

## Reference: skill files

- [`surrealdb/references/auth-jwt.md`](~/.claude/skills/surrealdb/references/auth-jwt.md) — full v3 patterns
- [`logto/references/jwt-and-claims.md`](~/.claude/skills/logto/references/jwt-and-claims.md) — Logto-specific gotchas (immutable claims, ESM script form, JwtCustomizerUserContext shape)
- [`logto/references/quickstart.md`](~/.claude/skills/logto/references/quickstart.md) — SDK integration per framework
- [`logto/references/management-api.md`](~/.claude/skills/logto/references/management-api.md) — backend user CRUD
