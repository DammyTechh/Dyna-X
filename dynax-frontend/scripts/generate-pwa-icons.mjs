/**
 * Generates the per-product PWA icon tiles from the shared DynaX brand mark.
 *
 * Run from the frontend root:  node scripts/generate-pwa-icons.mjs
 *
 * The source mark (public/images/dynax-icon.png) is already a finished dark
 * rounded-square app icon — the blue gradient is negative space cut out of a
 * near-black tile, not a standalone glyph on transparency. So a product variant
 * is the mark inset on a coloured rounded tile, which reads as a coloured frame
 * rather than a re-tinted logo. PAD controls how much frame shows.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'public/images/dynax-icon.png';
const OUT = 'public/icons';
const SIZES = [192, 512];

/** Fraction of the tile taken by padding on each side. */
const PAD = 0.12;
/** Corner radius as a fraction of tile size — matches the rounded-3xl/p-3 ratio
 *  on the scanner login tile (24px radius on a 120px tile). */
const RADIUS = 0.2;

const PRODUCTS = [
  { name: 'pro', bg: '#FFFFFF', ring: '#E2E8F0' },
  { name: 'care', bg: '#2563EB' },
  { name: 'physio', bg: '#7C3AED' },
  { name: 'scanner', bg: '#0F172A' },
];

/** Rounded-square tile, optionally with a hairline inner ring (for the white
 *  variant, which would otherwise have no edge against a light wallpaper). */
function tileSvg(size, bg, ring) {
  const r = Math.round(size * RADIUS);
  const sw = ring ? Math.max(1, Math.round(size / 192)) : 0;
  const inset = sw / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="${inset}" y="${inset}" width="${size - sw}" height="${size - sw}" ` +
      `rx="${r}" ry="${r}" fill="${bg}"` +
      (ring ? ` stroke="${ring}" stroke-width="${sw}"` : '') +
      `/></svg>`
  );
}

async function build({ name, bg, ring }, size) {
  const logo = Math.round(size * (1 - PAD * 2));
  const mark = await sharp(SRC)
    .resize(logo, logo, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((size - logo) / 2);
  const file = `${OUT}/${name}-icon-${size}.png`;
  await sharp(tileSvg(size, bg, ring))
    .composite([{ input: mark, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(file);

  const m = await sharp(file).metadata();
  console.log(`${file}  ${m.width}x${m.height}`);
}

await mkdir(OUT, { recursive: true });
for (const p of PRODUCTS) for (const s of SIZES) await build(p, s);
console.log('done');
