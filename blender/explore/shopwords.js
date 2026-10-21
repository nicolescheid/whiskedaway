// Cards and the book in the visitor's own shopping words (brainstorm-1, D6). The cards are written in New Zealand words
// ("courgette", "kūmara", "coriander"); once the Map knows the country, each atom's text shows that country's words instead.
// `table` is gemma-lines.json tell.shopWords: { US: { courgette: 'zucchini', ... }, AU: {...} } (a country with no entry, such as NZ, keeps
// the written words). The original text is kept on each atom, so changing the country never translates a translation.

const TEXT_FIELDS = ['title', 'short', 'ref', 'hook', 'method_short', 'body'];
const SEED_FIELDS = ['name', 'why'];
const SKIP_AFTER = '(?!\\s+(?:seeds?|powder|ground))';          // "coriander seeds" stay coriander seeds
// The swapped word's plural: "kūmaras" → "sweet potatoes", "prawns" → "shrimp" (QA 9 issue 4)
const plural = w => (/(shrimp|zucchini)$/i.test(w) ? w : /(potato|tomato)$/i.test(w) ? `${w}es` : `${w}s`);

/** A function that swaps one country's words into a string, or null when there's nothing to swap */
export function swapper(words) {
  const pairs = Object.entries(words || {});
  if (!pairs.length) return null;
  const rules = pairs.map(([from, to]) => ({
    re: new RegExp(`(?<![\\p{L}])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s?)(?![\\p{L}])${SKIP_AFTER}`, 'giu'), to }));
  return text => rules.reduce((t, { re, to }) => t.replace(re, (m, s) => {
    const w = s ? plural(to) : to;
    return m[0] !== m[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w;
  }), String(text));
}

export function createShopWords({ table = {}, atoms }) {
  let current = null, swapNow = null;
  /** Show every atom in this country's words (a code like "US"); safe to call again whenever the country changes */
  function apply(country) {
    if (country === current) return false;
    current = country;
    const swap = swapNow = swapper(table[country]);
    for (const a of atoms()) {
      const src = a.__written ||= {
        ...Object.fromEntries(TEXT_FIELDS.filter(k => a[k] != null).map(k => [k, a[k]])),
        key_ingredients: a.key_ingredients ? a.key_ingredients.slice() : undefined,
        seed: a.seed ? { name: a.seed.name, why: a.seed.why } : undefined,
      };
      const f = swap || (t => t);
      for (const k of TEXT_FIELDS) if (src[k] != null) a[k] = f(src[k]);
      if (src.key_ingredients) a.key_ingredients = src.key_ingredients.map(f);
      if (src.seed) for (const k of SEED_FIELDS) if (src.seed[k] != null) a.seed[k] = f(src.seed[k]);
    }
    return true;
  }
  /** Any other text (the Chiapothecary's Mix) in the same words */
  const text = t => (swapNow ? swapNow(t) : t);
  return { apply, text, get country() { return current; } };
}
