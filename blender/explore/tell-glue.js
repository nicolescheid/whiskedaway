// Tell Gemma, wired to the Inn (moved out of explore.html, architecture step 3): the one setter for the check-in's
// answers (setAnswer), her line on each sheet's Done (checkedIn, kitchenSaid, acknowledge), the facts she brings up on a
// room's first visit (entryFact), the offer to tell her (maybeOfferTell), the empty-room line, the Map's default country,
// shopping words, the sheets (tell = createTell) and the tags in her chat. The sheets themselves are tell.js and tags.js.
// The keep-the-answer policy (EVERY_WAY_KEEPS) is the bootstrap's. Shared through `inn` (docs/code-map.md).
import { visit } from './visit-state.js';
import { sound } from './sound.js';
import { createTags } from './tags.js';
import { book } from './book.js';
import { sweetTags } from './sweet-spells.js';
import { servingsNumber, checkinWords, timeWords, ackLine, heardWords } from './checkin.js';
import { createTell, countryFromLanguage, cuisineLabel, countryLabel } from './tell.js';
import { createShopWords } from './shopwords.js';
import { kitchenFits, kitchenWords } from './kitchen.js';

export function install(inn) {
  Object.assign(inn, { setAnswer, entryFact, maybeOfferTell, emptyRoomLine, applyShopWords });   // its functions, for the other modules (hoisted)
  // What the visitor has told Gemma, as tags in her chat (explore/tags.js): change or forget from any room
  // ---------- Tell Gemma about you (explore/tell.js, tell-gemma-ux.md): the pantry, the map and dietary needs
  const T = inn.LINES.tell || {}; inn.T = T;
  const CW = checkinWords(T); inn.CW = CW;
  // Each answer's sound, whichever door (sound.js: the same family for every object that sets one answer)
  const answerSound = (key, value, prev = null) => (value ? sound.answer(key, { change: key === 'energy' && !!prev, count: servingsNumber(value) || 1 })
    : sound.unanswer(key)); inn.answerSound = answerSound;                              // the check-in's words (checkin.js; gemma-lines.json tell.checkin)
  // The one setter for the check-in's answers, whichever door they come through (the desk's sheet, a tag): the same key, the same
  // tag, the same line from Gemma (checkin-views.md: one home per answer, many doors to it). `quiet` when the sheet says one line for all.
  function setAnswer(key, value, { from = 'tag', quiet = false } = {}) {
    if (visit.get(key) === (value ?? null)) return false;
    visit.set(key, value ?? null);
    inn.track('tell_set', { kind: key, from });               // single-choice: never a count (analytics-events.js ANSWER_KINDS)
    if (!quiet) answerSound(key, value);                   // the sheet plays its sounds in the tap
    if (!quiet && value) { inn.say(capFirst(ackLine(CW, key, value) || ''), [], true); inn.holdLine(); }
    inn.scheduleNavigate();                                    // the next idea leans on it
    return true;
  }
  const TL = {
    offer: T.offer || "Want to tell me what's in your cupboard, or anything to avoid?", offerYes: T.offerYes || 'Tell me', offerNo: T.offerNo || 'Not now',
    forgot: T.forgot || 'Forgotten.', nothingAnywhere: T.nothingAnywhere || "I can't find anything on my shelves that fits all of that.",
    roomNone: T.roomNone || "Nothing in here fits {diet}, I'm afraid. {room} has a few.",
  }; inn.TL = TL;
  // A world object with "tool": "checkin" (the foyer desk) opens the check-in; "pantry" (the groceries by the door too) the pantry
  const TELL_TOOLS = { pantry: 'pantry', locale: 'map', dietary: 'dietary', checkin: 'checkin' }; inn.TELL_TOOLS = TELL_TOOLS;
  // The Map's starting country: the connection's (from /local-weather), else the browser's language region (PM, option b)
  const mapDefault = () => (inn.state.connCountry && countryLabel(inn.state.connCountry) ? inn.state.connCountry : countryFromLanguage()); inn.mapDefault = mapDefault;
  // Words that mean the same in the kitchen (tell-data.json groups): each word maps to the rest of its group
  const SYNONYMS = {}; inn.SYNONYMS = SYNONYMS;
  for (const [w, xs] of Object.entries(T.synonyms || {})) SYNONYMS[w.toLowerCase()] = [].concat(xs).map(x => String(x).toLowerCase());
  // Cards and the book show the visitor's country's words once the Map knows it (brainstorm-1 D6): written in NZ words, swapped on display
  const shopWords = createShopWords({ table: T.shopWords, atoms: () => inn.world.atoms }); inn.shopWords = shopWords;
  function applyShopWords() { if (shopWords.apply(visit.get('country') || mapDefault())) { inn.ideas.render(); inn.bookView.refresh(); } }
  const pantryNow = () => { const p = visit.get('pantry'); return Array.isArray(p) ? { items: p, useUp: false } : { items: p?.items || [], useUp: !!p?.useUp }; }; inn.pantryNow = pantryNow;
  const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);
  const DIET_WORD = { vegetarian: 'vegetarian', vegan: 'vegan', 'gluten-free': 'gluten-free', 'dairy-free': 'dairy-free', 'nut-free': 'nut-free', 'low-fodmap': 'low-FODMAP' }; inn.DIET_WORD = DIET_WORD;
  const capFirst = t => t.replace(/^./, c => c.toUpperCase());
  // Her one line on Done, naming two things at most, never the list (tell-gemma-ux §4); {two} {many} {c} {d} {country}
  // The check-in's Done: each answer through its own door's setter, quietly, then one line from Gemma (the answer's own line when
  // only one changed, else her thanks)
  function checkedIn({ after, changed, from, forgot }) {
    if (forgot) return inn.say(TL.forgot, [], true);
    for (const k of changed) {
      if (k === 'energy') { if (after.energy) inn.chooseEnergy(after.energy, { quiet: true, from }); else visit.forget('energy'); }
      else if (k === 'weather') inn.chooseWeather(after.weather, { quiet: true });
      else setAnswer(k, after[k], { from, quiet: true });
    }
    const one = changed.length === 1 && after[changed[0]] ? changed[0] : null;
    // Several answers: name two of them (QA 6/7), servings, then time, then confidence; the candle and weather say their own
    const PHRASE = { servings: v => heardWords(CW, 'servings', v), time: v => heardWords(CW, 'time', v) || timeWords(CW, v),
                     confidence: v => heardWords(CW, 'confidence', v) || String(CW.confidence?.[v] || '').toLowerCase() };
    const two = ['servings', 'time', 'confidence'].filter(k => changed.includes(k) && after[k]).map(k => PHRASE[k](after[k])).filter(Boolean).slice(0, 2);
    const named = two.length === 2 ? (CW.ack.checkinTwo || "{a}, and {b}. I'll keep all that in mind.").replace('{a}', two[0]).replace('{b}', two[1]) : '';
    const line = !one ? named || CW.ack.checkin : one === 'energy' ? inn.world.energies?.[after.energy]?.moment : one === 'weather' ? inn.world.weathers[after.weather]?.moment
      : ackLine(CW, one, after[one]);
    if (line) { inn.say(capFirst(line), [], true); inn.holdLine(); }
    inn.scheduleNavigate();
  }
  // Your kitchen's Done: her line for one appliance, else "{x}. I'll keep to those." (two named at most), or cleared; each appliance
  // picked is counted (kitchen_pick: its id, nothing else)
  function kitchenSaid({ before, after, forgot }) {
    const K = inn.LINES.kitchen || {}, p = after.picks;
    for (const id of p) if (!before.picks.includes(id)) inn.track('kitchen_pick', { appliance: id });
    if (forgot) return inn.say(TL.forgot, [], true);
    const words = kitchenWords(p, K);
    const line = !p.length ? K.cleared || "Cleared. I'll suggest anything."
      : p.length === 1 ? K.pick?.[p[0]] || `${capFirst(words[0])}.`
      : (K.many || "{x}. I'll keep to those.").replace('{x}', capFirst(inn.listOf(words.slice(0, 2)) + (words.length > 2 ? ' and the rest' : '')));
    // Cards already out stay (PM): say so once when some no longer fit
    const misfit = p.length && inn.state.cards.some(c => inn.atomsById[c.atom] && !kitchenFits(inn.atomsById[c.atom], p));
    inn.say([line, misfit && K.cards_stay].filter(Boolean).join(' '), [], true);
    inn.holdLine();
    inn.scheduleNavigate();
  }
  function acknowledge(kind, { after, forgot }) {
    const A = T.ack || {};
    if (forgot) return inn.say(TL.forgot, [], true);
    let line = '';
    if (kind === 'pantry') {
      if (after.items.length) sound.answer('pantry');      // the paper bag
      const xs = after.items, two = inn.listOf(xs.slice(0, 2)), many = `${xs[0]}, ${xs[1]} and a few more`;
      line = after.useUp ? (A.pantryUseUp || '{two} first, then.').replace('{two}', two)
        : xs.length >= 3 ? (A.pantryMany || '{many}. Noted.').replace('{many}', many) : (A.pantry || "{two}. I'll work with those.").replace('{two}', two);
    } else if (kind === 'dietary') {
      const xs = after.dietary.filter(d => !inn.PASS_ONLY.has(d)).map(d => DIET_WORD[d] || d);
      // every need is named, so none seems dropped (QA pass 4); low-FODMAP isn't kept to (no cards checked yet), only passed on
      const fodmap = after.dietary.includes('low-fodmap') ? `${T.dietary?.fodmapLabel || 'Low-FODMAP'}. ${T.dietary?.fodmapNote || "I'll pass it on when I write your recipe. I only leave out cards I've checked."}` : '';
      line = xs.length ? (A.dietary || "{d}. I'll keep to that.").replace('{d}', inn.listOf(xs)) : fodmap || (A.dietaryOther || "Noted. I'll pass it on when I write your recipe.");
    }
    inn.say(capFirst(line), [], true);
    inn.holdLine();
    inn.scheduleNavigate();                                   // the next idea leans on it
  }
  // One fact on a room's first visit: dietary, then the pantry (in the kitchens that cook), then a cuisine (Inn rule 11)
  function entryFact(id) {
    const F = T.entry || {};
    const d = [].concat(visit.get('dietary') || []).filter(x => !inn.PASS_ONLY.has(x)), p = pantryNow().items, c = inn.cuisinesNow();
    if (d.length) return (F.dietary || "I'll keep to {d} in here too.").replace('{d}', inn.listOf(d.map(x => DIET_WORD[x] || x)));
    if (p.length && ['cuddlecore', 'flourish'].includes(id)) return (F.pantry || "I'll look for things that use your {p}.").replace('{p}', inn.listOf(p.slice(0, 2)));
    if (c.length) return (F.cuisine || "I'll lean {c} where I can.").replace('{c}', cuisineLabel(c[0]));
    return '';
  }
  function maybeOfferTell() {
    if (inn.state.tellOffered || (inn.state.keeps || 0) + (inn.state.dismissals || 0) < 2) return;
    if (pantryNow().items.length || visit.get('foodMap') || visit.get('dietary') || visit.get('dietaryOther')) return;
    inn.state.tellOffered = true;
    inn.state.offerTell = true;                               // she asks in her next line (navigate), after the keep line's 3 s
  }
  // When the diet filter (or the visit) has emptied this room: once per room, name the room with most that fit, and let other
  // rooms' ideas in here; once per visit, say when nothing anywhere fits. Never a bubble that breaks the filter (§5)
  const unused = a => !inn.state.served.includes(a.id) && !inn.state.dismissed.includes(a.id) && !book.has(a.id);
  const fitsDiet = a => !inn.dietClash(a) && !inn.likeClash(a) && unused(a);              // the cage always wins, before the kitchen loosens
  const fits = a => fitsDiet(a) && inn.kitchenOk(a); inn.fits = fits;
  function emptyRoomLine() {
    const home = inn.homeOf(inn.state.room);
    if (!inn.hasOwn()) return null;
    if (inn.world.atoms.some(a => a.room === home && fits(a))) return null;
    // The kitchen first: if the room still has ideas for their diet, loosen the kitchen here and serve again
    if (inn.world.atoms.some(a => a.room === home && fitsDiet(a))) {
      const line = inn.loosenKitchen(home);
      if (line) { inn.scheduleNavigate(); return line; }
    }
    // Then the cage: if all the room has left is something caged, she says so and lets it out for this room (never the bell jar)
    if (inn.world.atoms.some(a => a.room === home && !inn.dietClash(a) && unused(a) && inn.feelsCaged(a))) {
      const line = inn.loosenFeels(home);
      if (line) { inn.scheduleNavigate(); return line; }
    }
    const diet = [].concat(visit.get('dietary') || []).filter(x => !inn.PASS_ONLY.has(x));   // not a filter yet (no cards checked), so never the reason
    if (!inn.world.atoms.some(fits)) {
      if (!diet.length || inn.state.nothingSaid) return null;
      inn.state.nothingSaid = true;
      return TL.nothingAnywhere;
    }
    if ((inn.state.emptySaid ||= {})[home]) return null;
    inn.state.emptySaid[home] = true;
    (inn.state.awayLift ||= {})[home] = true;
    const counts = {};
    inn.world.atoms.filter(fits).forEach(a => { counts[a.room] = (counts[a.room] || 0) + 1; });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const name = { cuddlecore: 'Cuddlecore', flourish: 'Flourish', 'sweet-spells': 'Sweet Spells', chiapothecary: 'The Chiapothecary' }[best] || 'Next door';
    if (!diet.length) return inn.LINES.room_empty || "That's everything I've got in here. Try next door.";
    return TL.roomNone.replace('{diet}', inn.listOf(diet.map(x => DIET_WORD[x] || x))).replace('{room}', name);   // "vegan, gluten-free and nut-free"
  }
  const tell = createTell({
    visit, lines: inn.LINES.tell, kitchenLines: inn.LINES.kitchen || {}, track: inn.track, keepEveryWay: inn.EVERY_WAY_KEEPS,
    openMap: src => inn.foodMap.open(src), mapWords: () => inn.foodMap?.word(visit.get('foodMap')) || '',   // the food map (food-map.js)
    beforeOpen: () => { inn.ideas.close(false); if (inn.bookView.isOpen) inn.bookView.close(); if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto'); },
    onDone: (k, r) => (k === 'checkin' ? checkedIn(r) : k === 'kitchen' ? kitchenSaid(r) : acknowledge(k, r)),
    openEnergy: () => tagsUI.openEnergy(),
    checkin: {
      energies: () => Object.entries(inn.world.energies || {}).map(([id, e]) => ({ id, label: e.label })),
      weathers: () => Object.entries(inn.world.weathers || {}).map(([id, w]) => ({ id, label: w.label })),
      weather: () => inn.state.weather || null,
      onTap: (k, v, prev) => k !== 'weather' && answerSound(k, v, prev),
      // Done with the weather still on the local guess: the guess was right (analytics; once a visit, like the old "That's right")
      onDone: after => {
        if (inn.state.weatherFrom !== 'local' || after.weather !== inn.state.weather || inn.state.guessKept) return;
        inn.state.guessKept = true;
        inn.track('weather_guess', { weather: inn.state.weather, outcome: 'kept' });
      },
    },
    energyLabel: () => inn.world.energies?.[visit.get('energy')]?.label || '',
  }); inn.tell = tell;
  const tagsUI = createTags({ el: inn.chatUI.tags, visit, world: inn.world, kitchenLines: inn.LINES.kitchen || {}, choose: { energy: id => inn.chooseEnergy(id), answer: (k, v) => setAnswer(k, v, { from: 'tag' }) }, tell,
    chipLabel: `+ ${T.menu?.title || 'Tell me about you'}`, lines: T, extra: { ...sweetTags(inn.sweet.data, (k, src) => inn.sweet.open(k, src)),
      foodMap: { icon: '🗺', name: inn.LINES.foodMap?.title || 'The food map', word: v => inn.foodMap?.word(v) || '', open: () => inn.foodMap.open('tag') } } });

  // Taps (explore/touch.js): the range and the appliances open Your kitchen (appliances-chia-plan.md §1); the pantry, the map,
  // the cookbooks and the desk open their sheets after her line
  inn.onTouch(30, (obj, id) => id === 'fl-range' || obj.type === 'kitchen', (obj, id) => {
    const K = inn.LINES.kitchen || {};
    inn.say([inn.momentOf(id, obj), inn.kitchenNow().length ? '' : inn.pickLine('kitchen.range', [].concat(K.range || []))].filter(Boolean).join(' '), [], true);
    inn.holdLine();
    tell.open('kitchen', 'object', { appliance: obj.appliance || null });
  });
  inn.onTouch(140, obj => TELL_TOOLS[obj.tool], (obj, id) => {
    // Cuddlecore's "How you're feeling" jars open the check-in (a stand-in line until content writes tell.objects['symptom-jars'])
    const told = T.objects?.[id] || (id === 'symptom-jars' ? "Tell me how much you've got in you today, and I'll cook to suit." : null);
    if (told) { inn.say(told, [], true); inn.holdLine(); }   // her reading waits, so this line is the one you see
    tell.open(TELL_TOOLS[obj.tool], 'object');
  });
}
