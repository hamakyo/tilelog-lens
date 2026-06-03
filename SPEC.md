# SPEC.md — TileLog Lens

## 1. Product definition

**TileLog Lens** is an unofficial, personal-use post-game statistics tracker for Mahjong Soul / 雀魂 screenshots.

The application lets a single owner import statistics from their own post-game/profile statistics screenshots, confirm extracted values, save only numerical statistics to Cloudflare D1, visualize trends, and export CSV/JSON files for AI-assisted analysis.

This app is not a gameplay assistant. It must not inspect game traffic, modify the game client, automate gameplay, or provide real-time in-game recommendations.

## 2. Primary goals

1. Let the owner record cumulative Mahjong Soul statistics as time-series snapshots.
2. Require precise observation timestamp input with `YYYY-MM-DD` and `HH:mm`.
3. Store confirmed numerical data in Cloudflare D1.
4. Never persist uploaded screenshots on the server.
5. Export statistics as CSV and AI-friendly JSON.
6. Protect the app with Cloudflare Access email One-time PIN / OTP and an application-level Access JWT check.
7. Keep the implementation Cloudflare-first, cheap to run, and easy to maintain.

## 3. Non-goals

The application must not implement:

- Real-time gameplay assistance.
- In-game overlay.
- Browser extension that reads live game DOM/canvas state.
- Network/API interception against Mahjong Soul.
- Game client modification, injection, memory inspection, or automation.
- Server-side screenshot storage in D1, KV, R2, object storage, Git, or logs.
- Public sharing of screenshots containing copyrighted UI, characters, or official assets.
- Any official-looking branding, logo imitation, or claim of affiliation.

## 4. Target user

Single-owner private use.

The default deployment is protected by Cloudflare Access and allows only the owner email address. Multi-user SaaS, public registration, team sharing, or social features are out of scope for MVP.

## 5. Technology stack

- Frontend: React SPA + Vite + TypeScript.
- API: Hono on Cloudflare Workers.
- Database: Cloudflare D1.
- Authentication perimeter: Cloudflare Access with email One-time PIN / OTP.
- Application authorization: Validate Cloudflare Access JWT and allow only configured owner email.
- File storage: none for screenshots. No R2 required for MVP.
- Charts: Recharts or lightweight charting library.
- Validation: Zod.
- CSV generation: application code using safe escaping.
- JSON export: generated on demand from D1.

## 6. Functional requirements

### 6.1 Authentication

- All routes must be protected by Cloudflare Access in production.
- Cloudflare Access policy must allow only the owner email address.
- API middleware must validate `Cf-Access-Jwt-Assertion`.
- API middleware must reject requests when:
  - the Access JWT is missing,
  - the Access JWT is expired,
  - `aud` does not match the configured Access application audience,
  - `iss` does not match the configured Cloudflare Access team issuer,
  - email claim does not equal the configured owner email.
- Local development may support an explicit development bypass only when `ENVIRONMENT=development`.
- Production must not allow anonymous access.

### 6.2 Screenshot import flow

The frontend may let the owner choose a local image file, but the file must remain in the browser.

Required behavior:

1. Owner selects an image file locally.
2. Frontend reads image dimensions, filename, `File.lastModified`, and optionally EXIF metadata if implemented.
3. Frontend computes SHA-256 hash of the file in the browser.
4. Frontend displays image preview locally.
5. Frontend may run browser-side OCR or provide manual entry fields.
6. Owner must confirm/edit all extracted values before saving.
7. Frontend sends only numerical/statistical fields plus optional metadata to the API.
8. API must reject payloads containing image files, `data:image/*`, base64 image payloads, or suspiciously large request bodies.

### 6.3 Observation timestamp

Each snapshot must include:

- `observed_date`: required, format `YYYY-MM-DD`.
- `observed_time`: required, format `HH:mm`, 24-hour clock, no seconds.
- `timezone`: required, default `Asia/Tokyo`.
- `observed_at_utc`: derived by the server.

`HH:mm` is mandatory because multiple screenshots can be recorded on the same day and differential analysis must be chronologically stable.

### 6.4 Snapshot data fields

The MVP should support these fields:

Required:

- `observed_date`
- `observed_time`
- `timezone`
- `game_mode`
- `matches`
- `avg_place`
- `first_rate`
- `second_rate`
- `third_rate`
- `fourth_rate`
- `win_rate`
- `deal_in_rate`
- `call_rate`
- `riichi_rate`

Recommended optional fields:

- `player_name`
- `rank_name`
- `rank_level`
- `rank_points`
- `rank_points_max`
- `avg_win_score`
- `max_renchan`
- `avg_win_turn`
- `bust_rate`
- `tsumo_rate`
- `note`
- `source_image_sha256`
- `file_name`
- `file_last_modified`
- `exif_taken_at`
- `image_width`
- `image_height`
- `parser_version`

### 6.5 Snapshot list

The app must provide a snapshot list sorted by `observed_at_utc DESC` by default.

List columns:

- observation datetime
- game mode
- rank
- rank points
- matches
- average place
- first/second/third/fourth rates
- win rate
- deal-in rate
- call rate
- riichi rate
- note indicator

Required actions:

- view details
- edit snapshot
- delete snapshot
- export CSV/JSON

### 6.6 Edit and delete

- Snapshot values must be editable after creation.
- Deletion must require confirmation.
- Deletion must not leave orphan data.
- MVP can use hard delete.
- Later versions may add audit logs, but MVP does not require them.

### 6.7 Analytics

The analytics page must show at least:

- average place trend
- win rate trend
- deal-in rate trend
- attack-defense gap trend: `win_rate - deal_in_rate`
- call rate trend
- riichi rate trend
- top-two rate trend: `first_rate + second_rate`
- bottom-two rate trend: `third_rate + fourth_rate`
- rank point trend when data exists
- period delta table between consecutive snapshots

The app should clearly label period values as estimates because source screenshots contain cumulative rounded rates.

### 6.8 Period delta estimation

For consecutive snapshots A and B:

- `matches_delta = B.matches - A.matches`
- `estimated_first_delta = round(B.matches * B.first_rate / 100) - round(A.matches * A.first_rate / 100)`
- Same for second/third/fourth, wins, deal-ins, calls, riichi, tsumo if present.

Validation:

- `matches_delta` must be positive for normal chronological progress.
- If `matches_delta` is zero, show as same-match update and do not compute period rates.
- If `matches_delta` is negative, mark as invalid order, different mode, reset, or OCR/input error.

### 6.9 CSV export

The app must generate CSV on demand via authenticated API response.

Required files:

- `/api/export/snapshots.csv`: cumulative snapshots.
- `/api/export/deltas.csv`: estimated period deltas.

CSV must:

- use UTF-8.
- include a header row.
- safely escape commas, quotes, and line breaks.
- avoid spreadsheet formula injection by prefixing dangerous cells beginning with `=`, `+`, `-`, or `@` with an apostrophe when appropriate.

### 6.10 JSON export

The app must generate AI-friendly JSON on demand.

Endpoint:

- `/api/export/ai-context.json`

The JSON must include:

- schema version
- generated/exported timestamp
- app name
- game name
- privacy metadata
- metrics descriptions
- snapshots
- derived metrics
- estimated deltas
- notes
- analysis request object

Default export must anonymize player name and player ID unless the owner explicitly disables anonymization.

### 6.11 Notes

Each snapshot may include a note describing play-style changes, mental state, or tactical focus.

Examples:

- “Focused on folding against parent riichi.”
- “Started calling more yakuhai/tanyao hands.”
- “Tried to reduce bad-shape riichi-only pushes.”

Notes are useful for AI analysis, but the UI must warn the owner not to include sensitive personal information unless they intend to export it.

## 7. Validation requirements

### 7.1 Field validation

- `observed_date`: must match `YYYY-MM-DD` and be a valid calendar date.
- `observed_time`: must match `HH:mm` and be a valid 24-hour time.
- `timezone`: must be a valid IANA timezone string; MVP may only support `Asia/Tokyo`.
- rates: 0 to 100 inclusive.
- `matches`: integer >= 0.
- `avg_place`: 1.00 to 4.00.
- `rank_points`: integer >= 0 when present.
- `rank_points_max`: integer > 0 when present.
- `rank_points <= rank_points_max` when both exist.
- `source_image_stored`: must always be 0.

### 7.2 Mahjong statistics consistency checks

Warn, but do not always block, when:

- first + second + third + fourth rates differ from 100 by more than 0.2.
- calculated average place differs from submitted `avg_place` by more than 0.03.
- `matches` decreased compared with the previous snapshot for the same game mode.
- same image SHA-256 was previously imported.
- same `game_mode + observed_date + observed_time` already exists.

Block when:

- required fields are missing.
- impossible numeric ranges are supplied.
- request includes image payloads.
- request body exceeds configured size limit.
- authentication/authorization fails.

## 8. Privacy and legal constraints

The app must maintain the following constraints:

- Personal-use only by default.
- Non-official disclaimer in README and UI footer.
- No official logo or copyrighted game image assets in app branding.
- Screenshots processed locally in browser only.
- No server-side image persistence.
- No real-time gameplay assistance.
- No game client modification or network inspection.
- CSV/JSON export is user-initiated.
- External AI upload is outside the app; the app only downloads files unless future explicit consent and policy text are added.

## 9. Non-functional requirements

### 9.1 Security

- All production routes behind Cloudflare Access.
- Hono middleware validates Access JWT.
- Owner email allowlist enforced in code.
- `workers_dev` should be disabled in production unless Access also protects the workers.dev route.
- API accepts JSON only for snapshot mutations.
- API rejects image/base64 payloads.
- No secrets committed to Git.
- Environment variables documented.

### 9.2 Cost

- No R2 in MVP.
- No server image storage.
- CSV/JSON generated on demand, not stored.
- D1 row count is small; queries should be simple.

### 9.3 Maintainability

- Shared TypeScript types and Zod schemas for frontend/API.
- Clear migrations under `migrations/`.
- Small Hono route modules.
- Tests for validation, derived metrics, CSV escaping, and JSON export shape.

### 9.4 Accessibility

- Form labels for all inputs.
- Keyboard-operable dialogs.
- Clear error messages.
- Charts accompanied by tabular data.

## 10. Acceptance criteria for MVP

MVP is complete when:

1. App deploys to Cloudflare Workers.
2. App is protected by Cloudflare Access OTP for only the owner email.
3. Hono validates Access JWT and rejects unauthorized users.
4. Owner can create a snapshot with required `YYYY-MM-DD` and `HH:mm`.
5. Owner can list, edit, and delete snapshots.
6. D1 stores only numerical/statistical fields and source metadata, not images.
7. API rejects image/base64 payloads.
8. Analytics page shows core trend charts and delta table.
9. CSV exports work for snapshots and deltas.
10. AI context JSON export works and defaults to anonymized data.
11. README includes non-official, personal-use, post-game-only disclaimer.
12. No code or UI implies official affiliation with Mahjong Soul / 雀魂.

