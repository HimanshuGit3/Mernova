# Architecture

## System

One Express API with Socket.IO on the same HTTP server, one MongoDB. Both apps only talk to the API. The CLIP model runs inside the API process (no external AI service, no API key). Firebase Cloud Messaging is optional and only used for background push.

```mermaid
flowchart LR
  subgraph Clients
    W["React web app<br/>(admin dashboard, student web, Live Booth)"]
    M["Flutter Android app<br/>(students, technicians)"]
  end

  subgraph API["Express 5 API (server/)"]
    R["Routes → middleware<br/>(auth, role, zod, upload)"]
    C["Controllers"]
    S["Services<br/>issues · sla · assignment · notifications · insights"]
    AI["AI service<br/>CLIP ViT-B/32 (transformers.js)"]
    RT["Realtime service<br/>Socket.IO rooms"]
    J["Jobs (node-cron)<br/>hourly SLA · auto-close"]
    ST["Storage service<br/>sharp → uploads/"]
  end

  DB[("MongoDB<br/>users · locations · issues · notifications")]
  FCM["Firebase Cloud Messaging<br/>(optional)"]

  W -- "HTTPS REST /api + JWT" --> R
  M -- "HTTPS REST /api + JWT" --> R
  W <-- "Socket.IO (JWT handshake)" --> RT
  M <-- "Socket.IO (JWT handshake)" --> RT
  R --> C --> S
  S --> DB
  S --> AI
  S --> ST
  S --> RT
  S -- "push (if configured)" --> FCM
  FCM -. "background notification" .-> M
  J --> S
```

### Layering

`route → middleware (auth, requireRole, validate, upload) → controller → service → model`

- **Routes** declare the path, the roles, and the zod schema.
- **Controllers** translate HTTP into service calls (read `req`, call one service, send the response). No business rules.
- **Services** hold every business rule: visibility, transitions (`utils/transitions.js` is the only place that decides), SLA/priority, assignment, notifications and realtime events. Events are emitted here so that every path that changes an issue (HTTP, jobs, seed) behaves the same.
- **Models** define schemas and indexes.

### Request lifecycle (report with photo)

1. `multer` keeps the upload in memory (≤ 5 MB, JPEG/PNG by MIME and magic bytes).
2. `sharp` re-encodes it to JPEG (max 1600 px) and a 400 px thumbnail; the storage service writes both with random names.
3. The AI service computes the CLIP embedding (with a timeout) for duplicate detection; failures never block the report.
4. The issue is saved with `dueAt` and `priorityScore`; `statusHistory` gets its first entry.
5. The notification service saves an inbox entry for each admin, emits `notification:new`, and pushes via FCM if configured. The realtime service emits `issue:created` and `stats:changed`.

## Report → assign → resolve → confirm

```mermaid
sequenceDiagram
  autonumber
  actor S as Student (mobile)
  participant API as Express API
  participant DB as MongoDB
  participant IO as Socket.IO
  actor A as Admin (web)
  actor T as Technician (mobile)

  S->>API: POST /issues/analyse (photo, QR location)
  API->>API: CLIP: category suggestion + embedding
  API->>DB: $geoNear / same location, last 7 days
  API-->>S: { suggestion, duplicates: [] }
  S->>API: POST /issues (photo, category, severity, clientRequestId)
  API->>DB: insert issue (dueAt, priorityScore, history)
  API->>IO: issue:created, stats:changed → role:admin
  API->>IO: notification:new → each admin
  IO-->>A: dashboard + Live Booth update live
  A->>API: GET /issues/:id/assignment-suggestions
  API-->>A: top 3 technicians by skill and open load
  A->>API: POST /issues/:id/assign { technicianId }
  API->>DB: status open → assigned (history)
  API->>IO: issue:updated → admin, reporter, technician
  API->>IO: notification:new → technician (+ FCM push)
  T->>API: POST /issues/:id/transition { to: in_progress }
  T->>API: POST /issues/:id/transition { to: resolved } + after photo
  API->>IO: issue:updated + notification:new → student
  S->>API: POST /issues/:id/transition { to: closed }
  API->>IO: issue:updated, stats:changed
  Note over API,DB: Hourly job: recompute priority, escalate overdue once (notify admins).<br/>Auto-close resolved issues after AUTO_CLOSE_HOURS.
```

## Status machine (D1)

```mermaid
stateDiagram-v2
  [*] --> open
  open --> assigned: admin assigns
  reopened --> assigned: admin assigns
  assigned --> assigned: admin reassigns
  in_progress --> assigned: admin reassigns
  assigned --> in_progress: assigned technician starts
  in_progress --> resolved: technician (after photo)
  resolved --> closed: reporter / admin / system (auto-close)
  resolved --> reopened: reporter, reason, ≤ 7 days
  open --> rejected: admin, reason
  reopened --> rejected: admin, reason
  closed --> [*]
  rejected --> [*]
```

## Realtime design

- One Socket.IO server attached to the same HTTP server, CORS limited to `CLIENT_ORIGIN`.
- The handshake carries the JWT in `auth.token`; the middleware verifies it and loads the user (inactive → refused).
- Each socket joins `user:<id>`; admins also join `role:admin`.
- Clients treat events as "something changed": they patch the item in view or refetch, and refetch the whole view after a reconnect, so a missed event can never leave stale data on screen.
- `stats:changed` is throttled server-side to at most one emit per 2 seconds, so a burst of changes does not trigger a burst of KPI queries.

## Security model

- Passwords: bcrypt (cost 10). JWT signed with `JWT_SECRET`, expiry `JWT_EXPIRES_IN`.
- Every protected route runs `auth` and `requireRole` on the server; visibility rules live in the issue service and unauthorised reads return 404 (no existence leak).
- Input: zod on every body/query/params; uploads checked by type, size and magic bytes, then re-encoded (strips metadata such as GPS EXIF from the stored photo).
- helmet headers, CORS allow-list, JSON body limit, rate limiting on login and register.

## Mobile offline queue

Unsent reports are stored on the device as JSON + the compressed image file. A connectivity listener retries with exponential backoff. Each report has a `clientRequestId` (UUID v4); the server's unique sparse index on it turns a repeated POST into "return the existing issue", so retries can never create duplicates.
