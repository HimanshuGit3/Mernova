# Phase 0: Environment check and scaffold

## What was built

- **Environment check.** Node.js 24, npm 11, git and a running MongoDB were found. Flutter and the Android SDK are missing; they are listed under "Needs the user" in `PROGRESS.md`, and the rest of the build carries on without them.
- **Monorepo with npm workspaces.** The root `package.json` declares `server` and `client` as workspaces, so one `npm install` installs both, and `npm run dev` uses `concurrently` to start the API and the web app together.
- **Server skeleton.** `app.js` *builds* the Express app (routes, middleware) and `server.js` *listens* on a port. Tests import `createApp()` and never open a real port; the production entry point adds the HTTP listener (and Socket.IO later). `config/env.js` validates every environment variable with zod at start-up and exits with a readable message if one is missing (NFR-04).
- **Client skeleton.** Vite + React 19 + Tailwind CSS v4, the self-hosted Plus Jakarta Sans font, and the design tokens from SPEC 8.1 as CSS variables, plus the original pin-and-wrench logo as SVG (also the favicon).
- **Mobile skeleton.** `pubspec.yaml` with every planned package, strict analysis options, the bundled font, and a Material 3 theme built from the same tokens in light and dark.

## Key choices and why

- **`app.js` / `server.js` split.** It keeps the app testable: supertest can call `createApp()` in memory, so tests are fast and there are no port clashes.
- **Fail-fast config.** A typo in `.env` should stop the server at boot, not cause a confusing 500 three screens later.
- **Semantic tokens.** Components say `bg-surface text-text border-border`, never `bg-white dark:bg-slate-900`. Dark mode swaps the variable values in one place, which keeps both themes consistent and guarantees AA contrast once the tokens are checked.
- **`127.0.0.1` instead of `localhost`.** Node 17+ may resolve `localhost` to IPv6 `::1`, and a default MongoDB only listens on IPv4.

## Concepts from fundamentals

- **npm workspaces.** One `node_modules` at the root, hoisted and shared; each package keeps its own `package.json`. `npm run <script> -w server` runs a script inside one workspace.
- **ES modules.** `"type": "module"` makes Node treat `.js` files as ES modules (`import`/`export`), the same syntax the browser uses. Imports must include the file extension.
- **Design tokens.** Named values (colours, radii, spacing, type sizes) that every component reads. Changing a token changes the whole product consistently.
- **CSS custom properties and Tailwind v4.** `@theme inline` tells Tailwind to generate utilities (`bg-surface`) that point at `var(--surface)`, so the value can change at runtime (dark mode) without rebuilding CSS.

## Checks

- `npm run dev` started both processes; `GET /api/health` returned `{"status":"ok"}`; the Vite page returned HTTP 200.
- `vite build` and `eslint .` passed.
- `flutter analyze` could not run: Flutter is not installed (Needs the user).

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why split `app.js` and `server.js`?** So tests can build the Express app in memory and call it with supertest, without opening a port. `server.js` adds the HTTP listener and the Socket.IO attachment for production and development.
2. **What does fail-fast configuration mean, and why use it?** The server validates its environment variables at start-up and exits immediately with a clear message if one is missing or invalid. Misconfiguration is found at deploy time, not by users.
3. **Why `127.0.0.1` and not `localhost` for MongoDB?** Newer Node versions may resolve `localhost` to the IPv6 address `::1`; a default MongoDB listens only on IPv4, so the connection would be refused.
4. **What is an npm workspace?** A way to manage several packages in one repository with one install and one lock file; scripts can be run per workspace with `-w`.
5. **How does dark mode work without a flash of the wrong theme?** A tiny inline script in `index.html` reads the saved preference (or the OS setting) and adds the `dark` class to `<html>` before React loads; every colour is a CSS variable that the `.dark` class overrides.

</details>
