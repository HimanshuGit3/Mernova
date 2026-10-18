# Phase 10: Mobile delight and push (FR-57, FR-58, optional push)

> **Status:** server push is built and tested. The mobile code is complete but `flutter analyze`, `flutter test` and the APK builds (with and without Firebase) are **pending a Flutter install** (PROGRESS "Needs the user").

## What was built

**Mobile**

- **Onboarding**: three pages (snap it, say "Me too", sorted live) with shape-and-icon illustrations, page dots, Skip/Next/Get started; shown once (SharedPreferences).
- **Biometric unlock** (`local_auth`; `MainActivity` extends `FlutterFragmentActivity`): opt-in from Profile (turned on only after a successful check); locks on cold start and after 30 s in the background; the lock screen offers Unlock or Sign out; sign-out clears the lock.
- **Offline report queue** (FR-58): when sending fails for network reasons (or 5xx/408/429/401), the report and a copy of its photo are stored in the app's documents folder (`offline_queue.json`, written atomically) and the flow shows "Saved on your phone". The queue flushes when connectivity returns, every 30 s for due items, and on sign-in; exponential backoff 5 s → 10 s → … ≤ 5 min; a definitive 4xx (e.g. validation) is dropped and reported. Every report keeps its `clientRequestId`, so a retry after a lost response returns the issue the server already created.
- **Offline banner**: "You're offline · 2 reports waiting to send" above the main screens, tap to retry; Profile lists waiting reports.
- **Push (optional)**: Firebase starts only when `FIREBASE_API_KEY/APP_ID/SENDER_ID/PROJECT_ID` are passed with `--dart-define`; device token registration and refresh; foreground messages show as an in-app banner (suppressed while the socket is connected, to avoid duplicates); tapping a notification opens the issue (`onMessageOpenedApp` and `getInitialMessage`).
- Already in place from earlier phases: dark mode (System/Light/Dark), Hero transitions into the issue detail, before/after slider, haptics on key actions, launcher icon and splash images (generated from the SVG logo).

**Server**

- `services/fcm.js`: when `FIREBASE_SERVICE_ACCOUNT` points to a key file, firebase-admin sends every saved notification to all of the user's devices (batches of 500, high priority, string-only data) and removes tokens FCM reports as dead. Without it, push stays a no-op.
- `docs/FIREBASE_SETUP.md`: the console steps.

## Key choices and why

- **Firebase options via `--dart-define`, not `google-services.json`.** The Google Services Gradle plugin fails the build when the JSON is missing; initialising Firebase with explicit `FirebaseOptions` lets one codebase build with or without Firebase and keeps keys out of git.
- **No local-notifications plugin.** While the app is open, the socket banner covers it; while closed, FCM's notification payload is displayed by Android itself. One less native plugin to configure.
- **Queue only unsent reports** (NFR-08): the app never caches issue data; the queue holds exactly what is needed to send each report.
- **Never lose a report on 401**: an expired session keeps the report queued until the user signs in again.

## Concepts from fundamentals

- **Idempotency key.** A client-generated UUID sent with the request; the server's unique index on it turns "the same request again" into "return what you already created". This makes retries after timeouts safe.
- **Exponential backoff.** Wait longer after each failure (5, 10, 20 … s, capped) so a struggling network or server is not hammered, and many phones do not retry in lock-step.
- **Atomic file writes.** Write to a temp file, then rename: a crash mid-write leaves the old file intact.
- **App lifecycle.** `paused`/`resumed` events let the app lock itself after time in the background.
- **Push vs. realtime.** Socket.IO needs the app running; FCM is delivered by the OS even when the app is closed, so both are used for different situations.

## Checks

| Check | Result |
| --- | --- |
| Server: same `clientRequestId` twice → one issue (also concurrently) | Passing (`issues.test.js`, phase 3) |
| Server: push sender delivers, removes dead tokens, string data, never breaks notify | **4 new tests passing**: `npm test -w server` → 407 passed, 1 skipped |
| Mobile: queue retry logic (persist, flush, backoff schedule, force on reconnect, retryable vs final errors, de-dup, cap) | Written: `test/offline_queue_test.dart` (8 tests). **Not run**: Flutter missing |
| `flutter build apk --debug` with and without Firebase defines | **Not run**: Flutter/Android SDK missing |
| Visual QA (onboarding, lock screen, offline banner) | **Not run**: no emulator |

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **How do you stop the offline queue from creating duplicate issues?** Each report gets a UUID `clientRequestId` when the flow starts and keeps it through every retry. The server has a unique sparse index on it, so a second arrival returns the existing issue (200) instead of creating a new one.
2. **When does the queue retry, and when does it give up?** It retries on network errors, 5xx, 408, 429 and 401 (after sign-in), with exponential backoff up to 5 minutes, immediately when the phone reconnects. It gives up on other 4xx answers (for example validation), tells the user and deletes the stored photo.
3. **Why does biometric unlock need `FlutterFragmentActivity`?** Android's BiometricPrompt is built on AndroidX Fragments; local_auth needs the host activity to be a FragmentActivity to show it.
4. **How can the app build with and without Firebase?** Firebase is initialised from compile-time `--dart-define` values. Without them the push service is simply disabled; there is no `google-services.json` or Gradle plugin that would make the build fail.
5. **What happens to push tokens of phones that uninstalled the app?** FCM reports them as unregistered when the server sends; the server then removes them from the user's `fcmTokens`, so they are not tried again.

</details>
