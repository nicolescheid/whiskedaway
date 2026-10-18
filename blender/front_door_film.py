"""
The home page's door film (docs/front-door-spec.md): the storybook picture of the Inn in its whisk
swirls in toward the front door, dissolves into the rendered door, the door opens and the camera
steps into the entrance hall, ending exactly where the live panorama takes over.

Run with plain Python after the door frames are rendered
(blender/hallway_build.py -- --door-film=landscape, and =portrait):
  python -I blender/front_door_film.py [--preview]

Frame 0 of each film is the picture exactly as the page shows it, so the click can start the film
without a visible jump. Portrait films put the landscape picture on a tall sheet of the same paper
until a portrait picture exists.

Writes blender/explore/assets/front-door/: film-landscape.mp4, film-portrait.mp4 and the matching
still images (picture-*.webp for the first frame, hall-*.webp for the last).
--preview writes only the swirl, small, to blender/out/door-film/swirl-preview-*.mp4.
"""
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

PREVIEW = "--preview" in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(os.path.dirname(HERE), "art-inbox", "inn-exterior", "whisk-inn-master.png")
FRAMES = os.path.join(HERE, "out", "door-film")
SITE = os.path.join(HERE, "explore", "assets", "front-door")
FPS = 24
SWIRL = 60                 # frames of swirl before the dissolve (2.5 s)
DISSOLVE = 12              # frames where the picture, still rushing in, fades into the rendered door
DOOR = (0.623, 0.494)      # the front door's centre in the picture, as a fraction of its size
ZOOM_END = 16.0            # how close the picture gets by the end of the dissolve (the door fills the frame)
SUB = 3                    # samples per frame for motion blur
SHAPES = {"landscape": (1920, 1080), "portrait": (1080, 1920)}


def paper_colour(img):
    a = np.asarray(img, dtype=np.float32)
    edge = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return tuple(int(v) for v in np.median(edge, axis=0))


def canvas(shape, scale=1):
    """The first frame as the page shows it, at `scale` times the film's size, and where the door is on it."""
    W, H = SHAPES[shape]
    W, H = W * scale, H * scale
    pic = Image.open(MASTER).convert("RGB")
    paper = paper_colour(pic)
    if shape == "landscape":
        return pic.resize((W, H), Image.LANCZOS), (DOOR[0] * W, DOOR[1] * H), paper
    # Portrait: the picture across 84% of the width, centred, its edges feathered into plain paper
    pw = int(W * 0.84)
    ph = round(pw * pic.height / pic.width)
    pic = pic.resize((pw, ph), Image.LANCZOS)
    mask = Image.new("L", (pw, ph), 0)
    f = int(pw * 0.04)
    mask.paste(255, (f, f, pw - f, ph - f))
    mask = mask.filter(ImageFilter.GaussianBlur(f / 2))
    out = Image.new("RGB", (W, H), paper)
    x0, y0 = (W - pw) // 2, (H - ph) // 2
    out.paste(pic, (x0, y0), mask)
    return out, (x0 + DOOR[0] * pw, y0 + DOOR[1] * ph), paper


def bilinear(src, x, y, fill):
    h, w, _ = src.shape
    inside = (x >= 0) & (x <= w - 1) & (y >= 0) & (y <= h - 1)
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = x.astype(np.int32)
    y0 = y.astype(np.int32)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    a = src[y0, x0] * (1 - fx) + src[y0, x0 + 1] * fx
    b = src[y0 + 1, x0] * (1 - fx) + src[y0 + 1, x0 + 1] * fx
    out = a * (1 - fy) + b * fy
    out[~inside] = fill
    return out


def ease(t):
    return t * t * (3 - 2 * t)


def swirl_frame(src, door, fill, W, H, scale, t):
    """t runs 0..1 over the swirl and on past 1 through the dissolve.
    The view rushes toward the door while the picture turns on itself like a whisk being spun,
    the turn strongest around the door and unwinding again as the door arrives."""
    u = min(t, 1.0)
    reach = (SWIRL + DISSOLVE) / SWIRL                      # t at the end of the dissolve
    zoom = np.exp(np.log(ZOOM_END) * (ease(min(t / reach, 1.0)) ** 1.6))
    cx = W / 2 + (door[0] / scale - W / 2) * ease(u)        # the view's centre glides onto the door
    cy = H / 2 + (door[1] / scale - H / 2) * ease(u)
    roll = 0.9 * np.sin(np.pi * u) ** 2                     # radians; back to level by the dissolve
    twirl = 2.2 * np.sin(np.pi * u) ** 1.5                  # radians at the door, fading with distance
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    px, py = xs - W / 2, ys - H / 2
    c, s = np.cos(-roll), np.sin(-roll)
    qx = cx + (c * px - s * py) / zoom
    qy = cy + (s * px + c * py) / zoom
    if twirl > 1e-3:
        dx, dy = qx - door[0] / scale, qy - door[1] / scale
        rho = np.hypot(dx, dy)
        reach_px = 0.45 * min(W, H) / max(1.0, zoom ** 0.5)
        th = twirl * np.exp(-(rho / reach_px) ** 2)
        ct, st = np.cos(th), np.sin(th)
        qx = door[0] / scale + ct * dx - st * dy
        qy = door[1] / scale + st * dx + ct * dy
    return bilinear(src, qx * scale, qy * scale, fill)


def make(shape, tmp):
    W, H = SHAPES[shape]
    if PREVIEW:
        W, H = W // 2, H // 2
    scale = 2
    img, door, paper = canvas(shape, scale)
    if PREVIEW:
        img = img.resize((W * scale, H * scale), Image.LANCZOS)
        door = (door[0] / 2, door[1] / 2)
    src = np.asarray(img, dtype=np.float32)
    fill = np.array(paper, dtype=np.float32)
    door_dir = os.path.join(FRAMES, shape)
    door_files = [] if PREVIEW else sorted(f for f in os.listdir(door_dir) if f.startswith("door_"))
    if not PREVIEW and len(door_files) < DISSOLVE + 24:
        sys.exit(f"not enough door frames in {door_dir}")
    n = 0

    def write(arr):
        nonlocal n
        n += 1
        Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(tmp, f"f_{n:04d}.jpg"), quality=95)

    total = SWIRL + (0 if PREVIEW else DISSOLVE)
    for i in range(total):
        acc = np.zeros((H, W, 3), np.float32)
        for k in range(SUB):                                  # motion blur: a few moments within the frame
            acc += swirl_frame(src, door, fill, W, H, scale, (i + k / SUB) / SWIRL)
        frame = acc / SUB
        if i >= SWIRL:
            d = (i - SWIRL + 1) / DISSOLVE
            d = ease(d)
            rendered = np.asarray(Image.open(os.path.join(door_dir, door_files[i - SWIRL])).convert("RGB").resize((W, H), Image.LANCZOS), np.float32)
            frame = frame * (1 - d) + rendered * d
        write(frame)
        print(f"\r{shape}: swirl {i + 1}/{total}", end="", flush=True)
    for f in door_files[DISSOLVE:]:
        shutil.copy(os.path.join(door_dir, f), os.path.join(tmp, f"f_{n + 1:04d}.jpg"))
        n += 1
    print()
    return n


def encode(tmp, out, crf):
    # Swirl and door frames, all JPEG, listed in order for the concat demuxer
    files = sorted(os.listdir(tmp))
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as fh:
        for f in files:
            if f != "list.txt":
                fh.write(f"file '{os.path.join(tmp, f)}'\nduration {1 / FPS:.6f}\n")
        fh.write(f"file '{os.path.join(tmp, files[-1])}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
                    "-profile:v", "high", "-movflags", "+faststart", "-an", out], check=True)
    print(f"wrote {out} ({os.path.getsize(out) / 1e6:.1f} MB)")


def main():
    os.makedirs(SITE, exist_ok=True)
    os.makedirs(FRAMES, exist_ok=True)
    for shape in SHAPES:
        with tempfile.TemporaryDirectory() as tmp:
            make(shape, tmp)
            if PREVIEW:
                encode(tmp, os.path.join(FRAMES, f"swirl-preview-{shape}.mp4"), 26)
                continue
            encode(tmp, os.path.join(SITE, f"film-{shape}.mp4"), 25)
            # The page's stills: the first frame (the picture) and the last (the hall, for the no-film path)
            first = sorted(f for f in os.listdir(tmp) if f.startswith("f_"))
            Image.open(os.path.join(tmp, first[0])).convert("RGB").save(os.path.join(SITE, f"picture-{shape}.webp"), quality=86, method=6)
            Image.open(os.path.join(tmp, first[-1])).convert("RGB").save(os.path.join(SITE, f"hall-{shape}.webp"), quality=80, method=6)


if __name__ == "__main__":
    main()
