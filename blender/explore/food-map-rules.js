// The food map's rules (no page code, so the unit tests read it: test/food-map.test.mjs). The sheet is explore/food-map.js,
// the countries explore/food-map.json. Nicole's shape, 23 Oct (map-adventure-scale.md): home pins, family (heritage) pins,
// loved countries, and an adventure dial. Familiar food = home, family and loved. The dial is a score, never a filter.

export const PENS = ['home', 'heritage', 'loved'];
export const STEPS = [1, 2, 3, 4, 5];
const uniq = xs => [...new Set(xs)];

/** The store's value, tidied: { home: [], heritage: [], loved: [] } with known country ids only, in the map's order */
export function tidy(fm, countries) {
  const o = fm && typeof fm === 'object' ? fm : {};
  return Object.fromEntries(PENS.map(p => [p, countries.map(c => c.id).filter(id => [].concat(o[p] || []).includes(id))]));
}
export const isEmpty = fm => PENS.every(p => !fm[p].length);

/** Familiar cuisines (home, then family, then loved: the order write-outs and lines use), and near ones (their neighbours') */
export function cuisineSets(fm, countries) {
  const byId = Object.fromEntries(countries.map(c => [c.id, c]));
  const ids = uniq(PENS.flatMap(p => fm[p]));
  const familiar = uniq(ids.flatMap(id => byId[id]?.cuisines || []));
  const near = uniq(ids.flatMap(id => byId[id]?.neighbours || []).flatMap(id => byId[id]?.cuisines || [])).filter(c => !familiar.includes(c));
  const heritage = uniq(fm.heritage.flatMap(id => byId[id]?.cuisines || []));
  return { familiar, near, heritage };
}

/** The shopping-words country the pins imply: the first home pin that is a shopping country, else null (heritage never sets it) */
export function shopFrom(fm, countries) {
  return fm.home.map(id => countries.find(c => c.id === id)?.shop).find(Boolean) || null;
}

/** Today's `cuisines` (labels, from the old Map) as loved countries: the first country for each label */
export function migrate(cuisines, countries) {
  const loved = uniq([].concat(cuisines || []).map(label => countries.find(c => c.cuisines.includes(label))?.id).filter(Boolean));
  return { home: [], heritage: [], loved };
}
