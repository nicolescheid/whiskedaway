// What Gemma serves (moved out of explore.html, architecture step 3): the navigator's timing (scheduleNavigate, navigate,
// applyReveal), her lines for ideas (L, pickLine, momentOf, innNoteLine), what steers it (steer), the filters (dietClash,
// kitchenOk, the away rule, the headline ingredient), serve, keepIdea, and the Ideas column (ideas = createIdeas).
// A new filter goes here beside dietClash and kitchenOk. Shared through `inn` (docs/code-map.md).
import { localNavigate, aiNavigate } from './navigator.js';
import { visit } from './visit-state.js';
import { createIdeas } from './ideas.js';
import { book, snapshot } from './book.js';
import { basket } from './basket.js';
import { notes as innNotes } from './notes.js';
import { WRITE_ONLY, CARB_DIETS } from './writeout.js';
import { chiaData } from './chia-mix.js';
import { sweetSteer } from './sweet-spells.js';
import { TIME_LIMIT, timeWords } from './checkin.js';
import { cuisineLabel } from './tell.js';
import { kitchenPicks, kitchenFits } from './kitchen.js';

export function install(inn) {
  Object.assign(inn, { scheduleNavigate, navigate, applyReveal, pickLine, innNoteLine, steer, loosenKitchen, serve, keepIdea });   // its functions, for the other modules (hoisted)
  // ---------- navigator
  let navTimer, navSeq = 0, lineHeldUntil = 0;
  inn.casting = false;                                         // a centrepiece is writing (B1): her lines wait for it
  const holdLine = () => { lineHeldUntil = Date.now() + 3000; }; inn.holdLine = holdLine;
  function scheduleNavigate() {
    clearTimeout(navTimer);
    navTimer = setTimeout(navigate, inn.AI ? 700 : 350);
  }
  const AI_MAX_CALLS = 10, AI_EVERY = 30000, AI_MIN_GAP = 10000;
  async function navigate() {
    const seq = ++navSeq;
    const opts = { ...steer(), dismissed: inn.state.dismissed, here: Object.keys(inn.spots), room: inn.homeOf(inn.state.room), roomName: inn.room().title };
    const local = localNavigate(inn.navTrail(), inn.world, opts);
    let r = local;
    // The AI reads the wander at most once on entering a room or every 30 s (never closer than 10 s), and ten times a visit;
    // between those the local reading answers (it costs nothing), so a busy wander doesn't call the model on every touch
    const now = Date.now(), roomNow = inn.homeOf(inn.state.room);
    const useAI = !!inn.AI && (inn.state.aiCalls || 0) < AI_MAX_CALLS && now - (inn.state.aiAt || 0) >= AI_MIN_GAP
      && (inn.state.aiRoom !== roomNow || now - (inn.state.aiAt || 0) >= AI_EVERY);
    if (useAI) { inn.state.aiCalls = (inn.state.aiCalls || 0) + 1; inn.state.aiAt = now; inn.state.aiRoom = roomNow; }
    // One new idea per step (two to start), so they come at the pace of the wander
    const putOut = res => res.serve.filter(s => !inn.state.served.includes(s.atom) && !book.has(s.atom)).slice(0, inn.state.cards.length ? 1 : 2).forEach(s => serve(s, res.mode));
    if (useAI) {
      // Hybrid: the room responds at once with the local reading (glow and new ideas), and Gemma
      // "types" while the AI reads the wander (the visitor pass and the model call can take many seconds).
      // Her line comes from the AI, which may also add one piece of its own; if it fails, she says the local line.
      inn.state.result = local;
      applyReveal(local.reveal);
      putOut(local);
      inn.thinking(true);
      inn.renderNotes();
      inn.store.save(inn.state);
      r = await aiNavigate(inn.AI, inn.navTrail(), inn.world, opts);
      if (seq !== navSeq) return;                            // a newer event superseded this one
      inn.thinking(false);
      if (r.fallback) inn.track('nav_fallback', { reason: /timeout|abort/i.test(r.fallback) ? 'timeout' : /429/.test(r.fallback) ? 'rate_limited'
                                                      : /403/.test(r.fallback) ? 'bot_check' : /navigate 5[0-9][0-9]/.test(r.fallback) ? 'upstream'   // the Worker or the model failed
                                                      : /navigate 4[0-9][0-9]/.test(r.fallback) ? 'rejected' : /fetch|network|load failed/i.test(r.fallback) ? 'network' : 'error' });
      r = { ...r, serve: r.mode === 'ai' ? r.serve.filter(s => !inn.state.served.includes(s.atom) && !book.has(s.atom)).slice(0, 1) : [] };
    }
    inn.state.result = r;
    // No builder words in view (brainstorm #6): if the AI can't help, Gemma says so once a visit, softly, in her own voice
    if (useAI && r.mode !== 'ai' && !inn.state.aloneSaid) { inn.state.aloneSaid = true; setTimeout(() => inn.chatLine('gemma', inn.LINES.alone || "I'm reading your wander on my own for a bit."), 1200); }
    applyReveal(r.reveal);
    // A chip the visitor just picked is something they told her, not something she worked out (Nicole, 23 Oct):
    // "Ah, something sweet." instead of "I think you're after something sweet."
    const told = inn.navTrail().at(-1);
    const toldLabel = told?.kind === 'choose' && inn.world.clusters[told.cluster]?.label;
    const gemma = toldLabel ? (inn.LINES.chose || 'Ah, {c}.').replace('{c}', toldLabel) : r.gemma;   // her reading has no lead now (content/no-lead)
    // A keep, set-aside or undo line stays up for 3 s before her next one (UX T1), unless a newer step comes along
    const speak = () => {
      if (seq !== navSeq || inn.casting) return;                   // a cast's writing line stays until the write ends (B1 QA)
      const empty = inn.emptyRoomLine();
      if (empty) inn.say(empty, [], true);
      else if (inn.state.offerTell) {
        // Once a visit, after two keeps or set-asides, if nothing about them is set (tell-gemma-ux §2.5)
        inn.state.offerTell = false;
        inn.say(inn.TL.offer, [], true);
        setTimeout(() => inn.setChips([{ label: inn.TL.offerYes, do: ['tell'] }, { label: inn.TL.offerNo, do: ['later'] }]), 400);
      } else if (inn.state.askDifferent) {
        // Three set aside in a row: instead of her reading, Gemma asks what they'd like (§9); a pick counts like a choice
        inn.state.askDifferent = false;
        inn.say(inn.LINES.dismiss?.different || 'Something different?', [], true);
        setTimeout(() => inn.setChips([['Quick', 'pantry'], ['Proper meal', 'build-up'], ['Sweet', 'treat'], ['Chia', 'energising']]
          .filter(([, c]) => inn.world.clusters[c]).map(([label, c]) => ({ label, do: ['choose', c] }))), 400);
      } else if (gemma) inn.say(gemma, r.fork);              // with the AI on this posts at once: she "typed" while it read
    };
    const wait = lineHeldUntil - Date.now();
    wait > 0 ? setTimeout(speak, wait) : speak();
    if (useAI) r.serve.forEach(s => serve(s, r.mode)); else putOut(r);
    inn.store.save(inn.state);
    inn.renderNotes();
  }

  function applyReveal(reveal) {
    const ids = new Set(reveal.map(r => r.object));
    for (const h of inn.hotspots) h.el.classList.toggle('revealed', ids.has(h.id));
  }
  // ---------- Gemma's Ideas (explore/ideas.js) and the recipe book (explore/book.js, explore/book-view.js)
  // Lines for ideas and the book come from gemma-lines.json (content editor); these stand in for any it doesn't have yet
  const L = {
    ideaFirst: inn.LINES.idea?.first || "I've had an idea for you. Tap it.",
    // ♥ Keep puts a leaflet in the basket (Stage 1): basket.keep in gemma-lines.json, same shape as keep (the book's)
    keepFirstEver: inn.LINES.basket?.keep?.first_ever || "That's in your basket. It's up at the top, and it stays on this device.",
    keepFirstVisit: inn.LINES.basket?.keep?.first_this_visit || ['In the basket it goes.'],
    keepThird: inn.LINES.basket?.keep?.third || ["Three in the basket. I'm starting to see what you like."],
    keepLater: inn.LINES.basket?.keep?.later || ['Kept.'],
    dismissFirst: inn.LINES.dismiss?.first || 'Fair enough. Fewer like that, then.',
    undo: inn.LINES.dismiss?.undo || 'Back it comes.',
    full: inn.LINES.book?.full || "Your book's full, so I've taken out the oldest one to make room.",
    noStorage: inn.LINES.book?.no_storage || "I can't keep a book on this device, so these are just for today.",
    cleared: inn.LINES.book?.cleared || 'All cleared. A fresh book.',
  }; inn.L = L;
  // A line from a list, rotating without repeating in a visit; {placeholders} filled, and lines whose placeholder can't be filled skipped
  function pickLine(key, list, fill = {}) {
    const ok = [].concat(list).filter(t => [...t.matchAll(/\{(\w+)\}/g)].every(m => fill[m[1]]));
    if (!ok.length) return null;
    const used = (inn.state.linesUsed ||= {})[key] ||= [];
    const fresh = ok.filter(t => !used.includes(t));
    const t = (fresh.length ? fresh : ok)[0];
    if (!fresh.length) used.length = 0;
    used.push(t);
    return t.replace(/\{(\w+)\}/g, (_, k) => fill[k]);
  }
  const momentOf = (id, obj) => (obj.moments?.length ? pickLine(`moment.${id}`, [obj.moment, ...obj.moments]) : obj.moment); inn.momentOf = momentOf;
  // Inn notes (explore/notes.js): the first touch of an object with a story adds it to the back of the book; touched again,
  // Gemma says she has it once a visit, then stays quiet
  function innNoteLine(id) {
    const N = inn.LINES.innNotes;
    if (!N?.notes?.[id]) return null;
    if (innNotes.has(id)) {
      const used = (inn.state.linesUsed ||= {})[`note.${id}`] ||= [];
      if (used.length) return null;
      used.push(N.again);
      return N.again;
    }
    const first = !innNotes.count;
    innNotes.add(id);
    inn.track('note_found', { object: id, count: String(innNotes.count) });
    return first ? N.addedFirst : N.added;
  }
  const sizeBucket = n => (n <= 0 ? '0' : n <= 2 ? '1-2' : n <= 5 ? '3-5' : n <= 10 ? '6-10' : '11+'); inn.sizeBucket = sizeBucket;

  // What steers the navigator besides the trail (recipe-book-ux.md §6b): never anything kept, served or clashing with a
  // dietary need; this visit's keeps weigh ×3 and older ones ×1; the pantry and cuisines add a bonus
  function steer() {
    const kept = book.list();
    return {
      awayOk: !awayOut() || !!inn.state.awayLift?.[inn.homeOf(inn.state.room)],
      moodThemes: chiaData(inn.LINES).moods[visit.dish('chiapothecary', 'mood')]?.themes || [],   // not chia.data: steer() can run before it's made
      ...sweetSteer(visit),                                                                    // Sweet Spells' cravings and "no added sugar"
      served: [...inn.state.served, ...kept.map(k => k.id), ...inn.world.atoms.filter(a => dietClash(a) || inn.likeClash?.(a) || !kitchenOk(a)).map(a => a.id)],
      book: { now: kept.filter(k => k.visit === book.visitId), before: kept.filter(k => k.visit !== book.visitId) },
      about: { pantry: inn.pantryNow().items, useUp: inn.pantryNow().useUp, cuisines: inn.cuisinesNow(), synonyms: inn.SYNONYMS,
               why: { ...inn.CW.why, ...inn.T.why }, cuisineLabel,
               timeLimit: TIME_LIMIT[visit.get('time')] || null, timeWords: timeWords(inn.CW, visit.get('time')), confidence: visit.get('confidence') },
    };
  }
  // The first dietary need an atom doesn't meet (atoms carry diet tags: vegetarian, vegan, gluten-free, dairy-free, nut-free)
  // Low-FODMAP is a hard filter only on atoms checked against a source (`fodmap_checked`; none yet): it goes into write-outs as an avoid
  // The More options (halal, kosher, Hindu, keto, low carb), like low-FODMAP, shape the ideas only where content has judged a card
  // for that need (atom.diet_checked; fodmap_checked for low-FODMAP): those that don't meet it are left out. Unjudged cards stay,
  // and the need always goes to the write-out. Until cards are judged they're never named as a filter (PASS_ONLY)
  const PASS_ONLY = new Set(['low-fodmap', ...WRITE_ONLY, ...CARB_DIETS]); inn.PASS_ONLY = PASS_ONLY;
  const judged = (a, d) => (d === 'low-fodmap' ? !!a.fodmap_checked : !PASS_ONLY.has(d) || (a.diet_checked || []).includes(d));
  const dietClash = a => [].concat(visit.get('dietary') || []).find(d => judged(a, d) && !(a.diet || []).includes(d)) || null; inn.dietClash = dietClash;
  // Your kitchen (explore/kitchen.js): ideas need one of the picked appliances, or no cooking. When a room runs dry on it, Gemma says
  // so once and the room is loosened (state.kitchenLoose[room]) until the kitchen changes
  const kitchenNow = () => kitchenPicks(visit.get('kitchen')); inn.kitchenNow = kitchenNow;
  const kitchenOk = a => !!inn.state.kitchenLoose?.[a.room] || kitchenFits(a, kitchenNow()); inn.kitchenOk = kitchenOk;
  function loosenKitchen(home) {
    if (!kitchenNow().length || inn.state.kitchenLoose?.[home]) return null;
    (inn.state.kitchenLoose ||= {})[home] = true;
    const K = inn.LINES.kitchen || {};
    return pickLine('kitchen.loosen', [K.loosen, K.loosen_alt].filter(Boolean)) || "Nothing in here fits your kitchen, so I'll loosen it for this room.";
  }
  const CLASH_NOTE = { vegetarian: 'not vegetarian', vegan: 'not vegan', 'gluten-free': 'has gluten', 'dairy-free': 'has dairy', 'nut-free': 'has nuts' }; inn.CLASH_NOTE = CLASH_NOTE;

  // At most one of the ideas out is from another room (PM on T4); the hallway and glasshouse have none of their own
  const hasOwn = () => inn.world.atoms.some(x => x.room === inn.homeOf(inn.state.room)); inn.hasOwn = hasOwn;
  const isAway = a => hasOwn() && a.room !== inn.homeOf(inn.state.room); inn.isAway = isAway;
  const awayOut = () => inn.state.cards.some(c => inn.atomsById[c.atom] && isAway(inn.atomsById[c.atom])); inn.awayOut = awayOut;
  // An idea's headline ingredient: its first key ingredient that isn't a base most recipes share (chia seeds, milk, butter…)
  const BASES = new Set(['chia seed', 'chia', 'oat milk', 'milk', 'water', 'olive oil', 'butter', 'salt', 'black pepper', 'honey', 'maple syrup', 'greek yoghurt', 'yoghurt', 'egg']);
  const headline = a => (a.key_ingredients || []).map(i => i.toLowerCase().replace(/ies$/, 'y').replace(/([^s])s$/, '$1')).find(i => !BASES.has(i)) || null; inn.headline = headline;
  function serve({ atom, why, fromKeep }, mode, opts) {
    const a = inn.atomsById[atom];
    if (!a || inn.state.served.includes(atom) || book.has(atom)) return;
    if (isAway(a) && awayOut() && !inn.state.awayLift?.[inn.homeOf(inn.state.room)]) return;   // not served, so it can come another time
    // Two ideas out at once never share a headline ingredient (QA pass 5: asparagus toast beside asparagus and eggs)
    const head = headline(a);
    if (head && inn.state.cards.some(c => inn.atomsById[c.atom] && headline(inn.atomsById[c.atom]) === head)) return;
    inn.state.served.push(atom);
    inn.servedBy[atom] = mode;
    ideas.add({ atom, why }, ideaSource(), opts);
    // An idea that came from a keep says so, unless Gemma has just spoken about that keep (one line per event)
    if (fromKeep && inn.state.trail.at(-1)?.kind === 'keep' && !inn.state.keepSpoke && inn.LINES.idea?.from_keep) inn.say(pickLine('fromKeep', inn.LINES.idea.from_keep), [], true);
    inn.state.keepSpoke = false;
  }
  // Where a new idea rises from: the object the visitor last touched or lingered by, if it's on screen and not under
  // Gemma's chat; otherwise her avatar (ideas.js)
  function ideaSource() {
    const e = [...inn.state.trail].reverse().find(x => ['touch', 'linger', 'map'].includes(x.kind));
    const h = e && inn.hotspots.find(x => x.id === e.id);
    if (!h || h.el.style.display === 'none') return null;
    const r = h.el.querySelector('.dot').getBoundingClientRect(), c = inn.$('chatwin').getBoundingClientRect();
    const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight) return null;
    if (p.x >= c.left && p.x <= c.right && p.y >= c.top && p.y <= c.bottom) return null;
    return p;
  }
  // Keep: from the highlight, or from the idea's page in the book. Gemma speaks on the 1st keep of the visit, the 3rd,
  // then every 4th (recipe-book-ux.md §7); the live region says it every time
  // Stage 1 (docs/basket-stage1-design.md): a keep is a leaflet in the basket; one Gemma has already written goes into the book
  function keepIdea(atom, why, method) {
    const a = inn.atomsById[atom];
    const snap = a ? snapshot(a, why) : book.get(atom) || basket.get(atom);
    if (!snap || book.has(atom) || basket.has(atom)) return;
    let first = false, tuckedAway = null;
    if (inn.writer.written(atom)) ({ first, tuckedAway } = book.keep({ ...snap, full: inn.writer.written(atom) }));
    else {
      first = !book.everKept && !basket.count && !inn.state.basketEver;
      basket.add(snap);
      inn.track('basket_add', { from: method, basket_size: sizeBucket(basket.count) });
    }
    inn.state.basketEver = true;
    ideas.remove(atom);
    if (!inn.state.served.includes(atom)) inn.state.served.push(atom);
    inn.state.keeps = (inn.state.keeps || 0) + 1;
    inn.maybeOfferTell();
    inn.record({ kind: 'keep', atom });
    inn.countAtom('atom_capture', atom, { method, book_size: sizeBucket(book.count) });
    ideas.say(book.has(atom) ? `Kept. ${book.count} in your book.` : `In your basket. ${basket.count} ${basket.count === 1 ? 'leaflet' : 'leaflets'}.`);
    const n = inn.state.keeps;
    let line = null;
    if (tuckedAway) line = L.full;
    else if (n === 1 && !book.lasting && !inn.state.noStorageSaid) { inn.state.noStorageSaid = true; line = L.noStorage; }
    else if (n === 1) line = first ? L.keepFirstEver : pickLine('keep1', L.keepFirstVisit);
    else if (n === 3) line = pickLine('keep3', L.keepThird, { cluster_label: inn.world.clusters[inn.state.result?.cluster]?.label });
    else if (n > 3 && (n - 3) % 4 === 0) line = pickLine('keepN', L.keepLater);
    if (line) { inn.say(line, [], true); holdLine(); }
    inn.state.keepSpoke = !!line;
    inn.state.dismissRun = 0;
    inn.renderTheme();
    inn.store.save(inn.state);
  }
  const ideas = createIdeas({
    state: inn.state, atoms: inn.atomsById, save: () => inn.store.save(inn.state), here: () => inn.homeOf(inn.state.room),
    avatar: () => inn.$('cw-av'), bookChip: () => inn.$('btn-book'),
    layout: (what, on) => { if (what === 'highlight') inn.chatUI.hold(on); },
    onFirst: function first() { const wait = inn.casting ? 500 : lineHeldUntil - Date.now(); if (wait > 0) setTimeout(first, wait); else inn.say(L.ideaFirst, [], true); },   // a held line (an Inn note's, a cast's) is read first
    // Once per device, the first time a touch visitor opens an idea: how to swipe it
    wantHint: () => !book.hint,
    onHint: () => { book.hint = true; inn.say(inn.LINES.swipe_hint || "Swipe right to keep one, or left if it's not for you.", [], true); },
    onHighlight: c => inn.countAtom('atom_highlight', c.atom),
    onShown: c => inn.countAtom('atom_served', c.atom),       // in view for a moment, once each (not when the navigator picks it)
    canShow: () => inn.$('front-door').hidden,
    onRead: c => {
      const a = inn.atomsById[c.atom];
      inn.record({ kind: 'open', atom: c.atom });
      inn.countAtom('atom_open', c.atom, { from: 'highlight' });
      inn.bookView.open(c.atom, { from: 'card', loosePage: book.has(c.atom) ? null : snapshot(a, c.why) });
    },
    onKeep: (c, method) => keepIdea(c.atom, c.why, method),
    onDismiss: c => {
      inn.state.dismissed.push(c.atom);
      inn.state.dismissals = (inn.state.dismissals || 0) + 1;
      inn.record({ kind: 'dismiss', atom: c.atom });
      if (inn.state.dismissals === 1) { inn.say(L.dismissFirst, [], true); holdLine(); }
      inn.maybeOfferTell();
      // Three set aside in a row: Gemma asks what they'd like instead (§9); a pick counts like a choice
      inn.state.dismissRun = (inn.state.dismissRun || 0) + 1;
      if (inn.state.dismissRun === 3) { inn.state.dismissRun = 0; inn.state.askDifferent = true; }   // she asks in her next line (navigate)
      inn.renderTheme();
    },
    // When the 5 s undo closes (or Undo is pressed): count it once, knowing whether it was undone
    onUndo: (c, { undone, method, bumped }) => {
      if (undone) {
        inn.state.dismissed = inn.state.dismissed.filter(x => x !== c.atom);
        if (bumped) inn.state.served = inn.state.served.filter(x => x !== bumped);     // stepped aside for the undo: it can come again
        const i = inn.state.trail.map(e => e.kind === 'dismiss' && e.atom === c.atom).lastIndexOf(true);
        if (i >= 0) inn.state.trail.splice(i, 1);
        inn.say(L.undo, [], true);
        holdLine();
        inn.store.save(inn.state);
        inn.renderNotes();
      }
      inn.countAtom('atom_dismiss', c.atom, { method, undone: undone ? 'yes' : 'no' });
    },
  }); inn.ideas = ideas;
}
