# Phase 7: AI triage and duplicate detection (FR-51, FR-52)

## What was built

- **CLIP service** (`server/services/clip.js`): `Xenova/clip-vit-base-patch32` through transformers.js, quantised, cached in `server/.cache/models`, loaded once and warmed up in the background at server start. 28 text prompts (4 phrasings × 7 categories) are embedded once; each photo needs one vision pass, which gives both the category suggestion and the image embedding.
- **AI facade** (`services/ai.js`): every call has a timeout (`AI_TIMEOUT_MS`); on failure, timeout or while loading it returns no suggestion and the report carries on. Tests inject a fake.
- **`POST /api/issues/analyse`**: photo (+ GPS or room) → `{ suggestion, duplicates, ai }`, with nothing saved. **`GET /api/issues/duplicates`** gives the same check without a photo.
- **Duplicate detection** (`services/duplicates.js`, D7): active issues from the last 7 days within `DUPLICATE_RADIUS_M` (MongoDB `$geoNear` on the 2dsphere index) or in the same room, ranked by cosine similarity of CLIP embeddings (+0.05 for the same category), threshold `DUPLICATE_SIMILARITY = 0.88`, top 3, no reporter identity.
- **Embeddings** are stored on create (hidden with `select: false`); `npm run seed:ai -w server` embeds the seed photos too.
- **Web**: the report form analyses the chosen photo ("Analysing photo…" → "AI: Electrical · 96% · Use" chip) and shows "Similar issue nearby. Is it the same problem?" with **Me too**; the issue detail shows the AI chip (accepted or changed).
- **Mobile** (code, pending Flutter): "Analysing…" step with a shimmer after the photo, AI chip with confidence that pre-fills the category, the duplicate bottom sheet with Me too, and a re-check when GPS arrives after the photo.
- **Calibration** (`npm run calibrate:ai -w server`) and an optional real-model smoke test (`npm run test:ai -w server`, skipped in normal runs and CI).

## Key choices and why

- **Zero-shot instead of training.** CLIP compares an image with text descriptions, so new categories need only new prompts, with no labelled training set. Several phrasings per category, summed after softmax, make it robust to wording.
- **One model for two jobs.** The same embedding classifies the photo and finds duplicates; nothing extra to host.
- **AI never blocks.** A slow or missing model just means no chip; reporting always works (tested with failing and slow fakes).
- **Location first, then similarity.** The geo/room filter keeps the candidate set tiny, so the similarity ranking is cheap and the results are physically plausible.

## Concepts from fundamentals

- **Embeddings.** A model maps an image (or text) to a vector of 512 numbers so that similar meanings land close together. Normalised to length 1, the dot product equals the cosine similarity: 1 for identical, around 0 for unrelated.
- **Contrastive models (CLIP).** Trained on image–caption pairs so that an image and its caption get similar vectors; that is why text prompts can classify images.
- **Softmax and temperature.** Similarities are scaled (×100) and turned into probabilities that sum to 1; the category's confidence is the sum over its prompts.
- **Geospatial queries.** `$geoNear` sorts documents by distance from a point on a sphere and filters by `maxDistance` in metres, using the 2dsphere index.
- **Threshold calibration.** Measure similarity for pairs that should match and pairs that should not, then choose a cut-off between the two distributions.

## Checks

```text
> npm test -w server         Test Files 9 passed | 1 skipped; Tests 403 passed | 1 skipped
> npm run test:ai -w server  1 passed (real CLIP: ≥ 5 of 7 seed images; calibration got 42/42)
> npm run e2e                e2e passed: 7/7 (fake AI);  E2E_REAL_AI=1 → 7/7 (real CLIP)
> npm run lint -w server / -w client   clean
> npm run build -w client    built
> npm run test:ui -w client  9 passed
> npm run screenshots -w client   68 screenshots, "No horizontal overflow on any page."
```

New tests: suggestion and confidence, photo required/validated, technician 403, AI failure and timeout fall back to "no suggestion", embedding stored but never returned, similar photo nearby found, dissimilar photo / outside radius / older than 7 days / closed / own report excluded, room match via QR location, top 3 sorted, Me too raises priority without a new issue, photo-less duplicates endpoint, scoring maths.

**Visual QA.** The new "report with photo" screenshot (AI on) showed the chip and the duplicate panel correctly, but the page overflowed on phones (439 px at 390 px). A new automatic overflow check in the screenshot script then found the same bug on the mobile dashboard (464 px), which I had missed in phase 5. Root cause: CSS grids without a base column template size their track to the content. Fixed with `grid-cols-1` / `minmax(0, …)` everywhere; all 68 screenshots are re-captured with no overflow.

Mobile checks (analyze/test/emulator) are still pending Flutter.

## Viva questions

<details>
<summary>Show questions and answers</summary>

1. **How does the app suggest a category without training a model?** CLIP embeds the photo and several text descriptions per category into the same vector space; the category whose descriptions are most similar (softmax over cosine similarities) wins, and its probability is shown as the confidence.
2. **How are duplicates detected?** Only active issues from the last 7 days within 50 m (or in the same room) are considered; their stored CLIP image embeddings are compared to the new photo by cosine similarity; those above 0.88 (calibrated) are offered, best first, maximum 3.
3. **What happens if the AI model is slow or fails?** Every AI call is raced against `AI_TIMEOUT_MS`; on timeout or error the API returns no suggestion and the student picks the category. Reporting never depends on AI.
4. **Why is the threshold 0.88?** On the 42 seed photos, every same-category pair scored at least 0.904 and every different-category pair at most 0.870; 0.88 separates them with margin on both sides.
5. **Why does "Me too" matter for social impact?** Instead of five duplicate tickets, one issue collects five supporters: the technicians fix it once, its priority rises by 8 per supporter, and every supporter is notified when it is fixed.

</details>
