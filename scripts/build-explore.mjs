// Copies the exploratory 360° room (blender/explore.html and friends) into public/explore/,
// so `vite build` ships it at whiskedaway.com/explore/. The sources stay in blender/;
// public/explore/ is generated (gitignored). Run automatically by `npm run build`.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'blender');
const out = join(root, 'public', 'explore');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'out'), { recursive: true });

// The page: same relative layout as in blender/, except the visitor-pass client sits beside it
const html = readFileSync(join(src, 'explore.html'), 'utf8')
  .replace("from '../src/lib/genie.js'", "from './genie.js'");
if (html.includes('../src/')) throw new Error('explore.html still references ../src/');
writeFileSync(join(out, 'index.html'), html);
cpSync(join(root, 'src', 'lib', 'genie.js'), join(out, 'genie.js'));

// Room data, navigator, Gemma's pixel avatar (and the Fluent Emoji MIT licence)
cpSync(join(src, 'explore'), join(out, 'explore'), { recursive: true });

// Renders: every room and weather by day and night, the glasshouse's four seasons, their previews and the hotspots
const keep = new RegExp([
  /^cuddlecore_pano_(rain|fair|change|stormy|very-dry)(_night)?(_preview)?\.jpg$/.source,
  /^hallway_pano_(entrance|middle)_(rain|fair|change|stormy|very-dry)(_night)?(_preview)?\.jpg$/.source,
  /^glasshouse_pano_(spring|summer|autumn|winter)(_preview)?\.jpg$/.source,
  /^flourish_pano_(rain|fair|change|stormy|very-dry)(_night)?(_preview)?\.jpg$/.source,
  /^(cuddlecore|hallway|glasshouse|flourish)_hotspots\.json$/.source,
].join('|'));
const files = readdirSync(join(src, 'out')).filter(f => keep.test(f));
for (const f of files) cpSync(join(src, 'out', f), join(out, 'out', f));
console.log(`explore: page + ${files.length} render files -> public/explore/`);
