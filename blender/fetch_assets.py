"""
Downloads the CC0 Poly Haven assets the room builds use into blender/assets/.
Run with plain Python (not Blender):  python -I blender/fetch_assets.py
Skips files already present. Poly Haven's API needs a User-Agent.
"""
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
UA = {"User-Agent": "whiskedaway-build/1.0"}
RES = "2k"

MODELS = ["pot_enamel_01", "painted_wooden_cabinet", "wooden_bookshelf_worn", "ArmChair_01",
          "wooden_candlestick", "vintage_oil_lamp", "wicker_basket_01", "wooden_bowl_01",
          "wooden_cutting_board", "wooden_spoon", "potted_plant_02", "ceramic_vase_01",
          # Concept-pack pass (Oct 2026): tall pantry, framed print, kitchen dressing
          "painted_wooden_cabinet_02", "hanging_picture_frame_01", "jug_01", "food_apple_01",
          "lemon", "yellow_onion", "throw_pillows_01", "wicker_basket_02",
          # Hallway (Oct 2026): clock, boot bench, boots, umbrella stand, entrance plant
          "painted_wooden_bench", "rubber_boots", "antique_ceramic_vase_01", "potted_plant_04",
          # Glasshouse (Oct 2026): planter boxes, seed trays, tools, the nettle and dandelion beds
          "planter_box_01", "planter_box_02", "planter_box_03", "seeding_tray_01", "trowel_01",
          "watering_can_metal_01", "garden_gloves_01", "nettle_plant", "dandelion_01",
          # Flourish (Oct 2026): four mismatched chairs, the phonograph's side table, herb pots, bowls
          "WoodenChair_01", "dining_chair_02", "painted_wooden_chair_01", "gallinera_chair", "side_table_01",
          "planter_pot_clay", "wooden_bowl_02"]
# Models whose glTF download is broken on Poly Haven (the .bin is short), fetched as .blend instead
BLEND_MODELS = ["vintage_grandfather_clock_01"]
TEXTURES = ["old_wooden_floor_01", "white_plaster_rough_01", "medieval_wood", "wood_table_worn",
            "rough_linen", "knitted_fleece",
            "terracotta_floor_tiles", "worn_planks", "forest_ground_06", "gravel_floor_02"]
# Glasshouse skies, by season: spring 38 deg sun, summer 48, autumn 28 misty, winter overcast
HDRIS = ["kloofendal_overcast_puresky", "kloofendal_38d_partly_cloudy_puresky",
         "kloofendal_48d_partly_cloudy_puresky", "kloofendal_28d_misty_puresky"]
TEXTURE_MAPS = {"Diffuse": "diff", "nor_gl": "nor", "Rough": "rough", "AO": "ao", "Displacement": "disp"}


def api(path):
    with urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/{path}", headers=UA)) as r:
        return json.load(r)


def download(url, dest):
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(dest + ".part", "wb") as fh:
        fh.write(r.read())
    os.replace(dest + ".part", dest)
    print("  got", os.path.relpath(dest, ASSETS))


def main():
    for aid in MODELS:
        print(aid)
        g = api(f"files/{aid}")["gltf"][RES]["gltf"]
        root = os.path.join(ASSETS, "models", aid)
        download(g["url"], os.path.join(root, f"{aid}.gltf"))
        for rel, inc in g.get("include", {}).items():
            download(inc["url"], os.path.join(root, *rel.split("/")))
    for aid in BLEND_MODELS:
        print(aid)
        b = api(f"files/{aid}")["blend"][RES]["blend"]
        root = os.path.join(ASSETS, "models", aid)
        download(b["url"], os.path.join(root, f"{aid}.blend"))
        for rel, inc in b.get("include", {}).items():
            download(inc["url"], os.path.join(root, *rel.split("/")))
    for aid in TEXTURES:
        print(aid)
        f = api(f"files/{aid}")
        for key, short in TEXTURE_MAPS.items():
            if key in f and RES in f[key]:
                download(f[key][RES]["jpg"]["url"], os.path.join(ASSETS, "textures", aid, f"{short}.jpg"))
    for aid in HDRIS:
        print(aid)
        download(api(f"files/{aid}")["hdri"][RES]["hdr"]["url"], os.path.join(ASSETS, "hdri", f"{aid}.hdr"))


if __name__ == "__main__":
    main()
