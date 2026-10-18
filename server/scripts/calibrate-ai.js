// Calibrate CLIP on the seed art: classification accuracy and the duplicate threshold.
// Run: node scripts/calibrate-ai.js (downloads the model once). Results are recorded in docs/DECISIONS.md.
import sharp from 'sharp';
const root = new URL('../', import.meta.url).href;
const { createClipService } = await import(root + 'services/clip.js');
const { artSvg, ART_CATEGORIES } = await import(root + 'scripts/seedArt.js');
const { cosineSimilarity } = await import(root + 'services/ai.js');

const ai = createClipService();
console.time('load');
await ai.warmup();
console.timeEnd('load');
console.log('status', ai.status());

const VARIANTS = 6;
const shots = [];
console.time('embed');
for (const c of ART_CATEGORIES) {
  for (let v = 1; v <= VARIANTS; v += 1) {
    const jpg = await sharp(Buffer.from(artSvg(c, v * 3 + 1)))
      .jpeg({ quality: 85 })
      .toBuffer();
    const r = await ai.analyse(jpg);
    shots.push({ c, v, ...r });
  }
}
console.timeEnd('embed');

let correct = 0;
const perCat = {};
for (const s of shots) {
  const ok = s.suggestion.category === s.c;
  correct += ok;
  perCat[s.c] = (perCat[s.c] ?? 0) + ok;
  if (s.v === 1)
    console.log(s.c.padEnd(12), '→', s.suggestion.category.padEnd(12), s.suggestion.confidence);
}
console.log('accuracy', correct, '/', shots.length, perCat);

const same = [];
const diff = [];
for (let i = 0; i < shots.length; i += 1)
  for (let j = i + 1; j < shots.length; j += 1) {
    const sim = cosineSimilarity(shots[i].embedding, shots[j].embedding);
    (shots[i].c === shots[j].c ? same : diff).push(sim);
  }
const stats = (a) => {
  a.sort((x, y) => x - y);
  const q = (p) => a[Math.floor(p * (a.length - 1))].toFixed(3);
  return `min ${q(0)} p5 ${q(0.05)} median ${q(0.5)} p95 ${q(0.95)} max ${q(1)}`;
};
console.log('same-category pairs ', stats(same));
console.log('different-category  ', stats(diff));
