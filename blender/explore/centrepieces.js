// The room's best idea, brought out (moved out of explore.html, architecture step 3): the centrepieces (Sweet Spells'
// spell table, Cuddlecore's pot, Flourish's Lay the Table: roomIdeas, bestHere, cast) and the star chart's fortune, plus
// the helpers that bring one idea out on request (canServe, onCard, showIdea, ideaPage, whenFree).
// Shared through `inn` (docs/code-map.md).
import { localNavigate } from './navigator.js';
import { sound } from './sound.js';
import { book, snapshot } from './book.js';
import { basket } from './basket.js';
import { createStarChart } from './star-chart.js';
import { pickIdea } from './idea-pick.js';
import { layers } from './layers.js';
import { fitKitchen } from './kitchen.js';

export function install(inn) {
  Object.assign(inn, { cast, canServe, showIdea, fortune });   // its functions, for the other modules (hoisted)
  // ---------- The centrepieces (hotspot plan B1): Sweet Spells' spell table, Cuddlecore's pot and Flourish's Lay the Table put
  // this room's best idea for the visitor in the basket and open the checkout with it ticked (Stage 1); written out, it's one of
  // today's 3 and the object glows while she writes. Written already: it opens free. At the cap: an honest line, and the leaflet
  // waits in the basket; a failed write stays there too.
  const CAST_ROOMS = { 'sweet-spells': 'spell', cuddlecore: 'pot', flourish: 'table' }; inn.CAST_ROOMS = CAST_ROOMS;
  const CAST_LINES = {                                          // stand-ins: gemma-lines.json cast.{spell,pot,table} has the real ones
    busy: "Hold on, I'm still writing the last one.", nothing: "I've nothing to write out yet. Have a look around.",
    atCap: "That's my three written out for today. It's in your basket for tomorrow.",
    failed: "That one didn't take. It's still in your basket.",
    added: "It's in your basket. Tick it and I'll write it out.",
    writing: 'Let me write it out for you.', done: 'Written out. Ready when you are.',
  };
  // This room's recipe ideas the visitor could still be offered: not set aside, not clashing with a dietary need
  // and fitting their kitchen; with none that fit, the kitchen is loosened for the room and Gemma says so
  function roomIdeas() {
    const all = inn.world.atoms.filter(a => a.room === inn.homeOf(inn.state.room) && a.kind === 'recipe idea' && !inn.state.dismissed.includes(a.id) && !inn.dietClash(a));
    const { atoms, loosened } = fitKitchen(all, inn.state.kitchenLoose?.[inn.homeOf(inn.state.room)] ? [] : inn.kitchenNow());
    const line = loosened && inn.loosenKitchen(inn.homeOf(inn.state.room));
    if (line) { inn.say(line, [], true); inn.holdLine(); }
    return atoms;
  }
  /** This room's best idea for the visitor (PM 4): the best not kept and not yet written; else the best kept one not yet written;
   *  else the best already written (it opens free). Best = the navigator's top pick, or with nothing to read yet, one already out. */
  function bestHere() {
    const all = roomIdeas(), unwritten = all.filter(a => !inn.writer.written(a.id));
    for (const pool of [unwritten.filter(a => !book.has(a.id) && !basket.has(a.id)), unwritten.filter(a => book.has(a.id) || basket.has(a.id)), all]) {
      if (!pool.length) continue;
      const top = localNavigate(inn.navTrail(), { ...inn.world, atoms: pool }, { ...inn.steer(), served: [], dismissed: inn.state.dismissed, room: inn.homeOf(inn.state.room) }).serve[0];
      return top || { atom: inn.state.cards.map(c => c.atom).find(id => pool.some(a => a.id === id)) || pool[0].id, why: '' };
    }
    return null;
  }
  // An idea's page in the book: its own page if kept, else a loose page (Keep, Cook this, the write-out)
  // A sheet the visitor opened while she wrote (Check in, Tell Gemma, the Mix, Sweet Spells' sheets, cook mode): what the cast
  // opens waits until it's closed and its history step back has gone, or the book would cover it and leave it inert (Nicole's phone)
  const whenFree = fn => layers.whenFree(fn); inn.whenFree = whenFree;                  // no layer open, and every step back landed (explore/layers.js)
  const ideaPage = (rec, from) => (book.has(rec.id) ? inn.bookView.open(rec.id, { from }) : inn.bookView.open(null, { from, loosePage: rec }));
  function cast(id) {
    const kind = CAST_ROOMS[inn.homeOf(inn.state.room)], C = inn.LINES.cast || {};
    const line = k => C[kind]?.[k] || C[k] || CAST_LINES[k];
    if (inn.casting || inn.checkout.running) return inn.say(line('busy'), [], true);
    const best = bestHere();
    if (!best) return inn.say(line('nothing'), [], true);
    const a = inn.atomsById[best.atom], rec = book.get(a.id) || basket.get(a.id) || snapshot(a, best.why);
    if (inn.writer.written(rec.id)) { ideaPage(rec, 'cast'); return inn.say(line('done'), [], true); }
    if (basket.add(rec)) inn.track('basket_add', { from: 'cast', basket_size: inn.sizeBucket(basket.count) });
    inn.castFor = { atom: rec.id, el: inn.hotspots.find(h => h.id === id)?.el, line };   // the object glows while the checkout writes it
    inn.say(line(inn.writer.left ? 'added' : 'atCap'), [], true);
    inn.holdLine();
    whenFree(() => inn.basketView.open({ from: 'cast', tick: rec.id }));
  }
  // ---------- The star chart reads your fortune (Nicole, 22 Oct: a little mini-game): "Pick a star" (explore/star-chart.js), and
  // Gemma reads it: a line about the visitor's day ({star}, and {weather} when the Inn's weather has words), then the fortune that
  // names a surprise sweet idea from the room ({idea}). She says it once the sheet closes, then the idea's card comes out, and
  // an Inn note found on this tap after that. starChart in gemma-lines.json
  const stars = createStarChart({ lines: inn.LINES.starChart || {}, track: inn.track, sound,
    beforeOpen: () => { inn.ideas.close(false); if (inn.bookView.isOpen) inn.bookView.close(); if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto'); } });
  // An idea the page can still serve as a new card: not served this visit, not kept or in the basket, no headline ingredient
  // shared with a card out (serve() refuses those), and not a second away idea
  const onCard = id => inn.state.cards.some(c => c.atom === id); inn.onCard = onCard;
  function canServe(a) {
    if (inn.state.served.includes(a.id) || book.has(a.id) || basket.has(a.id)) return false;
    if (inn.isAway(a) && inn.awayOut() && !inn.state.awayLift?.[inn.homeOf(inn.state.room)]) return false;
    const head = inn.headline(a);
    return !head || !inn.state.cards.some(c => inn.atomsById[c.atom] && inn.headline(inn.atomsById[c.atom]) === head);
  }
  /** Bring out the card for `a` (pickIdea): served as a new card, or reopened; else its page in the book (kept, or served earlier) */
  function showIdea(a, from) {
    if (!a) return;
    whenFree(() => {
      if (!onCard(a.id)) inn.serve({ atom: a.id, why: '' }, 'local', { force: true });   // asked for: it makes room
      if (onCard(a.id)) inn.ideas.open(a.id, { focus: false });
      else ideaPage(book.get(a.id) || basket.get(a.id) || snapshot(a, ''), from);
    });
  }
  function fortune(obj, noteLine) {
    const SC = inn.LINES.starChart || {};
    // The idea named is always the one that comes out (QA 4 S1): first an idea serve() will take (not served this visit, not
    // kept, no headline clash with a card out); else one already on a card (it reopens); else any of the room's (its page opens)
    const a = pickIdea(roomIdeas().sort(() => Math.random() - 0.5), { canServe, onCard: x => onCard(x.id), anyCard: true });
    const t = a && inn.pickLine('fortune', SC.fortunes || [], { idea: '\u0001' });
    if (!t) { inn.say(inn.momentOf('star-chart', obj), [], true); return false; }
    // The title starts a sentence as it's written, and mid-sentence in lower case (not a name: "Anzac biscuits")
    const title = /(^|[.!?]\s+)\u0001/.test(t) || /^(Anzac|Kiwi|Mānuka)\b/.test(a.title) ? a.title : a.title[0].toLowerCase() + a.title.slice(1);
    const told = t.replace('\u0001', title);
    const weather = SC.weather?.[inn.state.weather]?.[inn.isNight() ? 'night' : 'day'];
    const read = star => [inn.pickLine('star.reading', SC.readings || [], { star, ...(weather ? { weather } : {}) }), told].filter(Boolean).join(' ');
    stars.open({ read, close: reading => {
      inn.say(reading, [], true);
      inn.holdLine();
      // The fortune stays the moment (Nicole, 22 Oct: opening checkout covered it): the idea's card comes out, and ♥ Keep
      // puts it in the basket like any other card
      whenFree(() => {
        showIdea(a, 'star_chart');
        if (noteLine) setTimeout(() => { inn.say(noteLine, [], true); inn.holdLine(); }, 4500);   // the reading first, long enough to read
      });
    } });
    return true;
  }

  // Taps (explore/touch.js): the star chart reads a fortune (and takes the Inn note, said after the reading); the spell table,
  // the pot and Lay the Table cast this room's best idea
  inn.onTouch(40, (obj, id) => obj.type === 'ambient' && id === 'star-chart' && inn.LINES.starChart?.fortunes?.length, (obj, id, tap) => {
    if (fortune(obj, tap.note)) tap.note = null;
  });
  inn.onTouch(120, obj => obj.type === 'submit' && obj.tool === 'generate' && CAST_ROOMS[inn.homeOf(inn.state.room)], (obj, id) => { cast(id); });
}
