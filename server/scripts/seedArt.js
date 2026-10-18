/**
 * Original illustrative "photos" for seed data, one scene per category (SPEC phase 3).
 * Each scene has a broken state (the report photo) and a fixed state (the after photo).
 * `variant` shifts colours and positions slightly so photos of one category are similar
 * but never identical, which is what duplicate detection has to cope with.
 */

const W = 800;
const H = 600;

const WALLS = ['#e9e4da', '#dfe6ee', '#e6e1ef', '#e3ece4', '#efe7dc', '#dde3ea'];
const FLOORS = ['#9c8a74', '#8a8f98', '#a08f7d', '#7f8a86', '#96866f', '#8c8478'];

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function room(variant, { floorY = 430 } = {}) {
  const wall = WALLS[variant % WALLS.length];
  const floor = FLOORS[variant % FLOORS.length];
  return `
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${shade(wall, -12)}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${floor}"/><stop offset="1" stop-color="${shade(floor, -25)}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${floorY}" fill="url(#wall)"/>
  <rect y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#floor)"/>
  <rect y="${floorY - 10}" width="${W}" height="12" fill="${shade(wall, -35)}"/>
  ${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 110 - 40}" y1="${H}" x2="${i * 100 + 30}" y2="${floorY}" stroke="${shade(floor, -18)}" stroke-width="2" opacity="0.5"/>`).join('')}`;
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const scenes = {
  electrical(v, fixed, r) {
    const x = 400 + (r() - 0.5) * 80;
    const glow = fixed
      ? `<circle cx="${x}" cy="190" r="150" fill="#fff6c8" opacity="0.55"/><circle cx="${x}" cy="190" r="80" fill="#fff3a8" opacity="0.7"/>`
      : '';
    const bulb = fixed ? '#ffe680' : '#bfbfb4';
    const flicker = fixed
      ? ''
      : `<g stroke="#f2b01e" stroke-width="7" stroke-linecap="round">
           <path d="M${x - 95} 150 l-30 -20"/><path d="M${x + 95} 150 l30 -20"/><path d="M${x - 105} 210 l-38 0"/><path d="M${x + 105} 210 l38 0"/>
         </g>
         <path d="M${x + 10} 225 l-18 30 h20 l-16 34" stroke="#3a3a3a" stroke-width="6" fill="none"/>`;
    const switchSpark = fixed
      ? ''
      : `<g fill="#ffcf33"><polygon points="640,300 660,270 655,295 680,285 662,315 670,300"/><circle cx="655" cy="300" r="6" fill="#ff8a00"/></g>`;
    return `${glow}
      <rect x="${x - 4}" y="0" width="8" height="120" fill="#4a4a4a"/>
      <path d="M${x - 40} 120 h80 l-12 30 h-56z" fill="#5c5c5c"/>
      <circle cx="${x}" cy="190" r="52" fill="${bulb}" stroke="#8a8a80" stroke-width="4"/>
      <rect x="${x - 22}" y="140" width="44" height="20" fill="#7b7b7b"/>
      ${flicker}
      <rect x="600" y="260" width="110" height="140" rx="10" fill="#f7f7f2" stroke="#9a9a90" stroke-width="4"/>
      <rect x="622" y="285" width="28" height="44" rx="5" fill="#d6d6cc"/><rect x="660" y="285" width="28" height="44" rx="5" fill="#d6d6cc"/>
      <circle cx="640" cy="360" r="11" fill="#2d2d2d"/><circle cx="672" cy="360" r="11" fill="#2d2d2d"/>
      ${switchSpark}
      <path d="M655 400 q-10 30 0 30" stroke="#333" stroke-width="5" fill="none"/>`;
  },

  plumbing(v, fixed, r) {
    const x = 380 + (r() - 0.5) * 60;
    const drops = fixed
      ? ''
      : Array.from(
          { length: 6 },
          (_, i) =>
            `<path d="M${x + 48 + (i % 2) * 6} ${300 + i * 22} q8 12 0 18 q-8 -6 0 -18z" fill="#4aa3df"/>`,
        ).join('') +
        `<ellipse cx="${x + 40}" cy="520" rx="${170 + r() * 40}" ry="28" fill="#5fb3e8" opacity="0.65"/>` +
        `<path d="M${x - 140} 300 q10 -20 20 0 q-10 14 -20 0z" fill="#4aa3df"/><path d="M${x - 180} 340 q10 -20 20 0 q-10 14 -20 0z" fill="#4aa3df"/>`;
    return `
      <rect x="${x - 200}" y="80" width="400" height="160" rx="8" fill="#cfe3ea" stroke="#9ab" stroke-width="4"/>
      <rect x="${x - 180}" y="250" width="360" height="70" rx="30" fill="#f4f6f7" stroke="#a7b1b8" stroke-width="5"/>
      <ellipse cx="${x}" cy="262" rx="150" ry="18" fill="#dfe6ea"/>
      <rect x="${x + 20}" y="190" width="18" height="60" fill="#b8c0c6"/>
      <path d="M${x + 20} 190 h70 v18 h-52z" fill="#c9d1d6" stroke="#9aa3a9" stroke-width="3"/>
      <rect x="${x + 82}" y="200" width="16" height="22" fill="#b8c0c6"/>
      <rect x="${x - 20}" y="170" width="44" height="14" rx="6" fill="#d22"/>
      <rect x="${x - 10}" y="320" width="22" height="120" fill="#aab3b9"/>
      <path d="M${x} 440 h80 v-30" stroke="#aab3b9" stroke-width="22" fill="none"/>
      ${fixed ? `<path d="M${x - 60} 438 h120" stroke="#e8eef1" stroke-width="10"/>` : `<rect x="${x + 36}" y="420" width="30" height="30" fill="#8b5a2b" opacity="0.6"/>`}
      ${drops}`;
  },

  furniture(v, fixed, r) {
    const x = 330 + (r() - 0.5) * 80;
    const brokenLeg = fixed
      ? `<rect x="${x + 150}" y="380" width="18" height="140" fill="#6b4a2f"/>`
      : `<rect x="${x + 150}" y="380" width="18" height="60" fill="#6b4a2f"/>
         <rect x="${x + 200}" y="500" width="18" height="80" fill="#6b4a2f" transform="rotate(68 ${x + 209} 540)"/>
         <path d="M${x + 150} 440 l9 -12 l9 12" fill="#f0e2c8"/>`;
    const tilt = fixed ? 0 : 8;
    return `
      <g transform="rotate(${tilt} ${x + 80} 520)">
        <rect x="${x}" y="150" width="20" height="240" rx="6" fill="#7a5535"/>
        <rect x="${x + 150}" y="150" width="20" height="240" rx="6" fill="#7a5535"/>
        <rect x="${x + 10}" y="170" width="150" height="110" rx="10" fill="#a8744a"/>
        <rect x="${x - 10}" y="360" width="190" height="30" rx="8" fill="#94643e"/>
        <rect x="${x}" y="380" width="18" height="140" fill="#6b4a2f"/>
        ${brokenLeg}
      </g>
      <rect x="560" y="300" width="200" height="22" rx="4" fill="#b68657"/>
      <rect x="575" y="322" width="14" height="190" fill="#7a5535"/><rect x="730" y="322" width="14" height="190" fill="#7a5535"/>
      <rect x="600" y="270" width="80" height="30" rx="4" fill="#3b7bd0"/>`;
  },

  network(v, fixed, r) {
    const x = 400 + (r() - 0.5) * 60;
    const color = fixed ? '#1f9e89' : '#d23b3b';
    const arcs = [70, 120, 170]
      .map(
        (rad, i) =>
          `<path d="M${x - rad} ${250 - i * 4} A${rad} ${rad} 0 0 1 ${x + rad} ${250 - i * 4}" stroke="${fixed ? '#1f9e89' : '#9aa4b2'}" stroke-width="16" fill="none" stroke-linecap="round" opacity="${fixed ? 1 : 0.55}"/>`,
      )
      .join('');
    const mark = fixed
      ? `<circle cx="${x + 150}" cy="110" r="44" fill="#1f9e89"/><path d="M${x + 128} 110 l16 16 l30 -32" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>`
      : `<circle cx="${x + 150}" cy="110" r="44" fill="#d23b3b"/><path d="M${x + 130} 90 l40 40 M${x + 170} 90 l-40 40" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`;
    return `
      ${arcs}
      <rect x="${x - 130}" y="290" width="260" height="80" rx="16" fill="#2f3b4d"/>
      <rect x="${x - 100}" y="250" width="12" height="50" fill="#2f3b4d"/><rect x="${x + 88}" y="250" width="12" height="50" fill="#2f3b4d"/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${x - 80 + i * 40}" cy="330" r="9" fill="${i === 0 ? color : fixed ? '#4ade80' : '#555'}"/>`).join('')}
      ${mark}
      <rect x="120" y="400" width="200" height="120" rx="8" fill="#1e2633"/>
      <rect x="132" y="412" width="176" height="96" fill="${fixed ? '#dbeafe' : '#e5e7eb'}"/>
      <text x="220" y="468" font-family="Arial" font-size="20" font-weight="700" fill="${fixed ? '#1f9e89' : '#d23b3b'}" text-anchor="middle">${fixed ? 'Connected' : 'No internet'}</text>
      <rect x="100" y="520" width="240" height="14" rx="5" fill="#2b3442"/>`;
  },

  cleanliness(v, fixed, r) {
    const x = 380 + (r() - 0.5) * 80;
    const litter = fixed
      ? ''
      : Array.from({ length: 9 }, () => {
          const lx = x - 220 + r() * 440;
          const ly = 470 + r() * 100;
          const c = ['#f2f2f2', '#e8c547', '#d94f4f', '#7fbf7f', '#c49a6c'][Math.floor(r() * 5)];
          return `<rect x="${lx}" y="${ly}" width="${24 + r() * 30}" height="${14 + r() * 16}" rx="4" fill="${c}" transform="rotate(${r() * 60 - 30} ${lx} ${ly})"/>`;
        }).join('') +
        `<ellipse cx="${x}" cy="200" rx="110" ry="40" fill="#e8c547"/><circle cx="${x - 50}" cy="185" r="26" fill="#f2f2f2"/><circle cx="${x + 45}" cy="190" r="30" fill="#c49a6c"/><rect x="${x - 10}" y="150" width="30" height="50" fill="#d94f4f"/>`;
    return `
      <path d="M${x - 110} 220 L${x - 90} 500 H${x + 90} L${x + 110} 220z" fill="${fixed ? '#2f855a' : '#3f6b4f'}"/>
      <rect x="${x - 120}" y="210" width="240" height="24" rx="6" fill="${fixed ? '#276749' : '#2f5a3f'}"/>
      ${[0, 1, 2].map((i) => `<rect x="${x - 50 + i * 40}" y="260" width="10" height="200" rx="5" fill="#000" opacity="0.15"/>`).join('')}
      ${fixed ? `<rect x="${x - 120}" y="196" width="240" height="18" rx="6" fill="#276749"/>` : ''}
      ${litter}`;
  },

  safety(v, fixed, r) {
    const x = 420 + (r() - 0.5) * 60;
    const wires = fixed
      ? `<rect x="120" y="140" width="160" height="200" rx="8" fill="#e5e7eb" stroke="#9ca3af" stroke-width="5"/><circle cx="200" cy="240" r="16" fill="#9ca3af"/>`
      : `<rect x="120" y="140" width="160" height="200" rx="8" fill="#2d2d2d" stroke="#555" stroke-width="5"/>
         <path d="M150 340 q20 80 -10 140" stroke="#d22" stroke-width="10" fill="none"/>
         <path d="M190 340 q-10 90 30 150" stroke="#1f6fd1" stroke-width="10" fill="none"/>
         <path d="M230 340 q30 70 10 130" stroke="#e8c547" stroke-width="10" fill="none"/>
         <g fill="#ffcf33"><polygon points="160,470 180,445 176,468 200,460 182,490 190,475"/></g>`;
    const sign = fixed
      ? ''
      : `<polygon points="${x},150 ${x + 150},420 ${x - 150},420" fill="#facc15" stroke="#1f2937" stroke-width="12" stroke-linejoin="round"/>
         <rect x="${x - 10}" y="230" width="20" height="110" rx="8" fill="#1f2937"/>
         <circle cx="${x}" cy="375" r="14" fill="#1f2937"/>`;
    return `${wires}${sign}
      <rect x="640" y="180" width="70" height="240" rx="30" fill="${fixed ? '#dc2626' : '#e5e7eb'}" stroke="#b91c1c" stroke-width="${fixed ? 0 : 6}" stroke-dasharray="${fixed ? '0' : '16 12'}"/>
      ${fixed ? '<rect x="655" y="150" width="40" height="40" rx="6" fill="#111827"/>' : ''}`;
  },

  other(v, fixed, r) {
    const x = 400 + (r() - 0.5) * 80;
    const crack = fixed
      ? `<rect x="${x - 160}" y="90" width="320" height="260" rx="6" fill="#ffffff" opacity="0.25"/>`
      : `<path d="M${x - 20} 60 l30 70 l-40 50 l50 60 l-30 70 l40 60 l-20 40" stroke="#4b4036" stroke-width="9" fill="none" stroke-linejoin="round"/>
         <path d="M${x + 10} 130 l60 20 l30 -20" stroke="#4b4036" stroke-width="6" fill="none"/>
         <path d="M${x - 30} 240 l-70 30 l-30 -10" stroke="#4b4036" stroke-width="6" fill="none"/>
         <polygon points="${x + 40},380 ${x + 70},395 ${x + 50},410" fill="#bcae9c"/>
         <polygon points="${x - 80},400 ${x - 40},410 ${x - 70},425" fill="#bcae9c"/>`;
    return `
      <rect x="80" y="120" width="150" height="310" fill="#8a6a4a" stroke="#5c4530" stroke-width="6"/>
      <circle cx="205" cy="290" r="10" fill="#d4af37"/>
      ${crack}
      <rect x="560" y="140" width="180" height="130" rx="6" fill="#c8a165" stroke="#7a5b31" stroke-width="6"/>
      <rect x="580" y="160" width="60" height="40" fill="#f8fafc" transform="rotate(${fixed ? 0 : -8} 610 180)"/><rect x="655" y="170" width="60" height="70" fill="#fde68a"/>`;
  },
};

export const ART_CATEGORIES = Object.keys(scenes);

/** @returns {string} an 800×600 SVG document */
export function artSvg(category, variant = 0, { fixed = false } = {}) {
  const scene = scenes[category] ?? scenes.other;
  const r = rng(variant * 7 + category.length * 13 + 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${room(variant)}
  ${scene(variant, fixed, r)}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}
