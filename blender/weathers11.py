"""The seven weathers added on 11 Nov 2026, derived from each room's own five (fair, change, rain, stormy, very-dry).

Each room build keeps its WEATHERS table for the original five and calls derive() for the rest, so a room's tuning
carries over: cloudy is that room's fair with the sun half hidden, drizzle its rain turned lighter, and so on.
The window plates come from weather_plates.py (art-inbox/*/30-87-*.png).

  cloudy      broken cloud, sun breaking through: fair light, the sun at half strength
  overcast    flat grey, shadowless: the change (sea-fog) light, no sun
  changeable  sun and showers: a sun at three-quarters, cooler sky, a few drops on the glass
  drizzle     fine light rain: the rain light a touch brighter, fewer drops on the glass
  windy       bright, fast cloud: fair light
  frost       clear cold morning: a pale cool sun, frost feathering up from the sill
  snow        soft white light off the snow, no sun, a little frost on the glass, lamps lit
"""

NEW = ("cloudy", "overcast", "changeable", "drizzle", "windy", "frost", "snow")

# The barometer needle (degrees; stormy -60, rain -30, change 0, fair 30, very dry 60)
DIAL = {"cloudy": 15, "overcast": -10, "changeable": 0, "drizzle": -20, "windy": -45, "frost": 45, "snow": -40}

COOL = (0.95, 0.97, 1.0)
COLD = (0.92, 0.96, 1.04)


def _sun(s, k, colour=None):
    return None if s is None else (s[0] * k, colour or s[1], s[2], s[3])


def _bounce(b, k, colour=None):
    return (b[0] * k, colour or b[1])


def _lamps(d):
    return "flames" if "flames" in d else "lamps" if "lamps" in d else None


def derive(W, views):
    """W: the room's WEATHERS (with fair, change, rain). views: {weather: {field: plate}} for the new ones,
    e.g. {"cloudy": {"view": "30-window-cloudy.png"}}. Returns the seven new entries."""
    fair, change, rain = W["fair"], W["change"], W["rain"]
    lk = _lamps(fair)
    out = {}

    d = dict(fair)
    d.update(sky=fair["sky"] * 0.8, tint=(0.98, 0.98, 0.98), backdrop=fair["backdrop"] * 0.92,
             sun=_sun(fair["sun"], 0.5), bounce=_bounce(fair["bounce"], 0.9, (0.97, 0.98, 1.0)),
             exposure=fair["exposure"] + 0.04)
    out["cloudy"] = d

    d = dict(change)
    d.update(sky=change["sky"] * 0.95, tint=(0.97, 0.98, 1.0), backdrop=change["backdrop"] * 0.92, sun=None,
             bounce=_bounce(change["bounce"], 0.9), wet=0.0, exposure=change["exposure"] + 0.03)
    out["overcast"] = d

    d = dict(fair)
    d.update(sky=(fair["sky"] + change["sky"]) / 2, tint=(0.96, 0.98, 1.0), backdrop=fair["backdrop"] * 0.95,
             sun=_sun(fair["sun"], 0.75), bounce=_bounce(fair["bounce"], 0.9, COOL), wet=0.12,
             exposure=fair["exposure"] + 0.02)
    if lk:
        d[lk] = change[lk] * 0.5
    out["changeable"] = d

    d = dict(rain)
    d.update(sky=rain["sky"] * 1.1, backdrop=rain["backdrop"] * 1.05, bounce=_bounce(rain["bounce"], 1.1), wet=0.25,
             exposure=rain["exposure"] - 0.03)
    if lk:
        d[lk] = rain[lk] * 0.7
    out["drizzle"] = d

    d = dict(fair)
    d.update(sun=_sun(fair["sun"], 0.95))
    out["windy"] = d

    d = dict(fair)
    d.update(sky=fair["sky"] * 0.95, tint=COLD, sun=_sun(fair["sun"], 0.9, (1.0, 0.95, 0.88)),
             bounce=_bounce(fair["bounce"], 1.0, COLD), wet=0.0, frost=0.3, exposure=fair["exposure"] + 0.02)
    if lk:
        d[lk] = change[lk]
    out["frost"] = d

    d = dict(change)
    d.update(sky=change["sky"] * 1.15, tint=(0.95, 0.97, 1.03), backdrop=change["backdrop"] * 1.1, sun=None,
             bounce=_bounce(change["bounce"], 1.15, (0.95, 0.97, 1.03)), wet=0.0, frost=0.15)
    if lk:
        d[lk] = rain[lk]
    if "fill" in rain:
        d["fill"] = rain["fill"]
    out["snow"] = d

    for k, d in out.items():
        if "dial" in d:
            d["dial"] = DIAL[k]
        if "green" in d:                     # daylight from the glasshouse, beyond the room
            d["green"] = {"cloudy": 0.8, "overcast": 0.75, "changeable": 0.85, "drizzle": 1.1, "windy": 1.0,
                          "frost": 0.95, "snow": 0.8}[k] * (rain if k == "drizzle" else change if k in ("overcast", "snow") else fair)["green"]
        d.update(views.get(k, {}))
    return out


def plates(prefix_day, prefix_night, start_day=30, start_night=40):
    """The plate names weather_plates.py writes for a window or lane set: (day views, night views)."""
    day = {w: f"{start_day + i}-{prefix_day}-{w}.png" for i, w in enumerate(NEW)}
    night = {w: f"{start_night + i}-{prefix_night}-{w}.png" for i, w in enumerate(NEW)}
    return day, night
