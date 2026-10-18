# FixIt Campus: progress

Source of truth: `docs/SPEC.md`. Continue from the first unchecked item.

## Phase checklist

- [x] Phase 0: Environment check and scaffold
- [x] Phase 1: Design documents
- [x] Phase 2: Server foundation and auth
- [x] Phase 3: Core domain API and seed data
- [x] Phase 4: Realtime, notifications and jobs
- [x] Phase 5: Web app (core) with the full design system
- [ ] Phase 6: Mobile app (core) — **code complete; checks pending Flutter install** (analyze, test, APK, emulator QA)
- [x] Phase 7: AI triage and duplicate detection (server + web verified; mobile part pending Flutter)
- [x] Phase 8: QR scan-to-report (server + web verified; mobile scanner pending Flutter)
- [x] Phase 9: Insights, Live Booth and transparency
- [ ] Phase 10: Mobile delight and push — **server push done + tested; mobile code complete, checks pending Flutter install**
- [ ] Phase 11: Hardening and delivery

## Environment (detected 2026-10-18)

| Tool | Status |
| --- | --- |
| Node.js | v24.14.1 |
| npm | 11.4.1 |
| git | 2.48.1.windows.1 |
| MongoDB | `mongod` running and reachable at 127.0.0.1:27017 |
| Flutter | **not installed** (not on PATH, not in common locations) |
| Android SDK / adb / emulator | **not installed** |
| Docker | CLI present, daemon not running (only needed for optional docker-compose) |

## Last check results

- Phase 0: `npm run dev` starts API + web; `GET /api/health` → `{"status":"ok"}`; Vite page 200; client build + lint clean. `flutter analyze` not run (Flutter missing).
- Phase 1: FR → endpoint mapping check: 26/26 functional requirements mapped, none missing.
- Phase 2: `npm test -w server` 35/35 passed (2 files); `npm run lint -w server` clean.
- Phase 3: `npm test -w server` 370/370 passed (6 files); lint clean; `npm run seed -w server` ran twice without errors (60 issues, 11 overdue).
- Phase 4: `npm test -w server` 386/386 passed (8 files); `npm run e2e` 7/7 scenario steps (AI + image duplicate hooks pending phase 7); lint clean.
- Phase 5: client lint clean, build ok, `npm run test:ui -w client` 9/9 passed; 64 web screenshots reviewed, all findings fixed.
- Phase 6: mobile code written (26 Dart files, 10 tests); static import check passed. `flutter analyze` / `flutter test` / `flutter build apk --debug` / emulator QA NOT RUN (Flutter + Android SDK missing).
- Phase 7: server 403 passed + 1 skipped (real-model smoke passes via `npm run test:ai`), e2e 7/7 (fake and real CLIP), client lint/build/test:ui 9/9, 68 screenshots with no overflow. Mobile AI screens written, not yet analysed.
- Phase 8: Playwright 10/10 (new: add room + printable sticker), server lookup/inactive tests pass, printed sheet + Locations screenshots reviewed, no overflow. Mobile scanner + QR parser test written, not run.
- Phase 9: Playwright 11/11 (new: Live Booth updates on API create), lint/build clean, Insights + /live (1920×1080) screenshots reviewed, no overflow; chart palette validated.
- Phase 10: server 407 passed (4 new push tests); idempotency covered. Mobile onboarding, biometrics, offline queue (+8 unit tests), push written, NOT analysed/run (Flutter missing).

## Known issues

- Run Playwright and screenshot commands from `C:\Users\Himanshu\Desktop\FixIt-Campus` (capital D); a lowercase cwd makes Node load `@playwright/test` twice on Windows ("did not expect test.describe()"). CI and normal shells are unaffected.

## Needs the user

1. **Install Flutter (stable) and the Android SDK** (Android Studio), then run `flutter doctor --android-licenses` and accept the licences. Until then the mobile app is written but cannot be analysed, tested, built or screenshotted on this machine. After installing, run inside `mobile/`:
   `flutter create --org com.fixitcampus --project-name fixit_campus --platforms android .`
   (generates the Gradle wrapper and the remaining platform files without overwriting the committed ones), then `flutter pub get`.
2. **Windows Firewall**: allow inbound TCP 5000 on the Private network so a physical phone can reach the API (README, "Phone on the same Wi-Fi"). Needs admin rights.
3. **Firebase (optional, for background push)**: follow `docs/FIREBASE_SETUP.md` once it exists. The app works without it.
4. **Campus coordinates**: check `CAMPUS_CENTER_LAT/LNG` in `server/.env` (see DECISIONS.md D-03).
