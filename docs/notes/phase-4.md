# Phase 4: Realtime, notifications and jobs

## What was built

- **Socket.IO server** (`services/socket.js`) on the same HTTP server as the API. The handshake middleware runs the same `userFromToken` check as HTTP (valid JWT, user exists, account active). Each socket joins `user:<id>`; admins also join `role:admin`. CORS is limited to `CLIENT_ORIGIN`.
- **Event emitters** (`services/realtime.js`), called only from the service layer:
  - `issue:created` → admins (full view, including the reporter)
  - `issue:updated` → admins (full view), the reporter (own view), supporters and assignee (view without the reporter's identity); each socket receives exactly one copy
  - `notification:new` → the owner
  - `stats:changed` → admins, trailing-throttled to at most one per 2 s
  - deactivating a user disconnects their live sockets.
- **Notification service**: every notification is saved (inbox), emitted, and passed to the push service (a no-op until Firebase is configured in phase 10).
- **Jobs** (`jobs/`, node-cron): hourly SLA sweep (recompute priority with a single `bulkWrite`, escalate newly overdue issues once: set `escalatedAt`, notify all admins) and an auto-close check every 15 minutes (resolved for `AUTO_CLOSE_HOURS` → closed by `system`, through the normal transition rules). Both run once shortly after start-up to catch up, and never overlap themselves.
- **`server.js`** exports `startServer({ port, jobs })`, so the e2e script can start the real server on an ephemeral port.
- **`npm run e2e`** (`scripts/e2e.js`): drops the test database, creates staff and a room, starts the server on port 0, connects real Socket.IO clients and runs the 7-step demo scenario from SPEC 13, asserting every API response and every socket event.

## Key choices and why

- **Events from services, not controllers.** Jobs and HTTP requests change issues through the same service functions, so an auto-closed issue produces the same events and notifications as a manual close.
- **Different payloads per room.** Socket.IO's `.to(room).except(room)` sends the admin view to admins and a redacted view to everyone else, without duplicates. Privacy rules from the REST API therefore hold in realtime too.
- **Trailing throttle for `stats:changed`.** A burst of ten changes causes at most one KPI refetch per 2 seconds on every dashboard, and the last change is never lost.
- **One write for the sweep.** `bulkWrite` updates hundreds of priorities in one round trip; notifications are sent only after the write succeeds, and only for issues that this sweep escalated.

## Concepts from fundamentals

- **WebSockets vs. HTTP.** HTTP is request → response; the server cannot speak first. A WebSocket is a long-lived two-way connection, so the server can push events the moment something changes. Socket.IO adds reconnection, rooms and a fallback transport on top.
- **Rooms.** Server-side groups of sockets. Emitting to `user:42` reaches every device that user has open (phone and laptop) without tracking socket ids.
- **Handshake authentication.** The token is checked once when the connection opens (like a door check), and the user's identity is kept on `socket.data` for the lifetime of the connection.
- **Cron expressions.** `0 * * * *` means "minute 0 of every hour"; `*/15 * * * *` means "every 15 minutes".
- **Throttling vs. debouncing.** Throttling limits how often something fires (at most once per window); debouncing waits until the activity stops. A dashboard should update during a burst, so throttling fits.

## Checks

```text
> server@1.0.0 test
 Test Files  8 passed (8)
      Tests  386 passed (386)

> server@1.0.0 e2e
✓ 1. Student registers on the phone and signs in on the web with the same account
✓ 2. Student scans the room QR, takes a photo, gets an AI suggestion and no duplicate, submits
✓ 3. Admin dashboard and Live Booth see it instantly; admin assigns the suggested technician
✓ 4. Technician is notified, sees the SLA countdown, starts, then resolves with an after photo
✓ 5. Student is notified and confirms; before/after appears in Fixed on campus; insights update
✓ 6. A second student reports the same problem; duplicate found; "Me too" raises priority instead of a new issue
✓ 7. Security: 403 for a student on an admin endpoint, 401 without a token, 400 for a PDF photo, 409/403 for invalid transitions
e2e passed: 7/7 scenario steps
```

New tests: handshake without a token, with a forged token, and for a deactivated account (refused); disconnect on deactivation; room targeting (`issue:created` only to admins); per-audience payloads (no reporter identity for technicians and supporters); exactly one copy per socket; full fix cycle notifications; throttle; SLA sweep escalates once and notifies every admin once; auto-close as system, idempotent.

The AI suggestion in step 2 and the image-based duplicate check in step 6 are wired in phase 7 (`scripts/e2eExtras.js`).

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **How is a Socket.IO connection authenticated?** The client sends the JWT in `auth.token` during the handshake; a server middleware verifies it, loads the user, rejects inactive accounts, and stores the identity on `socket.data`. Without a valid token the connection never opens.
2. **How does the admin dashboard update without polling?** The server emits `issue:created`, `issue:updated` and `stats:changed` to the `role:admin` room; the dashboard patches its list or refetches the KPIs when they arrive.
3. **What happens if a client misses events while disconnected?** Socket.IO reconnects automatically; on reconnect the client refetches its current view, so the screen becomes correct regardless of what was missed.
4. **How do you make sure an SLA breach notifies admins only once?** `escalatedAt` is set the first time an issue is seen overdue, and escalation only happens when it is still null. It is cleared only if the SLA restarts (reopen).
5. **Why does auto-close go through `applyTransition` instead of a bulk update?** So the system obeys the same rules (only `resolved → closed`), writes a history entry, sends the same notifications and realtime events, and cannot corrupt state.

</details>
