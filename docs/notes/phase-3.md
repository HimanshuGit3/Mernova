# Phase 3: Core domain API and seed data

## What was built

- **Models with indexes**: `Issue` (status history, SLA fields, AI fields, hidden embedding, sparse unique `clientRequestId`, 2dsphere `point`), `Location` (unique code, GeoJSON point, QR content `FIXIT:LOC:<code>`), `Notification` (`{ user, readAt, createdAt }` index for the unread inbox).
- **Upload pipeline**: multer keeps the file in memory (5 MB limit, JPEG/PNG MIME) → magic bytes are checked (a PDF renamed to `.jpg` is refused) → sharp applies the EXIF orientation, strips metadata, and writes a max-1600 px JPEG plus a 400 px thumbnail with random names under `uploads/YYYY/MM/` → only the path is stored.
- **Business rules**:
  - `utils/transitions.js` is the single table of allowed status changes (D1), with `assertTransition` (throws the right error) and `allowedTransitions` (drives the buttons the apps show).
  - `services/sla.js`: due dates by severity, overdue, priority score and one-time escalation (D2).
  - `services/assignment.js`: top 3 active technicians with the skill, by open load (D3).
  - `services/issues.js`: create (idempotent), list (role-scoped, filters, search, sort, pagination), get, admin edit, Me too, assign/reassign, every transition, notifications for each event.
- **Other endpoints**: locations CRUD and lookup by code, notifications inbox, insights (KPIs with deltas and sparklines, overview trends, building health, heatmap, needs-attention, activity, Live Booth snapshot), CSV export, "Fixed on campus" feed.
- **Seed** (`npm run seed -w server`): 6 buildings and 30 rooms around the campus centre, 1 admin, 4 technicians, 8 students, 60 issues over 30 days in every status, category and severity, with realistic titles, supporters, consistent status histories, 11 overdue, and original SVG-art photos (one scene per category, plus a "fixed" after photo).
- `docs/requests.http` for manual testing.

## Key choices and why

- **Visibility as a query filter.** `scopeFilter(user)` is merged into every read, so a forbidden issue is simply not found (404), never fetched-then-hidden.
- **Views per audience.** `issueView.js` shapes every response: admins see the reporter, students only see their own identity, and the feed and Live Booth carry no names at all.
- **Idempotency in two layers.** A lookup by `clientRequestId` handles normal retries; the unique index handles the race where two retries arrive at once (tested with three concurrent requests → one issue).
- **Re-encode every upload.** Re-encoding with sharp removes hidden payloads and EXIF GPS data, normalises format and size, and fails safely on anything that is not a real image.
- **Stored priority, refreshed.** `priorityScore` is stored, so sorting by priority uses an index; it is recomputed on every change and hourly by a job (phase 4).

## Concepts from fundamentals

- **GeoJSON and 2dsphere indexes.** Points are stored as `{ type: 'Point', coordinates: [lng, lat] }` (longitude first). A 2dsphere index lets MongoDB answer "within 50 m" queries on a sphere (used for duplicates in phase 7).
- **Aggregation pipeline.** MongoDB processes documents through stages (`$match` → `$group` → `$lookup` …), like a SQL `WHERE … GROUP BY … JOIN`, on the server. The KPIs, trends and building scores are pipelines.
- **Compound indexes.** `{ status: 1, priorityScore: -1 }` serves "active issues by priority" without scanning or sorting in memory; field order matters (equality first, then sort).
- **Magic bytes.** The first bytes of a file identify its real format (JPEG `FF D8 FF`, PNG `89 50 4E 47`); the file name and `Content-Type` are just claims.
- **CSV injection.** Spreadsheet apps execute cells starting with `=`, `+`, `-` or `@`; prefixing them with `'` makes them plain text.

## Checks

```text
> server@1.0.0 test
> vitest run
 Test Files  6 passed (6)
      Tests  370 passed (370)
```

- Uploads: PDF (also disguised as JPEG) → 400 `INVALID_FILE`; over 5 MB → 400 `FILE_TOO_LARGE`; resize to 1600/400 px verified.
- Visibility: other student, unassigned technician → 404; supporters see the issue without the reporter.
- Transitions: every (status × target × actor) combination checked against a hand-written copy of D1 (7 statuses × 6 targets × 6 actors = 252 cases), plus photo/reason/technician requirements, the 7-day reopen window, and a full HTTP lifecycle including reassignment while in progress.
- Assignment validation (student, inactive, unknown, bad id → 400; non-admin → 403); SLA and priority maths; pagination bounds (limit 0/51, page −1 → 400); CSV export headers, filtering and formula escaping.
- Seed: `npm run seed -w server` ran twice without errors; a run without `--reset` refuses to touch existing data.
- `npm run lint -w server`: clean.

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **How does the server guarantee that a status change is valid?** Every change goes through `assertTransition` in `utils/transitions.js`, which checks the current status, the actor's relationship to the issue (admin, assignee, reporter, system) and required inputs (photo, reason, active technician). Nothing else in the code changes `status`.
2. **Why store `priorityScore` instead of computing it on read?** Sorting by a stored, indexed field is fast and paginates correctly. It changes only when severity, supporters or overdue hours change, so it is recomputed on every update and hourly.
3. **What stops a student from uploading a malicious file as a photo?** MIME check, magic-byte check, 5 MB limit, and re-encoding with sharp to a fresh JPEG with random names. Anything that is not a decodable image is rejected with 400.
4. **How is "Me too" different from reporting again?** It adds the student to `supporters` of the existing issue (no duplicate work), raises its priority by 8, notifies the reporter, and lets the supporter follow updates.
5. **Why is the CSV export a separate endpoint rather than client-side?** The server can export every matching row (not just the visible page) using the same filters and access rules as the list, and it neutralises formula injection in one place.

</details>
