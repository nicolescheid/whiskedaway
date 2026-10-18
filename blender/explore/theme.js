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
/** Gemma's sentence for the book's "This visit" page, from gemma-lines.json `book.theme`:
 *  "This visit, by the look of it: sweet, evening. You've kept three, mostly from Sweet Spells." */
export function themeSentence(words, keptNow, roomName, T = {}) {
  if (!keptNow.length) return '';
  const rooms = {};
  keptNow.forEach(k => { rooms[k.room] = (rooms[k.room] || 0) + 1; });
  const [top, n] = Object.entries(rooms).sort((a, b) => b[1] - a[1])[0];
  const fill = s => s.replace('{n}', NUM[keptNow.length] || keptNow.length).replace('{room}', roomName(top)).replace('{words}', words.join(T.join || ', '));
  const kept = keptNow.length === 1 ? (T.kept_one || "You've kept one, from {room}.") : n === keptNow.length ? (T.kept_all || "You've kept {n}, all from {room}.")
    : n > keptNow.length / 2 ? (T.kept_mostly || "You've kept {n}, mostly from {room}.") : (T.kept_mixed || "You've kept {n}, from around the Inn.");
  return [words.length ? fill(T.words || 'This visit, by the look of it: {words}.') : '', fill(kept)].filter(Boolean).join(' ');
}
