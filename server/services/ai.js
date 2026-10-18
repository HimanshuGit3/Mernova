import { env } from '../config/env.js';

/**
 * AI service facade (D6). The rest of the server only calls `analyseImage` and `embedImage`;
 * both resolve to null on failure, timeout or when AI is disabled, so reports never block on AI.
 * Tests inject a fake with `setAiService`; they never download models.
 *
 * An implementation is `{ status(): string, classify(buffer) → { category, confidence } | null,
 * embed(buffer) → number[] | null }`. The CLIP implementation lives in services/clip.js.
 */

const disabled = {
  status: () => 'disabled',
  classify: async () => null,
  embed: async () => null,
};

let impl = disabled;

export function setAiService(service) {
  impl = service ?? disabled;
}

export function aiStatus() {
  return impl.status();
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function safely(fn) {
  if (!env.AI_TRIAGE_ENABLED) return null;
  try {
    return await withTimeout(Promise.resolve().then(fn), env.AI_TIMEOUT_MS);
  } catch (err) {
    console.warn('[ai] call failed:', err.message);
    return null;
  }
}

/** → { category, confidence } | null */
export function classifyImage(buffer) {
  return safely(() => impl.classify(buffer));
}

/** → number[] (L2-normalised) | null */
export function embedImage(buffer) {
  return safely(() => impl.embed(buffer));
}

/** Both at once (one model pass when the implementation supports it). */
export async function analyseImage(buffer) {
  if (impl.analyse) {
    const res = await safely(() => impl.analyse(buffer));
    return res ?? { suggestion: null, embedding: null };
  }
  const [suggestion, embedding] = await Promise.all([classifyImage(buffer), embedImage(buffer)]);
  return { suggestion, embedding };
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
