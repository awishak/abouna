// Makes favicon.ico (16, 32, 48) and apple-touch-icon.png (180) from a photo,
// cropped square on the face. Sharp is borrowed from ../fieldtime.
//   node scripts/make-favicon.mjs <photo> <left> <top> <size>
// left, top and size are the square crop in the photo's own pixels.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const sharp = require('sharp');

const [src, left, top, size] = process.argv.slice(2);
if (!src) { console.log('usage: make-favicon.mjs <photo> <left> <top> <size>'); process.exit(1); }
const crop = { left: Number(left), top: Number(top), width: Number(size), height: Number(size) };

async function png(px) {
  return sharp(src).extract(crop).resize(px, px, { kernel: 'lanczos3' }).png().toBuffer();
}

// ICO holding PNG images, which every current browser reads.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
images.forEach((img, i) => {
  const o = i * 16;
  dir.writeUInt8(sizes[i], o); dir.writeUInt8(sizes[i], o + 1);
  dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
  dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(img.length, o + 8); dir.writeUInt32LE(offset, o + 12);
  offset += img.length;
});
await writeFile(join(root, 'favicon.ico'), Buffer.concat([header, dir, ...images]));
await writeFile(join(root, 'apple-touch-icon.png'), await png(180));
await writeFile(join(root, 'mockups', 'favicon-preview.png'), await png(256));
console.log('favicon.ico', sizes.join('/'), 'and apple-touch-icon.png 180 written');
