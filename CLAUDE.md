# FixIt Campus: instructions for Claude Code

Campus issue-reporting app for the MERNOVA X 2026 expo (Presidency University, MCA final year).
One Express API + one MongoDB, used by a React web app and a Flutter app.
Spec: `docs/SPEC.md` (source of truth). Progress: `docs/PROGRESS.md`. Decisions: `docs/DECISIONS.md`.

## Mode: fully autonomous

- IMPORTANT: Build the entire project yourself, phase by phase (SPEC section 11), without waiting for approval between phases. The user will not answer design questions. SPEC section 6 already records the key decisions. For anything else the spec leaves open, choose the simplest robust option and record it, with the reason, in `docs/DECISIONS.md`.
- At the start of every session, and after any compaction, read `docs/PROGRESS.md` and continue from the first unchecked item.
- Keep `docs/PROGRESS.md` current: phase checklist, last check results, known issues, and a "Needs the user" list.
- Stop only for what you cannot do yourself: missing system software (Node.js, Flutter, Android SDK, a running MongoDB), interactive account or licence steps (Firebase console, Android licences), and anything needing Windows admin rights (firewall rules). Record it under "Needs the user", then keep building everything that does not depend on it. The app must keep working without the missing piece.
- Never install system software, change system or security settings, push to a remote, or deploy anything.

## Definition of done for every phase

1. Run the phase's checks and show the real output. A phase is done only when they pass.
2. Fix root causes. Never skip, weaken, or delete a test, lint rule, or validation to make a check pass.
3. UI work: run the visual QA loop (SPEC section 8.4) and fix everything the screenshots show before moving on.
4. Write `docs/notes/phase-N.md`: what was built, why the key choices were made, the concepts explained from fundamentals, and 5 viva questions with answers inside a collapsed `<details>` block.
5. Commit on a branch `phase-N-<slug>`, one commit per logical step (Conventional Commits), then merge into `main` with `--no-ff`.
6. Update `docs/PROGRESS.md`.

## When compacting

Preserve: the current phase, the PROGRESS.md checklist state, any failing check with its error, and the files changed in the current phase.

## Environment

- Windows + Git Bash. npm scripts must be cross-platform (use `cross-env` when a script sets env vars).
- MongoDB is local. Always use `mongodb://127.0.0.1:27017/...`, never `localhost`: newer Node.js may resolve `localhost` to IPv6 `::1`, which a default MongoDB install does not listen on.
- Android emulator from Android Studio (`flutter emulators`, `adb`). No iOS.

## Commands (created during the build)

- `npm install` at the root (npm workspaces: `server`, `client`)
- `npm run dev`: API + web together
- `npm test -w server` · `npm run seed -w server` · `npm run e2e` (full API + realtime scenario)
- `npm run lint -w client` · `npm run build -w client` · `npm run test:ui -w client` (Playwright) · `npm run screenshots -w client`
- `cd mobile && flutter analyze && flutter test` · `flutter build apk --debug --dart-define=API_BASE_URL=...`

## Conventions

- Server: Express 5, ES modules. route → middleware (auth, role, validation, upload) → controller → service → model.
- Every protected route is checked on the server. Hiding UI is never access control.
- One error shape: `{ "error": { "code", "message", "details"? } }` with the correct HTTP status.
- zod validation in `server/middleware/validate.js`. Status changes only through the map in `server/utils/transitions.js`.
- API base `/api`. Lists take `?page=&limit=` (default 20, max 50), newest first unless sorted by priority.
- Store photo paths (`/uploads/x.jpg`), never full URLs. Each client builds URLs from its own API origin.
- The UI quality bar is SPEC section 8. Never ship a default-looking or unstyled screen.
