/**
 * AI hooks for the e2e scenario (steps 2 and 6). By default a deterministic fake AI is used
 * so the run never downloads a model; set E2E_REAL_AI=1 to use the real CLIP model.
 */
import { setAiService } from '../services/ai.js';
import { createClipService } from '../services/clip.js';
import { createFakeAi } from '../tests/fakeAi.js';

let fake = null;

export async function installFakeAi() {
  if (process.env.E2E_REAL_AI === '1') {
    const clip = createClipService();
    setAiService(clip);
    await clip.warmup();
    return;
  }
  fake = createFakeAi();
  setAiService(fake);
}

/** Tell the fake AI what a scenario photo shows (no-op with the real model). */
export async function teach(blob, category) {
  if (fake) await fake.teach(Buffer.from(await blob.arrayBuffer()), category);
}

/** POST /issues/analyse with the photo and the scanned room. */
export async function analyse(call, token, photo, locationId) {
  const res = await call('POST', '/issues/analyse', { token, form: { photo, locationId } });
  if (res.status !== 200)
    throw new Error(`analyse failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export const findDuplicates = analyse;
