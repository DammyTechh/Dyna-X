// Throwaway: renders the same product tile at several padding ratios so the
// framing can be eyeballed before committing. Delete after choosing.
import sharp from 'sharp';

const SRC = 'public/images/dynax-icon.png';
const SIZE = 512;
const RADIUS = 0.2;

function tileSvg(size, bg, ring) {
  const r = Math.round(size * RADIUS);
  const sw = ring ? Math.max(1, Math.round(size / 192)) : 0;
  const i = sw / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect x="${i}" y="${i}" width="${size - sw}" height="${size - sw}" rx="${r}" ry="${r}" fill="${bg}"` +
    (ring ? ` stroke="${ring}" stroke-width="${sw}"` : '') + `/></svg>`);
}

async function tile(bg, ring, pad) {
  const logo = Math.round(SIZE * (1 - pad * 2));
  const mark = await sharp(SRC).resize(logo, logo, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const off = Math.round((SIZE - logo) / 2);
  return sharp(tileSvg(SIZE, bg, ring)).composite([{ input: mark, top: off, left: off }]).png().toBuffer();
}

// One row per padding ratio, one column per product colour.
const PADS = [0.20, 0.12, 0.06];
const COLS = [['#FFFFFF', '#E2E8F0'], ['#2563EB', null], ['#7C3AED', null], ['#0F172A', null]];
const G = 16;
const W = COLS.length * SIZE + (COLS.length + 1) * G;
const H = PADS.length * SIZE + (PADS.length + 1) * G;

const layers = [];
for (let r = 0; r < PADS.length; r++) {
  for (let c = 0; c < COLS.length; c++) {
    layers.push({
      input: await tile(COLS[c][0], COLS[c][1], PADS[r]),
      top: G + r * (SIZE + G),
      left: G + c * (SIZE + G),
    });
  }
}

await sharp({ create: { width: W, height: H, channels: 4, background: '#94A3B8' } })
  .composite(layers).png().toFile('scripts/pad-compare.png');
console.log('scripts/pad-compare.png', W + 'x' + H, 'rows = pad', PADS.join(', '));
