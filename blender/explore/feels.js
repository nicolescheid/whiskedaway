// How you like it, the data and the rules (no page code, so the unit tests read it: test/feels.test.mjs). The tray, the
// cage and the bell jar are explore/how-you-like-it.js. Nicole's lists, 23 Oct (cuddlecore-medicine-foods.md).
//   FEELS: the tray's feels, each Skip it / Either way / More, please. JAR: the bell jar's foods (behind a flag until a
//   pharmacist or dietitian has checked them).
//   A card carries the feels content has tagged it with (atom.feels: ['spicy', 'crunchy']). Until a card is tagged, the
//   feels that show in an ingredient's name (chilli, coriander, nuts, seeds) are read from its key ingredients; the others
//   need the tag. The bell jar's foods are always read from the key ingredients.

// skip/more: Gemma's short words for her Done line; icon: the cage's overlay; words: ingredient names that carry it
export const FEELS = [
  { id: 'spicy', group: 'flavour', label: 'Spicy heat', skip: 'Nothing spicy', more: 'a bit more heat', icon: '🌶️',
    words: ['chilli', 'chili', 'jalapeño', 'jalapeno', 'cayenne', 'sriracha', 'harissa', 'gochujang', 'chipotle', 'sambal'] },
  { id: 'strong-spice', group: 'flavour', label: 'Strongly spiced', skip: 'Nothing strongly spiced', more: 'plenty of spice', icon: '🫚' },
  { id: 'strong-flavours', group: 'flavour', label: 'Strong flavours', skip: 'No strong flavours', more: 'big flavours', icon: '🧀' },
  { id: 'smells', group: 'flavour', label: 'Strong smells', skip: 'No strong smells', more: 'a good strong smell', icon: '🧄' },
  { id: 'bitter', group: 'flavour', label: 'Bitter', skip: 'Nothing bitter', more: 'a bitter edge', icon: '☕' },
  { id: 'sour', group: 'flavour', label: 'Very sour', skip: 'Nothing very sour', more: 'something sour', icon: '🍋' },
  { id: 'coriander', group: 'flavour', label: 'Coriander', skip: 'No coriander', more: 'more coriander', icon: '🌿', words: ['coriander', 'cilantro'] },
  { id: 'slippery', group: 'texture', label: 'Slippery', skip: 'Nothing slippery', more: 'something slippery', icon: '🍄' },
  { id: 'crunchy', group: 'texture', label: 'Very crunchy', skip: 'Nothing too crunchy', more: 'a good crunch', icon: '🥨' },
  { id: 'bits', group: 'texture', label: 'Bits in smooth things', skip: 'No bits in smooth things', more: 'bits in smooth things', icon: '🥣' },
  { id: 'seeds', group: 'bits', label: 'Seeds and pips', skip: 'No seeds', more: 'seeds and pips', icon: '🌻',
    words: ['seed', 'sesame', 'tahini', 'linseed', 'flaxseed', 'poppy seed', 'pomegranate', 'passionfruit'] },
  { id: 'nuts', group: 'bits', label: 'Nuts', skip: 'No nuts', more: 'nuts', icon: '🥜',
    words: ['nut', 'peanut', 'almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'pine nut', 'peanut butter', 'almond butter'] },
  { id: 'skins', group: 'bits', label: 'Skins and husks', skip: 'No skins or husks', more: 'skins and husks', icon: '🥔' },
];
export const GROUPS = { flavour: 'Heat and flavour', texture: 'Textures', bits: 'Bits and pieces' };
// Caged heat: with one of these skipped, Gemma may offer a cuisine's mild ways in, once (PM's idea, approved 23 Oct)
export const HEAT = ['spicy', 'strong-spice', 'strong-flavours'];

// The bell jar (Nicole approved the list, 23 Oct). No reasons, no drug names, ever. words: as FEELS
export const JAR = [
  { id: 'grapefruit', label: 'Grapefruit (and pomelo, Seville orange)', short: 'grapefruit', icon: '🍊',
    words: ['grapefruit', 'pomelo', 'seville orange'] },
  { id: 'liquorice', label: 'Liquorice', short: 'liquorice', icon: '🍬', words: ['liquorice', 'licorice'] },
  { id: 'aged-cheese', label: 'Aged cheese and cured meats', short: 'aged cheese and cured meats', icon: '🧀',
    words: ['parmesan', 'parmigiano', 'pecorino', 'grana padano', 'aged cheddar', 'blue cheese', 'gorgonzola', 'stilton', 'roquefort', 'gruyère', 'gruyere',
            'salami', 'prosciutto', 'chorizo', 'pepperoni', 'pancetta'] },
  { id: 'alcohol', label: 'Alcohol in cooking', short: 'alcohol in cooking', icon: '🍷',
    words: ['wine', 'beer', 'sherry', 'brandy', 'rum', 'mirin', 'sake', 'marsala', 'cider', 'vodka', 'whisky', 'whiskey', 'liqueur', 'port', 'stout'] },
  { id: 'leafy-greens', label: 'Lots of leafy greens', short: 'lots of leafy greens', icon: '🥬',
    words: ['spinach', 'kale', 'silverbeet', 'chard', 'cavolo nero', 'collard', 'watercress', 'rocket', 'arugula', 'mustard greens', 'bok choy', 'puha'] },
];

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = words => new RegExp(`\\b(${words.map(escRe).join('|')})(s|es)?\\b`, 'i');
const RE = Object.fromEntries([...FEELS, ...JAR].filter(x => x.words).map(x => [x.id, wordRe(x.words)]));

/** True when a piece of text (an ingredient, a swap) names something with this feel or jar food */
export const names = (id, text) => !!RE[id]?.test(String(text || ''));
const inKeys = (a, id) => (a.key_ingredients || []).some(i => names(id, i));

/** The feels a card has: its tags once content has tagged it, else what its key ingredients name */
export function feelsOf(a) {
  if (Array.isArray(a.feels)) return a.feels;
  return FEELS.filter(f => f.words && inKeys(a, f.id)).map(f => f.id);
}
/** The first skipped feel a card has, or null. skip: the skipped feel ids */
export const feelClash = (a, skip) => (skip.length ? skip.find(f => feelsOf(a).includes(f)) || null : null);
/** The first bell-jar food a card's key ingredients name, or null. off: the jar ids kept off */
export const jarClash = (a, off) => off.find(id => inKeys(a, id)) || null;

/** The store's value ({ spicy: 'skip', … }) as the ids skipped and wanted more, in the tray's order */
export function feelsSplit(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { skip: FEELS.filter(f => o[f.id] === 'skip').map(f => f.id), more: FEELS.filter(f => o[f.id] === 'more').map(f => f.id) };
}
/** What a write-out sends the Worker: plain words, never ids (worker/inn-extras.js feelsLine) */
export function feelsPayload(v, off = []) {
  const { skip, more } = feelsSplit(v), word = id => FEELS.find(f => f.id === id).label.toLowerCase();
  const out = {};
  if (skip.length) out.feels_skip = skip.map(word);
  if (more.length) out.feels_more = more.map(word);
  if (off.length) out.keeping_off = off.map(id => JAR.find(j => j.id === id)?.short).filter(Boolean);
  return out;
}
