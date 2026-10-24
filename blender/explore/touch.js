// What a tap on a hotspot does (architecture step 3; it was one long if/else in explore.html). touch(id) does what every
// tap does (the room's intro, the trail, the count, an Inn note), then the first handler whose `when` matches runs.
// Each feature registers its own handlers in its install(): inn.onTouch(order, when, run).
//   when(obj, id) -> true if this handler is for that object
//   run(obj, id, tap) -> true to stop there (no Inn note after it); tap.note is the Inn note, which run may take (null)
// Order keeps today's precedence where two could match (chia drawers and the kitchen before plain ambient objects, the star
// chart and notice board before generic ambient, Sweet Spells' and the Chiapothecary's tools before submit):
//   10 something that plays (here)        60 any other ambient object (here)      110 the Chiapothecary's tools (chia-glue)
//   20 a Chiapothecary drawer (chia-glue) 70 barometer, clock, seasons wheel      120 a centrepiece cast (centrepieces)
//   25 the tray, cage and bell jar (how-you-like-it)
//   29 the garden's barbecue, once Your kitchen has one (garden)    59 the garden's fire and tent in the rain (garden)
//   30 the kitchen and range (tell-glue)     (inn-dialogs)                         130 any other submit (here)
//   40 the star chart (centrepieces)      80 doors and walks (rooms)              140 Tell Gemma's objects (tell-glue)
//   50 the notice board (theme-glue)      90 the hallway dial (rooms)             then: "I can't open this one" (here)
//                                         100 Sweet Spells' tools (sweet-glue)
// A new kind of object (the garden's, the Inn map's) registers a handler with an order that slots it in.
import { sound } from './sound.js';
import { pickIdea } from './idea-pick.js';

export function install(inn) {
  const handlers = [];
  inn.onTouch = (order, when, run) => {
    handlers.push({ order, when, run });
    handlers.sort((a, b) => a.order - b.order);              // stable: equal orders keep the order they registered in
  };

  inn.touch = function touch(id) {
    const obj = inn.world.objects[id];
    // A visitor who skipped the weather question and started looking around still hears what this room is for, before
    // the object's own line (the barometer answers the question itself; a door introduces the room it opens)
    if (!['weather', 'door', 'walk'].includes(obj.type)) inn.introduce();
    if (obj.type === 'energy') return inn.chooseEnergy(obj.energy);   // the candle is the event: no separate touch
    inn.record({ kind: 'touch', id });
    inn.track('hotspot_touch', { room: inn.state.room, object: id, object_type: obj.type });
    const tap = { note: inn.innNoteLine(id) };                  // an Inn note: said after the object's own line
    const h = handlers.find(x => x.when(obj, id));
    if (h) { if (h.run(obj, id, tap)) return; }
    else inn.openTool(obj.label, "I can't open this one for you yet. Touching it still tells me something about what you're after, so it counts.");
    if (tap.note) { inn.say(tap.note, [], true); inn.holdLine(); }
  };

  // Something that plays (the music box). With the sound off, the speaker by the bell glows to say where it is
  inn.onTouch(10, obj => obj.type === 'ambient' && obj.plays, (obj, id) => {
    const now = sound.music(id), $ = inn.$;
    if (!sound.on) { $('btn-sound').classList.remove('nudge'); void $('btn-sound').offsetWidth; $('btn-sound').classList.add('nudge'); setTimeout(() => $('btn-sound').classList.remove('nudge'), 2200); }
    inn.say(!sound.on ? obj.moment_quiet || obj.moment : now ? inn.momentOf(id, obj) : obj.moment_stop || obj.moment, [], true);   // playing: its `moments` rotate too
    inn.holdLine();
  });
  // Any other ambient object: her line (a content `moments` list rotates with the base line, never repeating in a visit)
  inn.onTouch(60, obj => obj.type === 'ambient', (obj, id) => {
    inn.say([inn.momentOf(id, obj), obj.ideas && obj.bridge].filter(Boolean).join(' '), [], true);
    if (id === 'wind-chime') sound.chime?.();                   // it says it rings: with the sound on, it does (QA 4)
    // Food on the counters and the Conservatory's herbs show their idea's card (Nicole, 22 Oct): obj.ideas, best fit first
    if (obj.ideas?.length) inn.showIdea(pickIdea(obj.ideas.map(x => inn.atomsById[x]).filter(a => a && !inn.dietClash(a)).sort((a, b) => inn.kitchenOk(b) - inn.kitchenOk(a)),
      { canServe: inn.canServe, onCard: a => inn.onCard(a.id), season: inn.room().seasons ? inn.seasonNow() : null }), 'object');
    inn.holdLine();                         // her reading waits, so the object's line stays up long enough to read (QA 9 issue 2)
  });
  inn.onTouch(130, obj => obj.type === 'submit', obj => {
    inn.openTool(obj.tool_title || obj.label, obj.tool_text || "I can't open this one for you yet.");
  });
}
