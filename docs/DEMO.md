# Booth demo script (5 minutes)

Follows the acceptance scenario in SPEC section 13. Two presenters is ideal: **A** drives the laptop (admin web + Live Booth), **B** holds the phone (student, then technician).

## Before visitors arrive (15 minutes)

1. Laptop on power; MongoDB running; `npm run seed:ai -w server`, then `npm run dev`.
2. Second browser window on `http://localhost:5173/live`, signed in as admin, **full screen** (the button top-right) on the big monitor. Check the LIVE badge is red.
3. Main window: admin dashboard (`admin@fixit.campus` / `FixIt@2026`).
4. Phone (or emulator) with the app installed and pointing at the laptop (`API_BASE_URL=http://<laptop IP>:5000`, see README). Open `http://<laptop IP>:5000/api/health` in the phone browser once to confirm it connects.
5. Print one A4 QR sheet (Locations → building "Academic Block B" → Print) and stick the **B-204** sticker on the booth table. Have a prop ready to photograph (a desk lamp, a chair, a power strip).
6. Prepare a fresh student email for the live registration (e.g. `visitor1@student.fixit.campus`).

## The script

| Time | Who | Do | Say |
| --- | --- | --- | --- |
| 0:00 | A | Point at the Live Booth screen | "Every pin is a real problem on campus. Watch this screen while we report one." |
| 0:20 | B | **Register** in the app with the visitor email | "Students sign up in the app…" |
| 0:40 | A | Sign in on the web with the **same** account, show empty My reports, sign out | "…and the same account works on the website. One API, one database." |
| 1:00 | B | Report → **Scan room QR** on the B-204 sticker → take a photo of the prop | "Indoors GPS is unreliable, so every room has a QR sticker." |
| 1:20 | B | Show the **Analysing…** step and the **AI chip** ("AI: Electrical · 94%") | "A CLIP model on our own server suggests the category from the photo. No external AI service." |
| 1:40 | B | Severity High → **Send** → success animation | |
| 1:45 | A | Point at the Live Booth: pin pulses, counter goes up, feed shows the report; dashboard updates | "Instantly, through WebSockets. No refresh." |
| 2:05 | A | Open the issue → **Assign** the suggested technician (best match, lowest load) | "Smart assignment: right skill, least busy." |
| 2:25 | B | Sign out, sign in as `ravi.tech@fixit.campus`; the notification arrives; open **My jobs**: SLA countdown | "High severity means a 24-hour SLA; priority rises if it goes overdue." |
| 2:50 | B | **Start work**, then **Resolve** with an after photo | |
| 3:10 | A | Show the before/after slider in Fixed on campus; Insights updated | "Transparency: every fix is public, without anyone's name." |
| 3:30 | B | Sign in as the visitor student: notification "Fixed! Please confirm" → **Confirm the fix** | "The reporter closes the loop, or reopens within 7 days." |
| 3:50 | B | Second student (`rahul@student.fixit.campus`): report the **same** prop in B-204 | |
| 4:05 | B | The **duplicate sheet** appears → **Me too** | "Instead of a duplicate ticket, the existing issue gets a supporter and +8 priority." |
| 4:25 | A | Insights: heatmap, building health; Locations: QR sheet | "Admins see hotspots and which buildings need care." |
| 4:45 | A | Hand a visitor the booth QR | "Scan this and try it yourself." |

Security proof if a judge asks: in a terminal, `npm run e2e` (30 seconds) runs this whole scenario at API level, including 403 for a student on an admin endpoint, 401 without a token, 400 for a PDF disguised as a photo, and 409/403 for invalid transitions.

## Fallback plan

| Problem | Fallback |
| --- | --- |
| Venue Wi-Fi blocks devices from seeing each other | Turn on the **laptop's mobile hotspot**, connect the phone to it, use the laptop's hotspot IP (`ipconfig` → "Local Area Connection* …") |
| No phone / phone cannot connect | Run the app on the **Android emulator** (`API_BASE_URL=http://10.0.2.2:5000`) and mirror it next to the web window |
| No internet at all | Everything runs locally; the AI model is cached after the first run. Only map tiles need internet. The pins, feed and counters still work |
| AI model not loaded yet | The report still works without the chip; show the AI on a second photo after `GET /api/health` reports `"ai":"ready"` |
| Something got messy mid-demo | `npm run seed:ai -w server` resets the data in about 15 seconds; refresh the browser windows |
| Laptop restarts | `npm run dev`, then reopen `/live` (the session is remembered) |

## Talking points per award

- **Cross-platform**: one Express API + MongoDB; same accounts; realtime sync everywhere; shared inbox.
- **AI**: CLIP zero-shot category + embedding similarity for duplicates, threshold calibrated (0.88) on test images, fails safe.
- **Innovation**: QR room stickers; Live Booth.
- **Technical**: status machine tested in every combination, SLA/priority engine with escalation and auto-close, idempotent offline queue.
- **Mobile experience**: onboarding, biometric unlock, dark mode, Hero transitions, before/after slider, offline queue with retry.
- **Social impact**: "Me too", Fixed on campus, building health scores.
