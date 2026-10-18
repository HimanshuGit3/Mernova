# Phase 8: QR scan-to-report (FR-53)

## What was built

- **Web Locations page** (`/locations`, admin): rooms table with a live QR preview per room, search, building filter, Active/Inactive/All, select rooms for printing, a create/edit drawer (code, building with suggestions, floor, room, label, **click-the-map placement**), and deactivate/reactivate.
- **Printable A4 sticker sheet** (`/locations/print?building=…` or `?codes=…`): 12 stickers per page (3 × 4), each with the logo, a 30 mm QR code (`FIXIT:LOC:<code>`, error correction M, rendered as SVG so it prints crisp), the room code in large type, label, building and "Scan in FixIt Campus". Print CSS sets `@page A4`, hides the toolbar and toasts, forces white, and breaks pages per sheet. It always renders light, even in dark mode.
- **Server** (built in phase 3): `GET /api/locations/code/:code` accepts a bare code or the full QR content and returns 404 for unknown **and inactive** rooms; the create endpoint uses the room's point (D9).
- **Mobile** (code, pending Flutter): `parseLocationQr` (strict pattern, case-insensitive prefix, normalised code); scanner screen (QR only, no duplicate reads, viewfinder, torch toggle, camera-permission and camera-error states, "not a FixIt sticker" and "room not in service" messages); "Scan room QR" in the report flow fills building, room and coordinates, re-runs the duplicate check for that room, and takes priority over GPS.

## Key choices and why

- **QR content is a code, not a URL.** `FIXIT:LOC:B-204` is short (a small, robust QR), meaningless to other apps, and resolved by the API, so deactivating a room makes its old stickers harmless.
- **SVG QR codes** scale without blur for any printer; error correction M survives small scuffs on a sticker.
- **Scanned room beats GPS.** Indoors, GPS can be off by tens of metres and floors are invisible to it; a sticker on the door gives the exact room.
- **Print as a separate route** outside the admin shell, so the printed page contains only stickers.

## Concepts from fundamentals

- **QR codes.** A 2-D barcode with finder squares in three corners for orientation and Reed–Solomon error correction (level M recovers about 15 % damage).
- **Print CSS.** `@media print` rules apply only when printing; `@page { size: A4 }` sets the paper; `break-after: page` starts each sheet on a new page; physical units (`mm`) map exactly to paper.
- **Accessible roles.** An input with a `datalist` is exposed as a combobox, not a plain textbox; tests that query by role catch this kind of semantic detail.
- **Containing blocks.** An absolutely positioned element (like a screen-reader-only label) escapes a scrolling container unless the container is positioned (`relative`).

## Checks

- Server: lookup by bare code and by full QR content, unknown → 404, **inactive → 404**, admin-only create/edit, duplicate code 409 (in `resources.test.js`, part of `npm test -w server`: 403 passed).
- Playwright: new test "admin adds a room and opens its printable QR sticker" → **10 passed**.
- Visual QA: Locations page (desktop/mobile, light/dark) and the printed sheet (print media emulation) reviewed. Findings fixed: the sticker's scan pill touched the border (QR 34 mm → 30 mm); the mobile Locations page was 717 px wide because `sr-only` table labels escaped the scroll container (fixed with `relative`); the printed sheet is captured at desktop only (a phone viewport has no meaning for A4 paper). Screenshot script: no horizontal overflow.
- Mobile: QR parsing test written (`test/qr_test.dart`, 2 tests) and the same pattern checked in JavaScript; `flutter test` not run (Flutter missing).

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why use QR stickers when phones have GPS?** GPS is unreliable indoors and cannot tell floors apart. A sticker on each door identifies the exact room, so the technician walks straight to it.
2. **What is inside the QR code and why?** Only `FIXIT:LOC:<room code>`. The app asks the API for the room, so stickers never go stale: rooms can be renamed or moved, and deactivated rooms are refused.
3. **What happens if someone scans an unrelated QR code?** The strict parser rejects anything that is not exactly `FIXIT:LOC:` plus a valid code, and the app says "That is not a FixIt Campus room sticker".
4. **How do you make the sticker sheet print correctly?** A dedicated route renders sheets in millimetres; print CSS sets A4, removes margins and app chrome, forces colours and breaks pages between sheets; QR codes are SVG for sharp printing.
5. **How was the mobile overflow bug on the Locations page found?** The screenshot script measures each page's `scrollWidth` against the viewport and fails when a page is wider; it flagged 717 px on a 390 px phone, caused by absolutely positioned screen-reader labels escaping the table's scroll box.

</details>
