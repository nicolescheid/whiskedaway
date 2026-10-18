// The visit's theme (recipe-book-ux.md v4 §6): two words at most, from a fixed friendly vocabulary, made from this visit's keeps
// (weighted) and the trail's leading reading; set-aside ideas count against. It reads like a host who's paying attention,
// so no scores or percentages leave this module. Pure functions, no DOM.

/** The friendly words, and the content tags that count towards each (content stage 3's identity tags) */
export const VOCAB = {
  comfort: ['comfort', 'cosy', 'warming', 'unwell'],
  quick: ['quick', 'simple', 'no-cook', 'snack'],
  'juices and smoothies': ['juice', 'smoothie'],
  'whole food': ['whole-food', 'meal', 'nourishing'],
  sweet: ['sweet', 'treat', 'indulgent', 'chocolate'],
  evening: ['evening', 'night'],
  restorative: ['restorative', 'calming', 'rest'],
  focus: ['focus'],
  skin: ['skin', 'vitamins'],
  energy: ['energy', 'energising'],
};
const KEEP = 3, BEFORE = 1, DISMISS = -2, LEAN = 1;

/**
 * keptNow / keptBefore: snapshots (with themes); dismissed: atoms set aside this visit; lean: the leading cluster's themes.
 * Returns { words: ['sweet', 'evening'], tally } — words only once something has been kept this visit.
 */
export function visitTheme({ keptNow = [], keptBefore = [], dismissed = [], lean = [] }) {
  const tally = {};
  const add = (themes, w) => {
    for (const [word, tags] of Object.entries(VOCAB)) if (themes.some(t => tags.includes(t))) tally[word] = (tally[word] || 0) + w;
  };
  keptNow.forEach(k => add(k.themes || [], KEEP));
  keptBefore.slice(0, 10).forEach(k => add(k.themes || [], BEFORE));
  dismissed.forEach(a => add(a.themes || [], DISMISS));
  add(lean, LEAN);
  const words = keptNow.length ? Object.entries(tally).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w) : [];
  return { words, tally };
}

/** Over all visits (the book's keeps): the two words Gemma would use for the visitor's tastes */
export function bookTastes(kept = []) {
  return visitTheme({ keptNow: kept }).words;
}

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
/** Gemma's sentence for the book's "This visit" page: "Today, by the look of it: sweet, evening. You've kept three, mostly from Sweet Spells."
 *  (A stand-in until the content editor writes the theme lines; `book.theme` in gemma-lines.json.) */
export function themeSentence(words, keptNow, roomName) {
  if (!keptNow.length) return '';
  const rooms = {};
  keptNow.forEach(k => { rooms[k.room] = (rooms[k.room] || 0) + 1; });
  const [top, n] = Object.entries(rooms).sort((a, b) => b[1] - a[1])[0];
  const count = NUM[keptNow.length] || keptNow.length;
  const where = keptNow.length === 1 ? ` It's from ${roomName(top)}.` : n === keptNow.length ? `, all from ${roomName(top)}.` : n > keptNow.length / 2 ? `, mostly from ${roomName(top)}.` : '.';
  const after = words.length ? `Today, by the look of it: ${words.join(', ')}. ` : '';
  return keptNow.length === 1 ? `${after}You've kept one.${where}` : `${after}You've kept ${count}${where}`;
}
