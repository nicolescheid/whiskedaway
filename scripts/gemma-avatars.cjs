// Gemma's Direction C avatars for the Inn, from art-inbox/gemma. Run from the repo root: node scripts/gemma-avatars.cjs
const sharp = require('sharp');
const fs = require('fs');
const src = 'art-inbox/gemma/13-avatar-large.png', out = 'blender/explore/assets/gemma';
const crop = { left: 200, top: 60, width: 800, height: 800 };   // ponytail cuff to shoulders, face a little above centre
(async () => {
  for (const px of [40, 80, 120, 56, 112, 168]) {
    await sharp(src).extract(crop).resize(px, px, { kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: false }).toFile(`${out}/avatar-${px}.png`);
  }
  fs.copyFileSync('art-inbox/gemma/runtime/13-avatar-48.png', `${out}/avatar-48.png`);
  fs.copyFileSync('art-inbox/gemma/runtime/14-avatar-24.png', `${out}/avatar-24.png`);
  // Home-screen icon: on parchment, slightly wider framing (iOS rounds the corners itself)
  const bust = await sharp(src).extract({ left: 104, top: 40, width: 920, height: 920 }).resize(180, 180, { kernel: 'lanczos3' }).toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: '#f4efe4' } }).composite([{ input: bust }]).png({ compressionLevel: 9 }).toFile('public/apple-touch-icon.png');
  for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(`${out}/${f}`).size);
  console.log('apple-touch-icon.png', fs.statSync('public/apple-touch-icon.png').size);
})();
