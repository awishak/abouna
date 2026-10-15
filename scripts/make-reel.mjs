// Makes a reel picture for the Behind the Scenes strip from a phone original:
// the picture turned the way the phone held it, 960 on the long side, JPEG.
//   node scripts/make-reel.mjs IMG_9761.jpeg 30     -> reel-30.jpg
// Sharp is borrowed from ../fieldtime. Then add reel-30.jpg to the strip and
// the list in index.html. The original never goes in git.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const sharp = require('sharp');
const [src, n] = process.argv.slice(2);
if (!src || !n) { console.log('usage: make-reel.mjs <original> <number>'); process.exit(1); }
const out = join(root, 'reel-' + String(n).padStart(2, '0') + '.jpg');
const info = await sharp(join(root, src)).rotate().resize({ width: 960, height: 960, fit: 'inside' }).jpeg({ quality: 82 }).toFile(out);
console.log(out, info.width + 'x' + info.height);
