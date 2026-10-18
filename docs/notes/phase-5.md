# Phase 5: Web app (core) with the full design system

## What was built

- **Design system** (`client/src/components/ui`): Button / IconButton / ButtonLink, Card, status / severity / category / SLA / AI / supporters pills, form fields (Input, Select, Textarea, Segmented, chip filters) with labels and error wiring, Skeleton / EmptyState / ErrorState, accessible Modal and Drawer (focus trap, Escape, focus restore), Popover, Avatar, Pagination, Photo with fallback, Lightbox, before/after slider (pointer and keyboard), animated counters, the original logo.
- **Theme**: light and dark from the same CSS-variable tokens; the toggle persists; maps invert their tiles in dark mode; reduced-motion is respected (`MotionConfig reducedMotion="user"` plus a CSS fallback).
- **Session**: axios client with a token interceptor; any 401 clears the token and returns to Login with "Your session ended" (D11). `GET /auth/me` validates a saved token at start-up.
- **Realtime**: one Socket.IO connection per session; `useSocketEvent`, `useReconnect`, `useLiveRefetch` (debounced refetch on events, full refetch after reconnect); a "Reconnecting…" chip in the top bar.
- **Pages**: split-screen Login/Register (dev-only demo quick-fill), admin shell (collapsible sidebar, search, bell with unread badge, theme toggle, profile menu), Dashboard (4 KPI cards with delta and sparkline, Needs attention, Live activity, mini map, category donut), Issues (URL-synced filters, search, sort, sticky table, cards on phones, CSV export), Issue detail (lightbox or before/after, timeline, AI chip, smart assignment, role-aware actions, admin severity/category edit, map), Map, Users (role tabs, add staff drawer, deactivate/reactivate), technician Jobs, student My reports / Report (FR-14) / Fixed on campus, 404.
- **Tests and QA**: `scripts/stack.mjs` starts an isolated seeded stack (API :5055 with database `fixit_ui`, web :5174); 9 Playwright tests; `npm run screenshots -w client` captures 16 routes × 2 viewports × 2 themes = 64 screenshots.

## Key choices and why

- **Semantic tokens + pills with neutral text.** Status colours like amber fail AA contrast as text on a tint. Pills keep the text in the main text colour and carry the meaning in a dot, tint and border, so contrast holds in both themes.
- **URL as the source of truth for filters.** Views can be bookmarked and shared, and they survive reloads (tested).
- **"Loading" is derived, not set.** `useResource` stores which request key its data belongs to; the view is loading whenever that key is stale. This avoids setState-in-effect cascades (enforced by the React Compiler lint rules) and race conditions between fast filter changes.
- **Events trigger refetches.** Lists refetch (debounced) on `issue:*` events instead of patching local copies, which is simple, cannot drift, and keeps the API's privacy rules in force.
- **Client route guards are UX only.** Every rule is enforced by the API; the guards just avoid showing pages that would answer 403/404.

### JWT in localStorage (D11): the trade-off

localStorage is readable by any JavaScript on the page, so an XSS bug could steal the token. An httpOnly cookie would hide it from scripts, but then every request needs CSRF protection, and the mobile app and Socket.IO handshake would need separate handling. We accept localStorage because React escapes all output, the app renders no user-supplied HTML, helmet sets security headers on the API, tokens expire (`JWT_EXPIRES_IN`), and any 401 clears the session immediately. A production hardening step would be short-lived tokens with refresh rotation.

## Concepts from fundamentals

- **SPA routing.** The browser loads one HTML page; React Router swaps components when the URL changes, using the History API, without a full reload.
- **Interceptors.** axios runs a function before every request (attach the token) and after every response (catch 401 globally), so no page repeats that logic.
- **Accessible dialogs.** `role="dialog"`, `aria-modal`, a labelled title, focus moved inside and trapped, Escape to close, focus returned to the trigger.
- **Responsive design.** Mobile-first Tailwind classes; the table becomes a card list below `md`; the sidebar becomes an off-canvas drawer below `lg`; on phones the issue detail shows actions straight after the photo (CSS `display: contents` + `order`).
- **Fast refresh rule.** A module should export only components, so hooks and contexts live in their own `.js` files.

## Checks

```text
> npm run lint -w client     eslint . --max-warnings 0   (clean)
> npm run build -w client    ✓ built
> npm run test:ui -w client  9 passed
  ✓ admin / technician / student land on their home pages
  ✓ wrong password shows an error
  ✓ a student cannot open admin pages
  ✓ admin filters issues (URL-synced) and assigns one
  ✓ a student sees only their own reports; another's issue shows "not found"
  ✓ a new report appears in the admin issue list without reload
  ✓ unknown routes show the 404 page
```

**Visual QA.** First pass found: sidebar background stopping at the viewport in full-page shots; seed resolved issues being auto-closed at start-up (activity feed full of "closed just now"); KPI deltas wrapping; dead space in the activity card; "1 updates"; two logo variants showing at once and a broken logo gradient (duplicate SVG ids); actions below the timeline on phones; "Joined" date wrapping. All fixed, re-captured and re-checked; no open issues.

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **How does the web app react when a token expires mid-session?** The API answers 401; the axios response interceptor clears the stored token and notifies the auth context, which signs out; the router sends the user to Login with a "session ended" message.
2. **Why put the issue filters in the URL?** The URL becomes the single source of truth: reload, back/forward, bookmarks and shared links all show the same view, and the component reads state from one place.
3. **How do you keep realtime screens correct if an event is missed?** Events trigger a refetch rather than patching data, and every view refetches after the socket reconnects.
4. **How do you meet WCAG AA with brand colours like amber?** Semantic colour is never the only carrier of meaning and never used as small text on a tint: pills use neutral text with a coloured dot/border, focus rings are visible, and icon buttons have labels.
5. **Is hiding the Users page from students secure?** No. It only improves navigation. The API checks the role on every request; a student calling `/api/users` gets 403 (tested on the server).

</details>
