# FixIt Campus: progress

Source of truth: `docs/SPEC.md`. Continue from the first unchecked item.

## Phase checklist

- [x] Phase 0: Environment check and scaffold
- [x] Phase 1: Design documents
- [ ] Phase 2: Server foundation and auth
- [ ] Phase 3: Core domain API and seed data
- [ ] Phase 4: Realtime, notifications and jobs
- [ ] Phase 5: Web app (core) with the full design system
- [ ] Phase 6: Mobile app (core)
- [ ] Phase 7: AI triage and duplicate detection
- [ ] Phase 8: QR scan-to-report
- [ ] Phase 9: Insights, Live Booth and transparency
- [ ] Phase 10: Mobile delight and push
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

## Known issues

- None yet.

## Needs the user

1. **Install Flutter (stable) and the Android SDK** (Android Studio), then run `flutter doctor --android-licenses` and accept the licences. Until then the mobile app is written but cannot be analysed, tested, built or screenshotted on this machine. After installing, run inside `mobile/`:
   `flutter create --org com.fixitcampus --project-name fixit_campus --platforms android .`
   (generates the Gradle wrapper and the remaining platform files without overwriting the committed ones), then `flutter pub get`.
2. **Windows Firewall**: allow inbound TCP 5000 on the Private network so a physical phone can reach the API (README, "Phone on the same Wi-Fi"). Needs admin rights.
3. **Firebase (optional, for background push)**: follow `docs/FIREBASE_SETUP.md` once it exists. The app works without it.
4. **Campus coordinates**: check `CAMPUS_CENTER_LAT/LNG` in `server/.env` (see DECISIONS.md D-03).
