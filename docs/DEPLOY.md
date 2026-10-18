# Deployment guide (prepared, not deployed)

SPEC D10: the project is ready to deploy but nothing is deployed. This page lists what a deployment needs.

## What runs where

| Part | Runs as | Notes |
| --- | --- | --- |
| API + Socket.IO | One Node.js 24 process (`server/server.js`) | Stateful only in MongoDB and the uploads folder; sockets need sticky sessions if you ever run several instances |
| Database | MongoDB 7+ (Atlas or self-hosted) | Indexes are created by mongoose at start-up |
| Photos | Disk folder `UPLOAD_DIR` behind `services/storage.js` | Mount a persistent volume, or swap the storage service for S3/GCS (only that file changes) |
| AI model | Downloaded on first start into `server/.cache/models` (~90 MB) | Persist the folder so restarts are instant; set `AI_TRIAGE_ENABLED=false` on very small machines |
| Web app | Static files from `npm run build -w client` (`client/dist`) | Any static host or CDN; SPA fallback to `index.html` |
| Mobile | Release APK built with the public API URL | See below |

## Option A: Docker Compose (API + MongoDB)

```bash
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
export CLIENT_ORIGIN=https://fixit.example.edu        # where the web app is served
docker compose up --build -d
curl http://localhost:5000/api/health
```

Volumes keep the database, uploads and the AI model across restarts. Put a TLS reverse proxy (Caddy, Nginx, a cloud load balancer) in front of port 5000 and enable **WebSocket upgrade** for `/socket.io/`.

## Option B: managed services

1. **MongoDB Atlas**: create a cluster, a database user, and allow the API host's IP. Use the `mongodb+srv://…` URI as `MONGODB_URI`.
2. **API** on any Node host (Render, Railway, Fly.io, a VM): build command `npm ci --workspace server --omit=dev`, start command `node server/server.js`, plus a persistent disk mounted at `server/uploads` (and ideally `server/.cache`).
3. **Web**: on Netlify/Vercel/Cloudflare Pages build with
   ```bash
   VITE_API_URL=https://api.fixit.example.edu/api VITE_SOCKET_URL=https://api.fixit.example.edu npm run build -w client
   ```
   and add an SPA rewrite (`/* → /index.html`).

## Environment (production)

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` (hides stack traces, disables request logging and the seed) |
| `PORT` | provided by the host, or 5000 |
| `MONGODB_URI` | the production database |
| `JWT_SECRET` | ≥ 32 random characters, from the host's secret store |
| `JWT_EXPIRES_IN` | `7d` (shorter if you prefer) |
| `CLIENT_ORIGIN` | the exact web origin(s), comma separated; CORS and Socket.IO allow only these |
| `UPLOAD_DIR` | a persistent volume path |
| `AI_TRIAGE_ENABLED`, `AI_TIMEOUT_MS`, `DUPLICATE_SIMILARITY`, `DUPLICATE_RADIUS_M`, `AUTO_CLOSE_HOURS` | as in `server/.env.example` |
| `FIREBASE_SERVICE_ACCOUNT` | optional, path to the mounted key (docs/FIREBASE_SETUP.md) |

The server refuses to start if a required variable is missing or invalid.

## Release APK

```bash
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=https://api.fixit.example.edu
# optional push:
#   --dart-define=FIREBASE_API_KEY=… --dart-define=FIREBASE_APP_ID=… \
#   --dart-define=FIREBASE_SENDER_ID=… --dart-define=FIREBASE_PROJECT_ID=…
```

Release builds allow **HTTPS only** (cleartext is enabled just in the debug manifest), so the API must be served over TLS. The APK is in `mobile/build/app/outputs/flutter-apk/app-release.apk`. For Play Store distribution add a signing config (`android/key.properties`); for the expo, side-loading the APK is enough.

## Checklist before going live

- [ ] TLS on the API and the web origin; WebSockets allowed through the proxy
- [ ] `CLIENT_ORIGIN` set to the real web origin only
- [ ] Strong `JWT_SECRET` from a secret store; `.env` never committed
- [ ] Persistent volumes for uploads and the model cache; MongoDB backups enabled
- [ ] Create the first admin: `ADMIN_PASSWORD=… npm run create-admin -w server -- --email you@college.edu --name "Estate Office"`
- [ ] `npm test -w server`, `npm run e2e`, `npm run test:ui -w client` green in CI
