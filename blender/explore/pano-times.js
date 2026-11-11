// Dawn and dusk renders (24 Oct): which panoramas exist, and what to show when the one wanted doesn't.
// Pure, so test/pano-times.test.mjs can hold it. Night's renders exist for every weather and are left to loadTex's
// null-on-404; dawn and dusk only exist for some, so EXISTS is the list of what art has rendered, and showWeather
// never asks for a name that isn't on it. test/pano-times.test.mjs checks the list against blender/out both ways:
// when art adds renders, regenerate it with
//   node scripts/pano-times-list.mjs
export const EXISTS = new Set([
  'chiapothecary_pano_change_dawn',
  'chiapothecary_pano_change_dusk',
  'chiapothecary_pano_changeable_dawn',
  'chiapothecary_pano_changeable_dusk',
  'chiapothecary_pano_cloudy_dawn',
  'chiapothecary_pano_cloudy_dusk',
  'chiapothecary_pano_drizzle_dawn',
  'chiapothecary_pano_drizzle_dusk',
  'chiapothecary_pano_fair_dawn',
  'chiapothecary_pano_fair_dusk',
  'chiapothecary_pano_frost_dawn',
  'chiapothecary_pano_frost_dusk',
  'chiapothecary_pano_overcast_dawn',
  'chiapothecary_pano_overcast_dusk',
  'chiapothecary_pano_snow_dawn',
  'chiapothecary_pano_snow_dusk',
  'chiapothecary_pano_windy_dawn',
  'chiapothecary_pano_windy_dusk',
  'cuddlecore_pano_change_dawn',
  'cuddlecore_pano_change_dusk',
  'cuddlecore_pano_changeable_dawn',
  'cuddlecore_pano_changeable_dusk',
  'cuddlecore_pano_cloudy_dawn',
  'cuddlecore_pano_cloudy_dusk',
  'cuddlecore_pano_drizzle_dawn',
  'cuddlecore_pano_drizzle_dusk',
  'cuddlecore_pano_fair_dawn',
  'cuddlecore_pano_fair_dusk',
  'cuddlecore_pano_frost_dawn',
  'cuddlecore_pano_frost_dusk',
  'cuddlecore_pano_overcast_dawn',
  'cuddlecore_pano_overcast_dusk',
  'cuddlecore_pano_snow_dawn',
  'cuddlecore_pano_snow_dusk',
  'cuddlecore_pano_windy_dawn',
  'cuddlecore_pano_windy_dusk',
  'flourish_pano_changeable_dawn',
  'flourish_pano_changeable_dusk',
  'flourish_pano_cloudy_dawn',
  'flourish_pano_cloudy_dusk',
  'flourish_pano_drizzle_dawn',
  'flourish_pano_drizzle_dusk',
  'flourish_pano_fair_dawn',
  'flourish_pano_fair_dusk',
  'flourish_pano_frost_dawn',
  'flourish_pano_frost_dusk',
  'flourish_pano_overcast_dawn',
  'flourish_pano_overcast_dusk',
  'flourish_pano_snow_dawn',
  'flourish_pano_snow_dusk',
  'flourish_pano_windy_dawn',
  'flourish_pano_windy_dusk',
  'garden_pano_camp_changeable_dawn',
  'garden_pano_camp_changeable_dusk',
  'garden_pano_camp_cloudy_dawn',
  'garden_pano_camp_cloudy_dusk',
  'garden_pano_camp_drizzle_dawn',
  'garden_pano_camp_drizzle_dusk',
  'garden_pano_camp_fair_dawn',
  'garden_pano_camp_fair_dusk',
  'garden_pano_camp_frost_dawn',
  'garden_pano_camp_frost_dusk',
  'garden_pano_camp_overcast_dawn',
  'garden_pano_camp_overcast_dusk',
  'garden_pano_camp_snow_dawn',
  'garden_pano_camp_snow_dusk',
  'garden_pano_camp_windy_dawn',
  'garden_pano_camp_windy_dusk',
  'garden_pano_patio_changeable_dawn',
  'garden_pano_patio_changeable_dusk',
  'garden_pano_patio_cloudy_dawn',
  'garden_pano_patio_cloudy_dusk',
  'garden_pano_patio_drizzle_dawn',
  'garden_pano_patio_drizzle_dusk',
  'garden_pano_patio_fair_dawn',
  'garden_pano_patio_fair_dusk',
  'garden_pano_patio_frost_dawn',
  'garden_pano_patio_frost_dusk',
  'garden_pano_patio_overcast_dawn',
  'garden_pano_patio_overcast_dusk',
  'garden_pano_patio_snow_dawn',
  'garden_pano_patio_snow_dusk',
  'garden_pano_patio_windy_dawn',
  'garden_pano_patio_windy_dusk',
  'glasshouse_pano_spring_changeable_dawn',
  'glasshouse_pano_spring_changeable_dusk',
  'glasshouse_pano_spring_cloudy_dawn',
  'glasshouse_pano_spring_cloudy_dusk',
  'glasshouse_pano_spring_drizzle_dawn',
  'glasshouse_pano_spring_drizzle_dusk',
  'glasshouse_pano_spring_fair_dawn',
  'glasshouse_pano_spring_fair_dusk',
  'glasshouse_pano_spring_frost_dawn',
  'glasshouse_pano_spring_frost_dusk',
  'glasshouse_pano_spring_overcast_dawn',
  'glasshouse_pano_spring_overcast_dusk',
  'glasshouse_pano_spring_snow_dawn',
  'glasshouse_pano_spring_snow_dusk',
  'glasshouse_pano_spring_windy_dawn',
  'glasshouse_pano_spring_windy_dusk',
  'hallway_pano_entrance_change_dawn',
  'hallway_pano_entrance_change_dusk',
  'hallway_pano_entrance_changeable_dawn',
  'hallway_pano_entrance_changeable_dusk',
  'hallway_pano_entrance_cloudy_dawn',
  'hallway_pano_entrance_cloudy_dusk',
  'hallway_pano_entrance_drizzle_dawn',
  'hallway_pano_entrance_drizzle_dusk',
  'hallway_pano_entrance_fair_dawn',
  'hallway_pano_entrance_fair_dusk',
  'hallway_pano_entrance_frost_dawn',
  'hallway_pano_entrance_frost_dusk',
  'hallway_pano_entrance_overcast_dawn',
  'hallway_pano_entrance_overcast_dusk',
  'hallway_pano_entrance_snow_dawn',
  'hallway_pano_entrance_snow_dusk',
  'hallway_pano_entrance_windy_dawn',
  'hallway_pano_entrance_windy_dusk',
  'hallway_pano_middle_change_dawn',
  'hallway_pano_middle_change_dusk',
  'hallway_pano_middle_changeable_dawn',
  'hallway_pano_middle_changeable_dusk',
  'hallway_pano_middle_cloudy_dawn',
  'hallway_pano_middle_cloudy_dusk',
  'hallway_pano_middle_drizzle_dawn',
  'hallway_pano_middle_drizzle_dusk',
  'hallway_pano_middle_fair_dawn',
  'hallway_pano_middle_fair_dusk',
  'hallway_pano_middle_frost_dawn',
  'hallway_pano_middle_frost_dusk',
  'hallway_pano_middle_overcast_dawn',
  'hallway_pano_middle_overcast_dusk',
  'hallway_pano_middle_snow_dawn',
  'hallway_pano_middle_snow_dusk',
  'hallway_pano_middle_windy_dawn',
  'hallway_pano_middle_windy_dusk',
  'sweet_spells_pano_change_dawn',
  'sweet_spells_pano_change_dusk',
  'sweet_spells_pano_changeable_dawn',
  'sweet_spells_pano_changeable_dusk',
  'sweet_spells_pano_cloudy_dawn',
  'sweet_spells_pano_cloudy_dusk',
  'sweet_spells_pano_drizzle_dawn',
  'sweet_spells_pano_drizzle_dusk',
  'sweet_spells_pano_fair_dawn',
  'sweet_spells_pano_fair_dusk',
  'sweet_spells_pano_frost_dawn',
  'sweet_spells_pano_frost_dusk',
  'sweet_spells_pano_overcast_dawn',
  'sweet_spells_pano_overcast_dusk',
  'sweet_spells_pano_snow_dawn',
  'sweet_spells_pano_snow_dusk',
  'sweet_spells_pano_windy_dawn',
  'sweet_spells_pano_windy_dusk',
]);

/** The Inn's weathers (ids), in the barometer's order. Labels, chips and themes live in cuddlecore-world.json's weathers. */
export const WEATHERS = ['fair', 'cloudy', 'windy', 'overcast', 'changeable', 'change', 'drizzle', 'rain', 'stormy', 'snow', 'frost', 'very-dry'];

/**
 * STAND-INS (11 Nov 2026): the weathers added after the first five, and the existing look each borrows while its own
 * renders are missing (a 404 on its pano). Once art's renders land the room's own are found first and this goes unused.
 */
export const LOOKALIKE = { cloudy: 'fair', windy: 'fair', overcast: 'change', changeable: 'fair', drizzle: 'rain', frost: 'fair', snow: 'change' };

const FILE = new RegExp(`(?:^|\\/)([a-z_]+_pano_(?:[a-z-]+_)?(?:${WEATHERS.join('|')})_(?:dawn|dusk))(?:_preview|_4k)?\\.jpg$`);

/** The suffix a pano name takes for a time of day: true/'night' -> _night, 'dawn' -> _dawn, 'dusk' -> _dusk, falsy -> none. */
export const sfx = t => t ? '_' + (t === true ? 'night' : t) : '';

/** Does this dawn/dusk render exist? Anything else (day, night) is assumed to, as before. */
export function panoExists(url) {
  const m = FILE.exec(url);
  return !m || EXISTS.has(m[1]);
}

// Weathers whose light is near enough to fair's to borrow its dawn or dusk
const FAIRISH = new Set(['fair', 'very-dry', 'change', 'cloudy', 'windy', 'changeable']);

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

/** A weather's own candidates, then (for a weather in LOOKALIKE) its stand-in's, without repeats. */
export function withLookalike(weather, list = candidates) {
  const own = list(weather), alt = LOOKALIKE[weather] ? list(LOOKALIKE[weather]) : [];
  const seen = new Set(own.map(c => c.join()));
  return [...own, ...alt.filter(c => !seen.has(c.join()))];
}

/** The first candidate that can exist, given how a room names its panoramas: pano(weather, tod, full). */
export function usable(R, weather, time, has = panoExists) {
  return withLookalike(weather, w => candidates(w, time)).filter(([w, t]) => (t !== 'dawn' && t !== 'dusk') || has(R.pano(w, t, false)));
}
