/** Deterministic archival crop/encoding: no generative alteration of handwriting. */
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');
const { mkdir, stat } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const source = process.argv[2] || 'assets/archive/source/gandhi-note-1920.jpg';
  const output = 'public/assets/archive';
  await mkdir(output, { recursive: true });
  const image = sharp(source);
  const { width, height } = await image.metadata();
  if (width !== 1460 || height !== 2288) throw new Error('Crop coordinates require the supplied 1460 × 2288 original.');
  // Body only: below the date and above Yours truly/signature; exclude address.
  await image.clone().extract({ left: 140, top: 615, width: 1240, height: 685 })
    .webp({ quality: 80 }).toFile(path.join(output, 'gandhi-note-texture.webp'));
  await image.clone().resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(path.join(output, 'gandhi-note-full.webp'));
  for (const [name, limit] of [['texture', 250000], ['full', 500000]]) {
    const file = path.join(output, `gandhi-note-${name}.webp`);
    const { size } = await stat(file);
    if (size > limit) throw new Error(`${file} exceeds ${limit} bytes`);
    console.log(file, size, await sharp(file).metadata());
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
