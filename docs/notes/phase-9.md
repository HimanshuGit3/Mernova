# Phase 9: Insights, Live Booth and transparency (FR-55, FR-56, FR-59)

## What was built

- **Insights** (`/insights`, admin): 7/30/90-day range; stat tiles (reported, fixed, average time to fix); "Reports vs fixes" per day (two lines, one axis, legend, crosshair tooltip); "Average time to fix" per day (its own bar chart, because hours and counts are different units); **problem hotspot heatmap** (leaflet.heat, weighted by severity, one sequential gold ramp); **building health** table with score bars plus a text band (Healthy / Needs care / At risk) and open, overdue, fixed and average fix time; status bars and the category donut; **CSV export** of the selected period. Everything refreshes on `stats:changed`.
- **Live Booth** (`/live`, admin, full screen, always dark): large animated counters (reported today, fixed today, open now, average time to fix), a dark live map where new reports pulse for 90 s, a "Happening now" feed of reports, starts and fixes, a visitor QR ("Try it now" → sign-up page), LIVE/RECONNECTING indicator, clock and a full-screen toggle. No personal data anywhere (the server's `/insights/live` has no names; tested).
- **Fixed on campus**: web feed with before/after sliders (phase 5) and the mobile feed and home carousel (phase 6).
- **Charts follow the dataviz rules**: no dual axes, 2 px lines, recessive grid, neutral text, legends for 2+ series, tooltips on every plot. The **categorical palette was validated** with the dataviz validator for both surfaces: furniture brown and "Other" gray failed the chroma floor and were replaced; dark mode gets its own amber step.

## Key choices and why

- **Two charts instead of a dual axis.** Counts and hours on one chart with two y-axes invite false comparisons; two aligned charts are honest and easier to read.
- **Score bars with words.** Health colours (green/amber/red) always come with a number and a label, so meaning never depends on colour alone.
- **Booth fits one 1920 × 1080 screen.** Nobody scrolls a kiosk; the layout uses the viewport height and the map fills what is left.
- **Admin-only booth.** The booth runs on the admin's laptop (a signed-in admin session); it shows only anonymous data, so the screen is safe in public.

## Concepts from fundamentals

- **Heatmaps.** Each point adds a blurred "heat" disc weighted by severity; overlapping discs add up, so dense or severe areas look darker. A sequential (single-hue, light → dark) ramp encodes "more".
- **Categorical vs sequential colour.** Categories need distinct hues in a fixed order; magnitudes need one hue from light to dark; status colours are reserved for status.
- **Colour-vision deficiency checks.** Palettes are tested by simulating deuteranopia/protanopia/tritanopia and measuring the perceptual distance (ΔE in OKLab) between neighbours.
- **Fullscreen API.** `element.requestFullscreen()` / `document.exitFullscreen()`, with `fullscreenchange` to keep the button state correct.

## Checks

```text
> npm run test:ui -w client   11 passed
  ✓ Live Booth updates without reload when an issue is created via the API
    (feed shows the new title, "Reported today" goes up by 1, reporter name never shown)
> npm run lint -w client / build   clean / built
> npm run screenshots -w client     no horizontal overflow (booth at 1920×1080 included)
```

**Visual QA.** `/live` at 1920 × 1080: first pass pushed the visitor QR below the fold and the map legend missed two statuses; fixed (one-screen layout, five-status legend). Insights: the time-to-fix y-axis labels were clipped; fixed. Insights on 390 px and in dark mode reviewed.

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **Why are "reports vs fixes" and "time to fix" separate charts?** They have different units (counts vs hours). A dual-axis chart makes the visual crossing of two lines meaningless and is a classic misleading-chart pattern; two charts on the same time axis are clearer.
2. **How is the building health score calculated?** 100, minus 10 per overdue issue, minus 3 per open issue (capped at 45), minus a slow-fix penalty when average fix time exceeds 24 h (capped at 20), clamped to 0–100. It is computed in a MongoDB aggregation joining issues to their rooms.
3. **How does the Live Booth stay live without refreshing?** The admin's socket receives `issue:created`, `issue:updated` and `stats:changed`; the booth refetches its anonymous snapshot (debounced), animates the counters and pulses new pins.
4. **What makes the booth safe to show in public?** The `/insights/live` endpoint returns only titles, categories, buildings, statuses and coordinates, never names or emails; a Playwright test checks that the reporter's name does not appear.
5. **How did you make sure the chart colours work for colour-blind visitors?** The palette was run through a validator that checks lightness, chroma and simulated colour-vision deficiency separation for both the light and dark surfaces; failing colours were replaced, and every chart also has a legend or labels so colour is never the only cue.

</details>
