# FixIt Campus

**Spot it. Snap it. Sorted.** Students report campus problems from their phone with a photo, GPS or a room QR code; AI suggests the category and catches duplicates; admins triage on a live web dashboard; technicians resolve against SLA deadlines. Everyone sees progress in real time.

Built for MERNOVA X 2026 (Presidency University, MCA final year): one Express REST API and one MongoDB, shared by a React web app and a Flutter Android app.

> This README is completed in phase 11. Full spec: [`docs/SPEC.md`](docs/SPEC.md). Progress: [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Repository

| Folder | What |
| --- | --- |
| `server/` | Express 5 API, Socket.IO, MongoDB (mongoose), CLIP AI, jobs |
| `client/` | React + Vite web app (admin dashboard, student web) |
| `mobile/` | Flutter Android app (students and technicians) |
| `docs/` | Spec, API, architecture, decisions, notes, screenshots |

## Versions used to build

Node.js 24.14.1 · npm 11.4.1 · MongoDB (local, `127.0.0.1:27017`) · Flutter stable (3.44 or newer required by the pinned packages).

## Quick start (development)

```bash
npm install
cp server/.env.example server/.env   # then set JWT_SECRET
npm run dev                          # API on :5000, web on :5173
```
