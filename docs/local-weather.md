# The Inn opens in the visitor's weather

19 October 2026. Nicole asked whether the Inn could start in the weather where the visitor is.

## How it works

1. On a new visit (nothing saved in this tab yet), the page asks the genie Worker's `GET /local-weather`,
   and waits at most 1.5 seconds.
2. The Worker reads the rough location Cloudflare attaches to every request (from the connection's IP),
   rounds it to half a degree (about 50 km), and asks [Open-Meteo](https://open-meteo.com/) for the
   current conditions there. Answers are cached per rounded area for 20 minutes.
3. It maps them to one of the Inn's five weathers and returns only that, e.g. `{"weather":"rain"}`:

   | Open-Meteo says | The Inn shows |
   |---|---|
   | Thunder (codes 95 to 99), or gusts of 60 km/h or more | Stormy |
   | Drizzle, rain, snow or showers (51 to 86), or 0.2 mm or more falling | Rain |
   | 27 °C or warmer, dry | Very dry (Gemma calls it "sweltering") |
   | Overcast or fog (3, 45, 48) | Change (her "sea fog rolling in") |
   | Clear to partly cloudy (0 to 2) | Fair |

4. The Inn opens in that weather, and Gemma checks her guess instead of asking from scratch:
   "Hello, love. Looks like rain where you are. Is that right?" (lines follow docs/gemma-voice-guide.md: they work at night too) In the hall the chips are "That's right" and
   the other four weathers. In Cuddlecore they're "That's right" and "Turn the barometer".
5. If anything fails (no location, Open-Meteo slow or down, the Worker unreachable), the page carries on
   as before: rain, and "What's the weather like for you today?"

Time of day isn't part of it: the Inn already follows the visitor's own clock.

## Privacy

- Open-Meteo sees our Worker's request for a rounded area, never the visitor's IP or anything else about them.
- Nothing is logged or stored. The guess lives only in the tab's visit state, like the rest of the wander.
- Credits ("Made with open things") gain a line, which also gives Open-Meteo the CC BY 4.0 attribution it asks for:
  "The weather where you are: Open-Meteo, CC BY 4.0. Our server asks it about the rough area Cloudflare places
  your connection in, never anything that identifies you, and keeps nothing."
- Open-Meteo's free API is for non-commercial use, up to 10,000 calls a day. With the cache, WhiskedAway
  makes at most a few calls per area per hour.

## Analytics

New event `weather_guess` with `weather` and `outcome`: `shown` when the guess is used, `confirmed` when
the visitor taps "That's right". A correction shows up as the usual `weather_change`.
Needs the genie Worker deployed (it holds the allow-list and the new route).
