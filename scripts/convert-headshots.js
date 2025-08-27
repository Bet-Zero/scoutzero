// scripts/convert-headshots.js  (replace with this)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inDir = path.resolve('assets_source/headshots');
const outDir = path.resolve('public/assets/headshots');
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(inDir)) {
  if (!/\.png$/i.test(file)) continue;
  const base = file.replace(/\.png$/i, '');
  const input = path.join(inDir, file);

  const meta = await sharp(input).metadata();
  const w = meta.width,
    h = meta.height;

  // 1× (same dimensions, perfect quality)
  await sharp(input)
    .withMetadata()
    .webp({ lossless: true })
    .toFile(path.join(outDir, `${base}.webp`));

  // 2× (double dimensions for Retina/DPR=2)
  await sharp(input)
    .resize(Math.round(w * 2), Math.round(h * 2), { kernel: 'lanczos3' })
    .withMetadata()
    .webp({ lossless: true })
    .toFile(path.join(outDir, `${base}@2x.webp`));
}

console.log('Headshots: 1× and 2× generated.');
