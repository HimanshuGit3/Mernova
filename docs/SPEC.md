# FixIt Campus: build spec

Source of truth for building the project. Claude Code builds it autonomously, phase by phase (section 11).
Every key decision is already made in section 6. Record any further decision in `docs/DECISIONS.md`.

---

## 1. Product

**FixIt Campus** — *Spot it. Snap it. Sorted.*
Students report campus problems (broken projector, water leak, dead Wi-Fi zone, damaged furniture) from their phone with a photo, GPS, or a room QR code. AI suggests the category and catches duplicates. Admins triage and assign on a live web dashboard. Technicians resolve from their phone against SLA deadlines. Everyone sees progress in real time.

MERNOVA X rules (hard requirements):

- One Express REST API and one MongoDB, used by both apps. No second backend. No app talks to MongoDB directly.
- Shared accounts: an account created on one app signs in on the other.
- The demo must show data created on one platform appearing on the other.
- Web focuses on management and reporting; mobile on camera, GPS, notifications and biometrics.
- One repository with `client/`, `mobile/`, `server/`, a README and `.env.example` files.

Award targets (each feature must work end to end; a polished smaller set beats a broken larger one):

| Award | Features that earn it |
| --- | --- |
| Best Cross-Platform Integration | Real-time sync of every change across web and mobile (Socket.IO), shared notification inbox (FR-50) |
| Best AI / Advanced Feature | On-server CLIP model: photo → category suggestion; image-similarity duplicate detection (FR-51, FR-52) |
| Best Innovation | QR "scan to report" stickers for room-level indoor location (FR-53); Live Booth mode (FR-55) |
| Best Technical Implementation | SLA and priority engine, escalation, auto-close, smart assignment, idempotent offline queue (FR-54, FR-58) |
| Best Mobile App Experience | Onboarding, biometric unlock, dark mode, motion, before/after slider, offline queue (FR-57, FR-58) |
| Best Social Impact | "Me too" support instead of duplicate reports, "Fixed on campus" transparency feed, building health scores (FR-52, FR-56, FR-59) |
| People's Choice / Best Project | Live Booth mode at the expo booth, overall polish |

## 2. Roles

| Role | Main platform | Can do |
| --- | --- | --- |
| Student | Flutter app; web "My reports" | Register, report issues, support ("Me too") existing issues, track own issues, confirm or reopen a fix |
| Technician | Flutter app | See assigned jobs sorted by priority and SLA, start work, resolve with an after photo |
| Admin | React web app | Everything on the web: dashboard, assign, users, locations and QR stickers, insights, Live Booth mode |

Students self-register. Admins create technician (with skills) and admin accounts. Every account signs in on both apps. An admin on mobile sees a short screen pointing to the web app.

## 3. Stack (use the latest stable version of each; check compatibility notes in package READMEs)

**Server (`server/`)**
- Node.js LTS, Express 5, ES modules (Express 5 forwards rejected async handlers to the error handler; no wrapper needed)
- mongoose · jsonwebtoken · bcryptjs (pure JS, avoids native builds on Windows) · zod
- multer · sharp (resize photos, make thumbnails, generate seed images) · helmet · cors · express-rate-limit · morgan · dotenv
- socket.io (realtime) · @huggingface/transformers (CLIP, runs locally, no API key) · node-cron (jobs)
- firebase-admin (optional push; app works without it)
- Tests: vitest + supertest + socket.io-client, against a separate test database

**Web (`client/`)**
- React + Vite, JavaScript · react-router · axios · Tailwind CSS
- motion (animations) · lucide-react (icons) · sonner (toasts) · recharts · react-leaflet + leaflet + leaflet.heat (OpenStreetMap tiles, no API key) · socket.io-client · qrcode
- Font: Plus Jakarta Sans (self-hosted via @fontsource)
- Tests: Playwright (UI smoke tests and screenshots)

**Mobile (`mobile/`)**
- Flutter stable, Material 3, Android only
- dio · provider · flutter_secure_storage · shared_preferences · path_provider
- image_picker · geolocator · flutter_image_compress · cached_network_image · mobile_scanner (QR) · local_auth (biometric) · connectivity_plus · url_launcher · intl
- socket_io_client (check its compatibility table against the server's Socket.IO major version)
- firebase_core · firebase_messaging · flutter_local_notifications (optional push)
- flutter_launcher_icons (app icon). Font: Plus Jakarta Sans bundled as an asset (not fetched at runtime)

**Root:** npm workspaces (`server`, `client`), `concurrently` for `npm run dev`.

## 4. Repository layout

```text
fixit-campus/
├── client/
│   ├── src/
│   │   ├── api/            axios instance + one module per resource
│   │   ├── realtime/       socket client + hooks
│   │   ├── theme/          design tokens, theme provider (light/dark)
│   │   ├── components/     ui/ (Button, Card, Badge, Table, Drawer, Skeleton, EmptyState…), layout/, charts/, map/
│   │   ├── context/        auth, notifications
│   │   ├── pages/          auth/, dashboard/, issues/, insights/, live/, locations/, users/, student/, NotFound
│   │   ├── routes/
│   │   ├── App.jsx · main.jsx
│   ├── tests/              Playwright specs
│   ├── scripts/screenshots.mjs
│   └── .env.example
├── mobile/
│   ├── assets/             fonts/, images/, icon/
│   ├── lib/
│   │   ├── config/ · theme/ · models/ · services/ (api, auth, issues, realtime, push, offline_queue, biometric)
│   │   ├── providers/ · widgets/
│   │   ├── screens/        onboarding/, auth/, student/, technician/, common/ (notifications, profile, issue_detail, admin_redirect)
│   │   └── main.dart
│   ├── test/ · integration_test/
├── server/
│   ├── config/ · controllers/ · middleware/ · models/ · routes/
│   ├── services/           storage, ai, realtime, notifications, push, sla, assignment
│   ├── jobs/               sla escalation, auto-close
│   ├── utils/              ApiError, transitions.js, geo helpers
│   ├── scripts/            seed.js, e2e.js
│   ├── tests/
│   ├── uploads/ · .cache/  (both git-ignored)
│   ├── app.js · server.js  (app builder vs. listener + socket attach)
│   └── .env.example
├── docs/                   SPEC.md, API.md, ARCHITECTURE.md, DECISIONS.md, PROGRESS.md, DEMO.md,
│                           FIREBASE_SETUP.md, DEPLOY.md, REPORT-NOTES.md, notes/, screenshots/
├── .vscode/launch.json     Flutter run configs for emulator and phone
├── docker-compose.yml · .github/workflows/ci.yml
├── .gitignore · README.md · package.json
```

## 5. Data model

**users**: name · email (unique, lowercase) · passwordHash (`select: false`) · role `student|technician|admin` · department · skills (technicians: categories they handle) · fcmTokens [String] · isActive · timestamps

**locations**: code (unique, e.g. `B-204`) · building · floor · room · label · point (GeoJSON) · isActive · timestamps

**issues**

| Field | Notes |
| --- | --- |
| title, description | title max 100, description max 1000 |
| category | `electrical` · `plumbing` · `furniture` · `network` · `cleanliness` · `safety` · `other` |
| severity | `low` · `medium` · `high` · `critical` (reporter picks, default medium; admin may change) |
| photoPath, thumbPath | original resized to max 1600 px + 400 px thumbnail (sharp) |
| resolutionPhotoPath, resolutionThumbPath, resolutionNote | set on resolve |
| point | GeoJSON Point `[lng, lat]` from GPS, or the scanned location's point |
| locationRef | ObjectId → locations (when a QR was scanned) |
| landmark | free text; required when there is neither GPS nor a QR location |
| status | `open` · `assigned` · `in_progress` · `resolved` · `closed` · `reopened` · `rejected` |
| reportedBy, assignedTo | ObjectId → users |
| supporters | [ObjectId → users] ("Me too") |
| priorityScore, dueAt, escalatedAt | SLA and priority engine (section 6) |
| ai | `{ suggestedCategory, confidence, accepted }` |
| embedding | [Number] CLIP image embedding, `select: false` |
| duplicateOf, rejectionReason | moderation |
| clientRequestId | unique sparse index; makes offline retries idempotent |
| statusHistory | [{ status, changedBy (user or `system`), at, note }] append-only |
| timestamps | |

**notifications**: user · type (`issue_created`, `issue_assigned`, `status_changed`, `sla_overdue`, `me_too`) · title · body · issue · readAt · timestamps

Indexes: users.email (unique) · locations.code (unique) · issues {status, priorityScore -1} · issues {status, createdAt -1} · issues.assignedTo · issues.reportedBy · issues.point (2dsphere) · issues.clientRequestId (unique, sparse) · notifications {user, readAt, createdAt -1}

Visibility: students see their own issues, issues they support, the campus-wide "Fixed on campus" feed, and nearby-duplicate candidates (both without reporter identity). Technicians see issues assigned to them. Admins see all. A request for an issue the caller may not see returns 404.

## 6. Decisions (already made: implement, do not ask)

**D1. Status transitions** (`server/utils/transitions.js`, the only place that decides):

| From | To | Who | Condition |
| --- | --- | --- | --- |
| open, reopened | assigned | admin | technician is active and has role technician |
| assigned, in_progress | assigned (reassign) | admin | records a history entry; in_progress returns to assigned |
| assigned | in_progress | the assigned technician | |
| in_progress | resolved | the assigned technician | after photo required; note optional |
| resolved | closed | the reporter, or admin | |
| resolved | reopened | the reporter | reason required; within 7 days of resolution |
| open, reopened | rejected | admin | reason required; `duplicateOf` optional |
| resolved | closed | system | auto-close after `AUTO_CLOSE_HOURS` (default 72) with no reporter action |

`closed` and `rejected` are terminal. Test every allowed and every forbidden transition.

**D2. SLA and priority.** dueAt = createdAt + SLA by severity: critical 4 h, high 24 h, medium 72 h, low 168 h. Overdue = now > dueAt and status not in resolved/closed/rejected. priorityScore = severityWeight (critical 100, high 60, medium 30, low 10) + 8 × supporters + 2 × min(48, hours overdue). Recompute on every change and hourly in a job. On first becoming overdue: notify admins once and set escalatedAt.

**D3. Smart assignment.** Suggest active technicians whose skills include the category, sorted by open workload (assigned + in_progress) ascending; show the top 3 with their load. Admin still chooses.

**D4. Realtime.** Socket.IO on the same server. JWT in the handshake `auth.token`. Rooms: `user:<id>`, `role:admin`. Events in section 10.

**D5. Notifications.** Every notification is saved (inbox), emitted over Socket.IO, and sent by FCM when Firebase is configured. Without Firebase everything still works while the app is open; `docs/FIREBASE_SETUP.md` lists the manual console steps for background push.

**D6. AI.** `@huggingface/transformers` with `Xenova/clip-vit-base-patch32`, loaded once (singleton), warmed up in the background at server start, cached in `server/.cache/models`. Zero-shot labels per category (several phrasings each, e.g. "a photo of a broken light or electrical switch"). Every AI call has a timeout (`AI_TIMEOUT_MS`); on failure or timeout, return no suggestion and carry on. Tests inject a fake AI service; tests never download models. Calibrate the duplicate similarity threshold on the seed images and record the value in DECISIONS.md.

**D7. Duplicates.** Candidates: issues not closed/rejected, created in the last 7 days, within `DUPLICATE_RADIUS_M` (default 50 m, `$geoNear`) or at the same `locationRef`. Rank by cosine similarity of embeddings (same category boosts). Return the top 3 above the threshold. The student can tap "Me too" (adds a supporter, notifies the reporter, raises priority) instead of filing a new issue.

**D8. Mobile API address.** Emulator: `http://10.0.2.2:5000`. Physical phone: `http://<laptop LAN IPv4>:5000` (find with `ipconfig`). Both as configs in `.vscode/launch.json` via `--dart-define=API_BASE_URL=...`. Allowing port 5000 through Windows Firewall is a manual step for the user (README). Cleartext HTTP only in debug builds (`android/app/src/debug/AndroidManifest.xml`).

**D9. QR codes.** Content is `FIXIT:LOC:<code>`. Admins print an A4 sheet of stickers from the web (QR + room label + "Scan in FixIt Campus"). Scanning in the app fetches the location and pre-fills building, room and coordinates. This gives room-level accuracy indoors, where GPS is unreliable.

**D10. Storage and deployment.** Photos on local disk behind `services/storage.js` (swappable for cloud later). Prepare Dockerfile, docker-compose and GitHub Actions CI; write `docs/DEPLOY.md`; deploy nothing.

**D11. Web token storage.** JWT in localStorage with an axios interceptor; any 401 clears it and returns to Login. Explain the XSS trade-off in the phase notes.

## 7. Requirements

**Functional.** Core (FR-01 to FR-34) must all work before any award feature starts.

| ID | Requirement | Platform |
| --- | --- | --- |
| FR-01 | Student registers (name, email, password) | Both |
| FR-02 | Log in; same account on web and mobile | Both |
| FR-03 | Log out; tokens expire (`JWT_EXPIRES_IN`) | Both |
| FR-04 | Admin creates technician (with skills) and admin accounts | Web |
| FR-05 | Admin deactivates a user | Web |
| FR-10 | Report an issue: camera or gallery photo, GPS, category, severity, landmark, description | Mobile |
| FR-11 | My reports with status, SLA and history | Both |
| FR-12 | Reporter confirms a fix or reopens it | Mobile + web |
| FR-14 | Report from the web with a typed location | Web |
| FR-20 | Technician's jobs, sorted by priority, with SLA countdown | Mobile |
| FR-21 | Start work; resolve with after photo and note | Mobile |
| FR-23 | Open the issue location in a maps app | Mobile |
| FR-30 | Admin dashboard: KPIs, needs-attention list, activity feed, mini map | Web |
| FR-31 | Issues table: filter (status, category, severity, building, date), search, sort, paginate; issue detail with photos, map, history, assignment | Web |
| FR-32 | Insights: counts by status/category, resolution-time trend | Web |
| FR-34 | Every view updates live without reload | Web + mobile |
| FR-50 | Realtime sync and shared notification inbox (bell on web, screen on mobile) | Both |
| FR-51 | AI category suggestion from the photo, shown as a chip with confidence; student accepts or changes | Mobile + web |
| FR-52 | Duplicate detection before submit with "Me too" support | Mobile |
| FR-53 | Locations registry, printable QR sheet, scan-to-report | Web + mobile |
| FR-54 | SLA, priority, escalation, auto-close, smart assignment suggestions | Server + both |
| FR-55 | Live Booth mode: full-screen live map, live feed, animated counters | Web |
| FR-56 | Campus heatmap, building health scores, CSV export | Web |
| FR-57 | Onboarding, biometric unlock, dark mode, motion, before/after slider | Mobile (dark mode on web too) |
| FR-58 | Offline report queue: save when offline, auto-send when online, idempotent via `clientRequestId` | Mobile |
| FR-59 | "Fixed on campus" feed of resolved issues with before/after photos, no reporter identity | Both |

**Non-functional**

| ID | Requirement |
| --- | --- |
| NFR-01 | Passwords stored only as bcrypt hashes |
| NFR-02 | Every protected route and socket connection checks the token and role on the server |
| NFR-03 | All input validated on the server with zod |
| NFR-04 | Secrets only in `.env`; startup fails fast if a required variable is missing |
| NFR-05 | CORS (HTTP and Socket.IO) allows only `CLIENT_ORIGIN` |
| NFR-06 | Uploads: JPEG/PNG only, max 5 MB, random names, re-encoded by sharp |
| NFR-07 | Login and register rate-limited per IP |
| NFR-08 | No app keeps its own copy of issue data beyond what a screen shows (offline queue holds only unsent reports) |
| NFR-09 | One error shape; 400 / 401 / 403 / 404 / 409 / 500; no stack traces outside development |
| NFR-10 | Loading (skeletons), empty and error states on every screen |
| NFR-11 | Lists paginated; dashboard queries use indexes; thumbnails in lists |
| NFR-12 | Phone compresses photos before upload |
| NFR-13 | ESLint + Prettier clean; `flutter analyze` clean |
| NFR-14 | WCAG AA contrast, visible focus, keyboard-usable web, labels on icon buttons, 48 dp touch targets |
| NFR-15 | README lets a fresh clone run everything |

## 8. Design system and visual quality bar

The frontend must look like a polished product, not a template. Same brand on web and mobile.

### 8.1 Tokens

- Colours (from the MERNOVA X / Presidency palette):
  - Brand: navy-900 `#0F1F3D`, navy-700 `#1B3260`, gold-500 `#C9962B`, gold-300 `#E4BC63`
  - Light: background `#F5F6F9`, surface `#FFFFFF`, text `#1A2233`, muted `#5B667C`, border `#DFE3EC`
  - Dark: background `#0B1223`, surface `#131D36`, text `#E8ECF6`, muted `#9AA6C3`, border `#26345A`
  - Status: open `#3B7BD0` · assigned `#7C5CD6` · in_progress `#E0A030` · resolved `#1F9E89` · closed `#64748B` · reopened `#E2654B` · rejected `#9CA3AF`
  - Severity: low `#64748B` · medium `#3B7BD0` · high `#E0A030` · critical `#DC2626`
- Type: Plus Jakarta Sans 400/500/700/800. Clear scale (12/14/16/20/24/32/48). Numbers in KPI cards use tabular figures.
- Shape: cards radius 12, inputs and buttons 10, chips fully rounded. 4/8 px spacing grid. Soft shadows in light mode, borders in dark mode.
- Motion: 150–250 ms ease-out; staggered list entry; shared-element transitions to issue detail; animated counters. Respect reduced-motion settings. No gratuitous animation.
- Illustrations: build from shapes, gradients and icons. No stock photos, no copyrighted characters or logos. Create an original FixIt Campus logo mark (pin + wrench) as SVG; generate the web favicon and the Android app icon from it.

### 8.2 Web layout

- Auth pages: split screen. Left brand panel (navy, gold accents, abstract campus-grid pattern, tagline, three feature highlights); right form card. Demo-account quick-fill buttons in development only.
- Admin shell: collapsible sidebar (Dashboard, Issues, Map, Insights, Live, Locations, Users); top bar with search, notification bell (unread badge, dropdown), light/dark toggle, profile menu.
- Dashboard: 4 KPI cards (Open, Overdue, Resolved this week, Average resolution time) with trend delta and sparkline; "Needs attention" list (overdue and critical, by priority); live activity feed; mini map; category donut.
- Issues: data table (sticky header, status and severity pills, SLA chip, thumbnail, supporters count) with filters and URL-synced state; issue detail page with photo lightbox, before/after slider, status timeline, AI chip, map, smart-assign panel.
- Live Booth (`/live`): dark, full-screen, readable from 3 m: live map with pulsing new pins, animated counters, scrolling feed of new reports and fixes, an on-screen QR for visitors. Shows no personal data.
- Student web: My reports cards, report form (FR-14), Fixed on campus feed.
- Responsive from 360 px to 1920 px.

### 8.3 Mobile layout

- Native splash in brand navy; onboarding (3 pages, shown once).
- Student bottom navigation: Home (my reports + Fixed on campus carousel), centre Report button, Notifications, Profile (theme, biometric toggle, logout).
- Report flow: photo (camera/gallery) or "Scan room QR" → "Analysing…" shimmer → details pre-filled (AI category chip with confidence, location from QR or GPS with a map preview, severity selector, description) → duplicate sheet ("Similar issue nearby — Me too?") → upload with progress → success animation.
- Technician: Jobs (priority order, SLA countdown chips, overdue in red), job detail (navigate, Start, Resolve with after photo and note).
- Issue detail: hero photo, status timeline, before/after slider, confirm/reopen.
- Offline banner and a "waiting to send" badge for queued reports. Haptic feedback on key actions.

### 8.4 Visual QA loop (required for every UI phase)

1. Web: `npm run screenshots -w client` uses Playwright to capture every route at 1440×900 and 390×844, light and dark, logged in as each relevant role with seed data, into `docs/screenshots/web/`.
2. Mobile: with an emulator running (`flutter emulators --launch <id>`, `flutter run`), capture each main screen with `adb exec-out screencap -p > docs/screenshots/mobile/<screen>.png`, navigating with `adb shell input`. If no emulator can run, record it in PROGRESS.md and use widget tests for layout checks.
3. Open every screenshot and check: alignment and spacing on the grid; no overflow, clipping or overlapping text; AA contrast; one clear primary action per screen; consistent radii, icons and type scale; loading, empty and error states exist; dark mode correct; no lorem ipsum or placeholder text; looks good on the 390 px width.
4. Fix every problem found, re-capture, and repeat until a pass finds nothing. Keep the final screenshots; they feed the poster and report.

## 9. Configuration

| Part | Variable | Development value |
| --- | --- | --- |
| server | `PORT` | `5000` |
| server | `MONGODB_URI` / `MONGODB_URI_TEST` | `mongodb://127.0.0.1:27017/fixit` / `.../fixit_test` |
| server | `JWT_SECRET`, `JWT_EXPIRES_IN` | long random string, `7d` |
| server | `CLIENT_ORIGIN` | `http://localhost:5173` |
| server | `UPLOAD_DIR` | `uploads` |
| server | `SEED_PASSWORD` | development password for all seed accounts |
| server | `CAMPUS_CENTER_LAT`, `CAMPUS_CENTER_LNG` | Presidency University, Bengaluru campus. Look up the coordinates; if unsure, record your value in DECISIONS.md for the user to correct |
| server | `AI_TRIAGE_ENABLED`, `AI_MODEL_ID`, `AI_TIMEOUT_MS` | `true`, `Xenova/clip-vit-base-patch32`, `8000` |
| server | `DUPLICATE_RADIUS_M`, `DUPLICATE_SIMILARITY` | `50`, calibrated value |
| server | `AUTO_CLOSE_HOURS` | `72` |
| server | `FIREBASE_SERVICE_ACCOUNT` | optional path to the key JSON, outside the repo |
| client | `VITE_API_URL`, `VITE_SOCKET_URL` | `http://localhost:5000/api`, `http://localhost:5000` |
| mobile | `API_BASE_URL` | `--dart-define`; see D8 |

`.gitignore`: `node_modules/`, `.env`, `server/uploads/`, `server/.cache/`, build outputs, Flutter build/generated folders, `google-services.json`, any service-account JSON, Playwright reports.

## 10. Realtime events

| Event | Sent to | Payload |
| --- | --- | --- |
| `issue:created` | `role:admin` | issue summary (no embedding) |
| `issue:updated` | `role:admin`, reporter, supporters, assignee | issue summary + what changed |
| `notification:new` | `user:<id>` | the saved notification |
| `stats:changed` | `role:admin` | nothing; clients refetch KPIs (throttled to once per 2 s) |

Clients reconnect automatically and refetch their current view after reconnecting.

---

## 11. Build phases

Each phase: implement → run its checks with real output → visual QA for UI → notes → commits and merge → PROGRESS.md. Core (phases 0–6) must fully work before award phases (7–10).

### Phase 0: Environment check and scaffold
- Check `node -v`, `npm -v`, `git --version`, MongoDB reachable at `127.0.0.1:27017`, `flutter --version`, `flutter doctor`, `flutter emulators`. Missing system software → "Needs the user"; stop only if Node.js or MongoDB is missing.
- Create the layout (section 4), npm workspaces, `docs/PROGRESS.md` (checklist of all phases), `docs/DECISIONS.md`, `.gitignore`, `.env.example` files, README skeleton with detected versions.
- Server: Express 5 with `app.js`/`server.js` split, `GET /api/health`. Client: Vite React + Tailwind + fonts + design tokens. Mobile: `flutter create --org com.fixitcampus --project-name fixit_campus mobile` (Android), brand theme and bundled font.
- **Checks:** `npm run dev` starts both; health returns ok; Vite page loads; `flutter analyze` clean.

### Phase 1: Design documents
- `docs/API.md`: every endpoint (method, path, roles, request, example response, error cases) for auth, issues (create, analyse photo, duplicates, me-too, list, get, assign, transition, feed), users, locations, notifications, insights, export, health.
- `docs/ARCHITECTURE.md`: Mermaid diagrams for the system (web + mobile → API + Socket.IO → MongoDB; AI service; FCM) and the report → assign → resolve → confirm sequence.
- **Checks:** every FR in section 7 maps to at least one endpoint or event (list the mapping in API.md).

### Phase 2: Server foundation and auth
- Config with fail-fast validation; Mongo connection; helmet, cors, JSON size limit, morgan (dev), rate limits; `validate` (zod), `auth` (verify JWT, load user, reject inactive), `requireRole`, `notFound`, `errorHandler` (duplicate key → 409, zod → 400 with field details).
- User model; register (always `student`, ignoring any role in the body), login, me, logout, save FCM token.
- **Checks:** tests for validation (400), duplicate email (409), wrong password (401), no token (401), student on admin route (403), role escalation attempt ignored. `npm test -w server` passes.

### Phase 3: Core domain API and seed data
- Issue, Location and Notification models with indexes. Upload pipeline: multer → sharp (re-encode, max 1600 px, 400 px thumbnail) → storage service. Serve `/uploads`.
- Create, list (role-scoped, filters, search, sort by date or priority, pagination), get, transitions (D1), assign + smart suggestions (D3), SLA and priority (D2), users admin, locations CRUD, notifications (list, mark read, mark all read), insights (status/category counts, resolution-time trend, building health), CSV export, Fixed on campus feed.
- `scripts/seed.js` (development only, `--reset` flag): CAMPUS_CENTER-based campus with 6 buildings and ~30 room locations; 1 admin, 4 technicians with skills, 8 students; ~60 issues over the last 30 days across all statuses, categories and severities, some overdue, some with supporters, realistic titles ("Projector flickering in B-204"); illustrative seed photos generated with sharp from original SVG art (one style per category) plus after photos for resolved ones. Print the demo accounts.
- `docs/requests.http` for manual testing.
- **Checks:** tests for upload type/size (400), visibility rules (404), every allowed and forbidden transition, assignment validation, SLA/priority calculation, pagination bounds, CSV export. Seed runs twice without errors.

### Phase 4: Realtime, notifications and jobs
- Socket.IO with JWT handshake and rooms (D4); events (section 10) from the service layer, not controllers.
- Notification service: save + emit + push (push is a no-op until Firebase is configured).
- Jobs: hourly priority recompute and overdue escalation; auto-close (D1).
- `scripts/e2e.js` (`npm run e2e`): starts the app on the test database with an ephemeral port and runs the full scenario from section 13 at API level, including receiving the socket events and notifications.
- **Checks:** server tests + `npm run e2e` pass.

### Phase 5: Web app (core) with the full design system
- Design system components (8.1/8.2), theme provider with light/dark, auth pages, admin shell, Dashboard, Issues table, Issue detail with assignment, Users, Student pages, Notifications bell, realtime hooks (FR-34/FR-50), 404. Fix Leaflet's default marker icons under Vite.
- Playwright: login as each role; admin filters issues and assigns one; student sees only their own reports; a realtime update appears without reload.
- **Checks:** lint, build, `npm run test:ui -w client` pass; visual QA loop (8.4) completed with no open issues.

### Phase 6: Mobile app (core)
- Brand theme (light/dark), dio client with token interceptor and 401 handling, secure token storage, provider state, realtime service, `.vscode/launch.json` (D8), Android permissions (only what plugins need), debug-only cleartext.
- Screens: login/register, admin redirect, student home, report flow (photo, GPS with permission handling and timeout, severity, landmark when no GPS, compression, progress), my reports, issue detail (confirm/reopen), technician jobs and job detail, notifications, profile.
- **Checks:** `flutter analyze` clean; widget tests for login validation, report form validation and status chips; `flutter build apk --debug` succeeds; on the emulator, a report from the phone appears live on the web dashboard; visual QA loop completed.

### Phase 7: AI triage and duplicate detection (FR-51, FR-52)
- AI service per D6; `POST /api/issues/analyse` returns the suggested category with confidence and duplicate candidates; embeddings stored on create; Me-too endpoint and notification.
- Mobile: "Analysing…" step, AI chip, duplicate sheet with Me too. Web: AI chip on issue detail and in the web report form.
- **Checks:** unit tests with a fake AI service; one optional real-model smoke test (`npm run test:ai -w server`, skipped in CI) showing correct top category on at least 5 of 7 seed images; e2e still passes; visual QA.

### Phase 8: QR scan-to-report (FR-53)
- Web Locations page (table, create/edit, print A4 QR sheet with print CSS). Mobile scanner screen (camera permission, torch toggle, invalid-code handling) pre-filling the report.
- **Checks:** tests for lookup by code and inactive locations; widget test for QR parsing; printed sheet screenshot reviewed.

### Phase 9: Insights, Live Booth and transparency (FR-55, FR-56, FR-59)
- Insights page: heatmap, building health table with score bars, trends, CSV export button. Live Booth mode. Fixed on campus feed on web and mobile.
- **Checks:** Playwright test that `/live` updates when an issue is created via the API; visual QA at 1920×1080 for `/live`.

### Phase 10: Mobile delight and push (FR-57, FR-58, optional push)
- Onboarding, biometric unlock with local_auth (MainActivity must extend `FlutterFragmentActivity`), dark mode, shared-element transitions, before/after slider, haptics, app icon from the logo.
- Offline queue: store unsent reports (JSON + image file) on device, show a badge, auto-send on reconnect with backoff, `clientRequestId` makes retries safe (server returns the existing issue on repeat).
- FCM: write `docs/FIREBASE_SETUP.md`; implement token registration, foreground display and tap-to-open, all disabled cleanly when `google-services.json` is absent.
- **Checks:** tests for queue retry logic and server idempotency (same `clientRequestId` twice → one issue); `flutter build apk --debug` works with and without Firebase files; visual QA.

### Phase 11: Hardening and delivery
- Audit every NFR; fix gaps. Run a fresh-eyes review of the whole codebase with a subagent (correctness and security gaps only) and fix what it finds.
- README (prerequisites, setup per part, env vars, seed accounts, run commands, APK build, firewall and phone-on-same-Wi-Fi notes, troubleshooting). `docs/DEMO.md`: a 5-minute booth script following section 13 plus a fallback plan (laptop hotspot, emulator only). `docs/REPORT-NOTES.md`: architecture, features, testing summary, screenshots list, future scope (material for the report and poster).
- Dockerfile, docker-compose (api + mongo), GitHub Actions CI (server tests, e2e, client lint/build, flutter analyze/test). `docs/DEPLOY.md`.
- Release APK command documented: `flutter build apk --release --dart-define=API_BASE_URL=<deployed API URL>`.
- **Checks:** section 13 gates all pass.

## 12. Out of scope

iOS builds, payments, chat, multiple campuses, email verification and password reset by email, admin features on mobile, deploying anything.

## 13. Final acceptance

**Demo scenario** (automated at API level by `npm run e2e`; manually on emulator + web):
1. A student registers on the phone and signs in on the web with the same account.
2. The student scans a room QR, takes a photo; AI suggests the category; no duplicate found; submits.
3. The admin's dashboard and Live Booth show it instantly; the admin assigns the suggested technician.
4. The technician's phone gets the notification; the job shows its SLA countdown; they start, then resolve with an after photo.
5. The student gets the notification and confirms; the before/after appears in Fixed on campus; insights update.
6. A second student reports the same problem; the duplicate sheet appears; "Me too" raises its priority instead of creating a new issue.
7. Security: student on an admin endpoint → 403; no token → 401; PDF as photo → 400; invalid transition → 409 or 403 as designed.

**Quality gates** (all must pass in one final run, with output shown):
- `npm test -w server` · `npm run e2e` · `npm run lint -w client` · `npm run build -w client` · `npm run test:ui -w client`
- `cd mobile && flutter analyze && flutter test && flutter build apk --debug`
- Visual QA screenshots in `docs/screenshots/` reviewed with no open issues
- `docs/PROGRESS.md` shows every phase complete; anything still waiting on the user is listed under "Needs the user" and the app works without it
