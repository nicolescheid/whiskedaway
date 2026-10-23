// The visit's theme and the hallway notice board (moved out of explore.html, architecture step 3): themeNow,
// renderTheme and the Ideas column's caption; the notice board's in-season pin and its idea (noticeBoard).
// The theme's words are theme.js's. Shared through `inn` (docs/code-map.md).
import { book } from './book.js';
import { visitTheme, themeSentence } from './theme.js';

export function install(inn) {
  Object.assign(inn, { themeNow, renderTheme, noticeBoard });   // its functions, for the other modules (hoisted)
  // ---------- the visit's theme (explore/theme.js): the Ideas column's caption on desktop, a line in the chat on phones,
  // the book's "This visit" page and the hallway notice board, once something's been kept
  function themeNow() {
    const kept = book.list(), now = kept.filter(k => k.visit === book.visitId);
    const { words } = visitTheme({ keptNow: now, keptBefore: kept.filter(k => k.visit !== book.visitId),
      dismissed: inn.state.dismissed.map(id => inn.atomsById[id]).filter(Boolean), lean: inn.world.clusters[inn.state.result?.cluster]?.themes || [] });
    const roomName = r => ({ cuddlecore: 'Cuddlecore', flourish: 'Flourish', 'sweet-spells': 'Sweet Spells', chiapothecary: 'the Chiapothecary' }[r] || r);
    return { words, now, sentence: themeSentence(words, now, roomName, inn.LINES.book?.theme) };
  }
  function renderTheme() {
    const { words } = themeNow();
    const cap = inn.$('ideas-theme');
    cap.textContent = words.join(', ');
    cap.hidden = !words.length;
    inn.chatUI.setTheme(words);
  }
  const caption = document.createElement('div');
  caption.id = 'ideas-theme';
  caption.className = 'ideas-theme';
  caption.hidden = true;
  caption.setAttribute('aria-label', "Today's theme");
  document.body.appendChild(caption);
  book.subscribe(renderTheme);
  // The hallway notice board shows the book once something's in it: the visit's theme and how many are kept (§5, §6)
  // The hallway notice board: what's in season for the visitor's hemisphere (hallway-world.json `noticeboard`), and one of its
  // ideas served; once there's a book, how many are in it
  function noticeBoard(obj) {
    const hemi = inn.seasonFor('south') === inn.seasonGuess ? 'south' : 'north';
    const pin = inn.hallWorld.noticeboard?.[hemi]?.[inn.seasonNow()];
    const n = book.count;
    const bookLine = n ? ` Your book has ${n === 1 ? 'one recipe' : `${n} recipes`} in it.` : '';
    if (!pin) return inn.say((n ? '' : obj.moment) + bookLine || obj.moment, [], true);
    inn.say(pin.line + bookLine, [], true);
    inn.holdLine();
    const pick = pin.atoms.map(id => inn.atomsById[id]).find(a => a && inn.fits(a) && !inn.state.cards.some(c => c.atom === a.id));
    if (pick) setTimeout(() => inn.serve({ atom: pick.id, why: inn.LINES.noticeboard_why || "Because it's in season." }, 'local'), 600);
  }
}
