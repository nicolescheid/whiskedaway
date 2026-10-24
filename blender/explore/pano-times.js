// Dawn and dusk renders (24 Oct): which panoramas exist, and what to show when the one wanted doesn't.
// Pure, so test/pano-times.test.mjs can hold it. Night's renders exist for every weather and are left to loadTex's
// null-on-404; dawn and dusk only exist for some, so this list is what keeps showWeather from asking for the rest.
// Coverage: `fair` for every room and stop; `change` for the four kitchens and both hallway stops.
const CHANGE = /^(cuddlecore|flourish|sweet_spells|chiapothecary|hallway_pano_(entrance|middle))_/;
const FILE = /(?:^|\/)([a-z_]+?)_pano_(?:[a-z-]+_)?(fair|change|rain|stormy|very-dry)_(dawn|dusk)(?:_preview)?\.jpg$/;

/** The suffix a pano name takes for a time of day: true/'night' -> _night, 'dawn' -> _dawn, 'dusk' -> _dusk, falsy -> none. */
export const sfx = t => t ? '_' + (t === true ? 'night' : t) : '';

/** Does this dawn/dusk render exist? Anything else (day, night) is assumed to, as before. */
export function panoExists(url) {
  const m = FILE.exec(url);
  if (!m) return true;
  const base = url.split('/').pop();
  return m[2] === 'fair' || (m[2] === 'change' && CHANGE.test(base));
}

// Weathers whose light is near enough to fair's to borrow its dawn or dusk
const FAIRISH = new Set(['fair', 'very-dry', 'change']);

/**
 * The renders to try, best first, as [weather, tod] (tod: 'dawn' | 'dusk' | 'night' | null for the day render).
 * dawn: its own, fair's, then the day render. dusk: its own, fair's, then night's (the room is nearly dark), then the day render.
 */
export function candidates(weather, time) {
  const day = [weather, null];
  if (time === 'night') return [[weather, 'night'], day];
  if (time !== 'dawn' && time !== 'dusk') return [day];
  const own = [weather, time], fair = FAIRISH.has(weather) && weather !== 'fair' ? [['fair', time]] : [];
  return time === 'dawn' ? [own, ...fair, day] : [own, ...fair, [weather, 'night'], day];
}

/** The first candidate that can exist, given how a room names its panoramas: pano(weather, tod, full). */
export function usable(R, weather, time) {
  return candidates(weather, time).filter(([w, t]) => (t !== 'dawn' && t !== 'dusk') || panoExists(R.pano(w, t, false)));
}
