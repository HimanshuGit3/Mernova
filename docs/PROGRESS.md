# FixIt Campus: progress

Source of truth: `docs/SPEC.md`. Continue from the first unchecked item.

## Phase checklist

- [x] Phase 0: Environment check and scaffold
- [x] Phase 1: Design documents
- [x] Phase 2: Server foundation and auth
- [x] Phase 3: Core domain API and seed data
- [x] Phase 4: Realtime, notifications and jobs
- [x] Phase 5: Web app (core) with the full design system
- [x] Phase 6: Mobile app (core) — analyze, test, APK and emulator QA done 2026-11-20
- [x] Phase 7: AI triage and duplicate detection (server + web + mobile verified on the emulator)
- [x] Phase 8: QR scan-to-report (server + web verified; mobile scanner builds, not exercised on the emulator: no camera QR source)
- [x] Phase 9: Insights, Live Booth and transparency
- [x] Phase 10: Mobile delight and push — in-app realtime banners verified on the emulator; FCM background push needs Firebase (Needs the user, item 3)
- [x] Phase 11: Hardening and delivery — every section 13 gate passes, including the Flutter gate (2026-11-20)

### Mobile verification (2026-11-20)

Flutter 3.47.7 + Android SDK are now installed. Emulator `Medium_Phone_API_37.0` (cold boot if adb shows it `offline`).
Run: `npm run dev`, launch the emulator, then `cd mobile && flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000`.

Fixes found by running on the emulator:
- `AndroidManifest.xml`: `usesCleartextTraffic="true"`; Android blocked plain HTTP to the local API, so every request failed.
- In-app notification banners lived on the app-wide messenger and stayed on the login screen after sign-out (previous user's notification + a "View" link). Now cleared when the session ends.
- `timeAgo` showed "0 min ago" for 45–59 s; now "just now" under a minute (regression test `test/time_ago_test.dart`).

## Environment (detected 2026-10-18)

| Tool | Status |
| --- | --- |
| Node.js | v24.14.1 |
| npm | 11.4.1 |
| git | 2.48.1.windows.1 |
| MongoDB | `mongod` running and reachable at 127.0.0.1:27017 |
| Flutter | 3.47.7 at `C:\src\flutter` (installed 2026-11) |
| Android SDK / adb / emulator | `%LOCALAPPDATA%\Android\Sdk` (adb not on PATH); AVD `Medium_Phone_API_37.0` |
| Docker | CLI present, daemon not running (only needed for optional docker-compose) |

## Last check results

- Phase 0: `npm run dev` starts API + web; `GET /api/health` → `{"status":"ok"}`; Vite page 200; client build + lint clean. `flutter analyze` not run (Flutter missing).
- Phase 1: FR → endpoint mapping check: 26/26 functional requirements mapped, none missing.
- Phase 2: `npm test -w server` 35/35 passed (2 files); `npm run lint -w server` clean.
- Phase 3: `npm test -w server` 370/370 passed (6 files); lint clean; `npm run seed -w server` ran twice without errors (60 issues, 11 overdue).
- Phase 4: `npm test -w server` 386/386 passed (8 files); `npm run e2e` 7/7 scenario steps (AI + image duplicate hooks pending phase 7); lint clean.
- Phase 5: client lint clean, build ok, `npm run test:ui -w client` 9/9 passed; 64 web screenshots reviewed, all findings fixed.
- Phase 6 (2026-11-20): `flutter analyze` → No issues found; `flutter test` → 23 passed; `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:5000` → built. Emulator QA against the live API: student login, home, fixed-on-campus, notifications, profile, report (gallery photo → server AI "Plumbing 97%", GPS, submit → stored in MongoDB with photo, point and embedding), issue detail, live Socket.IO update when an admin assigns, sign-out, technician jobs + job detail + timeline. Screenshots in `docs/screenshots/mobile/`.
- Phase 7: server 403 passed + 1 skipped (real-model smoke passes via `npm run test:ai`), e2e 7/7 (fake and real CLIP), client lint/build/test:ui 9/9, 68 screenshots with no overflow. Mobile AI screens written, not yet analysed.
- Phase 8: Playwright 10/10 (new: add room + printable sticker), server lookup/inactive tests pass, printed sheet + Locations screenshots reviewed, no overflow. Mobile scanner + QR parser test written, not run.
- Phase 9: Playwright 11/11 (new: Live Booth updates on API create), lint/build clean, Insights + /live (1920×1080) screenshots reviewed, no overflow; chart palette validated.
- Phase 10: server 407 passed (4 new push tests); idempotency covered. Mobile onboarding, biometrics, offline queue (+8 unit tests), push written, NOT analysed/run (Flutter missing).
- Phase 11 (final gate run, one pass):
  - `npm test -w server` → Test Files 11 passed | 1 skipped; **Tests 414 passed** | 1 skipped (optional real-model test, passes via `npm run test:ai`)
  - `npm run e2e` → **7/7** scenario steps
  - `npm run lint -w client` → clean (exit 0); `npm run lint -w server` → clean
  - `npm run build -w client` → built
  - `npm run test:ui -w client` → **11 passed**
  - `npm run screenshots -w client` → 84 screenshots, no horizontal overflow; final review: no open visual issues (web)
  - `cd mobile && flutter analyze && flutter test && flutter build apk --debug` → no issues, 23 passed, APK built (re-run 2026-11-20)
  - Fresh-eyes subagent review: 7 findings, 6 fixed with regression tests, 1 accepted with reason (DECISIONS D-32/D-33)

## Known issues

- Run Playwright and screenshot commands from `C:\Users\Himanshu\Desktop\FixIt-Campus` (capital D); a lowercase cwd makes Node load `@playwright/test` twice on Windows ("did not expect test.describe()"). CI and normal shells are unaffected.

## Needs the user

1. ~~Install Flutter and the Android SDK~~ done.
2. **Windows Firewall**: allow inbound TCP 5000 on the Private network so a physical phone can reach the API (README, "Phone on the same Wi-Fi"). Needs admin rights.
3. **Firebase (optional, for background push)**: follow `docs/FIREBASE_SETUP.md`. The app works without it.
4. **Campus coordinates**: check `CAMPUS_CENTER_LAT/LNG` in `server/.env` (see DECISIONS.md D-03).
