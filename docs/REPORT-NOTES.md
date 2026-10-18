# Report and poster notes

Raw material for the MCA project report and the MERNOVA X poster. Numbers are from the final quality-gate run recorded in `PROGRESS.md`.

## One-line pitch

FixIt Campus turns a photo of a broken projector into a tracked, prioritised, assigned and verified repair, with AI triage, room-level QR location and live updates on web and mobile.

## Problem

Campus maintenance requests travel by word of mouth, WhatsApp groups and paper registers: they get lost, duplicated, have no location precision indoors, no priority, and no feedback to the person who reported them.

## Solution overview

| Actor | Platform | Core loop |
| --- | --- | --- |
| Student | Android app (and web) | Snap → AI suggests category → scan room QR or GPS → duplicate check ("Me too") → submit → live status → confirm or reopen |
| Admin (estate office) | Web dashboard | Live KPIs → needs-attention list → smart assignment → insights, heatmap, building health → QR stickers → Live Booth |
| Technician | Android app | Jobs by priority with SLA countdown → navigate → start → resolve with after photo |

## Architecture (for the report's design chapter)

- **Three tiers, one backend**: React (Vite) web and Flutter Android → Express 5 REST API + Socket.IO on the same server → MongoDB. No client touches the database (MERNOVA rule).
- **Layering**: route → middleware (auth, role, zod validation, upload) → controller → service → model. Business rules live in services; the status machine lives in one file (`utils/transitions.js`).
- **Realtime**: JWT-authenticated sockets; rooms per user and for admins; events carry per-audience payloads (privacy rules apply to realtime too); clients refetch after reconnect.
- **AI**: CLIP ViT-B/32 via transformers.js inside the API process; zero-shot classification with 28 prompts; 512-d image embeddings stored per issue; duplicates = geo/room filter + cosine similarity ≥ 0.88 (calibrated); every AI call has a timeout and a fallback.
- **SLA engine**: due date by severity (4/24/72/168 h), priority = severity weight + 8 × supporters + 2 × hours overdue (≤ 48); hourly sweep escalates once; auto-close after 72 h.
- **Mobile resilience**: offline queue with idempotency keys and exponential backoff; secure token storage; biometric lock.
- Diagrams: `docs/ARCHITECTURE.md` (system, sequence, state machine, all Mermaid).

## Data model (collections)

`users` (role, skills, FCM tokens, bcrypt hash) · `locations` (code, building, room, GeoJSON point) · `issues` (status, history, SLA fields, photos, AI suggestion, embedding, supporters, idempotency key) · `notifications` (per-user inbox). Indexes listed in SPEC 5; geo queries use a 2dsphere index.

## Feature list by award

| Award | Evidence |
| --- | --- |
| Cross-platform integration | Same API and accounts on both apps; Socket.IO sync on every screen; shared inbox; e2e test proves phone → web flows |
| AI / advanced | CLIP triage (42/42 on test images), duplicate detection with calibrated threshold, graceful fallback |
| Innovation | QR room stickers with printable A4 sheets; Live Booth mode |
| Technical implementation | Status machine (252 combinations tested), SLA/priority engine, escalation, auto-close, smart assignment, idempotent offline queue, fail-fast config |
| Mobile experience | Onboarding, biometric unlock, dark mode, Hero transitions, before/after slider, haptics, offline queue |
| Social impact | "Me too", Fixed on campus feed (anonymous), building health scores |

## Testing summary (for the testing chapter)

| Level | Tool | What | Count |
| --- | --- | --- | --- |
| Unit + integration (API) | Vitest + Supertest + socket.io-client | auth, roles, validation, uploads, visibility, every transition, SLA maths, assignment, AI fallbacks with a fake model, duplicates, realtime rooms and privacy, jobs, push, CSV | **407 passing** (+1 optional real-model test) |
| End-to-end scenario | Node script with real sockets | the 7-step demo from SPEC 13 incl. security checks | **7/7 steps** (fake AI and real CLIP) |
| UI | Playwright (Chromium) | sign-in per role, filter + assign, student privacy, realtime list update, QR sheet, Live Booth realtime | **11 passing** |
| Mobile | flutter_test | login and report form validation, chips/SLA, QR parsing, offline queue retry logic, JSON parsing | 20 tests written (run pending Flutter install) |
| Visual QA | Playwright screenshots | every web route, 1440×900 and 390×844, light and dark, plus the booth at 1920×1080 and the printed QR sheet; automatic horizontal-overflow check | ~78 screenshots |
| Accessibility | review + validators | AA contrast tokens, chart palette validated for colour-vision deficiency, focus rings, labelled icon buttons, keyboard-usable dialogs, 48 dp touch targets | |

Bugs found by the process (good report material): SLA due date off by milliseconds (fixed: same timestamp for creation and SLA start); seeded resolved issues auto-closed on start-up (seed fixed); grid tracks overflowing on phones (found by the automatic overflow check); screen-reader-only labels escaping a scroll container; chart palette failing chroma checks.

## Screenshots for the poster and report

All in `docs/screenshots/web/` (light and dark, desktop and mobile):

- `admin-dashboard-*`: KPI cards, needs attention, live activity, map, donut
- `admin-issues-*`, `admin-issue-open-*`, `admin-issue-closed-*` (before/after slider, timeline, smart assign)
- `admin-insights-*`: heatmap, building health, trends
- `admin-live-booth-dark.png`: Live Booth at 1920×1080
- `admin-locations-*`, `admin-qr-sheet-desktop-light.png`: QR stickers
- `student-report-ai-*`: AI chip + duplicate "Me too"
- `student-my-reports-*`, `student-fixed-feed-*`, `public-login-*`
- Mobile screenshots: `docs/screenshots/mobile/` (to capture on the emulator once Flutter is installed)

## Future scope

- Multiple campuses and departments (out of scope now), role for department heads.
- Cloud storage for photos (S3/GCS) behind the existing storage service; CDN thumbnails.
- Fine-tuning CLIP prompts or a small classifier on real campus photos; predictive maintenance from recurring issues per room.
- Technician route planning across buildings; spare-parts inventory per job.
- iOS build, web push, and SMS fallback for staff without smartphones.
- Short-lived access tokens with refresh rotation; audit log export.

## Tech stack (poster footer)

Node.js 24 · Express 5 · MongoDB · Socket.IO · transformers.js (CLIP) · React 19 · Vite · Tailwind CSS 4 · Leaflet + OpenStreetMap · Recharts · Flutter (Material 3) · Firebase Cloud Messaging (optional) · Vitest · Playwright
