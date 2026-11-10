"""The seven 11 Nov weathers' window plates, made from the five generated ones (no new image generation).

    python blender/weather_plates.py [--set cuddlecore] [--weather snow] [--sheet out.jpg]

Each plate set (the Cuddlecore and Flourish sea windows, the lane, Flourish's garden door, the glasshouse's four
seasons) was generated registered: the same coast, walls and houses sit on the same pixels in every weather. So a
new weather is a mix of the existing ones, region by region (sky, sea, land), plus a grade:

  cloudy      fair land under broken cloud: the rain sky with blue breaking through, patches of cloud shadow
  overcast    the rain plate, sky flattened to an even grey, softer and a little paler, no streaks
  changeable  sun on the left, a squall out at sea on the right: fair and stormy mixed in big patches
  drizzle     the rain plate, hazier and paler (glass is wet in the build, less than rain)
  windy       fair, with the clouds stretched by wind and the stormy plate's whitecaps on a blue sea
  frost       clear cold morning: the very-dry sky cooled, white frost on the grass and leaves
  snow        a soft white sky, snow lying on the land, flakes falling

Night versions come from the night plates the same way. Writes beside the originals with the next free numbers
(see NAMES) and never overwrites a generated plate.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(os.path.dirname(HERE), "art-inbox")
NEW = ["cloudy", "overcast", "changeable", "drizzle", "windy", "frost", "snow"]


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def save(a, path):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, optimize=True)


def blur(a, r):
    if r <= 0:
        return a
    if a.ndim == 2:
        return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, np.float32) / 255


def hblur(a, r):
    """Horizontal motion blur (wind-stretched cloud)."""
    k = np.ones(2 * r + 1, np.float32) / (2 * r + 1)
    pad = np.pad(a, ((0, 0), (r, r), (0, 0)), mode="edge")
    out = np.zeros_like(a)
    for c in range(3):
        out[..., c] = np.apply_along_axis(lambda row: np.convolve(row, k, mode="valid"), 1, pad[..., c])
    return out


def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def sat(a, s):
    l = lum(a)[..., None]
    return l + (a - l) * s


def noise(h, w, scale, seed, octaves=3):
    """Smooth value noise 0..1, features about `scale` pixels."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        g = rng.random((h // s + 2, w // s + 2)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w + 2 * s, h + 2 * s), Image.BICUBIC)
        out += amp * (np.asarray(im, np.float32)[s:s + h, s:s + w] / 255)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- masks, from a set's clearest day plate --------------------------------------------------------------------

def sky_mask(fair, limit=0.75, floor=None):
    """Sky: scanning down each column from the top while the fair plate stays sky-coloured (blue, or bright and
    grey-white cloud), and above the horizon. The horizon is the strongest horizontal edge on the open side."""
    h, w, _ = fair.shape
    r, g, b = fair[..., 0], fair[..., 1], fair[..., 2]
    l = lum(fair)
    mx, mn = fair.max(axis=2), fair.min(axis=2)
    skyish = ((b > r + 0.06) & (b >= g - 0.02) & (l > 0.35)) | ((l > 0.62) & (mx - mn < 0.16))
    skyish = blur(skyish.astype(np.float32), 1.5) > 0.5
    # horizon: in the right-hand third, the row with the biggest jump in brightness between 35% and limit
    band = l[:, int(w * 0.66):].mean(axis=1)
    d = np.abs(np.diff(blur(band[:, None, None].repeat(3, 2), 0)[..., 0, 0]))
    lo, hi = int(h * 0.35), int(h * limit)
    horizon = lo + int(np.argmax(d[lo:hi])) if hi > lo else int(h * limit)
    stops = np.array([np.argmin(skyish[:horizon, x]) if not skyish[:horizon, x].all() else horizon for x in range(w)])
    # A bird, a speck or a rain streak stops one column early and leaves a bar: follow the neighbourhood's median
    pad = np.pad(stops, 30, mode="edge")
    med = np.array([np.median(pad[x:x + 61]) for x in range(w)])
    stops = np.where(np.abs(stops - med) > 12, med, stops).astype(int)
    if floor:                                       # where pale distant land reads as sky (the glasshouse's far coast)
        stops = np.minimum(stops, int(h * floor))
    m = np.zeros((h, w), np.float32)
    for x in range(w):
        m[:stops[x], x] = 1
    return blur(m, 2.5), horizon


def sea_mask(fair, sky, horizon):
    """Open water below the horizon: blue, fairly even, below the sky."""
    h, w, _ = fair.shape
    r, g, b = fair[..., 0], fair[..., 1], fair[..., 2]
    blue = (b > r + 0.12) & (b > g + 0.02)
    rows = np.arange(h)[:, None] >= horizon - 2
    m = (blue & rows).astype(np.float32) * (1 - sky)
    m = blur(m, 3)
    return np.clip(m * 1.4, 0, 1)


def veg_mask(a):
    """Upward-facing growing things and grass: green-ish, not too dark."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = smoothstep(0.03, 0.12, g - b) * smoothstep(-0.03, 0.02, g - r)   # green and yellow-green, not beige stone
    return blur(green, 1.0)


# ---- the recipes ---------------------------------------------------------------------------------------------------

def depth_ramp(h, w, horizon):
    """0 at the horizon .. 1 at the bottom of the plate (near)."""
    y = np.arange(h, dtype=np.float32)[:, None] * np.ones((1, w), np.float32)
    return np.clip((y - horizon) / max(1, h - horizon), 0, 1)


def haze(a, amount, colour, h, w, horizon):
    far = 1 - depth_ramp(h, w, horizon)
    k = (amount * far ** 1.5)[..., None]
    return a * (1 - k) + np.array(colour, np.float32) * k


def flat_sky(rain_sky, l_target, tint):
    """An even overcast: the rain sky's cloud shapes, blurred and compressed toward one grey."""
    s = blur(rain_sky, 9)
    l = lum(s)
    l = l_target + (l - l.mean()) * 0.35
    grad = np.linspace(-0.03, 0.04, s.shape[0], dtype=np.float32)[:, None]   # a touch lighter toward the horizon
    return (l + grad)[..., None] * np.array(tint, np.float32)


def flakes(h, w, seed, density, night=False):
    """Falling snow: soft dots, bigger and blurrier near the bottom (nearer)."""
    rng = np.random.default_rng(seed)
    layer = np.zeros((h, w), np.float32)
    for size, count, rad in ((1, 2.2, 0.6), (2, 0.9, 1.0), (3, 0.35, 1.8)):
        n = int(h * w / 1000 * density * count)
        ys = rng.integers(0, h, n)
        xs = rng.integers(0, w, n)
        lay = np.zeros((h, w), np.float32)
        for dy in range(size):
            for dx in range(size):
                lay[np.clip(ys + dy, 0, h - 1), np.clip(xs + dx, 0, w - 1)] = 1
        layer = np.maximum(layer, blur(lay, rad) * (1.6 if size > 1 else 1.0))
    return np.clip(layer, 0, 1) * (0.55 if night else 0.85)


def streaks(h, w, seed, density, length, slant=0.25):
    """Fine rain: short faint diagonal lines."""
    rng = np.random.default_rng(seed)
    lay = np.zeros((h, w), np.float32)
    n = int(h * w / 1000 * density)
    ys = rng.integers(0, h, n)
    xs = rng.integers(0, w, n)
    for t in range(length):
        lay[np.clip(ys + t, 0, h - 1), np.clip(xs + int(t * slant), 0, w - 1)] = 1
    return blur(lay, 0.7)


def make(set_name, src, weather, night, M, seed=11):
    """src: dict of the set's plates (fair, rain, change, stormy, very-dry, or what exists) for day or night."""
    fair = src["fair"]
    rain = src.get("rain", fair)
    stormy = src.get("stormy", rain)
    dry = src.get("very-dry", fair)
    h, w, _ = fair.shape
    sky, sea, horizon = M["sky"][..., None], M["sea"][..., None], M["horizon"]
    land = np.clip(1 - sky - sea, 0, 1)
    big = noise(h, w, w / 5, seed)                       # cloud patches
    if weather == "cloudy":
        if night:
            s = blur(rain, 2.5) * 0.95                      # a cloudy night is the rain night's cloud, without the rain
        else:
            # Blue breaks through where the rain sky's cloud is thinnest (its brightest parts), in a few bigger gaps
            rl = lum(blur(rain, 2))
            rl = (rl - np.percentile(rl[M["sky"] > 0.5], 5)) / (np.percentile(rl[M["sky"] > 0.5], 99) - np.percentile(rl[M["sky"] > 0.5], 5) + 1e-3)
            gap = blur(smoothstep(0.5, 0.85, rl * 0.75 + noise(h, w, w / 4, seed + 1) * 0.4), 2.0)[..., None]
            bright_rain = np.clip(rain * 1.2 + 0.05, 0, 1)
            s = bright_rain * (1 - gap) + fair * gap
        shade = smoothstep(0.45, 0.7, big)[..., None] * 0.55   # cloud shadow on the land and sea
        g = fair * (1 - shade) + sat(rain, 0.9) * shade
        out = s * sky + g * (1 - sky)
        out = sat(out, 0.95)
    elif weather == "overcast":
        base = sat(rain, 0.82)
        if night:
            s = blur(rain, 6)
        else:
            s = flat_sky(rain, 0.72, (0.96, 0.98, 1.0))
        g = base * 0.92 + 0.06                               # softer, a little lifted, shadowless
        g = blur(g, 0.6) * 0.5 + g * 0.5                     # loses the rain plate's fine streaks
        out = s * sky + g * (1 - sky)
        if not night:
            out = haze(out, 0.25, (0.74, 0.77, 0.80), h, w, horizon)
    elif weather == "changeable":
        x = np.linspace(0, 1, w, dtype=np.float32)[None, :] * np.ones((h, 1), np.float32)
        squall = smoothstep(0.35, 0.8, x * 0.75 + big * 0.45)[..., None]   # 1 = under the squall (right, out at sea)
        s = fair * (1 - squall) + stormy * squall
        sun = (1 - squall) * smoothstep(0.4, 0.65, noise(h, w, w / 6, seed + 2))[..., None]
        g = rain * (1 - sun) + fair * sun                  # land and sea lit in patches
        g = g * (1 - squall * 0.6) + stormy * (squall * 0.6)
        out = s * sky + g * (1 - sky)
        if not night:
            out = out * (1 + 0.12 * sun)                    # sun patches a touch brighter: dramatic
    elif weather == "drizzle":
        base = sat(rain, 0.85)
        s = blur(rain, 3) * 0.6 + flat_sky(rain, 0.66, (0.95, 0.97, 1.0)) * 0.4 if not night else blur(rain, 4)
        out = s * sky + base * (1 - sky)
        if not night:
            out = haze(out, 0.4, (0.70, 0.73, 0.76), h, w, horizon)
            st = streaks(h, w, seed + 3, 3.0, 9)[..., None]
            out = out * (1 - st * 0.12) + 0.85 * st * 0.12
    elif weather == "windy":
        s = hblur(fair, 28) * 0.7 + fair * 0.3
        # whitecaps: where the stormy sea is brighter than its own neighbourhood
        if "stormy" in src:
            hi = np.clip(lum(stormy) - lum(blur(stormy, 6)), 0, 1)[..., None]
            caps = smoothstep(0.03, 0.12, hi)
            sea_px = fair + caps * (np.array([0.96, 0.98, 1.0], np.float32) - fair) * 0.85
        else:
            sea_px = fair
        g = fair * (1 - sea) + sea_px * sea
        out = s * sky + g * (1 - sky)
        out = sat(out, 1.05)
    elif weather == "frost":
        s = dry if not night else fair
        s = s * np.array([0.92, 0.98, 1.06], np.float32)     # cold, pale clear sky
        g = fair if not night else fair
        v = veg_mask(g)[..., None] * land
        near = (0.7 + 0.3 * depth_ramp(h, w, horizon))[..., None]
        speck = noise(h, w, 6, seed + 4, octaves=2)[..., None]
        k = np.clip(v * near * (0.6 + 0.35 * speck) + 0.12 * land, 0, 0.92)
        rime = (np.array([0.86, 0.9, 0.95], np.float32) if not night else np.array([0.30, 0.36, 0.48], np.float32))
        rime = rime * (0.7 + 0.45 * lum(g)[..., None] / (lum(g).mean() + 1e-3) * 0.5)
        g = g * (1 - k) + rime * k
        g = sat(g, 0.75) * np.array([0.94, 0.98, 1.05], np.float32)
        out = s * sky + g * (1 - sky)
        if not night:
            out = haze(out, 0.18, (0.82, 0.86, 0.92), h, w, horizon)
    elif weather == "snow":
        base = fair                                         # dry ground under the snow (the rain plates' puddles shine)
        if night:
            s = blur(rain, 6) * 1.1
        else:
            s = flat_sky(rain, 0.80, (0.97, 0.98, 1.0))
        l = lum(base)
        lnorm = np.clip(l / (np.percentile(l, 90) + 1e-3), 0, 1.2)[..., None]
        white = np.array([0.93, 0.95, 0.98], np.float32) if not night else np.array([0.36, 0.42, 0.56], np.float32)
        snowpx = white * (0.62 + 0.38 * lnorm)            # keeps the shape of the land in the snow's shading
        v = veg_mask(base)
        flatish = smoothstep(0.08, 0.3, l)                 # dark trunks, hedges and wall faces stay darker
        ground = smoothstep(0.75, 0.95, depth_ramp(h, w, int(h * 0.5)))     # the near ground (lawn, lane) lies white
        cover = noise(h, w, 18, seed + 6, octaves=2)
        k = (np.clip(v * 0.9 + flatish * 0.4 + ground * (0.55 + 0.4 * cover), 0, 0.95)[..., None]) * land
        g = base * (1 - k) + snowpx * k
        g = sat(g, 0.55)
        g = g * (1 - sea) + sat(rain, 0.4) * 0.85 * sea     # a grey-teal sea
        out = s * sky + g * (1 - sky)
        out = haze(out, 0.35 if not night else 0.2, (0.86, 0.88, 0.91) if not night else (0.20, 0.23, 0.30), h, w, horizon)
        fl = flakes(h, w, seed + 5, 1.2, night)[..., None]
        out = out * (1 - fl) + (np.array([1, 1, 1], np.float32) if not night else np.array([0.7, 0.75, 0.85], np.float32)) * fl
    else:
        raise ValueError(weather)
    # Lit windows and lamps keep their own warm light (they are in the base plates the recipe started from)
    lit_src = fair if weather in ("cloudy", "windy", "frost", "snow") else rain
    warm = (smoothstep(0.55, 0.8, lum(lit_src)) * smoothstep(0.3, 0.45, lit_src[..., 0] - lit_src[..., 2])
            * smoothstep(0.08, 0.16, lit_src[..., 0] - lit_src[..., 1]))   # orange-yellow light, not sunlit grass
    warm = (blur(warm, 1.0) * (1 - M["sky"]))[..., None]
    out = out * (1 - warm) + lit_src * warm
    return np.clip(out, 0, 1)


# ---- the sets -----------------------------------------------------------------------------------------------------

# Per set: folder, the day plates by weather, the night plates by weather (or one shared night plate), and the new
# file names (numbered on from the set's last generated plate).
def window_set(folder, start_day, start_night):
    return dict(folder=folder,
                day={"rain": "14-window-rain.png", "fair": "15-window-fair.png", "change": "16-window-change.png",
                     "stormy": "17-window-stormy.png", "very-dry": "18-window-very-dry.png"},
                night={"rain": "19-night-rain.png", "fair": "20-night-fair.png", "change": "21-night-change.png",
                       "stormy": "22-night-stormy.png", "very-dry": "23-night-very-dry.png"},
                out_day=lambda wx: f"{start_day + NEW.index(wx)}-window-{wx}.png",
                out_night=lambda wx: f"{start_night + NEW.index(wx)}-night-{wx}.png")


SETS = {
    "cuddlecore": window_set("cuddlecore", 30, 40),
    "flourish": window_set("flourish", 30, 40),
    "lane": dict(folder="sweet-spells",
                 day={"rain": "14-lane-rain.png", "fair": "15-lane-fair.png", "change": "16-lane-change.png",
                      "stormy": "17-lane-stormy.png", "very-dry": "18-lane-very-dry.png"},
                 night={"rain": "19-lane-night-rain.png", "fair": "20-lane-night-fair.png", "change": "21-lane-night-change.png",
                        "stormy": "22-lane-night-stormy.png", "very-dry": "23-lane-night-very-dry.png"},
                 out_day=lambda wx: f"{30 + NEW.index(wx)}-lane-{wx}.png",
                 out_night=lambda wx: f"{40 + NEW.index(wx)}-lane-night-{wx}.png"),
    "garden": dict(folder="flourish",
                   day={"rain": "24-garden-rain.png", "fair": "25-garden-fair.png", "change": "26-garden-change.png",
                        "stormy": "27-garden-stormy.png", "very-dry": "28-garden-very-dry.png"},
                   night={"fair": "29-garden-night.png"},
                   night_weathers=("frost", "snow"),     # the garden door shares one night plate; only these differ
                   out_day=lambda wx: f"{50 + NEW.index(wx)}-garden-{wx}.png",
                   out_night=lambda wx: f"{60 + NEW.index(wx)}-garden-night-{wx}.png"),
}
for i, season in enumerate(["spring", "summer", "autumn", "winter"]):
    SETS[f"glasshouse-{season}"] = dict(
        folder="glasshouse", sky_floor=0.5,
        day={"fair": f"{13 + i}-outside-{season}.png", "rain": f"{20 + i}-outside-{season}-wet.png"},
        night={"fair": f"{24 + i}-outside-{season}-night.png"},
        night_weathers=("frost", "snow"),
        out_day=lambda wx, s=season: f"{30 + NEW.index(wx) * 4 + ['spring', 'summer', 'autumn', 'winter'].index(s)}-outside-{s}-{wx}.png",
        out_night=lambda wx, s=season: f"{60 + NEW.index(wx) * 4 + ['spring', 'summer', 'autumn', 'winter'].index(s)}-outside-{s}-night-{wx}.png")


def masks(st):
    fair = load(os.path.join(ART, st["folder"], st["day"]["fair"]))
    sky, horizon = sky_mask(fair, floor=st.get("sky_floor"))
    for k in ("rain", "very-dry"):                  # sky only where every plate agrees it is sky
        if k in st["day"]:
            sky = np.minimum(sky, sky_mask(load(os.path.join(ART, st["folder"], st["day"][k])), floor=st.get("sky_floor"))[0])
    return dict(sky=sky, sea=sea_mask(fair, sky, horizon), horizon=horizon)


def run(set_names, weathers, sheet=None):
    rows = []
    for name in set_names:
        st = SETS[name]
        M = masks(st)
        day = {k: load(os.path.join(ART, st["folder"], v)) for k, v in st["day"].items()}
        night = {k: load(os.path.join(ART, st["folder"], v)) for k, v in st["night"].items()}
        for wx in weathers:
            seed = 11 + NEW.index(wx)
            a = make(name, day, wx, False, M, seed)
            p = os.path.join(ART, st["folder"], st["out_day"](wx))
            save(a, p)
            rows.append((f"{name} {wx}", p))
            if wx in st.get("night_weathers", NEW):
                b = make(name, night, wx, True, M, seed)
                p = os.path.join(ART, st["folder"], st["out_night"](wx))
                save(b, p)
                rows.append((f"{name} {wx} night", p))
            print("[plates]", name, wx)
    if sheet:
        W = 1086
        ims = [Image.open(p).resize((W, W // 3)) for _, p in rows]
        s = Image.new("RGB", (W, sum(i.size[1] for i in ims)))
        y = 0
        for im in ims:
            s.paste(im, (0, y))
            y += im.size[1]
        s.save(sheet, quality=82)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append")
    ap.add_argument("--weather", action="append")
    ap.add_argument("--sheet")
    a = ap.parse_args()
    run(a.set or list(SETS), a.weather or NEW, a.sheet)
