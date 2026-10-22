// Extra lines for the Inn's write-outs and re-writes (inn-idea), kept out of the Worker's main file so they can be unit-tested
// (test/inn-extras.test.mjs). Both are new, optional payload fields: a page that doesn't send them gets the prompt it had before.
//   Your kitchen (appliances-chia-plan.md §1): payload.appliances ['oven', 'air fryer'] or payload.no_cooking true
//   A real mix (§2): payload.mix.addins ['Berries', …], mix.top [the ones that go on top], mix.thirsty [the ones that soak up liquid]

const txt = (v, n) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, n);
const list = (v, n, m = 40) => (Array.isArray(v) ? v : []).slice(0, n).map(x => txt(x, m).trim()).filter(Boolean);

/** The kitchen line, or '' for no preference */
export function kitchenLine(payload = {}) {
  if (payload.no_cooking === true) {
    return 'Their kitchen: no cooking at all, only a fridge, a chopping board, a kettle and a toaster. Make it a no-cook version, '
      + 'and never ask for a stove, oven, microwave, air fryer, BBQ, blender or slow cooker.';
  }
  const xs = list(payload.appliances, 8, 30);
  if (!xs.length) return '';
  return `Their kitchen: cook it with: ${xs.join(', ')} (a kettle, toaster and fridge are fine too). Use only these. `
    + 'If the idea usually needs something else, adapt the method to one they have (an air fryer instead of the oven, a microwave instead of the stove '
    + 'for warming, a fork or whisk instead of a blender) and say so in a few words in that step. Never ask for an appliance they did not list.';
}

/** The add-ins line for a real mix, with the chia to liquid kept honest, or '' for a simple jar */
export function addinsLine(mix = {}) {
  const all = list(mix.addins, 12);
  if (!all.length) return '';
  const top = list(mix.top, 12).filter(x => all.includes(x)), thirsty = list(mix.thirsty, 12).filter(x => all.includes(x));
  const parts = [`Their add-ins, every one in the recipe: ${all.join(', ')}.`];
  if (top.length) parts.push(`These go on top just before eating, not in the jar overnight: ${top.join(', ')}.`);
  parts.push('Keep the chia to liquid at 3 tbsp chia seeds to 1 cup (250 ml) of liquid, scaled together for the servings; add-ins never change the chia.');
  if (thirsty.length) parts.push(`${thirsty.join(', ')} soak${thirsty.length === 1 ? 's' : ''} up liquid, so add a splash more (about 2 tbsp each) and say so.`);
  parts.push('Give small amounts for spices and sweeteners (a pinch, half a teaspoon, a teaspoon).');
  return parts.join(' ');
}
