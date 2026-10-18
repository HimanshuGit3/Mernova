import path from 'node:path';
import sharp from 'sharp';
import {
  env as hf,
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers';
import { env } from '../config/env.js';

/**
 * CLIP (ViT-B/32) running inside the API process via transformers.js (D6).
 * - zero-shot category: cosine similarity between the photo and several phrasings per category
 * - embedding: the L2-normalised image vector, stored on the issue for duplicate detection
 * The model is downloaded once into server/.cache/models and loaded once (singleton).
 */

export const CATEGORY_PROMPTS = {
  electrical: [
    'a photo of a broken light bulb or flickering lamp',
    'a photo of a damaged electrical socket or switch with sparks',
    'a photo of a ceiling light that is not working',
    'an illustration of an electrical fault with a light bulb',
  ],
  plumbing: [
    'a photo of a leaking tap or sink with water dripping',
    'a photo of a water leak and a puddle on the floor',
    'a photo of a broken washbasin or pipe',
    'an illustration of a dripping tap over a sink',
  ],
  furniture: [
    'a photo of a broken chair',
    'a photo of a damaged desk or table',
    'a photo of broken classroom furniture',
    'an illustration of a broken wooden chair',
  ],
  network: [
    'a photo of a wifi router with no internet connection',
    'a photo of a laptop showing no internet',
    'a photo of a network access point with a red error light',
    'an illustration of a wifi router with an error symbol',
  ],
  cleanliness: [
    'a photo of an overflowing dustbin with litter',
    'a photo of garbage and litter on the floor',
    'a photo of a dirty untidy room',
    'an illustration of a full rubbish bin with trash around it',
  ],
  safety: [
    'a photo of exposed electrical wires, a safety hazard',
    'a photo of a yellow warning sign for danger',
    'a photo of a missing fire extinguisher',
    'an illustration of a hazard warning triangle and loose wires',
  ],
  other: [
    'a photo of a crack in a wall',
    'a photo of a damaged door or notice board',
    'a photo of a building maintenance problem',
    'an illustration of a cracked wall next to a door',
  ],
};

const LOGIT_SCALE = 100; // CLIP's learned temperature

function l2normalise(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

/** Softmax over prompt similarities, summed per category → { category, confidence, scores }. */
export function scoreCategories(imageEmbedding, promptEmbeddings) {
  const logits = promptEmbeddings.map((p) => LOGIT_SCALE * dot(imageEmbedding, p.vector));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const scores = {};
  promptEmbeddings.forEach((p, i) => {
    scores[p.category] = (scores[p.category] ?? 0) + exps[i] / total;
  });
  const [category, confidence] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return { category, confidence: Math.round(confidence * 1000) / 1000, scores };
}

export function createClipService({ modelId = env.AI_MODEL_ID } = {}) {
  hf.cacheDir = path.join(env.SERVER_ROOT, '.cache', 'models');
  hf.allowLocalModels = true;
  let state = 'idle'; // idle → loading → ready | failed
  let loading = null;
  let vision;
  let processor;
  let prompts; // [{ category, text, vector }]

  async function load() {
    state = 'loading';
    const opts = { dtype: 'q8' };
    const [tokenizer, textModel, visionModel, proc] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId),
      CLIPTextModelWithProjection.from_pretrained(modelId, opts),
      CLIPVisionModelWithProjection.from_pretrained(modelId, opts),
      AutoProcessor.from_pretrained(modelId),
    ]);
    const entries = Object.entries(CATEGORY_PROMPTS).flatMap(([category, texts]) =>
      texts.map((text) => ({ category, text })),
    );
    const inputs = tokenizer(
      entries.map((e) => e.text),
      { padding: true, truncation: true },
    );
    const { text_embeds: textEmbeds } = await textModel(inputs);
    const dim = textEmbeds.dims[1];
    prompts = entries.map((e, i) => ({
      ...e,
      vector: l2normalise(textEmbeds.data.slice(i * dim, (i + 1) * dim)),
    }));
    await textModel.dispose?.(); // text prompts are cached; free the text encoder
    vision = visionModel;
    processor = proc;
    state = 'ready';
  }

  function ensureLoaded() {
    if (state === 'ready') return Promise.resolve();
    if (!loading) {
      loading = load().catch((err) => {
        state = 'failed';
        loading = null;
        console.warn(`[ai] CLIP failed to load: ${err.message}`);
        throw err;
      });
    }
    return loading;
  }

  async function embed(buffer) {
    await ensureLoaded();
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(224, 224, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
    const inputs = await processor(image);
    const { image_embeds: imageEmbeds } = await vision(inputs);
    return l2normalise(imageEmbeds.data);
  }

  return {
    status: () => (state === 'idle' ? 'loading' : state),
    /** Start loading in the background (server start-up); never throws. */
    warmup: () => ensureLoaded().catch(() => {}),
    embed,
    async classify(buffer) {
      const e = await embed(buffer);
      const { category, confidence } = scoreCategories(e, prompts);
      return { category, confidence };
    },
    /** One vision pass for both the suggestion and the embedding. */
    async analyse(buffer) {
      const embedding = await embed(buffer);
      const { category, confidence } = scoreCategories(embedding, prompts);
      return { suggestion: { category, confidence }, embedding };
    },
  };
}
