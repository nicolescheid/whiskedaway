// The visitor's weather for the Inn's opening view (docs/local-weather.md): Open-Meteo's current conditions as one of the
// Inn's twelve weathers (ids as in blender/explore/cuddlecore-world.json). Pure, so test/inn-weather.test.mjs can hold it.
// WMO weather codes: https://open-meteo.com/en/docs (0 clear, 1-3 mainly clear to overcast, 45/48 fog, 51-57 drizzle,
// 61-67 rain, 71-77 snow, 80-82 rain showers, 85/86 snow showers, 95-99 thunder).

/** The Open-Meteo `current` fields innWeather reads */
export const CURRENT_FIELDS = 'weather_code,temperature_2m,precipitation,wind_gusts_10m,cloud_cover';

const within = (x, lo, hi) => x >= lo && x <= hi;

/** Open-Meteo's current conditions as an Inn weather id, or null without a weather code. */
export function innWeather({ weather_code: code, temperature_2m: temp, precipitation: rain, wind_gusts_10m: gusts, cloud_cover: cloud } = {}) {
  if (code == null) return null;
  if (code >= 95) return 'stormy';                                               // thunder
  if (within(code, 71, 77) || code === 85 || code === 86) return 'snow';          // snow, snow grains, snow showers
  const showers = within(code, 80, 82), falling = within(code, 51, 67) || showers || rain >= 0.2;
  if (falling && gusts >= 60) return 'stormy';                                   // rain on a proper gale
  if (showers && cloud != null && cloud < 70) return 'changeable';               // showers with sun between them
  if (within(code, 61, 67) || showers) return 'rain';                            // rain, freezing rain, heavier showers
  if (within(code, 51, 57)) return 'drizzle';                                    // drizzle, freezing drizzle
  if (rain >= 0.2) return 'rain';                                                // something falling the code doesn't say
  if (gusts >= 50) return 'windy';                                               // dry, but blowing hard
  if (temp >= 27) return 'very-dry';                                             // sweltering
  if (code === 45 || code === 48) return 'change';                               // fog (her "sea fog rolling in")
  if (temp <= 0 && code <= 2) return 'frost';                                    // at or below freezing under a clear or broken sky
  if (code === 3 || cloud >= 85) return 'overcast';                              // grey all over
  if (code === 2 || cloud >= 40) return 'cloudy';                                // partly cloudy
  return 'fair';                                                                 // clear or mainly clear
}
