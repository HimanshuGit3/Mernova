import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { createClipService } from '../services/clip.js';
import { artSvg, ART_CATEGORIES } from '../scripts/seedArt.js';

/**
 * Optional real-model smoke test (npm run test:ai -w server). Downloads CLIP once
 * (~90 MB, cached in server/.cache/models). Skipped in normal runs and in CI.
 */
const run = process.env.RUN_AI_SMOKE === '1';

describe.skipIf(!run)('CLIP on the seed images (real model)', () => {
  it('picks the right category for at least 5 of 7 seed images', { timeout: 600_000 }, async () => {
    const clip = createClipService();
    const results = [];
    for (const [i, category] of ART_CATEGORIES.entries()) {
      const jpg = await sharp(Buffer.from(artSvg(category, i + 1)))
        .jpeg()
        .toBuffer();
      const r = await clip.classify(jpg);
      results.push({ expected: category, got: r.category, confidence: r.confidence });
    }
    console.table(results);
    const correct = results.filter((r) => r.expected === r.got).length;
    expect(correct).toBeGreaterThanOrEqual(5);
  });
});
