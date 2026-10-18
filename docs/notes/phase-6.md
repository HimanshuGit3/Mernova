# Phase 6: Mobile app (core)

> **Status: code complete, checks pending.** Flutter and the Android SDK are not installed on the build machine (see PROGRESS "Needs the user"), so `flutter analyze`, `flutter test`, `flutter build apk --debug`, the emulator demo and the mobile screenshots have not run yet. The code was written to pass the strict analyzer settings; imports and file references were checked with a script.

## What was built

- **Platform**: Android manifest with only the permissions the plugins need (internet, camera, location, biometric, notifications, vibrate), `queries` for opening maps, `MainActivity` extending `FlutterFragmentActivity` (needed by local_auth), and cleartext HTTP **only in the debug manifest** (D8). `.vscode/launch.json` has emulator (`10.0.2.2`) and phone (LAN IP) configurations.
- **Brand**: Material 3 theme in light/dark from the shared tokens, the bundled Plus Jakarta Sans font, a natively painted logo, and generated launcher/splash images.
- **Services**: `ApiClient` (dio) adds the JWT, turns every failure into `ApiException` (one error shape, field details) and reports 401s; `TokenStore` keeps the JWT and profile in Android Keystore-backed secure storage; `RealtimeService` (Socket.IO with JWT handshake, auto-reconnect, `reconnected` event); `IssuesService` (list, detail, feed, multipart create with upload progress, transitions, Me too); `LocationService` (permission handling, 12 s timeout for indoor GPS, settings shortcut); `PhotoService` (camera/gallery and compression to about 1600 px, quality 72, NFR-12).
- **State** (provider): `Session` (restore, login, register, logout, sign-out on 401, offline start with the cached profile), `ThemeController`, `NotificationsController` (shared inbox, live updates, unread badge).
- **Screens**: login/register; admin redirect (admins use the web); student shell (Home, Fixed, centre Report button, Alerts, Profile); home with the Fixed on campus carousel and My reports; report flow (photo, then details with GPS card or required landmark, then upload progress, then success animation); issue detail (Hero photo, chips, before/after slider, timeline, open in Maps, confirm/reopen, start/resolve with after photo, Me too); technician Jobs (priority order, SLA countdown, overdue count); notifications; profile (theme, sign out).
- **Tests**: widget tests for login validation, report form validation (incl. the no-GPS landmark rule), status/severity/category chips and the SLA chip, plus unit tests for `validateReport`, `slaState` and JSON parsing.

## Key choices and why

- **Server decides, app displays.** Buttons come from `allowedActions` in the issue detail, so the app can never offer a transition the server would refuse.
- **Events trigger refetches** (`LiveRefresh` mixin, debounced, plus a full refetch after reconnect), the same pattern as the web.
- **One `clientRequestId` per report** (UUID v4) from the moment the flow opens, so a retried upload can never create two issues.
- **Location fallback.** Indoors GPS often fails; after 12 s the form switches to "landmark required" instead of blocking. A scanned room (phase 8) replaces both.
- **Secure storage for the token**, never SharedPreferences (which is plain XML on the device).

## Concepts from fundamentals

- **Widget tree and state.** Flutter rebuilds widgets from state; `ChangeNotifier` + `provider` lets screens listen to shared state (session, inbox) and rebuild when it changes.
- **Hero transitions.** Two widgets with the same `tag` on consecutive routes animate between their positions: the list thumbnail grows into the detail header.
- **Runtime permissions.** Android asks the user for camera and location at the moment of use; the app must handle "denied" and "denied forever" (send the user to Settings) gracefully.
- **`--dart-define`.** Compile-time constants: the same code builds for the emulator (`10.0.2.2` is the host machine) or a phone on Wi-Fi (the laptop's LAN IP).
- **Multipart upload.** A photo and text fields are sent as `multipart/form-data`; dio reports bytes sent for the progress bar.

## Checks

| Check | Result |
| --- | --- |
| `flutter analyze` | **Not run**: Flutter not installed |
| `flutter test` | **Not run**: Flutter not installed (tests written: 10) |
| `flutter build apk --debug` | **Not run**: Android SDK not installed |
| Emulator: phone report appears live on the web dashboard | **Not run**: no emulator. The same API flow is covered by `npm run e2e` (step 2–3) and the Playwright realtime test |
| Visual QA (mobile screenshots) | **Not run**: no emulator |
| Static import/reference check (script) | Passed: all 26 Dart files resolve their imports; every package is declared in `pubspec.yaml` |

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why does the emulator use `10.0.2.2` instead of `localhost`?** Inside the Android emulator, `localhost` is the emulator itself; `10.0.2.2` is a special alias for the host computer where the API runs.
2. **Why is cleartext HTTP allowed only in the debug manifest?** Development uses plain HTTP on the laptop. Android blocks cleartext by default; enabling it only for debug builds keeps release builds HTTPS-only.
3. **How does the app stay secure if someone gets the phone?** The JWT is in encrypted secure storage, tokens expire, deactivation signs the user out on the next request (401), and biometric unlock is added in phase 10.
4. **What happens if GPS is not available indoors?** The location request times out after 12 seconds; the form shows "No GPS location" and makes the landmark field required, or the student scans the room's QR sticker.
5. **How does a technician's phone learn about a new job immediately?** The server emits `notification:new` to the technician's `user:<id>` room over Socket.IO; the inbox controller adds it, increments the badge and shows a banner with a View action. FCM covers the app-closed case (phase 10).

</details>
