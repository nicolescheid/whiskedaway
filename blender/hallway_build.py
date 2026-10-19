"""
The Inn's ground-floor hallway and entrance hall, with the magic dial beside every room door.
Builds the space, renders a 360 equirectangular panorama from each camera stop with Cycles, and
writes hotspot angles per stop for the browser viewer.

Layout from docs/inn-floorplan.html (1 plan unit = 3 cm) and art-inbox/inn-hallway/ (ChatGPT's
concept pack, notes.md, dial-layout.json). Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/hallway_build.py -- [--preview] [--no-render] [--stop=middle]
Fly-through video frames instead of panoramas (docs/flythrough-plan.md, shots 2 to 5):
  blender -b --factory-startup --python blender/hallway_build.py -- --flythrough [--rough]

Axes: X = hill (-) to garden (+), Y = toward the sea, Z = up. Metres.
The corridor runs from the entrance hall (y = 0) to the sea window (y = 7.8), walls at x = +-0.9.
The entrance hall runs across the front of the house, y = -2.2 .. 0, with the front door at y = -2.2.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ART, OUT, area_light, blend_model, box, box_span, center_of, crop_image, curtain, cyl,  # noqa: E402
                     emission_mat, image_mat, look, mat, meshes_of, model, pano_camera, pbr, point_light, retint,
                     sphere, srgb, text, use_gpu, window_glass, fly_camera, key_rot_z, video_settings)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS
WEATHER = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "rain")
ONLY_STOP = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--stop=")), None)
FLY = "--flythrough" in ARGS
ROUGH = "--rough" in ARGS
# The home page's door film (docs/front-door-spec.md): just the door opening, ending at the entrance stop
DOOR_FILM = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--door-film=")), None)   # landscape or portrait
ANIM = {}                    # the parts the fly-through moves: doors, the Cuddlecore dial pointer

# The sea window shows the same coast as the Cuddlecore window (the two rooms sit either side of it)
VIEWS = {"rain": "14-window-rain.png", "fair": "15-window-fair.png", "change": "16-window-change.png",
         "stormy": "17-window-stormy.png", "very-dry": "18-window-very-dry.png"}
SKY = {"rain": (1.1, 0.42, 70), "fair": (2.0, 0.66, 110), "change": (1.5, 0.5, 100),
       "stormy": (0.5, 0.27, 32), "very-dry": (2.3, 0.72, 100)}   # world strength, backdrop, window bounce W
WET = {"rain": 0.5, "stormy": 0.75}   # raindrops on the sea window (whisked.window_glass)

# Late night, as the kitchen does it: the kitchen's night view of the same coast in the sea window, a near-black
# sky and fanlight, the lamps carrying the light. Rain still beads on the sea window in rain and storm.
NIGHT = "--night" in ARGS
NIGHT_VIEWS = {"rain": "19-night-rain.png", "fair": "20-night-fair.png", "change": "21-night-change.png",
               "stormy": "22-night-stormy.png", "very-dry": "23-night-very-dry.png"}
if NIGHT:
    VIEWS = NIGHT_VIEWS
    SKY = {k: (0.04, 0.8, 5) for k in SKY}
LAMP = 1.2 if NIGHT else 1.0   # wall lamps and the oil lamp, a touch brighter at night
FILL = 0.25 if NIGHT else 1.0  # the broad warm fills: low at night, so the light falls in pools round the lamps

os.makedirs(OUT, exist_ok=True)
PACK = os.path.join(ART, "inn-hallway")
KITCHEN = os.path.join(ART, "cuddlecore")

H = 2.7                      # ceiling
EYE = 1.6
CW = 0.9                     # half the corridor width
WT = 0.15                    # internal wall thickness
SEA = 7.8                    # sea wall (inner face)
FRONT = -2.2                 # front wall (inner face)
HALL_X = 5.4                 # entrance hall half width

# Camera stops: just inside the front door, and halfway down the hall
STOPS = {"entrance": (0.0, -1.3, EYE), "middle": (0.0, 3.3, EYE)}

# Room doors off the corridor: side (-1 hill/left, +1 garden/right facing the sea), door centre y,
# dial station (degrees clockwise from the star, per dial-layout.json) the pointer is left set to.
DOORS = {
    "sweet-spells":  dict(side=-1, y=2.0, station=120, label="Sweet Spells"),
    "cuddlecore":    dict(side=-1, y=6.0, station=40, label="Cuddlecore Kitchen"),
    "chiapothecary": dict(side=+1, y=2.0, station=160, label="Chiapothecary", ajar=24),
    "flourish":      dict(side=+1, y=6.0, station=80, label="Flourish"),
}
DIAL_NAMES = json.load(open(os.path.join(PACK, "dial-layout.json"), encoding="utf8"))["stations"]
DOOR_W, DOOR_H = 0.9, 2.1    # opening; the leaf is a touch smaller
DIAL_R = 0.1                 # 200 mm plate
DIAL_Z = 1.3
DIAL_BACK = 0.7              # dial centre sits this far from the door centre, toward the front door

HOTSPOTS = {}


def hotspot(key, label, target, kind="interactive", overlay=None):
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "name"):
        objs = list(target)
    elif hasattr(target, "name"):
        objs = meshes_of(target) or [target]
    else:
        objs = []
    HOTSPOTS[key] = {"label": label, "type": kind, "overlay": overlay, "center": [round(v, 3) for v in center_of(target)],
                     "objects": [o.name for o in objs]}


def frame_matrix(origin, normal, right):
    """4x4 matrix whose local X = right, Y = up, Z = normal (pointing out of the wall)."""
    n, r = Vector(normal).normalized(), Vector(right).normalized()
    up = n.cross(r)
    m = Matrix((r, up, n)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def group(name, matrix, parts):
    """Parent parts (built at the origin in local coordinates) to an empty placed by matrix."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = matrix
    bpy.context.view_layer.update()
    return root


def half_disc(name, r, material, segs=48):
    verts = [(0, 0, 0)] + [(r * math.cos(math.pi * i / segs), 0, r * math.sin(math.pi * i / segs)) for i in range(segs + 1)]
    faces = [(0, i + 1, i + 2) for i in range(segs)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return o


# ---------------------------------------------------------------- the check-in (docs: checkin-views.md, checkin-ux.md)

# The five energy candles, as in the Cuddlecore kitchen: (key, body height). Unlit; the page lights the one you choose.
CHECKIN_CANDLES = [("burnt-out", 0.016), ("low", 0.045), ("half", 0.09), ("three-quarters", 0.135), ("full", 0.18)]


def checkin_props(oak, tread_oak, brass, brass_worn, berry_linen, paint):
    """A narrow console against the foyer's back wall, right of the hall opening and under the notice board:
    five unlit candles on a brass tray (the hotspot), an hourglass, two place settings, an apron on a peg above.
    And two paper bags of shopping just inside the front door, between the umbrella stand and the boot bench."""
    x0, x1, y0, y1, top = 1.14, 2.42, -0.36, -0.02, 0.82
    box_span("desk_top", x0, x1, y0, y1, top - 0.03, top, oak, bevel=0.008)
    box_span("desk_apron", x0 + 0.04, x1 - 0.04, y0 + 0.03, y1 - 0.02, top - 0.12, top - 0.03, tread_oak, bevel=0.004)
    box_span("desk_shelf", x0 + 0.05, x1 - 0.05, y0 + 0.04, y1 - 0.02, 0.16, 0.18, tread_oak, bevel=0.004)
    for lx in (x0 + 0.05, x1 - 0.05):
        for ly in (y0 + 0.05, y1 - 0.04):
            box_span(f"desk_leg_{lx:.2f}_{ly:.2f}", lx - 0.022, lx + 0.022, ly - 0.022, ly + 0.022, 0, top - 0.03, tread_oak, bevel=0.004)
    model("wicker_basket_01", (x0 + 0.35, -0.2, 0.18), rot_z=10, scale=0.9)     # on the shelf below

    # Five candles on a brass tray, shortest (burnt out) on the left as you face the desk
    wax = mat("checkin_wax", srgb("#e6b04a"), rough=0.45)
    p = wax.node_tree.nodes["Principled BSDF"]
    p.inputs["Subsurface Weight"].default_value = 0.45
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.75, 0.35)
    p.inputs["Subsurface Scale"].default_value = 0.012
    wick_m = mat("checkin_wick", srgb("#2a2420"), rough=0.8)
    tray_x, ty = x0 + 0.33, -0.2
    stand = [box("checkin_tray", (tray_x, ty, top + 0.008), (0.5, 0.11, 0.016), brass, bevel=0.005)]
    flames = {}
    for i, (key, h) in enumerate(CHECKIN_CANDLES):
        cx = tray_x - 0.2 + i * 0.1
        stand.append(cyl(f"checkin_dish_{key}", (cx, ty, top + 0.02), 0.042, 0.01, brass_worn, bevel=0.003))
        base = top + 0.025
        stand.append(cyl(f"checkin_candle_{key}", (cx, ty, base + h / 2), 0.028, h, wax, bevel=0.005))
        wick = cyl(f"checkin_wick_{key}", (cx, ty, base + h + 0.006), 0.0015, 0.012, wick_m, verts=8, bevel=0)
        if key == "burnt-out":
            wick.rotation_euler = (math.radians(25), 0, 0)              # spent and bent over
        flames[key] = [round(cx, 3), ty, round(base + h + 0.022, 3)]    # where the page draws the flame when lit
    hotspot("checkin-desk", "The check-in desk", stand, kind="checkin")
    HOTSPOTS["checkin-desk"]["flames"] = flames

    # An hourglass: two glass bulbs between turned wooden ends, sand mostly run through
    hx, hy = x0 + 0.72, -0.17
    glass = mat("hourglass_glass", (0.95, 0.97, 0.98, 1), rough=0.03, transmission=1.0, ior=1.5)
    sand = mat("hourglass_sand", srgb("#d8b47a"), rough=0.9)
    for z, r in ((top + 0.008, 0.05), (top + 0.172, 0.05)):
        cyl(f"hourglass_end_{z:.2f}", (hx, hy, z), r, 0.016, tread_oak, bevel=0.004)
    for k in range(3):
        a = 2 * math.pi * k / 3
        cyl(f"hourglass_post_{k}", (hx + 0.04 * math.cos(a), hy + 0.04 * math.sin(a), top + 0.09), 0.005, 0.16, tread_oak, verts=8)
    for z, rot in ((top + 0.051, 0), (top + 0.129, math.pi)):
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.032, radius2=0.004, depth=0.074, location=(hx, hy, z),
                                        rotation=(rot, 0, 0))
        b = bpy.context.active_object
        bpy.ops.object.shade_smooth()
        b.data.materials.append(glass)
        b.visible_shadow = False
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.028, radius2=0.002, depth=0.03, location=(hx, hy, top + 0.031))
    bpy.ops.object.shade_smooth()
    bpy.context.active_object.data.materials.append(sand)                # the heap below
    cyl("hourglass_sand_top", (hx, hy, top + 0.096), 0.008, 0.006, sand, verts=16, bevel=0)

    # Two place settings: plate, folded napkin, knife and fork
    plate_m = mat("plate_glaze", srgb("#efe8da"), rough=0.25)
    steel = mat("cutlery", srgb("#b9b6ae"), rough=0.3, metal=1.0)
    for i, px in enumerate((x0 + 0.93, x0 + 1.15)):
        cyl(f"setting_plate_{i}", (px, -0.19, top + 0.007), 0.095, 0.012, plate_m, verts=48, bevel=0.004)
        box(f"setting_napkin_{i}", (px, -0.19, top + 0.017), (0.09, 0.09, 0.008), berry_linen, bevel=0.003)
        box(f"setting_knife_{i}", (px + 0.11, -0.19, top + 0.003), (0.012, 0.18, 0.004), steel, bevel=0.001)
        box(f"setting_fork_{i}", (px - 0.11, -0.19, top + 0.003), (0.014, 0.17, 0.004), steel, bevel=0.001)

    # An apron on a peg on the back wall, past the notice board
    ax = 2.58
    cyl("apron_peg", (ax, -0.04, 1.78), 0.012, 0.08, oak, rot=(math.radians(90), 0, 0))
    sphere("apron_peg_end", (ax, -0.08, 1.78), 0.018, oak)
    curtain("apron", ax, -0.05, 1.77, 0.34, 0.72, mat("apron_linen", srgb("#d9cdb4"), rough=0.95), pleats=3, amp=0.012, seed=8)
    box("apron_strap", (ax, -0.045, 1.83), (0.02, 0.01, 0.12), mat("apron_tie", srgb("#8b4d5c"), rough=0.9), bevel=0.002)

    # The shopping: two paper bags just inside the front door, the produce showing
    kraft = mat("kraft_paper", srgb("#b48a58"), rough=0.92)
    bags = []
    for i, (bx, by, rot, h) in enumerate(((1.30, FRONT + 0.17, 8, 0.34), (1.40, FRONT + 0.46, -14, 0.3))):
        b = box(f"grocery_bag_{i}", (bx, by, h / 2), (0.24, 0.15, h), kraft, bevel=0.006)
        b.rotation_euler = (0, 0, math.radians(rot))
        bags.append(b)
        cuff = box(f"grocery_bag_cuff_{i}", (bx, by, h - 0.02), (0.245, 0.155, 0.04), kraft, bevel=0.004)
        cuff.rotation_euler = (0, 0, math.radians(rot))
    model("lemon", (1.26, FRONT + 0.15, 0.35), rot_z=30)
    model("yellow_onion", (1.33, FRONT + 0.2, 0.33), rot_z=80)
    model("food_apple_01", (1.36, FRONT + 0.45, 0.29), rot_z=10)
    model("food_apple_01", (1.43, FRONT + 0.48, 0.28), rot_z=140)
    bread = cyl("grocery_loaf", (1.22, FRONT + 0.17, 0.38), 0.035, 0.32, mat("loaf_crust", srgb("#b47a3c"), rough=0.75),
                verts=16, bevel=0.03, rot=(math.radians(-20), math.radians(15), 0))
    leaves = mat("leek_green", srgb("#5f7f3c"), rough=0.6)
    for k in range(3):
        cyl(f"grocery_greens_{k}", (1.44 + 0.02 * k, FRONT + 0.43, 0.38), 0.008, 0.18, leaves, verts=8,
            rot=(math.radians(12 - 9 * k), math.radians(-10 + 8 * k), 0))
    hotspot("groceries", "The shopping", bags + [bread], kind="pantry")


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # Materials: the kitchen's scans, recoloured to ChatGPT's hallway notes (art-inbox/inn-hallway/notes.md)
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#ece2cf"), tint_mix=0.85, bump=0.6)
    floor = pbr("floor", "old_wooden_floor_01", 2.5, tint=srgb("#6c4b31"), tint_mix=0.3, rough_add=0.15, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#76502d"), tint_mix=0.45, rot_z=90)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#a57543"), tint_mix=0.35, rot_z=90)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    tread_oak = pbr("tread_oak", "wood_table_worn", 1.2, tint=srgb("#8b5d35"), tint_mix=0.4)
    front_paint = pbr("front_paint", "wood_table_worn", 1.2, tint=srgb("#2c2416"), tint_mix=0.85, rough_add=0.05)
    # Painted berry outside, to match the storybook picture; varnished wood inside, as the panoramas show it
    front_berry = pbr("front_berry", "wood_table_worn", 1.2, tint=srgb("#7a2f45"), tint_mix=0.9, rough_add=0.12)
    berry_linen = pbr("berry_linen", "rough_linen", 0.5, tint=srgb("#8b4d5c"), tint_mix=1.0, bump=0.5)
    berry_linen.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.25
    runner = image_mat("runner", os.path.join(KITCHEN, "13-rag-rug-tile-candidate.png"), rough=0.97,
                       tile=0.7, normal_from="knitted_fleece", normal_strength=0.8)
    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    brass = mat("brass", srgb("#b07f52"), rough=0.4, metal=1.0)
    brass_worn = mat("brass_worn", srgb("#bd9655"), rough=0.28, metal=1.0)
    ink = mat("engraving", srgb("#3a2a18"), rough=0.5, metal=0.6)
    coir = pbr("coir", "rough_linen", 0.25, tint=srgb("#5e4a33"), tint_mix=1.0, bump=1.2)
    # at night the fanlight is dark night glass, not frosted white
    frosted = mat("frosted", (0.2, 0.23, 0.3, 1) if NIGHT else (0.92, 0.94, 0.94, 1), rough=0.35, transmission=1.0, ior=1.5)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    umbrella_cloth = [mat("umbrella_green", srgb("#3c4a3a"), rough=0.8), mat("umbrella_black", srgb("#24221f"), rough=0.75)]
    bulb = mat("bulb", (1, 0.85, 0.6, 1), emission=(1.0, 0.72, 0.42, 1), strength=18)
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2, 1), strength=30)
    stub_plaster = mat("stub_plaster", srgb("#d8c8ae"), rough=0.9)

    # ---- Floor and ceilings (one floor slab; ceilings leave a stairwell over the top of the stairs)
    box_span("floor", -HALL_X - 0.3, HALL_X + 0.3, FRONT - 0.3, SEA + 0.3, -0.1, 0, floor)
    stair_x0, tread, rise, steps = -1.25, 0.26, H / 14, 14
    stair_top = stair_x0 - tread * steps                      # -4.89
    well = (stair_top, -2.2)                                  # stairwell opening, x range
    for name, x0, x1, y0, y1 in (("ceil_a", -HALL_X - 0.3, HALL_X + 0.3, FRONT - 0.3, -1.0),
                                 ("ceil_b", well[1], HALL_X + 0.3, -1.0, SEA + 0.3),
                                 ("ceil_c", -HALL_X - 0.3, well[0], -1.0, 0.0),
                                 ("ceil_d", -HALL_X - 0.3, well[1], 0.0, SEA + 0.3)):
        box_span(name, x0, x1, y0, y1, H, H + 0.12, plaster)

    # ---- Corridor walls with four door openings, skirting, beams
    def wall_run(name, side, y0, y1, gaps):
        x_in = side * CW
        x0, x1 = sorted((x_in, x_in + side * WT))
        cuts = sorted(gaps)
        y = y0
        for g0, g1 in cuts + [(y1, y1)]:
            if g0 > y:
                box_span(f"{name}_{y:.2f}", x0, x1, y, g0, 0, H, plaster)
                sk0, sk1 = sorted((x_in, x_in - side * 0.02))
                box_span(f"{name}_skirt_{y:.2f}", sk0, sk1, y, g0, 0, 0.16, paint, bevel=0.003)
            if g1 > g0:
                box_span(f"{name}_lintel_{g0:.2f}", x0, x1, g0, g1, DOOR_H, H, plaster)
            y = g1

    for side in (-1, 1):
        gaps = [(d["y"] - DOOR_W / 2, d["y"] + DOOR_W / 2) for d in DOORS.values() if d["side"] == side]
        wall_run(f"corridor_{'l' if side < 0 else 'r'}", side, 0.0, SEA, gaps)
    box_span("corridor_runner", -0.4, 0.4, 0.35, SEA - 0.55, 0, 0.012, runner, bevel=0.004)
    for i, y in enumerate((0.8, 2.6, 4.4, 6.2, 7.5)):
        box_span(f"beam_c{i}", -CW, CW, y - 0.1, y + 0.1, H - 0.2, H, beam_wood, bevel=0.015)

    # Cased opening between the entrance hall and the corridor (a lowered header, cream trims)
    box_span("hall_header", -CW, CW, 0.0, WT, 2.32, H, plaster)
    for x in (-CW - 0.04, CW + 0.04):
        box_span(f"opening_trim_{x}", x - 0.045, x + 0.045, -0.03, 0.0, 0, 2.36, paint, bevel=0.006)
    box_span("opening_trim_top", -CW - 0.085, CW + 0.085, -0.03, 0.0, 2.32, 2.41, paint, bevel=0.006)

    # ---- Sea wall: tall six-pane sash, berry curtains, sill with a jug of stems
    win_l, win_r, win_b, win_t = -0.5, 0.5, 0.6, 2.4
    for name, x0, x1, z0, z1 in (("sea_l", -CW, win_l, 0, H), ("sea_r", win_r, CW, 0, H),
                                 ("sea_b", win_l, win_r, 0, win_b), ("sea_t", win_l, win_r, win_t, H)):
        box_span(name, x0, x1, SEA, SEA + 0.3, z0, z1, plaster)
    box_span("sea_skirt", -CW, CW, SEA - 0.02, SEA, 0, 0.16, paint, bevel=0.003)
    wy = SEA + 0.2
    zc = (win_b + win_t) / 2
    box("sea_sill", (0, SEA - 0.04, win_b - 0.025), (win_r - win_l + 0.2, 0.3, 0.05), oak, bevel=0.006)
    for x in (win_l + 0.03, win_r - 0.03):
        box(f"sea_frame_{x}", (x, wy, zc), (0.06, 0.08, win_t - win_b), paint)
    box("sea_frame_t", (0, wy, win_t - 0.03), (win_r - win_l, 0.08, 0.06), paint)
    box("sea_frame_b", (0, wy, win_b + 0.03), (win_r - win_l, 0.08, 0.06), paint)
    box("sea_meeting", (0, wy, zc), (win_r - win_l, 0.07, 0.05), paint)
    box("sea_muntin_v", (0, wy, zc), (0.025, 0.05, win_t - win_b), paint)
    for z in (win_b + (zc - win_b) / 2, zc + (win_t - zc) / 2):
        box(f"sea_muntin_{z:.2f}", (0, wy, z), (win_r - win_l, 0.05, 0.025), paint)
    pane = box("sea_glass", (0, wy + 0.01, zc), (win_r - win_l, 0.006, win_t - win_b),
               window_glass("sea_glass", wet=WET.get(WEATHER, 0.0)), bevel=0)
    pane.visible_shadow = False
    sky, backdrop_strength, bounce_w = SKY[WEATHER]
    bd_w, bd_h, bd_y = 11.4, 3.8, SEA + 4.2
    bd_top = EYE + 0.58 * bd_h
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, bd_y, bd_top - bd_h / 2), rotation=(math.radians(90), 0, 0))
    bd = bpy.context.active_object
    bd.name = "sea_view"
    bd.scale = (bd_w, bd_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    bd.visible_shadow = False
    bd.data.materials.append(emission_mat("sea_view", os.path.join(KITCHEN, VIEWS[WEATHER]), backdrop_strength))
    hotspot("sea-window", "The sea", pane, kind="ambient")
    box("sea_curtain_rod", (0, SEA - 0.12, win_t + 0.1), (1.5, 0.022, 0.022), mat("iron", srgb("#24211c"), 0.7, 0.75), bevel=0.009)
    curtain("sea_curtain_l", win_l - 0.12, SEA - 0.12, win_t + 0.08, 0.34, win_t - win_b + 0.3, berry_linen, pleats=6, seed=3)
    curtain("sea_curtain_r", win_r + 0.12, SEA - 0.12, win_t + 0.08, 0.34, win_t - win_b + 0.3, berry_linen, pleats=6, seed=4)
    model("jug_01", (-0.18, SEA - 0.06, win_b), rot_z=30)
    model("potted_plant_02", (0.22, SEA - 0.08, win_b), rot_z=80, scale=0.35)
    model("wicker_basket_02", (0.58, SEA - 0.32, 0), rot_z=-15, scale=1.4)

    # ---- Room doors and dials
    def room_stub(name, side, y, depth=1.2, half=0.8, light=8.0):
        """A small closed room behind a door, so warm light shows under it."""
        xa = side * (CW + WT)
        xb = side * (CW + WT + depth)
        x0, x1 = sorted((xa, xb))
        box_span(f"{name}_far", *sorted((xb, xb + side * 0.1)), y - half, y + half, 0, H, stub_plaster)
        box_span(f"{name}_s0", x0, x1, y - half - 0.1, y - half, 0, H, stub_plaster)
        box_span(f"{name}_s1", x0, x1, y + half, y + half + 0.1, 0, H, stub_plaster)
        if light:
            point_light(f"{name}_light", ((xa + xb) / 2, y, 1.6), light, (1.0, 0.66, 0.38), radius=0.3)

    def door(key, d):
        s, yc = d["side"], d["y"]
        x_mid = s * (CW + WT / 2)
        normal = (-s, 0, 0)                                  # the corridor face
        right = (0, -s, 0)                                   # viewer's right, looking at the wall
        lw, lh, lt = DOOR_W - 0.02, DOOR_H - 0.03, 0.045
        parts = []
        # leaf built around its hinge (local x from 0 at the hinge to lw at the latch side)
        leaf = box_span(f"{key}_leaf", 0, lw, -lt / 2, lt / 2, 0.012, 0.012 + lh, door_oak, bevel=0.004)
        parts.append(leaf)
        for px in (0.235, lw - 0.235):
            for pz0, pz1 in ((0.2, 0.95), (1.12, 1.95)):
                for face in (-1, 1):
                    parts.append(box_span(f"{key}_panel_{px}_{pz0}_{face}", px - 0.14, px + 0.14,
                                          face * lt / 2, face * (lt / 2 + 0.006), pz0 + 0.02, pz1 - 0.02, door_oak, bevel=0.008))
                    for name, a0, a1, b0, b1 in (("l", px - 0.17, px - 0.145, pz0, pz1), ("r", px + 0.145, px + 0.17, pz0, pz1),
                                                 ("b", px - 0.17, px + 0.17, pz0, pz0 + 0.025), ("t", px - 0.17, px + 0.17, pz1 - 0.025, pz1)):
                        parts.append(box_span(f"{key}_mould_{px}_{pz0}_{face}_{name}", a0, a1, face * lt / 2,
                                              face * (lt / 2 + 0.014), b0, b1, door_dark, bevel=0.005))
        for face in (-1, 1):
            parts.append(cyl(f"{key}_knob_{face}", (lw - 0.07, face * (lt / 2 + 0.035), 1.0), 0.028, 0.05, brass_worn,
                             rot=(math.radians(90), 0, 0)))
        for hz in (0.25, 1.85):
            parts.append(cyl(f"{key}_hinge_{hz}", (0.005, 0, hz), 0.009, 0.1, mat(f"{key}_iron", srgb("#2a2622"), 0.6, 0.8)))
        # hinge on the front-door side (smaller y), so the dial sits next to the hinge edge, as in concept 04.
        # Local leaf axes: x along the door (toward the sea), y through it (toward the corridor = -s in world x).
        hinge = Vector((x_mid, yc - DOOR_W / 2 + 0.01, 0))
        swing = math.radians(d.get("ajar", 0))
        # map local x -> world +y (toward the sea), local y -> world -x, z stays up (a proper rotation, no mirror)
        m = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4()
        rot = Matrix.Rotation(-s * swing, 4, "Z")          # open into the room, away from the corridor
        mm = rot @ m
        mm.translation = hinge
        leaf_root = group(f"{key}_door", mm, parts)
        ANIM[f"door-{key}"] = leaf_root

        # architrave on the corridor face
        fx0, fx1 = sorted((s * CW, s * CW - s * 0.025))
        trims = [box_span(f"{key}_trim_a", fx0, fx1, yc - DOOR_W / 2 - 0.08, yc - DOOR_W / 2, 0, DOOR_H + 0.08, paint, bevel=0.005),
                 box_span(f"{key}_trim_b", fx0, fx1, yc + DOOR_W / 2, yc + DOOR_W / 2 + 0.08, 0, DOOR_H + 0.08, paint, bevel=0.005),
                 box_span(f"{key}_trim_t", fx0, fx1, yc - DOOR_W / 2 - 0.08, yc + DOOR_W / 2 + 0.08, DOOR_H, DOOR_H + 0.09, paint, bevel=0.005)]
        jx0, jx1 = sorted((s * CW, s * (CW + WT)))
        for y0, y1 in ((yc - DOOR_W / 2, yc - DOOR_W / 2 + 0.008), (yc + DOOR_W / 2 - 0.008, yc + DOOR_W / 2)):
            box_span(f"{key}_jamb_{y0:.2f}", jx0, jx1, y0, y1, 0, DOOR_H, paint)
        box_span(f"{key}_head", jx0, jx1, yc - DOOR_W / 2, yc + DOOR_W / 2, DOOR_H - 0.008, DOOR_H, paint)
        hotspot(f"door-{key}", d["label"], meshes_of(leaf_root), kind="door")
        dial(key, d, normal, right)
        return leaf_root, trims

    def dial(key, d, normal, right):
        s, yc = d["side"], d["y"]
        origin = (s * CW - s * 0.006, yc - DIAL_BACK, DIAL_Z)
        parts = []
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0035))
        face = bpy.context.active_object
        face.name = f"{key}_dial_face"
        side_len = 2 * DIAL_R / 0.965                        # the plate's circle spans 96.5% of the flat image
        face.scale = (side_len, side_len, 1)
        bpy.ops.object.transform_apply(scale=True)
        face.data.materials.append(dial_face)
        parts.append(face)
        parts.append(cyl(f"{key}_dial_rim", (0, 0, 0), DIAL_R, 0.006, brass, verts=96, bevel=0.002))
        # The names Claude engraves (the concept art leaves the plates blank)
        for st in DIAL_NAMES:
            if not st["label"]:
                continue
            a = math.radians(st["angle_clockwise_from_top_deg"])
            r = 0.0785
            words = st["label"].split(" ")
            body = "\n".join(words) if len(words) > 1 else st["label"]
            size = 0.0042 if len(words) > 1 else (0.0036 if len(body) > 10 else 0.0044)
            parts.append(text(f"{key}_name_{st['index']}", body, (r * math.sin(a), r * math.cos(a), 0.0045),
                              (0, 0, 0), size, ink))
        # The pointer, set to this door's own room
        a = math.radians(d["station"])
        ptr = []
        ptr.append(cyl(f"{key}_hub", (0, 0, 0.012), 0.014, 0.012, brass_worn, bevel=0.003))
        ptr.append(sphere(f"{key}_hub_cap", (0, 0, 0.019), 0.008, brass_worn))
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.006, radius2=0.0025, depth=0.062,
                                        location=(0, 0.035, 0.012), rotation=(math.radians(-90), 0, 0))
        shaft = bpy.context.active_object
        shaft.name = f"{key}_pointer"
        bpy.ops.object.shade_smooth()
        shaft.data.materials.append(brass_worn)
        ptr.append(shaft)
        ptr.append(sphere(f"{key}_pointer_tip", (0, 0.068, 0.012), 0.0065, brass_worn))
        ptr.append(cyl(f"{key}_pointer_neck", (0, -0.012, 0.012), 0.0035, 0.024, brass_worn, verts=16, bevel=0.0,
                       rot=(math.radians(90), 0, 0)))
        ptr.append(sphere(f"{key}_pointer_tail", (0, -0.026, 0.012), 0.006, brass_worn))
        pointer = group(f"{key}_pointer_set", Matrix.Rotation(-a, 4, "Z"), ptr)
        ANIM[f"pointer-{key}"] = pointer
        parts.append(pointer)
        plate = group(f"{key}_dial", frame_matrix(origin, normal, right), parts)
        hotspot(f"dial-{key}", "The dial", [face], kind="dial", overlay="dial")
        return plate

    dial_face = image_mat("dial_face", os.path.join(PACK, "05-dial-plate-flat.png"), rough=0.35, circle=0.4825)
    pdial = dial_face.node_tree.nodes["Principled BSDF"]
    pdial.inputs["Metallic"].default_value = 1.0
    for key, d in DOORS.items():
        door(key, d)
        if d.get("ajar"):
            # Chiapothecary: the door left a little open, warm light and greenery behind it
            s = d["side"]
            room_stub(key, s, d["y"], depth=2.6, half=1.6, light=0)
            point_light(f"{key}_lamp", (s * 2.4, d["y"] + 0.6, 1.9), 30, (1.0, 0.7, 0.42), radius=0.25)
            cab = model("painted_wooden_cabinet", (s * 3.32, d["y"] + 0.4, 0), rot_z=-90 * s)
            retint(cab, "#9db08f", lo=0.6, hi=1.1)
            model("potted_plant_02", (s * 3.3, d["y"] + 0.1, 1.18), rot_z=40, scale=0.55)
            model("potted_plant_02", (s * 1.8, d["y"] + 1.2, 0), rot_z=10, scale=1.0)
            model("potted_plant_04", (s * 3.3, d["y"] + 0.75, 1.18), rot_z=0, scale=1.4)
        else:
            room_stub(key, d["side"], d["y"], depth=2.6 if FLY and key == "cuddlecore" else 1.2)
            if FLY and key == "cuddlecore":
                # The fly-through opens this door: glimpse the real kitchen (its front wall, from the
                # rendered panorama) glowing at the far end, instead of the plain room behind it
                s = d["side"]
                pano = os.path.join(OUT, "cuddlecore_pano_rain_preview.jpg")
                # A tall crop (window, curtains, range) that fills the whole far end of the room behind the door
                glimpse_png = crop_image(pano, (866, 240, 1182, 780), os.path.join(OUT, "crop_kitchen_glimpse_tall.png"))
                bpy.ops.mesh.primitive_plane_add(size=1, location=(s * (CW + WT + 2.58), d["y"], H / 2),
                                                 rotation=(math.radians(90), 0, math.radians(-90 * s)))
                glimpse = bpy.context.active_object
                glimpse.name = "kitchen_glimpse"
                glimpse.scale = (1.62, H + 0.02, 1)
                bpy.ops.object.transform_apply(scale=True)
                glimpse.data.materials.append(emission_mat("kitchen_glimpse", glimpse_png, 1.1))

    # ---- Grandfather clock against the hill-side wall, between its two doors (no hands: the viewer draws them)
    # The fly-through has no live browser hands to draw on it, so it keeps the model's own, set to 4:40
    clock_parts = ["vintage_grandfather_clock_01_Body"] + (
        ["vintage_grandfather_clock_01_HourHand", "vintage_grandfather_clock_01_MinuteHand"] if FLY else [])
    clock = blend_model("vintage_grandfather_clock_01", (-CW + 0.19, 4.0, 0), rot_z=90, only=clock_parts)
    for o in clock.children:
        if o.name.endswith("HourHand"):
            o.rotation_euler = (0, math.radians((4 + 40 / 60) / 12 * 360), 0)
        elif o.name.endswith("MinuteHand"):
            o.rotation_euler = (0, math.radians(40 / 60 * 360), 0)
    hotspot("grandfather-clock", "The clock", clock, kind="clock", overlay="time")
    HOTSPOTS["grandfather-clock"]["center"] = [-CW + 0.19 + 0.125, 4.0, 1.732]
    HOTSPOTS["grandfather-clock"]["face"] = {"center": [-CW + 0.19 + 0.125, 4.0, 1.732], "normal": [1, 0, 0], "radius": 0.12}

    # ---- Wall lamps: a brass plate, a short arm and a cone shade over a warm bulb
    def wall_lamp(name, at, normal, watts=24):
        n = Vector(normal)
        right = Vector((0, 0, 1)).cross(n)
        parts = [cyl(f"{name}_plate", (0, 0, 0.008), 0.05, 0.016, brass, bevel=0.003),
                 cyl(f"{name}_arm", (0, 0.04, 0.11), 0.008, 0.2, brass, rot=(0, 0, 0)),
                 cyl(f"{name}_arm2", (0, 0.11, 0.2), 0.008, 0.16, brass, rot=(math.radians(90), 0, 0))]
        bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.1, radius2=0.035, depth=0.1, end_fill_type="NOTHING",
                                        location=(0, 0.13, 0.22))
        shade = bpy.context.active_object
        shade.name = f"{name}_shade"
        shade.rotation_euler = (math.radians(-90), 0, 0)
        shade.modifiers.new("thick", "SOLIDIFY").thickness = 0.003
        bpy.ops.object.shade_smooth()
        shade.data.materials.append(brass)
        parts.append(shade)
        parts.append(sphere(f"{name}_bulb", (0, 0.1, 0.22), 0.026, bulb))
        g = group(name, frame_matrix(at, normal, right), parts)
        # local: z out of the wall, y up. The light sits in the bulb.
        light_at = Vector(at) + n * 0.22 + Vector((0, 0, 0.1))
        point_light(f"{name}_light", light_at, watts * LAMP, (1.0, 0.68, 0.4), radius=0.04)
        return g

    for name, at, normal in (("lamp_cl0", (-CW, 0.8, 1.9), (1, 0, 0)), ("lamp_cr1", (CW, 4.0, 1.9), (-1, 0, 0)),
                             ("lamp_cl2", (-CW, 7.15, 1.9), (1, 0, 0)), ("lamp_hall_b", (3.4, 0.0, 1.9), (0, -1, 0)),
                             ("lamp_front_l", (-0.85, FRONT, 1.9), (0, 1, 0)), ("lamp_front_r", (0.85, FRONT, 1.9), (0, 1, 0)),
                             ("lamp_hall_end", (-HALL_X, -1.6, 1.9), (1, 0, 0))):
        wall_lamp(name, at, normal)

    # ---- Entrance hall: walls, front door with its fanlight, stairs, notice board, bench, pegs
    for name, x0, x1 in (("hall_back_l", -HALL_X, -CW - WT), ("hall_back_r", CW + WT, HALL_X)):
        box_span(name, x0, x1, 0.0, WT, 0, H, plaster)
        box_span(f"{name}_skirt", x0, x1, -0.02, 0.0, 0, 0.16, paint, bevel=0.003)
    for side in (-1, 1):
        x0, x1 = sorted((side * HALL_X, side * (HALL_X + WT)))
        box_span(f"hall_end_{side}", x0, x1, FRONT, 0, 0, H, plaster)
    for i, x in enumerate((-1.8, 1.8, 3.6)):
        box_span(f"beam_h{i}", x - 0.1, x + 0.1, FRONT, 0, H - 0.2, H, beam_wood, bevel=0.015)

    fd_w, fd_h, arch_r, arch_z = 1.0, 2.1, 0.46, 2.15
    fy0, fy1 = FRONT - 0.3, FRONT
    box_span("front_wall_l", -HALL_X, -fd_w / 2, fy0, fy1, 0, H, plaster)
    box_span("front_wall_r", fd_w / 2, HALL_X, fy0, fy1, 0, H, plaster)
    over = box_span("front_over_door", -fd_w / 2, fd_w / 2, fy0, fy1, fd_h, H, plaster)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=arch_r, depth=1.0, location=(0, FRONT - 0.15, arch_z),
                                        rotation=(math.radians(90), 0, 0))
    cutter = bpy.context.active_object
    boolean = over.modifiers.new("arch", "BOOLEAN")
    boolean.operation, boolean.object = "DIFFERENCE", cutter
    with bpy.context.temp_override(object=over, active_object=over, selected_objects=[over]):
        bpy.ops.object.modifier_apply(modifier="arch")
    bpy.data.objects.remove(cutter)
    for x0, x1 in ((-HALL_X, -fd_w / 2 - 0.09), (fd_w / 2 + 0.09, HALL_X)):
        box_span(f"front_skirt_{x0}", x0, x1, FRONT, FRONT + 0.02, 0, 0.16, paint, bevel=0.003)
    for x in (-fd_w / 2 - 0.045, fd_w / 2 + 0.045):
        box_span(f"front_trim_{x}", x - 0.045, x + 0.045, FRONT, FRONT + 0.025, 0, fd_h + 0.05, paint, bevel=0.005)
    box_span("front_transom", -fd_w / 2 - 0.09, fd_w / 2 + 0.09, FRONT - 0.2, FRONT + 0.025, fd_h, arch_z, paint, bevel=0.005)
    # arch trim: a ring of short boxes following the fanlight curve
    for i in range(24):
        a0, a1 = math.pi * i / 24, math.pi * (i + 1) / 24
        am = (a0 + a1) / 2
        seg = box(f"arch_trim_{i}", ((arch_r + 0.04) * math.cos(am), FRONT + 0.0125, arch_z + (arch_r + 0.04) * math.sin(am)),
                  (0.08, 0.025, (arch_r + 0.04) * (a1 - a0) + 0.01), paint, bevel=0.003)
        seg.rotation_euler = (0, -am, 0)                     # long side along the curve
    fan = half_disc("fanlight", arch_r, frosted)
    fan.location = (0, FRONT - 0.15, arch_z)
    fan.visible_shadow = False
    for k in range(1, 6):
        a = math.pi * k / 6
        bar = box(f"fan_bar_{k}", (arch_r / 2 * math.cos(a), FRONT - 0.15, arch_z + arch_r / 2 * math.sin(a)),
                  (0.018, 0.03, arch_r), paint, bevel=0.002)
        bar.rotation_euler = (0, math.pi / 2 - a, 0)
    ring_r = arch_r * 0.42
    for i in range(16):                                      # the small inner arc of the fanlight
        am = math.pi * (i + 0.5) / 16
        seg = box(f"fan_ring_{i}", (ring_r * math.cos(am), FRONT - 0.15, arch_z + ring_r * math.sin(am)),
                  (0.018, 0.03, ring_r * math.pi / 16 + 0.006), paint, bevel=0.002)
        seg.rotation_euler = (0, -am, 0)
    # What shows through the fanlight: a soft overcast sky, seen by the camera only (light still comes from the world)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, FRONT - 1.2, arch_z + 0.3), rotation=(math.radians(90), 0, 0))
    lane_sky = bpy.context.active_object
    lane_sky.name = "fanlight_sky"
    lane_sky.scale = (4, 2, 1)
    for attr in ("visible_shadow", "visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter"):
        setattr(lane_sky, attr, False)
    sky_m = mat("fanlight_sky", (0, 0, 0, 1), emission=srgb("#1d2533" if NIGHT else "#c9d1d6"), strength=0.06 if NIGHT else 0.55)
    lane_sky.data.materials.append(sky_m)
    fd_parts = [box_span("front_leaf", -fd_w / 2 + 0.01, fd_w / 2 - 0.01, FRONT - 0.2, FRONT - 0.15, 0.01, fd_h - 0.005, front_paint, bevel=0.004)]
    for px in (-0.22, 0.22):
        for pz0, pz1 in ((0.18, 0.9), (1.08, 1.95)):
            fd_parts.append(box_span(f"front_panel_{px}_{pz0}", px - 0.17, px + 0.17, FRONT - 0.15, FRONT - 0.141, pz0, pz1, front_paint, bevel=0.006))
    fd_parts.append(cyl("front_knob", (0.38, FRONT - 0.12, 1.0), 0.03, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
    fd_parts.append(box("front_letter_plate", (0, FRONT - 0.138, 1.02), (0.26, 0.006, 0.07), brass, bevel=0.003))
    hotspot("front-door", "Exit out the front door", fd_parts, kind="door")
    # The outside face: berry paint, four raised panels, a brass knob and letter plate (seen only from the lane)
    fd_parts.append(box_span("front_outside", -fd_w / 2 + 0.01, fd_w / 2 - 0.01, FRONT - 0.205, FRONT - 0.2, 0.01, fd_h - 0.005, front_berry, bevel=0.002))
    for px in (-0.22, 0.22):
        for pz0, pz1 in ((0.18, 0.9), (1.08, 1.95)):
            fd_parts.append(box_span(f"front_out_panel_{px}_{pz0}", px - 0.17, px + 0.17, FRONT - 0.214, FRONT - 0.205, pz0, pz1, front_berry, bevel=0.006))
    fd_parts.append(cyl("front_out_knob", (0.38, FRONT - 0.24, 1.0), 0.03, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
    fd_parts.append(box("front_out_letter_plate", (0, FRONT - 0.208, 1.02), (0.26, 0.006, 0.07), brass, bevel=0.003))
    # Hinged on the side away from the knob, so the fly-through can swing it open into the hall
    hinge = bpy.data.objects.new("front_door_hinge", None)
    scene.collection.objects.link(hinge)
    hinge.location = (-fd_w / 2 + 0.01, FRONT - 0.15, 0)
    bpy.context.view_layer.update()
    for part in fd_parts:
        part.parent = hinge
        part.matrix_parent_inverse = hinge.matrix_world.inverted()
    ANIM["door-front"] = hinge
    box_span("door_mat", -0.6, 0.6, FRONT + 0.03, FRONT + 0.65, 0, 0.012, coir, bevel=0.004)

    # Stairs up along the back wall of the entrance hall, rising toward the hill side
    sy0, sy1 = -1.0, 0.0
    stair_parts = []
    for k in range(steps):
        xa = stair_x0 - tread * k
        xb = xa - tread
        top = rise * (k + 1)
        stair_parts.append(box_span(f"step_{k}", xb, xa, sy0, sy1, 0, top - 0.03, paint))
        stair_parts.append(box_span(f"tread_{k}", xb - 0.0, xa + 0.03, sy0 - 0.03, sy1, top - 0.03, top, tread_oak, bevel=0.006))
        stair_parts.append(box_span(f"runner_{k}", xb, xa + 0.035, -0.85, -0.15, top, top + 0.008, runner, bevel=0.002))
        stair_parts.append(box_span(f"runner_rise_{k}", xa + 0.03, xa + 0.038, -0.85, -0.15, top - rise + 0.01, top, runner, bevel=0.0))
    box_span("landing", -HALL_X, stair_top, sy0, sy1, H - 0.12, H, tread_oak)
    # Stairwell above the opening: plaster walls and a dim warm landing light
    for name, x0, x1, y0, y1 in (("well_back", -HALL_X, well[1], 0.0, 0.1), ("well_front", -HALL_X, well[1], -1.1, -1.0),
                                 ("well_end", well[1], well[1] + 0.1, -1.1, 0.1)):
        box_span(name, x0, x1, y0, y1, H, 2 * H, plaster)
    box_span("well_ceiling", -HALL_X, well[1] + 0.1, -1.1, 0.1, 2 * H, 2 * H + 0.1, plaster)
    point_light("landing_light", (-4.3, -0.5, H + 2.0), 6, (1.0, 0.68, 0.4), radius=0.2)
    # Newel, handrail, balusters
    slope = math.atan2(rise, tread)
    cyl("newel", (stair_x0 + 0.04, sy0 + 0.05, 0.55), 0.055, 1.1, tread_oak, verts=8, bevel=0.01)
    sphere("newel_cap", (stair_x0 + 0.04, sy0 + 0.05, 1.14), 0.065, tread_oak)
    rail_len = (tread * steps + 0.1) / math.cos(slope)
    rail = box("handrail", (0, 0, 0), (rail_len, 0.07, 0.05), tread_oak, bevel=0.015)
    rail.rotation_euler = (0, slope, 0)
    rail.location = (stair_x0 - tread * steps / 2, sy0 + 0.05, rise * steps / 2 + 0.92)
    for k in range(steps):
        x = stair_x0 - tread * (k + 0.5)
        top = rise * (k + 1)
        rail_z = 0.92 + rise * steps / 2 + (stair_x0 - tread * steps / 2 - x) * math.tan(slope)
        cyl(f"baluster_{k}", (x, sy0 + 0.05, (top + rail_z) / 2), 0.018, rail_z - top, tread_oak, verts=12, bevel=0.004)
    hotspot("stairs", "Up the stairs", stair_parts[:12], kind="ambient")
    # The stiff cellar door under the stairs
    cx = -4.15
    cellar = [box_span("cellar_leaf", cx - 0.32, cx + 0.32, sy0 - 0.035, sy0 - 0.005, 0.02, 1.25, door_oak, bevel=0.004)]
    for dx in (-0.16, 0.0, 0.16):
        cellar.append(box_span(f"cellar_plank_{dx}", cx + dx - 0.004, cx + dx + 0.004, sy0 - 0.037, sy0 - 0.033, 0.03, 1.24,
                               mat("plank_gap", srgb("#3a2818"), 0.8)))
    cellar.append(sphere("cellar_knob", (cx + 0.24, sy0 - 0.06, 0.7), 0.022, brass_worn))
    for x in (cx - 0.38, cx + 0.38):
        box_span(f"cellar_trim_{x}", x - 0.04, x + 0.04, sy0 - 0.03, sy0, 0, 1.3, paint, bevel=0.004)
    box_span("cellar_trim_t", cx - 0.42, cx + 0.42, sy0 - 0.03, sy0, 1.26, 1.33, paint, bevel=0.004)
    hotspot("cellar-door", "The cellar door", cellar, kind="locked")

    # Notice board, to the right of the hallway opening (ChatGPT's board, cropped flat onto a panel)
    board_png = crop_image(os.path.join(PACK, "09-notice-board.png"), (478, 26, 1188, 914),
                           os.path.join(OUT, "crop_notice_board.png"))
    bw, bh = 0.62, 0.62 * 888 / 710
    bpy.ops.mesh.primitive_plane_add(size=1, location=(2.0, -0.016, 1.5), rotation=(math.radians(90), 0, 0))
    board = bpy.context.active_object
    board.name = "notice_board"
    board.scale = (bw, bh, 1)
    bpy.ops.object.transform_apply(scale=True)
    board.data.materials.append(image_mat("notice_board", board_png, rough=0.8))
    box_span("notice_board_back", 2.0 - bw / 2, 2.0 + bw / 2, -0.014, 0.0, 1.5 - bh / 2, 1.5 + bh / 2, oak)
    hotspot("notice-board", "The notice board", [board], kind="interactive", overlay="notices")

    # By the front door: boot bench and boots, umbrella stand, peg rail with a basket under it
    model("painted_wooden_bench", (2.1, FRONT + 0.27, 0), rot_z=180)
    model("rubber_boots", (3.05, FRONT + 0.3, 0), rot_z=200)
    model("antique_ceramic_vase_01", (1.0, FRONT + 0.22, 0), rot_z=30, scale=1.25)
    checkin_props(oak, tread_oak, brass, brass_worn, berry_linen, paint)
    for i, (dx, dy, tilt, cloth) in enumerate(((-0.03, 0.01, 7, 0), (0.035, -0.02, -9, 1))):
        bx, by = 1.0 + dx, FRONT + 0.22 + dy
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.015, radius2=0.055, depth=0.6,
                                        location=(bx, by, 0.5), rotation=(math.radians(tilt), 0, 0))
        bpy.ops.object.shade_smooth()
        bpy.context.active_object.data.materials.append(umbrella_cloth[cloth])
        cyl(f"umbrella_shaft_{i}", (bx, by + math.sin(math.radians(-tilt)) * 0.42, 0.88), 0.006, 0.2, brass, rot=(math.radians(tilt), 0, 0))
        sphere(f"umbrella_handle_{i}", (bx, by + math.sin(math.radians(-tilt)) * 0.52, 0.99), 0.02, tread_oak, scale=(1, 1, 1.6))
    box_span("peg_rail", -2.5, -1.2, FRONT, FRONT + 0.03, 1.72, 1.82, oak, bevel=0.005)
    for i in range(4):
        x = -2.33 + i * 0.32
        cyl(f"peg_{i}", (x, FRONT + 0.07, 1.77), 0.014, 0.08, oak, rot=(math.radians(90), 0, 0))
        sphere(f"peg_end_{i}", (x, FRONT + 0.11, 1.77), 0.02, oak)
    model("wicker_basket_01", (-1.85, FRONT + 0.28, 0), rot_z=10, scale=1.2)
    model("potted_plant_02", (-0.95, -1.25, 0), rot_z=40, scale=0.9)

    # The far garden end of the entrance hall: a sage cabinet with a lamp and a plant
    cab = model("painted_wooden_cabinet", (HALL_X - 0.33, -1.1, 0), rot_z=-90)
    retint(cab, "#eee5d3")
    lamp = model("vintage_oil_lamp", (HALL_X - 0.33, -0.85, 1.18), rot_z=-90, scale=0.65)
    for o in meshes_of(lamp):
        if o.name.endswith("flame"):
            o.data.materials.clear()
            o.data.materials.append(flame)
    point_light("hall_oil_lamp", (HALL_X - 0.33, -0.85, 1.18 + 0.36), 18 * LAMP, (1.0, 0.64, 0.33), radius=0.03)
    model("potted_plant_04", (HALL_X - 0.33, -1.4, 1.18), rot_z=20, scale=1.6)

    # ---- Light: overcast sky through the sea window and fanlight, warm lamps, light under doors
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(os.path.dirname(OUT), "assets", "hdri", "kloofendal_overcast_puresky.hdr"))
    wnt.links.new(env.outputs["Color"], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = sky
    area_light("sea_portal", (0, wy, zc), (math.radians(90), 0, 0), (win_r - win_l, win_t - win_b), 0, (1, 1, 1), portal=True)
    sea_bounce = area_light("sea_bounce", (0, SEA - 0.05, zc), (math.radians(90), 0, 0), (0.9, 1.7), bounce_w, (0.78, 0.86, 1.0))
    sea_bounce.visible_camera = sea_bounce.visible_glossy = False
    area_light("fan_portal", (0, FRONT - 0.17, arch_z + arch_r / 2), (math.radians(-90), 0, 0), (2 * arch_r, arch_r), 0, (1, 1, 1), portal=True)
    fan_bounce = area_light("fan_bounce", (0, FRONT + 0.05, arch_z + 0.2), (math.radians(-90), 0, 0), (0.9, 0.45), bounce_w * 0.15, (0.78, 0.86, 1.0))
    fan_bounce.visible_camera = fan_bounce.visible_glossy = False
    point_light("hall_fill", (0.5, -1.0, 2.4), 14 * FILL, (1.0, 0.68, 0.4), radius=0.8)
    point_light("corridor_fill", (0, 4.0, 2.4), 10 * FILL, (1.0, 0.68, 0.4), radius=0.8)

    # ---- Render settings
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = 128 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.render.resolution_x = 2048 if PREVIEW else 8192
    scene.render.resolution_y = 1024 if PREVIEW else 4096
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.7 if NIGHT else 0.75
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def visible_from(cam, hs):
    """Is the hotspot's centre in sight from this stop (nothing else in the way)?"""
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok:
        return True
    if obj and obj.name in hs["objects"]:
        return True
    return (loc - origin).length > dist - 0.12


def stop_hotspots(cam):
    out = {}
    for key, hs in HOTSPOTS.items():
        yaw, pitch = look(cam, hs["center"], cam[2])
        entry = {"label": hs["label"], "type": hs["type"], "overlay": hs["overlay"], "yaw": yaw, "pitch": pitch,
                 "distance": round((Vector(hs["center"]) - Vector(cam)).length, 2), "visible": visible_from(cam, hs)}
        if "face" in hs:
            entry["face"] = hs["face"]
        if "flames" in hs:                                           # where each candle's flame goes, seen from here
            entry["flames"] = {k: dict(zip(("yaw", "pitch"), look(cam, f, cam[2])), distance=round((Vector(f) - Vector(cam)).length, 2))
                               for k, f in hs["flames"].items()}
        out[key] = entry
    return out


def flythrough(scene):
    """Shots 2 to 5 of docs/flythrough-plan.md: the front door, down the hall, the dial, the Cuddlecore door."""
    E = (0, 8, 1.5)                          # straight down the hall to the sea window
    fly_camera(scene, [
        (1,   (0, -2.75, 1.55), E, 30),       # 2: the front door fills the frame
        (36,  (0, -2.75, 1.55), E, 30),
        (120, (0, -1.6, 1.6), E, 28),         #    ...and we step through
        (190, (0, 0.4, 1.6), E, 28),          # 3: straight on into the hallway
        (282, (0.1, 3.4, 1.6), (0, 7.8, 1.5), 28),         #    the walk, the clock passing on the left
        (336, (0.15, 4.7, 1.6), (-0.6, 6.2, 1.4), 28),
        (382, (-0.45, 5.15, 1.4), (-0.9, 5.3, 1.3), 35),   # 4: close on the dial
        (442, (-0.45, 5.15, 1.4), (-0.9, 5.3, 1.3), 35),
        (482, (-0.2, 5.6, 1.6), (-0.9, 6.0, 1.1), 28),     # 5: ease back as the door opens
        (552, (-0.85, 6.0, 1.6), (-3.0, 6.0, 1.5), 28),    #    and into the doorway
    ])
    key_rot_z(ANIM["door-front"], [(12, 0), (60, 95)])
    # The Cuddlecore dial: from The Hall, a pause on the star, then on to Cuddlecore (clockwise = more negative)
    key_rot_z(ANIM["pointer-cuddlecore"], [(382, -320), (407, -360), (417, -360), (437, -400)])
    # The Cuddlecore door's root also carries the leaf's +90 degree turn onto the wall
    key_rot_z(ANIM["door-cuddlecore"], [(462, 0), (498, 90)], base=90)
    out = os.path.join(OUT, "flythrough", "rough" if ROUGH else "final", "hall_")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    video_settings(scene, ROUGH, out)
    bpy.ops.render.render(animation=True)
    print("[whisked] fly-through frames done")


def door_film(scene, shape):
    """The home page's door film: the door swings open and the camera steps in, ending exactly at the
    entrance stop, looking down the hall, so the page can crossfade into the live panorama.
    Portrait frames are for phones held upright."""
    E = (0, 8, 1.6)                                    # level, like the panorama's yaw 0
    fly_camera(scene, [
        (1,   (0, -2.75, 1.55), E, 30),
        (30,  (0, -2.75, 1.55), E, 30),
        (120, STOPS["entrance"], E, 28),
        (132, STOPS["entrance"], E, 28),               # a short hold to crossfade from
    ])
    key_rot_z(ANIM["door-front"], [(8, 0), (56, 95)])
    out = os.path.join(OUT, "door-film", f"{shape}{'-rough' if ROUGH else ''}", "door_")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    video_settings(scene, ROUGH, out)
    if shape == "portrait":
        scene.render.resolution_x, scene.render.resolution_y = scene.render.resolution_y, scene.render.resolution_x
    bpy.ops.render.render(animation=True)
    print("[whisked] door film frames done")


def main():
    build()
    if DOOR_FILM:
        return door_film(bpy.context.scene, DOOR_FILM)
    if FLY:
        return flythrough(bpy.context.scene)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "hallway.blend"))
    scene = bpy.context.scene
    data = {"room": "hallway", "stops": {}}
    cam = None
    for stop, loc in STOPS.items():
        data["stops"][stop] = {"position": list(loc), "hotspots": stop_hotspots(loc)}
    with open(os.path.join(OUT, "hallway_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    suffix = "_preview" if PREVIEW else ""
    for stop, loc in STOPS.items():
        if ONLY_STOP and stop != ONLY_STOP:
            continue
        if cam:
            bpy.data.objects.remove(cam)
        cam = pano_camera(scene, loc, 0)
        scene.render.filepath = os.path.join(OUT, f"hallway_pano_{stop}_{WEATHER}{'_night' if NIGHT else ''}{suffix}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"[whisked] rendered {stop}")
    print("[whisked] done")


main()
