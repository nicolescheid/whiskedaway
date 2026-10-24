// Rewrites EXISTS in blender/explore/pano-times.js from the dawn and dusk renders in blender/out (run after art adds some)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = new URL('../blender/out/', import.meta.url), file = new URL('../blender/explore/pano-times.js', import.meta.url);
const names = readdirSync(out).filter(f => /_(dawn|dusk)\.jpg$/.test(f)).map(f => f.replace(/\.jpg$/, '')).sort();
const body = names.map(n => `  '${n}',`).join('\n');
const src = readFileSync(file, 'utf8').replace(/export const EXISTS = new Set\(\[[\s\S]*?\]\);/, `export const EXISTS = new Set([\n${body}\n]);`);
writeFileSync(file, src);
console.log(`pano-times: ${names.length} dawn/dusk renders listed`);
