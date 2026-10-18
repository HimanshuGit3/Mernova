# Phase 11: Hardening and delivery

## What was built

- **NFR audit** (all 15): bcrypt only (01); server-side auth and role checks on every route and socket (02); zod on every input (03); fail-fast config, now also validating `JWT_EXPIRES_IN` and defaulting `NODE_ENV` to production (04); CORS allow-list for HTTP and Socket.IO (05); upload type/size/magic bytes/random names/re-encode (06); auth rate limits (07); the app keeps only unsent reports (08); one error shape, no stacks outside development (09); loading/empty/error states (10); pagination, indexes, thumbnails (11); phone-side compression (12); ESLint + Prettier clean on server and web, `flutter analyze` pending Flutter (13); AA contrast, focus, keyboard, labelled icon buttons, 48 dp targets (14); README for a fresh clone (15).
- **Fresh-eyes review by a subagent** (correctness and security only). Findings and fixes:
  1. Technicians could read the reporter's name in the status history → names for technicians limited to staff (D-33).
  2. "Me too" on any active id grants follow access → accepted and documented (D-32): no personal data is exposed.
  3. Concurrent "Me too" could add the same supporter twice (reproduced) → atomic conditional `$addToSet`.
  4. A phone's FCM token could stay on a previous account → the server moves the token on registration; every app sign-out sends it.
  5. Offline queue not tied to a user → items carry `ownerId`; only the owner's session lists or sends them.
  6. Missing `NODE_ENV` meant development mode in production → default is now production.
  7. Invalid `JWT_EXPIRES_IN` only failed at login → validated at start-up.
  Every fix has a regression test (`server/tests/hardening.test.js`, `mobile/test/offline_queue_test.dart`).
- **Delivery**: full README (prerequisites, setup per part, environment, demo accounts, commands, APK builds, phone-on-Wi-Fi and firewall, troubleshooting), `docs/DEMO.md` (5-minute script + fallback plan), `docs/REPORT-NOTES.md`, `docs/DEPLOY.md`, `server/Dockerfile`, `docker-compose.yml` (API + MongoDB, validated with `docker compose config`), `.github/workflows/ci.yml` (server tests + e2e, web lint/build/Playwright, Flutter analyze/test), and `npm run create-admin -w server` for a real deployment.

## Key choices and why

- **Review with fresh eyes.** The reviewer did not write the code, so it checked the rules as written rather than as remembered; four of its seven findings were real cross-cutting gaps that unit tests written by the author had not targeted.
- **Fix with tests first in mind.** Each finding became a test that fails on the old code, so the bug cannot come back silently.
- **Secure defaults.** Forgetting a variable now makes the server safer (production), not leakier.

## Concepts from fundamentals

- **Race conditions.** Two requests that read, check and then write can both pass the check. A single conditional update in the database (`updateOne({ supporters: { $ne: id } }, { $addToSet })`) makes check-and-write one atomic step.
- **Least privilege / data minimisation.** Each audience gets only the fields it needs; the technician needs the problem and the place, not who reported it.
- **Twelve-factor configuration.** Configuration lives in the environment, is validated at start-up, and never in code or git.
- **Containers.** The Dockerfile installs only production dependencies, runs as the non-root `node` user and has a health check; volumes keep data across restarts.
- **Continuous integration.** Every push runs the same gates as the final acceptance, on clean machines.

## Checks (final run, also recorded in PROGRESS.md)

```text
npm test -w server        Test Files 11 passed | 1 skipped (12); Tests 414 passed | 1 skipped (415)
npm run e2e               e2e passed: 7/7 scenario steps
npm run lint -w client    eslint . --max-warnings 0 (no output, exit 0)
npm run build -w client   ✓ built
npm run test:ui -w client 11 passed
npm run screenshots       84 screenshots, "No horizontal overflow on any page."; reviewed
cd mobile && flutter …    bash: flutter: command not found   ← needs the user (install Flutter + Android SDK)
```

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **What did the security review find, and how did you fix the most serious issue?** Seven findings; the most impactful were push tokens surviving an account switch (another user's notifications on a shared phone) and a double-tap race on "Me too". The token is now moved to the new account on registration and sent on every sign-out; "Me too" is a single atomic conditional update. Both have regression tests.
2. **How does the system protect personal data?** Reporter identity is visible only to admins and the reporter; feed, Live Booth, duplicates, socket payloads and technician views omit it; password hashes, device tokens and embeddings are never selected; photos are re-encoded, which strips GPS EXIF.
3. **What happens if the server is deployed with a missing or wrong setting?** It refuses to start and prints which variable is wrong (zod schema). A missing `NODE_ENV` falls back to production, so stack traces never leak.
4. **How would you deploy this?** Docker Compose (API + MongoDB with volumes) or managed services (Atlas + a Node host + a static host for the web build), TLS with WebSocket upgrade at the proxy, `CLIENT_ORIGIN` set to the web origin, and a release APK built with the HTTPS API URL (`docs/DEPLOY.md`).
5. **How do you know the whole system works together?** `npm run e2e` runs the expo demo scenario end to end against the real server and sockets, Playwright drives the web UI through role flows and realtime updates, and CI runs all of it on every push.

</details>
