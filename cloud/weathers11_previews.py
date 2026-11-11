"""Make each new 8K panorama's 2048 preview by downscaling it (as earlier art batches did), for the 11 Nov weathers.

    python cloud/weathers11_previews.py
"""
import glob
import os

from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "blender", "out")
NEW = ("cloudy", "overcast", "changeable", "drizzle", "windy", "frost", "snow")
made = 0
for p in sorted(glob.glob(os.path.join(OUT, "*_pano_*.jpg"))):
    stem = os.path.basename(p)[:-4]
    if stem.endswith("_preview") or not any(f"_{w}" in stem for w in NEW):
        continue
    dst = os.path.join(OUT, stem + "_preview.jpg")
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(p):
        continue
    im = Image.open(p).convert("RGB")
    im.resize((2048, 1024), Image.LANCZOS).save(dst, quality=90, optimize=True)
    made += 1
print(f"[previews] made {made}")
