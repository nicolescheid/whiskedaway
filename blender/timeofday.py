"""Dawn and dusk for the room builds: --dawn / --dusk beside the existing --night.

Each room's build keeps its day and night looks. This module turns a weather's day look into a dawn or dusk one:
the window plate is regraded (day and night plates mixed, a warm glow along the horizon), the sky and fill go
warm and low, and the sun, where it can reach the room at that time, is a low golden lamp. East is the village
lane (dawn light), west is the sea (dusk light): see docs/inn-floorplan.html (the sunny garden side is north).
"""
import os
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "out", "_plates")

# plate: how much of the day plate (the rest is the night plate); glow: horizon colour and strength; horizon: where
# in the plate (0 top .. 1 bottom) the glow is centred; sky/tint: world; sun: (colour, elevation); bounce: window
# fill colour and a multiplier on the weather's own bounce; lamps: floor for lamp and candle strength.
TIMES = {
    "dawn": dict(plate=0.55, glow=((1.0, 0.62, 0.50), 0.55), horizon=0.50, sky=0.55, tint=(1.0, 0.80, 0.76),
                 sun=((1.0, 0.72, 0.48), 7.0, 6.0), bounce=((1.0, 0.78, 0.68), 0.55), lamps=0.7, exposure=0.12),
    "dusk": dict(plate=0.40, glow=((1.0, 0.50, 0.22), 0.70), horizon=0.50, sky=0.45, tint=(1.0, 0.68, 0.50),
                 sun=((1.0, 0.58, 0.28), 8.0, 7.0), bounce=((1.0, 0.70, 0.46), 0.55), lamps=1.0, exposure=0.15),
}


def _pixels(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return a


def plate(day_path, night_path, time, tag=""):
    """The window plate for dawn or dusk: written once to out/_plates and reused."""
    os.makedirs(CACHE, exist_ok=True)
    out = os.path.join(CACHE, f"{time}_{tag or os.path.splitext(os.path.basename(day_path))[0]}.png")
    if os.path.exists(out):
        return out
    t = TIMES[time]
    day, night = _pixels(day_path), _pixels(night_path)
    if night.shape != day.shape:                      # plates are the same size in practice; fall back to the day plate
        night = day
    m = t["plate"]
    a = day * m + night * (1 - m)
    h = a.shape[0]
    y = np.linspace(1.0, 0.0, h, dtype=np.float32)[:, None, None]   # pixel row 0 is the bottom in Blender
    pos = 1.0 - y                                                  # 0 top .. 1 bottom
    band = np.exp(-((pos - t["horizon"]) / 0.22) ** 2)
    col, k = t["glow"]
    a[..., :3] = a[..., :3] * (1 - 0.35 * band) + np.array(col, dtype=np.float32) * (k * band) * (0.4 + 0.6 * a[..., :3].mean(axis=2, keepdims=True))
    a[..., :3] *= np.array(t["tint"], dtype=np.float32) * 0.5 + 0.5   # a general warm cast
    a = np.clip(a, 0, 1)
    img = bpy.data.images.new("tod_plate", a.shape[1], h, alpha=False)
    img.pixels = a.reshape(-1).tolist()
    img.filepath_raw = out
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return out


def look(time, wx, sun_time, sun_az, lamp_key):
    """Updates for a room's WX dict. sun_time: the time ('dawn' or 'dusk') the sun reaches this room's windows;
    sun_az: its azimuth in the room's own convention. lamp_key: 'flames' or 'lamps'. Direct sun only on dry weather."""
    t = TIMES[time]
    up = dict(sky=wx["sky"] * t["sky"], tint=t["tint"], exposure=wx["exposure"] + t["exposure"])
    if wx.get("sun") and sun_time == time:
        up["sun"] = (wx["sun"][0] * 0.9, t["sun"][0], t["sun"][1], sun_az)
    else:
        up["sun"] = None
    w, c = wx["bounce"]
    up["bounce"] = (w * t["bounce"][1], t["bounce"][0])
    up[lamp_key] = max(wx.get(lamp_key, 0.0), t["lamps"])
    return up
