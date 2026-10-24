// The garden (24 Oct 2026): outdoor cooking, out through Flourish's stable door. Two stops, the patio and the camp
// (garden-world.json, ROOMS keys garden-patio and garden-camp, so the Inn map lights it up). Its doors, walks, herbs and
// ovens are ordinary objects; this module holds what's the garden's own:
// - the garden table lays out the room's best idea, like Flourish's Lay the Table (a centrepiece cast, kind 'table')
// - the barbecue opens Your kitchen until the visitor has told Gemma they've got one, then brings out a barbecue idea
// - in rain and storm the fire is out and the tent laced shut, so those objects say their `moment_wet` line instead
import { pickIdea } from './idea-pick.js';

export function install(inn) {
  inn.CAST_ROOMS.garden = 'table';                                  // centrepieces.js: gd-table casts with cast.table's lines

  const wet = () => ['rain', 'stormy'].includes(inn.state.weather);
  // An object's idea card, as touch.js does for food on the counters: best fit first, never one that clashes with a diet
  function showIdeas(obj) {
    if (!obj.ideas?.length) return;
    inn.showIdea(pickIdea(obj.ideas.map(x => inn.atomsById[x]).filter(a => a && !inn.dietClash(a)).sort((a, b) => inn.kitchenOk(b) - inn.kitchenOk(a)),
      { canServe: inn.canServe, onCard: a => inn.onCard(a.id), season: null }), 'object');
  }

  // Taps (explore/touch.js): before the kitchen (30), the barbecue once Your kitchen has it; before plain ambient (60), the wet lines
  inn.onTouch(29, (obj, id) => id === 'gd-bbq' && inn.kitchenNow().includes('bbq'), (obj, id) => {
    inn.say(inn.momentOf(id, obj), [], true);
    showIdeas(obj);
    inn.holdLine();
  });
  inn.onTouch(59, obj => obj.type === 'ambient' && obj.moment_wet && wet(), obj => {
    inn.say(obj.moment_wet, [], true);
    showIdeas(obj);
    inn.holdLine();
  });
}
