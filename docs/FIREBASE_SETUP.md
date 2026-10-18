# Firebase push notifications (optional)

FixIt Campus works **without Firebase**: every notification is saved in the inbox and delivered instantly over Socket.IO while the app is open (D5). Firebase Cloud Messaging (FCM) adds one thing: notifications on a phone whose app is **closed or in the background**.

Nothing in the repository depends on Firebase files. The server enables push only when `FIREBASE_SERVICE_ACCOUNT` is set; the app enables it only when four `--dart-define` values are passed. There is **no `google-services.json`** and no Google Services Gradle plugin, so `flutter build apk --debug` works the same with or without Firebase.

## 1. Create the Firebase project (console, about 5 minutes)

1. Open <https://console.firebase.google.com> → **Add project** → name it `fixit-campus` (Google Analytics is not needed).
2. **Add app → Android**. Package name: `com.fixitcampus.fixit_campus`. App nickname: FixIt Campus. You can skip the SHA-1 and the "download google-services.json" step; we do not use the file.
3. Open **Project settings → General → Your apps → FixIt Campus (Android)** and note:
   - **App ID** (`1:1234567890:android:abc…`) → `FIREBASE_APP_ID`
   - **Project ID** (`fixit-campus-1a2b3`) → `FIREBASE_PROJECT_ID`
4. Open **Project settings → General → Web API key** → `FIREBASE_API_KEY`.
5. Open **Project settings → Cloud Messaging** and note the **Sender ID** → `FIREBASE_SENDER_ID`. Make sure **Firebase Cloud Messaging API (V1)** shows *Enabled*.

## 2. Server: a service-account key

1. **Project settings → Service accounts → Generate new private key** → a JSON file downloads.
2. Store it **outside the repository**, for example `C:\secrets\fixit-firebase.json`. Never commit it (`.gitignore` blocks `*service-account*.json` and `*-firebase-adminsdk-*.json` as a safety net).
3. In `server/.env`:

   ```env
   FIREBASE_SERVICE_ACCOUNT=C:\secrets\fixit-firebase.json
   ```

4. Restart the API. The log shows `[push] Firebase Cloud Messaging enabled for project fixit-campus-1a2b3`. If the file is missing or invalid the server logs a warning and carries on without push.

## 3. App: build with the Firebase values

Add the four values to the build or run command (or to the `args` in `.vscode/launch.json`):

```bash
cd mobile
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:5000 \
  --dart-define=FIREBASE_API_KEY=AIza... \
  --dart-define=FIREBASE_APP_ID=1:1234567890:android:abc... \
  --dart-define=FIREBASE_SENDER_ID=1234567890 \
  --dart-define=FIREBASE_PROJECT_ID=fixit-campus-1a2b3
```

On first launch Android 13+ asks for notification permission; allow it. After signing in, the app registers its device token with `POST /api/auth/fcm-token`. Signing out removes it.

## 4. Test it

1. Sign in on the phone as a technician (e.g. `ravi.tech@fixit.campus`), then press Home to background the app.
2. On the web, as admin, assign an issue to that technician.
3. A system notification "New job assigned to you" appears. Tapping it opens the issue in the app.

## How it works

| Situation | What happens |
| --- | --- |
| App open | Socket.IO `notification:new` → in-app banner (FCM foreground messages are suppressed while the socket is connected, so there are no duplicates) |
| App in background / closed | FCM shows the system notification; tapping it opens the issue (`issueId` in the message data) |
| Firebase not configured | No push; inbox + realtime work as normal |
| Token no longer valid | The server removes it automatically after FCM reports it as unregistered |

## Troubleshooting

- **No notification in background**: check the server log line above, that the phone allowed notifications, and that the device token was registered (the user's `fcmTokens` in MongoDB is not empty).
- **`[push] Firebase failed to start`** in the app log: one of the four `--dart-define` values is wrong; copy them again from Project settings.
- Emulators need a **Google Play** system image for FCM.
