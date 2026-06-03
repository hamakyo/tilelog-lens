# PLAN.md — TileLog Lens implementation plan

## Phase 0 — Repository initialization

Goal: create a clean Cloudflare-first TypeScript project skeleton.

Tasks:

- [ ] Initialize package.json.
- [ ] Add TypeScript strict config.
- [ ] Add Vite React SPA.
- [ ] Add Hono Worker entry.
- [ ] Add Cloudflare Workers types.
- [ ] Add Vitest.
- [ ] Add formatting/linting if desired.
- [ ] Add `wrangler.jsonc` template.
- [ ] Add `/api/health` route.

Acceptance criteria:

- [ ] `npm run dev` starts local app.
- [ ] `/api/health` returns `{ ok: true }`.
- [ ] TypeScript compiles.

## Phase 1 — D1 schema and local database

Goal: create D1 schema and database access helpers.

Tasks:

- [ ] Add `migrations/0001_init.sql`.
- [ ] Create `stat_snapshots` table.
- [ ] Optionally create `play_notes` table.
- [ ] Add D1 query helpers.
- [ ] Add typed row mappers.
- [ ] Add local migration instructions to README.

Acceptance criteria:

- [ ] Migration applies locally.
- [ ] Migration applies remotely in preview/prod.
- [ ] Table includes `source_image_stored INTEGER NOT NULL DEFAULT 0 CHECK (source_image_stored = 0)`.
- [ ] No table stores image data.

## Phase 2 — Shared schemas and validation

Goal: centralize input validation and consistency warnings.

Tasks:

- [ ] Add shared `SnapshotCreateInput` type.
- [ ] Add Zod schema for snapshot creation.
- [ ] Add Zod schema for snapshot update.
- [ ] Add `observed_date` validation.
- [ ] Add required `observed_time` validation for `HH:mm`.
- [ ] Add rate range validation.
- [ ] Add rank point validation.
- [ ] Add consistency warning functions.
- [ ] Add tests for validation.

Acceptance criteria:

- [ ] Missing time is rejected.
- [ ] Invalid `24:00` is rejected.
- [ ] `23:59` is accepted.
- [ ] Rates outside 0-100 are rejected.
- [ ] Placement rate sum warning works.
- [ ] Average place mismatch warning works.

## Phase 3 — Access authentication middleware

Goal: protect API with Cloudflare Access JWT validation.

Tasks:

- [ ] Add `jose`.
- [ ] Implement Access JWT validation middleware.
- [ ] Verify `iss`.
- [ ] Verify `aud`.
- [ ] Verify expiration.
- [ ] Verify email equals `OWNER_EMAIL`.
- [ ] Add development-only bypass, disabled in production.
- [ ] Add no-token/invalid-token tests where practical.

Acceptance criteria:

- [ ] API rejects missing JWT in production.
- [ ] API rejects non-owner email.
- [ ] API does not log JWT.
- [ ] README documents Cloudflare Access setup.

## Phase 4 — Request guards

Goal: enforce screenshot non-persistence at the API boundary.

Tasks:

- [ ] Require JSON content type for mutation routes.
- [ ] Add request body size limit.
- [ ] Reject suspicious keys: `image`, `screenshot`, `file`, `blob`, `base64`, `dataUrl`.
- [ ] Reject strings containing `data:image/`.
- [ ] Add tests for rejection behavior.

Acceptance criteria:

- [ ] Payload with `data:image/png;base64,...` is rejected.
- [ ] Payload with `screenshot` key is rejected.
- [ ] Normal snapshot JSON is accepted.

## Phase 5 — Snapshot CRUD API

Goal: create the core data API.

Tasks:

- [ ] `GET /api/snapshots`.
- [ ] `POST /api/snapshots`.
- [ ] `GET /api/snapshots/:id`.
- [ ] `PUT /api/snapshots/:id`.
- [ ] `DELETE /api/snapshots/:id`.
- [ ] Derive `observed_at_utc` server-side.
- [ ] Return validation warnings on create/update.
- [ ] Handle duplicate `game_mode + observed_at_utc`.
- [ ] Handle duplicate image hash warning.

Acceptance criteria:

- [ ] Can create a snapshot.
- [ ] Can list snapshots sorted by observed time.
- [ ] Can edit a snapshot.
- [ ] Can delete a snapshot.
- [ ] Duplicate observation time returns clear error.

## Phase 6 — React import and snapshot UI

Goal: build usable owner interface.

Tasks:

- [ ] Create app shell/navigation.
- [ ] Create Import page.
- [ ] Add required date input.
- [ ] Add required time input with `step=60`.
- [ ] Add statistics form fields.
- [ ] Add local image picker.
- [ ] Add local image preview.
- [ ] Add browser-side SHA-256 helper.
- [ ] Add browser-side image dimension helper.
- [ ] Ensure API payload never includes image file or base64.
- [ ] Create Snapshot list page.
- [ ] Create Snapshot edit page.

Acceptance criteria:

- [ ] Owner can manually enter and save snapshot.
- [ ] Owner can select local image for preview only.
- [ ] Network request contains no image bytes/base64.
- [ ] Required `HH:mm` prevents save when empty.

## Phase 7 — Analytics

Goal: provide useful trend analysis.

Tasks:

- [ ] Add derived metric functions.
- [ ] Add estimated period delta functions.
- [ ] Add `GET /api/analytics/deltas`.
- [ ] Add dashboard latest summary.
- [ ] Add trend chart for average place.
- [ ] Add trend chart for win/deal-in rates.
- [ ] Add trend chart for attack-defense gap.
- [ ] Add trend chart for call/riichi rates.
- [ ] Add delta table.
- [ ] Add caveat about rounded cumulative source data.

Acceptance criteria:

- [ ] Dashboard works with 0, 1, and multiple snapshots.
- [ ] Delta table marks zero/negative match deltas.
- [ ] Charts have table fallback.

## Phase 8 — CSV export

Goal: download spreadsheet-friendly data.

Tasks:

- [ ] Implement CSV escaping helper.
- [ ] Mitigate spreadsheet formula injection for user-controlled text.
- [ ] Implement `/api/export/snapshots.csv`.
- [ ] Implement `/api/export/deltas.csv`.
- [ ] Add Export page buttons.
- [ ] Add tests for CSV escaping.

Acceptance criteria:

- [ ] CSV downloads in browser.
- [ ] Header row included.
- [ ] Japanese text preserved in UTF-8.
- [ ] Quotes/commas/newlines escaped correctly.

## Phase 9 — AI JSON export

Goal: produce AI-friendly structured export.

Tasks:

- [ ] Define AI context JSON type.
- [ ] Implement derived metrics export.
- [ ] Implement estimated deltas export.
- [ ] Implement notes export.
- [ ] Default anonymization to true.
- [ ] Add `privacy` metadata.
- [ ] Implement `/api/export/ai-context.json`.
- [ ] Add Export page download button.
- [ ] Add tests for anonymization.

Acceptance criteria:

- [ ] JSON downloads in browser.
- [ ] Default export excludes player name/player ID.
- [ ] JSON states screenshots are not included and not stored.
- [ ] JSON includes analysis request in Japanese.

## Phase 10 — Cloudflare deployment hardening

Goal: deploy safely for personal use.

Tasks:

- [ ] Create D1 database.
- [ ] Apply remote migrations.
- [ ] Configure production route/custom domain.
- [ ] Set `workers_dev = false` or protect workers.dev with Access.
- [ ] Configure Cloudflare Access app.
- [ ] Enable One-time PIN / OTP.
- [ ] Allow only owner email.
- [ ] Set secrets: `OWNER_EMAIL`, `ACCESS_AUD`.
- [ ] Validate production login.
- [ ] Validate unauthorized email cannot access.
- [ ] Validate API rejects direct unauthenticated request.

Acceptance criteria:

- [ ] Production app requires OTP login.
- [ ] Only owner email can access.
- [ ] D1 writes work in production.
- [ ] CSV/JSON export works in production.

## Phase 11 — Documentation and polish

Goal: make the repo clear enough for future maintenance/portfolio review.

Tasks:

- [ ] Update README with exact commands.
- [ ] Add screenshots only if they do not contain Mahjong Soul copyrighted UI/assets, or use mock UI data.
- [ ] Add disclaimer to README and UI footer.
- [ ] Add privacy/security notes.
- [ ] Add known limitations.
- [ ] Add backlog.

Acceptance criteria:

- [ ] New developer/Codex can understand project from README/SPEC/DESIGN/AGENTS/PLAN.
- [ ] Disclaimer is present.
- [ ] No official assets are committed.

## Backlog after MVP

- [ ] Browser-side OCR using fixed crop regions.
- [ ] Manual crop-region calibration UI.
- [ ] Multiple game modes.
- [ ] Import from manually prepared CSV.
- [ ] Better note tagging.
- [ ] Snapshot comparison page.
- [ ] AI prompt generator page.
- [ ] Optional local-only PWA mode.
- [ ] Data backup/restore as JSON.
- [ ] Dark mode.

## Explicitly rejected backlog items

Do not add these:

- [ ] Server-side screenshot upload/storage.
- [ ] R2 screenshot archive.
- [ ] Real-time match advice.
- [ ] Mahjong Soul client integration.
- [ ] Traffic interception.
- [ ] Browser extension reading live game state.
- [ ] Official-looking branding.

