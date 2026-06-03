# AGENTS.md — Coding agent instructions for TileLog Lens

## 1. Mission

Build **TileLog Lens**, an unofficial, personal-use, post-game statistics tracker for Mahjong Soul / 雀魂 screenshots.

The app stores confirmed numerical statistics in Cloudflare D1 and exports CSV/JSON for AI analysis. It must not store screenshots server-side, provide gameplay assistance, or imply official affiliation.

## 2. Hard constraints

These are non-negotiable:

1. Use **Hono + React SPA + TypeScript**.
2. Deploy target is **Cloudflare Workers**.
3. Database is **Cloudflare D1**.
4. Authentication perimeter is **Cloudflare Access email One-time PIN / OTP**.
5. API must validate **Cloudflare Access JWT** using `Cf-Access-Jwt-Assertion`.
6. App must allow only the configured owner email.
7. `observed_date` and `observed_time` are required. `observed_time` must be `HH:mm`.
8. Screenshots must be processed locally in the browser only.
9. Never upload, persist, log, store, or export screenshot images or base64 image payloads.
10. Do not implement real-time gameplay assistance, network interception, game client modification, overlays, automation, or browser extension behavior.
11. CSV/JSON export must be user-initiated and authenticated.
12. Default AI JSON export must anonymize player identifiers.

If a requested change conflicts with these constraints, refuse the change in code comments/PR notes and implement the safe alternative.

## 3. Preferred project structure

Use this structure unless there is a strong reason not to:

```txt
.
├─ README.md
├─ SPEC.md
├─ DESIGN.md
├─ PLAN.md
├─ AGENTS.md
├─ package.json
├─ wrangler.jsonc
├─ migrations/
│  └─ 0001_init.sql
├─ src/
│  ├─ worker/
│  │  ├─ index.ts
│  │  ├─ env.ts
│  │  ├─ middleware/
│  │  │  ├─ accessAuth.ts
│  │  │  └─ requestGuards.ts
│  │  ├─ routes/
│  │  │  ├─ snapshots.ts
│  │  │  ├─ analytics.ts
│  │  │  ├─ exportCsv.ts
│  │  │  └─ exportJson.ts
│  │  └─ lib/
│  │     ├─ d1.ts
│  │     ├─ csv.ts
│  │     ├─ metrics.ts
│  │     └─ time.ts
│  ├─ web/
│  │  ├─ main.tsx
│  │  ├─ App.tsx
│  │  ├─ pages/
│  │  │  ├─ DashboardPage.tsx
│  │  │  ├─ ImportPage.tsx
│  │  │  ├─ SnapshotListPage.tsx
│  │  │  ├─ SnapshotEditPage.tsx
│  │  │  └─ ExportPage.tsx
│  │  ├─ components/
│  │  └─ lib/
│  │     ├─ api.ts
│  │     ├─ imageLocal.ts
│  │     └─ format.ts
│  └─ shared/
│     ├─ schema.ts
│     ├─ types.ts
│     └─ constants.ts
└─ tests/
   ├─ validation.test.ts
   ├─ metrics.test.ts
   ├─ csv.test.ts
   └─ exportJson.test.ts
```

For Cloudflare static asset serving, configure the Worker to serve built React assets. Keep API under `/api/*`.

## 4. Dependencies

Recommended:

- `hono`
- `zod`
- `jose`
- `react`
- `react-dom`
- `vite`
- `typescript`
- `@cloudflare/workers-types`
- `vitest`
- chart library: `recharts` or a lightweight alternative

Avoid heavy server-only Node dependencies that do not run in Cloudflare Workers.

## 5. Environment variables and bindings

Expected Worker bindings/env:

```ts
interface Env {
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "production";
  OWNER_EMAIL: string;
  ACCESS_AUD: string;
  ACCESS_ISSUER: string;
  ACCESS_JWKS_URL: string;
}
```

Notes:

- `ACCESS_ISSUER` is typically `https://<team-name>.cloudflareaccess.com`.
- `ACCESS_JWKS_URL` is typically `${ACCESS_ISSUER}/cdn-cgi/access/certs`.
- Do not hardcode owner email or Access values in source.

## 6. Cloudflare Access middleware requirements

Implement middleware that:

1. Allows local development only when `ENVIRONMENT=development` and a documented development bypass is enabled.
2. Reads `Cf-Access-Jwt-Assertion`.
3. Verifies JWT using `jose` and Cloudflare Access JWKS.
4. Verifies `aud`, `iss`, and `exp`.
5. Extracts email claim.
6. Compares email to `OWNER_EMAIL` case-insensitively.
7. Returns `403` on failure.
8. Does not expose token contents in logs.

Pseudo-code:

```ts
const token = c.req.header("Cf-Access-Jwt-Assertion");
if (!token) return c.json({ error: "forbidden" }, 403);

const JWKS = createRemoteJWKSet(new URL(env.ACCESS_JWKS_URL));
const { payload } = await jwtVerify(token, JWKS, {
  issuer: env.ACCESS_ISSUER,
  audience: env.ACCESS_AUD,
});

const email = String(payload.email ?? "").toLowerCase();
if (email !== env.OWNER_EMAIL.toLowerCase()) {
  return c.json({ error: "forbidden" }, 403);
}
```

## 7. Request guards

All mutation endpoints must:

- require `Content-Type: application/json`.
- enforce a small request body size limit.
- reject obvious image payload keys: `image`, `file`, `base64`, `dataUrl`, `screenshot`, `blob`.
- reject string values containing `data:image/`.
- reject very large string fields.

This prevents accidental server-side screenshot storage.

## 8. Database migrations

Start with `migrations/0001_init.sql` based on DESIGN.md.

Rules:

- Never store image bytes.
- `source_image_stored` must default to 0 and have a CHECK constraint forcing 0.
- Add unique index on `game_mode, observed_at_utc`.
- Add index on `observed_at_utc`.
- Use ISO string timestamps for created/updated fields.

## 9. API routes

Implement these routes first:

```txt
GET    /api/health
GET    /api/snapshots
POST   /api/snapshots
GET    /api/snapshots/:id
PUT    /api/snapshots/:id
DELETE /api/snapshots/:id
GET    /api/analytics/deltas
GET    /api/export/snapshots.csv
GET    /api/export/deltas.csv
GET    /api/export/ai-context.json
```

All `/api/*` routes require authentication.

## 10. Validation rules

Use shared Zod schemas.

Important rules:

- `observed_date`: `YYYY-MM-DD`.
- `observed_time`: `HH:mm`.
- `timezone`: default `Asia/Tokyo`.
- `matches`: integer >= 0.
- all rates: 0 <= value <= 100.
- `avg_place`: 1 <= value <= 4.
- `first_rate + second_rate + third_rate + fourth_rate` should be near 100. Warn if not.
- calculated average place should be near submitted `avg_place`. Warn if not.

Do not block warning-level consistency issues unless impossible values exist.

## 11. Frontend requirements

### Import page

- Date input required.
- Time input required, `step=60`.
- Time is displayed and saved as `HH:mm`.
- Local image selector optional for preview/OCR.
- Compute SHA-256 in browser when image exists.
- Do not POST image file or base64.
- Show extracted/manual fields.
- Show validation warnings before save.

### Dashboard page

- Display trend charts and latest snapshot summary.
- Every chart must have numeric/table fallback.

### Export page

- Download buttons for snapshots CSV, deltas CSV, AI context JSON.
- Anonymization enabled by default for AI JSON.
- Warn owner to remove personal info from notes before uploading exports to third-party AI tools.

## 12. CSV rules

CSV generation must:

- include UTF-8 content.
- include header row.
- quote fields safely.
- escape quotes by doubling them.
- prefix spreadsheet-dangerous values beginning with `=`, `+`, `-`, or `@` with `'` when representing user-controlled text.

## 13. AI JSON rules

AI context JSON must include:

```ts
{
  schema_version: "1.0",
  app: "TileLog Lens",
  game: "Mahjong Soul / 雀魂",
  exported_at: string,
  privacy: {
    anonymized: boolean,
    screenshots_included: false,
    source_images_stored: false
  },
  metrics_description: Record<string, string>,
  snapshots: Snapshot[],
  derived_metrics: DerivedMetric[],
  estimated_deltas: EstimatedDelta[],
  notes: Note[],
  analysis_request: {
    language: "ja",
    goal: string,
    focus: string[]
  }
}
```

Never include screenshots.

## 14. Testing expectations

Add tests for:

- date/time validation.
- rate range validation.
- average place consistency calculation.
- period delta estimation.
- CSV escaping and formula injection mitigation.
- AI JSON anonymization.
- request guard rejecting image/base64 payloads.

## 15. Documentation expectations

Keep README.md updated with:

- setup steps.
- local dev commands.
- D1 migration commands.
- Cloudflare Access setup summary.
- deployment steps.
- non-official disclaimer.
- privacy/security notes.

## 16. Coding style

- TypeScript strict mode.
- Prefer small pure functions for metrics/export logic.
- Keep API route handlers thin.
- Avoid `any`; use typed D1 result mappers.
- Use explicit units in names: `observed_at_utc`, `rank_points_max`, `avg_win_score`.
- Errors returned as `{ error: string, details?: unknown }`.
- Do not log personal notes, tokens, or export payloads.

## 17. Definition of done for each task

A task is done when:

- TypeScript passes.
- Tests pass.
- Lint/format pass if configured.
- No screenshot persistence is introduced.
- Access/security constraints remain intact.
- Relevant docs are updated.

