import sharp from 'sharp';

/**
 * Deterministic stand-in for CLIP (tests never download models, D6).
 * Embedding = the photo's mean colour (normalised RGB), so same-colour photos are "similar".
 * Category = the nearest photo taught with `teach()`, else the dominant channel:
 * red → electrical, green → cleanliness, blue → plumbing.
 */
export function createFakeAi({ fail = false, delayMs = 0 } = {}) {
  const taught = [];

  async function meanColour(buffer) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (fail) throw new Error('fake AI failure');
    const { channels } = await sharp(buffer).stats();
    const [r, g, b] = channels.map((c) => c.mean);
    const n = Math.hypot(r, g, b) || 1;
    return [r / n, g / n, b / n];
  }

  function categoryOf(e) {
    if (taught.length) {
      const dist = (t) =>
        Math.hypot(t.embedding[0] - e[0], t.embedding[1] - e[1], t.embedding[2] - e[2]);
      return [...taught].sort((a, b) => dist(a) - dist(b))[0].category;
    }
    const [r, g, b] = e;
    if (r >= g && r >= b) return 'electrical';
    if (g >= r && g >= b) return 'cleanliness';
    return 'plumbing';
  }

  return {
    status: () => (fail ? 'failed' : 'ready'),
    embed: meanColour,
    /** Remember that this photo shows `category` (e2e scenario photos). */
    async teach(buffer, category) {
      taught.push({ embedding: await meanColour(buffer), category });
    },
    async classify(buffer) {
      return { category: categoryOf(await meanColour(buffer)), confidence: 0.9 };
    },
    async analyse(buffer) {
      const embedding = await meanColour(buffer);
      return { suggestion: { category: categoryOf(embedding), confidence: 0.9 }, embedding };
    },
  };
}
