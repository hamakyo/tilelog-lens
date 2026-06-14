# PLAN.md — TileLog Lens implementation plan

## Phase 0 — Repository initialization

Goal: create a clean Cloudflare-first TypeScript project skeleton.

Tasks:

- [x] Initialize package.json.
- [x] Add TypeScript strict config.
- [x] Add Vite React SPA.
- [x] Add Hono Worker entry.
- [x] Add Cloudflare Workers types.
- [x] Add Vitest.
- [x] Add formatting/linting if desired.
- [x] Add `wrangler.jsonc` template.
- [x] Add `/api/health` route.

Acceptance criteria:

- [x] `npm run dev` starts local app.
- [x] `/api/health` returns `{ ok: true }`.
- [x] TypeScript compiles.

## Phase 1 — D1 schema and local database

Goal: create D1 schema and database access helpers.

Tasks:

- [x] Add `migrations/0001_init.sql`.
- [x] Create `stat_snapshots` table.
- [x] Reserve `play_notes` for future richer note-taking; MVP uses `stat_snapshots.note`.
- [x] Add D1 query helpers.
- [x] Add typed row mappers.
- [x] Add local migration instructions to README.

Acceptance criteria:

- [x] Migration applies locally.
- [x] Migration applies remotely in preview/prod.
- [x] Table includes `source_image_stored INTEGER NOT NULL DEFAULT 0 CHECK (source_image_stored = 0)`.
- [x] No table stores image data.

## Phase 2 — Shared schemas and validation

Goal: centralize input validation and consistency warnings.

Tasks:

- [x] Add shared `SnapshotCreateInput` type.
- [x] Add Zod schema for snapshot creation.
- [x] Add Zod schema for snapshot update.
- [x] Add `observed_date` validation.
- [x] Add required `observed_time` validation for `HH:mm`.
- [x] Add rate range validation.
- [x] Add rank point validation.
- [x] Add consistency warning functions.
- [x] Add tests for validation.

Acceptance criteria:

- [x] Missing time is rejected.
- [x] Invalid `24:00` is rejected.
- [x] `23:59` is accepted.
- [x] Rates outside 0-100 are rejected.
- [x] Placement rate sum warning works.
- [x] Average place mismatch warning works.

## Phase 3 — Access authentication middleware

Goal: protect API with Cloudflare Access JWT validation.

Tasks:

- [x] Add `jose`.
- [x] Implement Access JWT validation middleware.
- [x] Verify `iss`.
- [x] Verify `aud`.
- [x] Verify expiration.
- [x] Verify email equals `OWNER_EMAIL`.
- [x] Add development-only bypass, disabled in production.
- [x] Add no-token/invalid-token tests where practical.

Acceptance criteria:

- [x] API rejects missing JWT in production.
- [x] API rejects non-owner email.
- [x] API does not log JWT.
- [x] README documents Cloudflare Access setup.

## Phase 4 — Request guards

Goal: enforce screenshot non-persistence at the API boundary.

Tasks:

- [x] Require JSON content type for mutation routes.
- [x] Add request body size limit.
- [x] Reject suspicious keys: `image`, `screenshot`, `file`, `blob`, `base64`, `dataUrl`.
- [x] Reject strings containing `data:image/`.
- [x] Add tests for rejection behavior.

Acceptance criteria:

- [x] Payload with `data:image/png;base64,...` is rejected.
- [x] Payload with `screenshot` key is rejected.
- [x] Normal snapshot JSON is accepted.

## Phase 5 — Snapshot CRUD API

Goal: create the core data API.

Tasks:

- [x] `GET /api/snapshots`.
- [x] `POST /api/snapshots`.
- [x] `GET /api/snapshots/:id`.
- [x] `PUT /api/snapshots/:id`.
- [x] `DELETE /api/snapshots/:id`.
- [x] Derive `observed_at_utc` server-side.
- [x] Return validation warnings on create/update.
- [x] Handle duplicate `game_mode + observed_at_utc`.
- [x] Handle duplicate image hash warning.

Acceptance criteria:

- [x] Can create a snapshot.
- [x] Can list snapshots sorted by observed time.
- [x] Can edit a snapshot.
- [x] Can delete a snapshot.
- [x] Duplicate observation time returns clear error.

## Phase 6 — React import and snapshot UI

Goal: build usable owner interface.

Tasks:

- [x] Create app shell/navigation.
- [x] Create Import page.
- [x] Add required date input.
- [x] Add required time input with `step=60`.
- [x] Add statistics form fields.
- [x] Add local image picker.
- [x] Add local image preview.
- [x] Add browser-side SHA-256 helper.
- [x] Add browser-side image dimension helper.
- [x] Ensure API payload never includes image file or base64.
- [x] Create Snapshot list page.
- [x] Create Snapshot edit page.
- [x] Create Settings page (owner info, basic config).

Acceptance criteria:

- [x] Owner can manually enter and save snapshot.
- [x] Owner can select local image for preview only.
- [x] Network request contains no image bytes/base64.
- [x] Required `HH:mm` prevents save when empty.

## Phase 7 — Analytics

Goal: provide useful trend analysis.

Tasks:

- [x] Add derived metric functions.
- [x] Add estimated period delta functions.
- [x] Add `GET /api/analytics/deltas`.
- [x] Add dashboard latest summary.
- [x] Add trend chart for average place.
- [x] Add trend chart for win/deal-in rates.
- [x] Add trend chart for attack-defense gap.
- [x] Add trend chart for call/riichi rates.
- [x] Add delta table.
- [x] Add caveat about rounded cumulative source data.

Acceptance criteria:

- [x] Dashboard works with 0, 1, and multiple snapshots.
- [x] Delta table marks zero/negative match deltas.
- [x] Charts have table fallback.

## Phase 8 — CSV export

Goal: download spreadsheet-friendly data.

Tasks:

- [x] Implement CSV escaping helper.
- [x] Mitigate spreadsheet formula injection for user-controlled text.
- [x] Implement `/api/export/snapshots.csv`.
- [x] Implement `/api/export/deltas.csv`.
- [x] Add Export page buttons.
- [x] Add tests for CSV escaping.

Acceptance criteria:

- [x] CSV downloads in browser.
- [x] Header row included.
- [x] Japanese text preserved in UTF-8.
- [x] Quotes/commas/newlines escaped correctly.

## Phase 9 — AI JSON export

Goal: produce AI-friendly structured export.

Tasks:

- [x] Define AI context JSON type.
- [x] Implement derived metrics export.
- [x] Implement estimated deltas export.
- [x] Implement notes export.
- [x] Default anonymization to true.
- [x] Add `privacy` metadata.
- [x] Implement `/api/export/ai-context.json`.
- [x] Add Export page download button.
- [x] Add tests for anonymization.

Acceptance criteria:

- [x] JSON downloads in browser.
- [x] Default export excludes player name/player ID.
- [x] JSON states screenshots are not included and not stored.
- [x] JSON includes analysis request in Japanese.

## Phase 10 — Cloudflare deployment hardening

Goal: deploy safely for personal use.

Tasks:

- [x] Create D1 database.
- [x] Apply remote migrations.
- [x] Configure production route/custom domain.
- [x] Set `workers_dev = false` or protect workers.dev with Access.
- [x] Configure Cloudflare Access app.
- [x] Enable One-time PIN / OTP.
- [x] Allow only owner email.
- [x] Set secrets: `OWNER_EMAIL`, `ACCESS_AUD`.
- [x] Validate production login.
- [x] Validate unauthorized email cannot access.
- [x] Validate API rejects direct unauthenticated request.

Acceptance criteria:

- [x] Production app requires OTP login.
- [x] Only owner email can access.
- [x] D1 writes work in production.
- [x] CSV/JSON export works in production.

## Phase 11 — Documentation and polish

Goal: make the repo clear enough for future maintenance/portfolio review.

Tasks:

- [x] Update README with exact commands.
- [x] Add screenshots only if they do not contain Mahjong Soul copyrighted UI/assets, or use mock UI data.
- [x] Add disclaimer to README and UI footer.

## Phase 12 — Flexible analysis roadmap

Goal: let the owner slice, compare, and export confirmed numerical data more flexibly without changing the screenshot privacy model.

Implementation order:

- [x] 12.1 Strengthen period and condition filters for analysis screens.
- [x] 12.2 Expand comparison views for period and mode comparisons.
- [x] 12.3 Add user-defined custom metrics.
- [x] 12.4 Add purpose-based analysis templates.
- [x] 12.5 Add outlier and change-point detection.
- [x] 12.6 Add configurable chart metric selection.
- [x] 12.7 Add note tags and tag-based analysis.
- [x] 12.8 Add customizable AI analysis requests.
- [x] 12.9 Add customizable CSV/JSON exports.
- [ ] 12.10 Expand the data quality view.

Acceptance criteria:

- [ ] Each step has a focused implementation commit.
- [ ] No step uploads, stores, logs, or exports screenshots or base64 image payloads.
- [ ] Existing Access, request guard, and export anonymization constraints remain intact.
- [ ] `pnpm run build` and `pnpm test` pass after the final step.
- [x] Add privacy/security notes.
- [x] Add known limitations.
- [x] Add backlog.

Acceptance criteria:

- [x] New developer/Codex can understand project from README/SPEC/DESIGN/AGENTS/PLAN.
- [x] Disclaimer is present.
- [x] No official assets are committed.

## Backlog after MVP

- [x] Browser-side OCR using fixed crop regions.
- [x] Settings page (basic config / owner info display).
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
