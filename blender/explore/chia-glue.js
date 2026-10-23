// The Chiapothecary, wired to the Inn (moved out of explore.html, architecture step 3): the Mix and its moods
// (chia = createChiaMix), the room's tools (CHIA_TOOLS: flasks, Mix, fridge, drawers) and a jar's own buttons on its page
// (chiaActions: ready by breakfast, make 4 jars). The Mix itself is chia-mix.js. Shared through `inn` (docs/code-map.md).
import { visit } from './visit-state.js';
import { sound } from './sound.js';
import { book } from './book.js';
import { createChiaMix } from './chia-mix.js';
import { servingsWords } from './checkin.js';

export function install(inn) {
  // ---------- the Chiapothecary (explore/chia-mix.js, rooms-views.md Stage A): moods on the flasks, Mix an experiment with
  // Gemma's swaps, then the write-out as a loose page in the book, ready to keep or cook
  const chia = createChiaMix({
    visit, lines: inn.LINES, writer: inn.writer, track: inn.track, sound, keepEveryWay: inn.EVERY_WAY_KEEPS,
    words: t => inn.shopWords.text(t),                             // the Mix in the visitor's shopping words (QA 9 issue 3)
    diets: () => visit.get('dietary'),                           // an add-in that clashes with one gets a plain line
    beforeOpen: () => { inn.ideas.close(false); if (inn.bookView.isOpen) inn.bookView.close(); if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto'); },
    say: t => { inn.say(t, [], true); inn.holdLine(); },
    onStart: rec => { inn.atomsById[rec.id] = rec; },               // so the notebook, Keep and Cook this treat it like any idea
    onWritten: rec => {
      inn.bookView.open(null, { from: 'mix', loosePage: rec });
      inn.say(chia.data.lines.written, [], true);
    },
  }); inn.chia = chia;
  const CHIA_TOOLS = { mood: () => chia.open('mood'), superpower: () => chia.open('mood'), generate: () => chia.open('mix'),
                       milk: () => chia.open('mix', { step: 'base' }), 'add-ins': () => chia.open('mix', { step: 'flavour' }) }; inn.CHIA_TOOLS = CHIA_TOOLS;
  // A chia jar's own buttons: "Ready by breakfast?" runs cook mode's timer to 7 tomorrow; "Make 4 jars" sets servings and opens the list
  const breakfastAt = () => { const d = new Date(); if (d.getHours() >= 7) d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0); return d.getTime(); };
  const chiaActions = [
    // From 7 in the morning on, the next 7:00 is tomorrow's: say so (the line is "Set it tonight…" otherwise)
    { label: chia.data.lines.breakfast, do: rec => {
      const day = new Date().getHours() >= 7 && new Date().getHours() < 17;
      inn.say(day ? chia.data.lines.breakfastLineDay || "Set it now and it'll be ready by 7 tomorrow morning." : chia.data.lines.breakfastLine, [], true);
      inn.cook.open(rec, 'breakfast', { until: breakfastAt() });
    } },
    // 4 jars is the same servings answer as the check-in's (setAnswer, list scaling). The list is made from the book, so a jar
    // not kept yet goes in first; and if the check-in said another number, Gemma says it's changed (QA 7)
    { label: chia.data.lines.jars, do: rec => {
      if (!book.has(rec.id)) inn.keepIdea(rec.id, rec.why, 'jars');
      if (book.has(rec.id)) inn.shopList.set(rec.id, true, 'jars');
      const was = visit.get('servings');
      inn.setAnswer('servings', '4', { from: 'jars', quiet: true });
      inn.bookView.open('list', { from: 'jars' });
      const changed = was && was !== '4'
        ? (chia.data.lines.jarsChanged || "Four jars, so I've made it four, not {n}. I've scaled your list.").replace('{n}', was === '1' ? 'one' : servingsWords(inn.CW, was)) : '';
      inn.say(changed || chia.data.lines.jarsLine, [], true); inn.holdLine();
    } },
  ]; inn.chiaActions = chiaActions;
}
