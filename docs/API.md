# FixIt Campus REST API

Base URL: `/api` (development: `http://localhost:5000/api`, emulator: `http://10.0.2.2:5000/api`).

## Conventions

- **Auth:** `Authorization: Bearer <JWT>`. The token carries `sub` (user id) and `role`; the server reloads the user on every request and rejects inactive accounts.
- **Roles:** `S` student, `T` technician, `A` admin. "Any" means any signed-in user. Public routes are marked.
- **Errors** always have one shape (NFR-09):

  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": [{ "path": "email", "message": "Invalid email" }] } }
  ```

  | Status | `code` | When |
  | --- | --- | --- |
  | 400 | `VALIDATION_ERROR`, `INVALID_FILE`, `FILE_TOO_LARGE` | zod validation failed, bad upload |
  | 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `ACCOUNT_DISABLED` | missing/invalid/expired token, wrong password, token of a deactivated account (forces sign-out) |
  | 403 | `FORBIDDEN`, `ACCOUNT_DISABLED` | wrong role, not allowed to perform this transition, login to a deactivated account |
  | 404 | `NOT_FOUND` | unknown route, or a resource the caller may not see |
  | 409 | `CONFLICT`, `INVALID_TRANSITION`, `DUPLICATE` | duplicate key, transition not allowed from the current status |
  | 429 | `RATE_LIMITED` | too many login/register attempts |
  | 500 | `INTERNAL` | unexpected; no stack trace outside development |

- **Pagination:** list endpoints take `?page=1&limit=20` (limit max 50) and return:

  ```json
  { "items": [], "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  ```

- **Photos** are stored and returned as paths (`/uploads/2026/10/ab12….jpg`). Each client prefixes its own API origin.
- **IDs** are MongoDB ObjectIds as strings, exposed as `id`.

### Issue summary object

Returned in lists and in realtime events. `reporter` is only present for admins and for the reporter themselves. Embeddings are never returned.

```json
{
  "id": "6712c0…",
  "title": "Projector flickering in B-204",
  "description": "Image flickers every few seconds…",
  "category": "electrical",
  "severity": "high",
  "status": "assigned",
  "photoPath": "/uploads/2026/10/1a2b.jpg",
  "thumbPath": "/uploads/2026/10/1a2b_thumb.jpg",
  "resolutionPhotoPath": null,
  "resolutionThumbPath": null,
  "resolutionNote": null,
  "location": { "lat": 13.1719, "lng": 77.5361 },
  "locationRef": { "id": "…", "code": "B-204", "building": "Block B", "floor": "2", "room": "204", "label": "Seminar Hall" },
  "landmark": null,
  "reporter": { "id": "…", "name": "Asha Rao" },
  "assignedTo": { "id": "…", "name": "Ravi Kumar" },
  "supportersCount": 3,
  "supportedByMe": false,
  "priorityScore": 84,
  "dueAt": "2026-10-19T08:00:00.000Z",
  "overdue": false,
  "escalatedAt": null,
  "ai": { "suggestedCategory": "electrical", "confidence": 0.82, "accepted": true },
  "duplicateOf": null,
  "rejectionReason": null,
  "resolvedAt": null,
  "createdAt": "2026-10-18T08:00:00.000Z",
  "updatedAt": "2026-10-18T09:12:00.000Z"
}
```

The detail endpoint adds `statusHistory: [{ status, changedBy: { id, name, role } | "system", at, note }]`. For students, staff entries show only the role (`{ role: "technician" }`), never a name.

---

## Health

| Method | Path | Roles | Response |
| --- | --- | --- | --- |
| GET | `/health` | Public | `200 { "status": "ok", "db": "up", "ai": "ready" \| "loading" \| "disabled" \| "failed", "time": "…" }` |

## Auth

| Method | Path | Roles | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public, rate-limited | `{ name, email, password (min 8), department? }`; any `role` is ignored | `201 { token, user }` (role always `student`) | 400, 409 email taken, 429 |
| POST | `/auth/login` | Public, rate-limited | `{ email, password }` | `200 { token, user }` | 400, 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_DISABLED`, 429 |
| GET | `/auth/me` | Any | | `200 { user }` | 401 |
| POST | `/auth/logout` | Any | `{ fcmToken? }` | `204` (removes the device's FCM token; the client discards the JWT) | 401 |
| POST | `/auth/fcm-token` | Any | `{ token }` | `204` | 400, 401 |

`user` object: `{ id, name, email, role, department, skills, isActive, createdAt }`. The password hash is never returned.

Example login response:

```json
{ "token": "eyJhbGciOi…", "user": { "id": "…", "name": "Asha Rao", "email": "asha@student.presidency.edu", "role": "student", "department": "MCA", "skills": [], "isActive": true } }
```

## Issues

| Method | Path | Roles | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/issues/analyse` | S, A | multipart: `photo` (JPEG/PNG ≤ 5 MB), `lat?`, `lng?`, `locationId?` | `200 { suggestion: { category, confidence } \| null, duplicates: [candidate] }` | 400 bad file |
| GET | `/issues/duplicates` | S, A | `?lat&lng` or `?locationId`, `category?` | `200 { duplicates: [candidate] }` (no image ranking; category match + distance) | 400 |
| POST | `/issues` | S, A | multipart: `photo` (required on mobile; optional on web), `title`, `description?`, `category`, `severity?`, `lat?`, `lng?`, `locationId?`, `landmark?` (required without GPS and location), `clientRequestId?` (uuid), `aiSuggestedCategory?`, `aiConfidence?` | `201 issue`; `200 issue` when the same `clientRequestId` was already received (idempotent retry) | 400, 401 |
| GET | `/issues` | Any (scoped) | `?status=open,assigned&category&severity&building&from&to&q&sort=newest\|oldest\|priority&page&limit` | `200 page<issue summary>` | 400 |
| GET | `/issues/feed` | Any | `?page&limit` | `200 page<feed item>`: resolved/closed issues with before/after photos, no reporter or assignee identity | |
| GET | `/issues/:id` | Any (scoped) | | `200 issue detail` | 404 not visible |
| PATCH | `/issues/:id` | A | `{ severity?, category?, title? }` | `200 issue detail` (SLA and priority recomputed) | 400, 404 |
| POST | `/issues/:id/support` | S | | `200 issue summary` ("Me too": adds a supporter, notifies the reporter, raises priority). Idempotent. | 404, 409 own issue or terminal status |
| GET | `/issues/:id/assignment-suggestions` | A | | `200 { suggestions: [{ id, name, skills, openLoad }] }` top 3 by workload (D3) | 404 |
| POST | `/issues/:id/assign` | A | `{ technicianId, note? }` | `200 issue detail` | 400 inactive / not a technician, 404, 409 invalid transition |
| POST | `/issues/:id/transition` | per D1 | JSON `{ to, note?, reason?, duplicateOf? }`, or multipart with `photo` when `to=resolved` | `200 issue detail` | 400 missing photo/reason, 403 not your job / not your report, 404, 409 not allowed from this status or reopen window expired |

Duplicate `candidate`: `{ id, title, category, status, thumbPath, distanceM, similarity, supportersCount, createdAt, locationRef }` (no reporter).

Transition targets (`to`): `in_progress`, `resolved`, `closed`, `reopened`, `rejected`. Assignment uses `/assign` (D1 row 1–2).

Scope of `GET /issues` and `GET /issues/:id`: students see issues they reported or support; technicians see issues assigned to them; admins see everything. `sort=priority` orders by `priorityScore` desc, then `dueAt` asc.

## Users (admin)

| Method | Path | Roles | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/users` | A | `?role&q&active&page&limit` | `200 page<user + openLoad>` | 400 |
| POST | `/users` | A | `{ name, email, password, role: "technician"\|"admin", department?, skills? }` (skills required for technicians) | `201 user` | 400, 409 |
| PATCH | `/users/:id` | A | `{ name?, department?, skills?, isActive? }` | `200 user` | 400, 404, 409 deactivating yourself |

## Locations

| Method | Path | Roles | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/locations` | Any | `?q&building&active&page&limit` | `200 page<location>` | |
| GET | `/locations/buildings` | Any | | `200 { buildings: ["Block A", …] }` | |
| GET | `/locations/code/:code` | Any | QR content `FIXIT:LOC:<code>` → `<code>` | `200 location` | 404 unknown **or inactive** |
| POST | `/locations` | A | `{ code, building, floor, room, label?, lat, lng }` | `201 location` | 400, 409 code taken |
| PATCH | `/locations/:id` | A | any field above, `isActive?` | `200 location` | 400, 404, 409 |

`location`: `{ id, code, building, floor, room, label, lat, lng, isActive, qr: "FIXIT:LOC:B-204" }`.

## Notifications

| Method | Path | Roles | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | Any (own) | `?page&limit&unread=true` | `200 page<notification> + unreadCount` |
| POST | `/notifications/:id/read` | Any (own) | | `200 notification` (404 if not yours) |
| POST | `/notifications/read-all` | Any (own) | | `200 { updated }` |

`notification`: `{ id, type, title, body, issue: "<issueId>", readAt, createdAt }`. Types: `issue_created`, `issue_assigned`, `status_changed`, `sla_overdue`, `me_too`.

## Insights (admin)

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/insights/summary` | | KPI cards: `{ open, overdue, resolvedThisWeek, avgResolutionHours, deltas: {…}, sparklines: { open: [n×14], … } }` |
| GET | `/insights/overview` | `?days=30` | `{ byStatus: {status: n}, byCategory: {category: n}, bySeverity, resolutionTrend: [{ date, avgHours, resolved }], createdTrend: [{ date, count }] }` |
| GET | `/insights/buildings` | | `{ buildings: [{ building, open, overdue, resolved30d, avgResolutionHours, score (0–100) }] }` |
| GET | `/insights/heatmap` | `?days=30` | `{ points: [[lat, lng, weight]] }` |
| GET | `/insights/attention` | | `{ items: [issue summary] }` overdue or critical, by priority, max 10 |
| GET | `/insights/activity` | `?limit=20` | `{ items: [{ issueId, title, status, at, actor }] }` recent status changes |
| GET | `/insights/live` | | Live Booth snapshot: counters, recent items, map points. **No personal data.** |
| GET | `/export/issues.csv` | same filters as `GET /issues` | `text/csv` attachment |

Building health score: `100 − 12 × overdue − 4 × open (max −60) + bonus for fast resolution`, clamped to 0–100 (see `services/insights.js`).

## Static files

`GET /uploads/<path>`: issue photos and thumbnails (public, random unguessable names).

## Realtime (Socket.IO, same origin as the API)

Connect with `io(SOCKET_URL, { auth: { token } })`. Invalid or missing token → `connect_error` with `UNAUTHENTICATED`.

| Event | Rooms | Payload |
| --- | --- | --- |
| `issue:created` | `role:admin` | issue summary |
| `issue:updated` | `role:admin`, `user:<reporter>`, `user:<supporter>`…, `user:<assignee>` | `{ issue: summary, changes: ["status", "assignedTo", …] }` |
| `notification:new` | `user:<id>` | notification |
| `stats:changed` | `role:admin` | none; refetch KPIs (throttled, at most once per 2 s) |

---

## Requirement → endpoint/event mapping

| FR | Endpoints / events |
| --- | --- |
| FR-01 | `POST /auth/register` |
| FR-02 | `POST /auth/login`, `GET /auth/me` (same users collection for both apps) |
| FR-03 | `POST /auth/logout`, JWT `exp` from `JWT_EXPIRES_IN` |
| FR-04 | `POST /users` |
| FR-05 | `PATCH /users/:id { isActive: false }` |
| FR-10 | `POST /issues` (multipart photo, lat/lng, category, severity, landmark) |
| FR-11 | `GET /issues` (student scope), `GET /issues/:id` (statusHistory, dueAt) |
| FR-12 | `POST /issues/:id/transition { to: "closed" \| "reopened" }` |
| FR-14 | `POST /issues` with `locationId` or `landmark`, `GET /locations` |
| FR-20 | `GET /issues?sort=priority` (technician scope), `dueAt`/`overdue` fields |
| FR-21 | `POST /issues/:id/transition { to: "in_progress" }`, `{ to: "resolved" }` + photo |
| FR-23 | `location` / `locationRef` in issue detail (client opens a maps URL) |
| FR-30 | `GET /insights/summary`, `/insights/attention`, `/insights/activity`, `/insights/heatmap`, `/insights/overview` |
| FR-31 | `GET /issues` filters, `GET /issues/:id`, `POST /issues/:id/assign`, `GET /issues/:id/assignment-suggestions` |
| FR-32 | `GET /insights/overview` |
| FR-34 | Socket events `issue:created`, `issue:updated`, `stats:changed` |
| FR-50 | `notification:new`, `GET /notifications`, `POST /notifications/:id/read`, `/read-all` |
| FR-51 | `POST /issues/analyse` → `suggestion`; `ai` field on issues |
| FR-52 | `POST /issues/analyse` → `duplicates`, `GET /issues/duplicates`, `POST /issues/:id/support` |
| FR-53 | `GET/POST/PATCH /locations`, `GET /locations/code/:code` |
| FR-54 | `priorityScore`, `dueAt`, `escalatedAt`, `sla_overdue` notifications, auto-close job, `GET /issues/:id/assignment-suggestions` |
| FR-55 | `GET /insights/live` + `issue:created` / `issue:updated` / `stats:changed` |
| FR-56 | `GET /insights/heatmap`, `GET /insights/buildings`, `GET /export/issues.csv` |
| FR-57 | Client-only (onboarding, biometrics, theme, slider uses `photoPath` + `resolutionPhotoPath`) |
| FR-58 | `POST /issues` with `clientRequestId` (repeat returns the existing issue) |
| FR-59 | `GET /issues/feed` |
