// Dawn and dusk renders (24 Oct): which panoramas exist, and what to show when the one wanted doesn't.
// Pure, so test/pano-times.test.mjs can hold it. Night's renders exist for every weather and are left to loadTex's
// null-on-404; dawn and dusk only exist for some, so EXISTS is the list of what art has rendered, and showWeather
// never asks for a name that isn't on it. test/pano-times.test.mjs checks the list against blender/out both ways:
// when art adds renders, regenerate it with
//   node scripts/pano-times-list.mjs
export const EXISTS = new Set([
]);
const FILE = /(?:^|\/)([a-z_]+_pano_(?:[a-z-]+_)?(?:rain|fair|change|stormy|very-dry)_(?:dawn|dusk))(?:_preview|_4k)?\.jpg$/;

/** The suffix a pano name takes for a time of day: true/'night' -> _night, 'dawn' -> _dawn, 'dusk' -> _dusk, falsy -> none. */
export const sfx = t => t ? '_' + (t === true ? 'night' : t) : '';

/** Does this dawn/dusk render exist? Anything else (day, night) is assumed to, as before. */
export function panoExists(url) {
  const m = FILE.exec(url);
  return !m || EXISTS.has(m[1]);
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
export function usable(R, weather, time, has = panoExists) {
  return candidates(weather, time).filter(([w, t]) => (t !== 'dawn' && t !== 'dusk') || has(R.pano(w, t, false)));
}
