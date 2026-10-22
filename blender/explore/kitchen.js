// Your kitchen (appliances-chia-plan.md §1): which appliances the visitor cooks with, as a list of ids in the visit store
// (`kitchen`). Nothing picked = no preference. "none" (No cooking) stands alone: picking it clears the rest, and picking an
// appliance clears it. An idea fits when it needs no cooking (atom.appliances []), or any one of the picked appliances; cards
// content hasn't tagged (no appliances_checked) always fit. Words come from gemma-lines.json `kitchen` (content editor).
// Pure functions only (unit tests: test/kitchen.test.mjs); the sheet is tell.js's, the wiring explore.html's.

export const APPLIANCES = ['stove', 'oven', 'microwave', 'air-fryer', 'bbq', 'food-processor', 'slow-cooker'];
export const NONE = 'none';
const KNOWN = new Set([...APPLIANCES, NONE]);

/** The visit's answer, cleaned: known ids only, in the sheet's order, "none" alone */
export function kitchenPicks(v) {
  const xs = [].concat(v || []).filter(x => KNOWN.has(x));
  if (xs.includes(NONE)) return [NONE];
  return APPLIANCES.filter(a => xs.includes(a));
}
/** One tap on the sheet: on or off, "none" clearing the rest and an appliance clearing "none" */
export function togglePick(picks, id) {
  const now = kitchenPicks(picks);
  if (!KNOWN.has(id)) return now;
  if (now.includes(id)) return now.filter(x => x !== id);
  if (id === NONE) return [NONE];
  return kitchenPicks([...now.filter(x => x !== NONE), id]);
}
/** Whether an idea fits the kitchen */
export function kitchenFits(atom, picks) {
  const p = kitchenPicks(picks);
  if (!p.length || !atom?.appliances_checked || !Array.isArray(atom.appliances)) return true;
  if (!atom.appliances.length) return true;                 // no cooking: fits every kitchen
  if (p[0] === NONE) return false;
  return atom.appliances.some(a => p.includes(a));
}
/** The room's ideas that fit, or all of them when none do (loosened: Gemma says so once a room) */
export function fitKitchen(atoms, picks) {
  const fit = atoms.filter(a => kitchenFits(a, picks));
  return fit.length || !atoms.length ? { atoms: fit, loosened: false } : { atoms, loosened: true };
}
/** The appliances as short words ("oven", "air fryer"), for the tag, Gemma's lines and the write-out */
export function kitchenWords(picks, K = {}) {
  return kitchenPicks(picks).map(id => (id === NONE ? K.none?.short || 'no cooking' : K.appliances?.[id]?.short || id.replace(/-/g, ' ')));
}
/** The header tag: "🍳 oven · air fryer", "🍳 oven · stove +2", "🥗 no cooking"; '' when nothing is picked */
export function kitchenTag(picks, K = {}) {
  const p = kitchenPicks(picks), words = kitchenWords(p, K);
  if (!p.length) return '';
  if (p[0] === NONE) return K.tag_none || '🥗 no cooking';
  if (p.length <= 2) return (K.tag || '🍳 {x}').replace('{x}', words.join(K.tag_join || ' · '));
  return (K.tag_many || '🍳 {two} +{n}').replace('{two}', words.slice(0, 2).join(K.tag_join || ' · ')).replace('{n}', p.length - 2);
}
/** What the write-out is told: { appliances: ['oven', 'air fryer'] } or { no_cooking: true }; {} for no preference */
export function kitchenPayload(picks, K = {}) {
  const p = kitchenPicks(picks);
  if (!p.length) return {};
  if (p[0] === NONE) return { no_cooking: true };
  return { appliances: kitchenWords(p, K) };
}
