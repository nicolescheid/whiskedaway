"""
The Flourish kitchen: the Inn's bright morning kitchen, across the hallway from Cuddlecore.
Builds the room, renders a 360 equirectangular panorama with Cycles in each barometer weather,
by day or at night, and writes hotspot angles for the browser viewer.

Layout from docs/inn-floorplan.html, the hallway build (the Flourish door is at hallway y = 6.0) and
art-inbox/flourish/ (ChatGPT's concept pack: layout.json, notes.md). Two changes to layout.json:
- the stable door moves to the sea end of the garden wall: the glasshouse lean-to covers the rest of
  that wall (floorplan: it starts about 1.5 m from the Inn's sea face), so a door further along would
  open into the glasshouse;
- the hallway door sits where the hallway already has it (1.8 m from the sea wall), so the range goes
  between it and the sea window, as in concepts 01 and 05.

Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/flourish_build.py -- [--weather=rain] [--night] [--preview] [--no-render]

Axes follow layout.json and the hallway: X = hallway wall (0) to garden wall (4.5), Y = front wall (0)
to sea wall (4.5), Z = up. Metres. Hallway coordinates are x + 1.05, y + 3.3.
"""
import bpy
import json
import math
import os
import random
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ART, ASSETS, OUT, area_light, box, box_span, center_of, cyl, emission_mat, image_mat, look,  # noqa: E402
                     mat, meshes_of, model, pano_camera, pbr, point_light, retint, sphere, srgb, swap_material, text,
                     use_gpu, window_glass)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS
NIGHT = "--night" in ARGS
WEATHER = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "rain")

os.makedirs(OUT, exist_ok=True)
PACK = os.path.join(ART, "flourish")

# One look per barometer reading, as in Cuddlecore. sea/garden: ChatGPT's plates outside the window and the
# stable door; sky: world strength and tint; sun: (W/m2, colour, elevation, azimuth from +X toward +Y) or None;
# bounce: window and door fill (W, colour); lamps: the wall lamp and oil lamp (0 = off); dial: barometer needle.
WEATHERS = {
    "rain":     dict(sea="14-window-rain.png", garden="24-garden-rain.png", dial=-30, sky=1.2, tint=(1.0, 1.0, 1.0),
                     backdrop=0.75, sun=None, bounce=(55, (0.8, 0.87, 1.0)), wet=0.5, lamps=1.0, fill=18, exposure=0.6),
    "fair":     dict(sea="15-window-fair.png", garden="25-garden-fair.png", dial=30, sky=2.0, tint=(1.0, 0.97, 0.93),
                     backdrop=1.1, sun=(9.0, (1.0, 0.9, 0.76), 21, 38), bounce=(75, (1.0, 0.97, 0.93)), wet=0.0, lamps=0.0,
                     fill=8, exposure=0.55),
    "change":   dict(sea="16-window-change.png", garden="26-garden-change.png", dial=0, sky=1.6, tint=(0.96, 0.98, 1.0),
                     backdrop=0.9, sun=None, bounce=(75, (0.93, 0.96, 1.0)), wet=0.0, lamps=0.6, fill=14, exposure=0.6),
    "stormy":   dict(sea="17-window-stormy.png", garden="27-garden-stormy.png", dial=-60, sky=0.55, tint=(0.85, 0.9, 1.0),
                     backdrop=0.5, sun=None, bounce=(28, (0.72, 0.8, 1.0)), wet=0.75, lamps=1.4, fill=16, exposure=0.7),
    "very-dry": dict(sea="18-window-very-dry.png", garden="28-garden-very-dry.png", dial=60, sky=2.3, tint=(1.0, 0.93, 0.82),
                     backdrop=1.15, sun=(10.0, (1.0, 0.86, 0.66), 27, 30), bounce=(70, (1.0, 0.93, 0.84)), wet=0.0, lamps=0.0,
                     fill=7, exposure=0.55),
}
WX = dict(WEATHERS[WEATHER])
NIGHT_SEA = {"rain": "19-night-rain.png", "fair": "20-night-fair.png", "change": "21-night-change.png",
             "stormy": "22-night-stormy.png", "very-dry": "23-night-very-dry.png"}
if NIGHT:
    # Late night: the same weather after dark, every lamp lit
    WX.update(sea=NIGHT_SEA[WEATHER], garden="29-garden-night.png", sky=0.04, tint=(0.55, 0.62, 1.0), backdrop=0.8,
              sun=None, bounce=(4, (0.55, 0.62, 1.0)), lamps=1.4, fill=6, exposure=0.9)

W, D, H = 4.5, 4.5, 2.7
EYE = 1.6
CAM = (2.2, 1.4, EYE)            # between the dresser and the table, looking at the sea window
CAM_YAW = 0                       # the middle of the panorama is the sea window (+Y)

WIN_L, WIN_R, WIN_B, WIN_T = 1.325, 3.175, 0.925, 2.375     # sea window opening (layout.json: 1.85 x 1.45, sill 0.925)
HD_Y, HD_W, HD_H = 2.7, 0.9, 2.1                            # hallway door: centre, opening (hallway_build DOORS)
SD_Y, SD_W, SD_H, SD_SPLIT = 3.8, 0.9, 2.05, 1.03           # stable door to the kitchen garden
RANGE_Y0, RANGE_Y1 = 3.29, 4.44                             # the range, against the hallway wall
TABLE_C, TABLE_S = (2.35, 2.6), (1.9, 0.95, 0.77)           # the hero table: centre and size
BARO_AT = (3.85, 1.45)            # barometer and clock on the sea wall, right of the window (x, z)
CLOCK_AT = (3.85, 2.33)
CLOCK_R = 0.14

HOTSPOTS = {}


# ---------------------------------------------------------------- helpers

def hotspot(key, label, target, kind="interactive", overlay=None):
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "name"):
        objs = []
        for t in target:
            objs += meshes_of(t) or [t]
    elif hasattr(target, "name"):
        objs = meshes_of(target) or [target]
    else:
        objs = []
    c = center_of(objs) if objs else list(target)
    HOTSPOTS[key] = {"label": label, "type": kind, "overlay": overlay, "center": [round(v, 3) for v in c],
                     "objects": [o.name for o in objs]}


def frame_matrix(origin, normal, right):
    """4x4 matrix whose local X = right, Y = up, Z = normal (pointing out of the wall)."""
    n, r = Vector(normal).normalized(), Vector(right).normalized()
    up = n.cross(r)
    m = Matrix((r, up, n)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def group(name, matrix, parts):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = matrix
    bpy.context.view_layer.update()
    return root


def mesh_obj(name, verts, faces, material, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    if material:
        o.data.materials.append(material)
    return o


def lathe(name, profile, material, loc, segs=40, thick=0.0, cap=True, scale=(1, 1, 1)):
    """A turned shape (bowl, jug, plate, kettle) from a (radius, height) profile, bottom first."""
    verts, faces = [], []
    for r, z in profile:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            verts.append((r * math.cos(a) * scale[0], r * math.sin(a) * scale[1], z * scale[2]))
    for k in range(len(profile) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    if cap and profile[0][0] > 0:
        verts.append((0, 0, profile[0][1] * scale[2]))
        c = len(verts) - 1
        faces += [(c, (i + 1) % segs, i) for i in range(segs)]
    o = mesh_obj(name, verts, faces, material)
    o.location = loc
    if thick:
        o.modifiers.new("thick", "SOLIDIFY").thickness = thick
    return o


def frames(points):
    """Parallel-transport frames along a polyline: (point, tangent, normal, binormal)."""
    out = []
    pts = [Vector(p) for p in points]
    t = (pts[1] - pts[0]).normalized()
    n = t.orthogonal().normalized()
    for i, p in enumerate(pts):
        t_new = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = (n - t_new * n.dot(t_new)).normalized()
        out.append((p, t_new, n, t_new.cross(n)))
    return out


def smooth_path(ctrl, n=40):
    """Catmull-Rom through control points."""
    c = [Vector(p) for p in ctrl]
    c = [c[0] * 2 - c[1]] + c + [c[-1] * 2 - c[-2]]
    out = []
    for i in range(1, len(c) - 2):
        p0, p1, p2, p3 = c[i - 1], c[i], c[i + 1], c[i + 2]
        steps = max(2, n // (len(ctrl) - 1))
        for s in range(steps):
            t = s / steps
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(c[-2])
    return out


def tube(name, ctrl, radius, material, segs=24, n=40, open_end=False, petals=0, petal_amp=0.0):
    """A tube along a smoothed path. radius(t) for t 0..1; petals adds scallops toward the end (the horn's bell)."""
    pts = smooth_path(ctrl, n)
    fr = frames(pts)
    verts, faces = [], []
    for k, (p, t, nn, bb) in enumerate(fr):
        u = k / (len(fr) - 1)
        r = radius(u)
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r * (1 + petal_amp * u ** 3 * math.cos(petals * a)) if petals else r
            verts.append(tuple(p + (nn * math.cos(a) + bb * math.sin(a)) * rr))
    for k in range(len(fr) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    o = mesh_obj(name, verts, faces, material)
    if open_end:
        o.modifiers.new("thick", "SOLIDIFY").thickness = 0.0025
    return o


def leaf(name, base, direction, length, width, material, crinkle=0.012, curl=0.3, seed=0, nx=8, ny=14):
    """A leaf (kale, beet top, herb) as a bent, crinkled strip, from base along direction."""
    rnd = random.Random(seed)
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()
    ph = rnd.uniform(0, 6)
    verts, faces = [], []
    for j in range(ny):
        t = j / (ny - 1)
        w = width * math.sin(math.pi * min(1, t * 1.05)) ** 0.7
        for i in range(nx):
            s = i / (nx - 1) * 2 - 1
            bend = curl * t * t * length                    # droops toward the tip
            ripple = crinkle * math.sin(9 * s + ph) * math.sin(13 * t + ph) * (0.3 + abs(s))
            cup = 0.25 * w * s * s
            p = Vector(base) + d * (t * length) + side * (s * w / 2) - up * bend + up * (ripple + cup)
            verts.append(tuple(p))
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    o = mesh_obj(name, verts, faces, material)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.0015
    return o


def color_noise_mat(name, dark, light, rough=0.6, scale=40, bump=0.3, sss=0.0):
    """A material whose colour wanders between two hexes (bread crust, soil, oats)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = rough
    p.inputs["Subsurface Weight"].default_value = sss
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = srgb(dark)
    ramp.color_ramp.elements[1].color = srgb(light)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    if bump:
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    return m


def bumpy(o, strength=0.012, size=0.08, subsurf=1):
    tex = bpy.data.textures.new(f"{o.name}_noise", "CLOUDS")
    tex.noise_scale = size
    if subsurf:
        o.modifiers.new("smooth", "SUBSURF").levels = subsurf
    d = o.modifiers.new("lumpy", "DISPLACE")
    d.texture = tex
    d.strength = strength
    d.texture_coords = "GLOBAL"
    return o


def wall_plane(name, center, size, normal, material):
    """A flat picture facing along normal ('-x', '-y', '+y', '+x')."""
    rot = {"-y": (math.radians(90), 0, 0), "+y": (math.radians(90), 0, math.radians(180)),
           "-x": (math.radians(90), 0, math.radians(90)), "+x": (math.radians(90), 0, math.radians(-90))}[normal]
    bpy.ops.mesh.primitive_plane_add(size=1, location=center, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    return o


def backdrop(name, path, center, size, normal, strength):
    o = wall_plane(name, center, size, normal, emission_mat(name, path, strength))
    o.visible_shadow = False
    return o


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rnd = random.Random(6)

    # Materials: the Inn's scans (same as Cuddlecore and the hallway), coloured from ChatGPT's notes and
    # moodboard (09), not from its very orange room frames
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#efe7d6"), tint_mix=0.85, bump=0.6)
    floor = pbr("floor", "old_wooden_floor_01", 2.5, tint=srgb("#8e6640"), tint_mix=0.3, rough_add=0.15, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#7a5536"), tint_mix=0.45, rot_z=90)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#a57543"), tint_mix=0.35, rot_z=90)
    honey = pbr("honey_oak", "wood_table_worn", 1.2, tint=srgb("#b18451"), tint_mix=0.35)
    pine = pbr("scrubbed_pine", "wood_table_worn", 1.4, tint=srgb("#c6a171"), tint_mix=0.55, rough_add=0.15, rot_z=90)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    door_cream = pbr("door_cream", "worn_planks", 1.2, tint=srgb("#e6dcc4"), tint_mix=0.8, rough_add=0.1)
    walnut = pbr("walnut", "wood_table_worn", 0.6, tint=srgb("#6b4128"), tint_mix=0.6)
    trug_wood = pbr("trug_wood", "wood_table_worn", 0.5, tint=srgb("#aa8253"), tint_mix=0.5, rough_add=0.1, rot_z=90)
    jute = pbr("jute", "rough_linen", 0.3, tint=srgb("#a88a5c"), tint_mix=1.0, bump=1.2)
    marigold_linen = pbr("marigold_linen", "rough_linen", 0.5, tint=srgb("#d9a441"), tint_mix=1.0, bump=0.5)
    runner_mat = image_mat("runner", os.path.join(PACK, "11-runner-tile.png"), rough=0.92, tile=0.42,
                           normal_from="rough_linen", normal_strength=0.5)
    towel_mat = image_mat("tea_towel", os.path.join(PACK, "12-tea-towel-tile.png"), rough=0.92, tile=0.25,
                          normal_from="rough_linen", normal_strength=0.5)

    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    dresser_paint = pbr("dresser_paint", "wood_table_worn", 1.2, tint=srgb("#e9dfc9"), tint_mix=0.88, rough_add=0.1)
    enamel = mat("enamel", srgb("#eee5d2"), rough=0.3, coat=0.6)
    cast_iron = mat("cast_iron", srgb("#292923"), rough=0.72, metal=0.75)
    iron = mat("iron", srgb("#2a2622"), rough=0.6, metal=0.8)
    brass = mat("brass", srgb("#b07f52"), rough=0.38, metal=1.0)
    brass_worn = mat("brass_worn", srgb("#bd9655"), rough=0.3, metal=1.0)
    copper = color_noise_mat("copper", "#8a4f30", "#c07a4c", rough=0.38, scale=6, bump=0.05)
    copper.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    chrome = mat("chrome", srgb("#c9c6bf"), rough=0.25, metal=1.0)
    glass = mat("jar_glass", (0.96, 0.98, 0.97, 1), rough=0.03, transmission=1.0, ior=1.5)
    cream_glaze = mat("cream_glaze", srgb("#efe6d2"), rough=0.3, coat=0.3)
    marigold_glaze = mat("marigold_glaze", srgb("#d9a441"), rough=0.28, coat=0.4)
    green_glaze = mat("green_glaze", srgb("#68754a"), rough=0.3, coat=0.3)
    stoneware = mat("stoneware", srgb("#ddd0b5"), rough=0.45)
    vinyl = mat("record", srgb("#111111"), rough=0.25)
    label_mat = mat("record_label", srgb("#d9a441"), rough=0.6)
    card = mat("card", srgb("#efe6d2"), rough=0.9)
    ink = mat("ink", srgb("#2c2416"), rough=0.6)
    flame = mat("flame", (1, 0.6, 0.25, 1), emission=(1.0, 0.55, 0.2, 1), strength=30)
    bulb = mat("bulb", (1, 0.85, 0.6, 1), emission=(1.0, 0.72, 0.42, 1), strength=18 if WX["lamps"] else 0.0)
    crust = color_noise_mat("crust", "#7e431c", "#c98f4e", rough=0.7, scale=25, bump=0.4)
    flour = mat("flour", srgb("#eee8dc"), rough=0.95)
    egg_mats = [mat(f"egg_{i}", srgb(c), rough=0.5) for i, c in enumerate(("#b67e55", "#a86f48", "#c29169", "#9c6640"))]
    oats = color_noise_mat("oats", "#bfa476", "#e2cfa3", rough=0.85, scale=90, bump=0.6)
    soil = color_noise_mat("soil", "#2c2416", "#514331", rough=0.95, scale=60, bump=0.5)
    kale = color_noise_mat("kale", "#1f3520", "#3f5e35", rough=0.55, scale=30, bump=0.4, sss=0.1)
    greens = color_noise_mat("greens", "#3f6b2a", "#6f9a3c", rough=0.5, scale=25, bump=0.2, sss=0.15)
    carrot = color_noise_mat("carrot", "#b9541c", "#d9772e", rough=0.6, scale=50, bump=0.3, sss=0.2)
    beet = color_noise_mat("beetroot", "#3e0f1c", "#6e1f2e", rough=0.55, scale=40, bump=0.3)
    beet_stem = mat("beet_stem", srgb("#8a2a3c"), rough=0.5)
    bean = mat("bean", srgb("#4f7a2c"), rough=0.45)

    window = window_glass("glass_sea", wet=WX["wet"])

    # ---- Shell. The sea and garden walls are outside walls (0.3 m), the hallway and front walls inside (0.15 m)
    box_span("floor", -0.3, W + 0.3, -0.3, D + 0.3, -0.1, 0, floor)
    box_span("ceiling", -0.3, W + 0.3, -0.3, D + 0.3, H, H + 0.1, plaster)
    box_span("wall_front", -0.15, W + 0.3, -0.15, 0, 0, H, plaster)
    # hallway wall with the door opening
    for y0, y1 in ((-0.15, HD_Y - HD_W / 2), (HD_Y + HD_W / 2, D + 0.3)):
        box_span(f"wall_hall_{y0:.2f}", -0.15, 0, y0, y1, 0, H, plaster)
    box_span("wall_hall_lintel", -0.15, 0, HD_Y - HD_W / 2, HD_Y + HD_W / 2, HD_H, H, plaster)
    # garden wall with the stable door opening
    for y0, y1 in ((-0.15, SD_Y - SD_W / 2), (SD_Y + SD_W / 2, D + 0.3)):
        box_span(f"wall_garden_{y0:.2f}", W, W + 0.3, y0, y1, 0, H, plaster)
    box_span("wall_garden_lintel", W, W + 0.3, SD_Y - SD_W / 2, SD_Y + SD_W / 2, SD_H, H, plaster)
    # sea wall with the window
    for name, x0, x1, z0, z1 in (("sea_l", -0.15, WIN_L, 0, H), ("sea_r", WIN_R, W + 0.3, 0, H),
                                 ("sea_b", WIN_L, WIN_R, 0, WIN_B), ("sea_t", WIN_L, WIN_R, WIN_T, H)):
        box_span(f"wall_{name}", x0, x1, D, D + 0.3, z0, z1, plaster)
    for x in (0.75, 2.25, 3.75):
        box_span(f"beam_{x}", x - 0.09, x + 0.09, 0, D, H - 0.2, H, beam_wood, bevel=0.015)
    skirts = [("skirt_front", 0, W, 0, 0.02), ("skirt_sea_l", 0, WIN_L - 0.1, D - 0.02, D), ("skirt_sea_r", WIN_R + 0.1, W, D - 0.02, D)]
    for name, x0, x1, y0, y1 in skirts:
        box_span(name, x0, x1, y0, y1, 0, 0.16, paint, bevel=0.003)
    for y0, y1 in ((0, HD_Y - HD_W / 2 - 0.08), (HD_Y + HD_W / 2 + 0.08, RANGE_Y0)):
        box_span(f"skirt_hall_{y0:.2f}", 0, 0.02, y0, y1, 0, 0.16, paint, bevel=0.003)
    box_span("skirt_garden", W - 0.02, W, 0, SD_Y - SD_W / 2 - 0.08, 0, 0.16, paint, bevel=0.003)

    # ---- Sea wall: timber double sash, six main lights, a sunny ledge with three pots of herbs
    wy = D + 0.2
    zc = (WIN_B + WIN_T) / 2
    xc = (WIN_L + WIN_R) / 2
    ww = WIN_R - WIN_L
    for name, x0, x1, y0, y1, z0, z1 in (("reveal_l", WIN_L - 0.002, WIN_L, D, wy, WIN_B, WIN_T),
                                          ("reveal_r", WIN_R, WIN_R + 0.002, D, wy, WIN_B, WIN_T)):
        box_span(name, x0, x1, y0, y1, z0, z1, paint)
    ledge = box_span("ledge", WIN_L - 0.1, WIN_R + 0.1, D - 0.33, wy - 0.04, WIN_B - 0.045, WIN_B, honey, bevel=0.006)
    box_span("ledge_apron", WIN_L - 0.06, WIN_R + 0.06, D - 0.3, D - 0.27, WIN_B - 0.13, WIN_B - 0.045, honey, bevel=0.004)
    for x in (WIN_L + 0.03, WIN_R - 0.03):
        box(f"sash_frame_{x:.2f}", (x, wy, zc), (0.06, 0.08, WIN_T - WIN_B), paint)
    box("sash_frame_t", (xc, wy, WIN_T - 0.03), (ww, 0.08, 0.06), paint)
    box("sash_frame_b", (xc, wy, WIN_B + 0.03), (ww, 0.08, 0.06), paint)
    box("sash_meeting", (xc, wy, zc), (ww, 0.07, 0.05), paint)
    for x in (WIN_L + ww / 3, WIN_L + 2 * ww / 3):
        box(f"sash_muntin_{x:.2f}", (x, wy, zc), (0.025, 0.05, WIN_T - WIN_B), paint)
    box("sash_latch", (xc, wy - 0.045, zc + 0.03), (0.07, 0.02, 0.012), brass_worn, bevel=0.003)
    pane = box("glass_sea_pane", (xc, wy + 0.01, zc), (ww, 0.006, WIN_T - WIN_B), window, bevel=0)
    pane.visible_shadow = False
    # The view outside: plate horizon 61% down, at eye height
    bd_w, bd_h = 13.5, 4.5
    bd_top = EYE + 0.61 * bd_h
    backdrop("view_sea", os.path.join(PACK, WX["sea"]), (xc, D + 4.2, bd_top - bd_h / 2), (bd_w, bd_h), "-y", WX["backdrop"])
    hotspot("fl-window", "The sea", pane, kind="ambient")
    herbs = []
    for i, (x, s, r) in enumerate(((2.55, 0.3, 30), (2.8, 0.26, 140), (3.02, 0.32, 260))):
        herbs.append(model("potted_plant_02", (x, D - 0.14, WIN_B), rot_z=r, scale=s))
    hotspot("fl-herbs", "The herbs", herbs, kind="ambient")

    # Barometer (turning it changes the weather), as in Cuddlecore; this one faces into the room from the sea wall
    bx_, bz_ = BARO_AT
    face_y = D - 0.05
    rx = (math.radians(90), 0, 0)
    cyl("baro_case", (bx_, D - 0.025, bz_), 0.15, 0.05, oak, bevel=0.012, rot=rx)
    box("baro_neck", (bx_, D - 0.025, bz_ + 0.27), (0.11, 0.045, 0.34), oak, bevel=0.012)
    cyl("baro_finial", (bx_, D - 0.025, bz_ + 0.46), 0.055, 0.045, oak, bevel=0.01, rot=rx)
    cyl("baro_hygro_face", (bx_, face_y + 0.002, bz_ + 0.46), 0.04, 0.004, card, rot=rx)
    cyl("baro_face", (bx_, face_y, bz_), 0.122, 0.004, card, rot=rx)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.124, minor_radius=0.008, location=(bx_, face_y - 0.002, bz_), rotation=rx)
    bpy.context.active_object.data.materials.append(brass)

    def on_face(angle_deg, radius, dy=0.0):
        a = math.radians(angle_deg)
        loc = (bx_ + radius * math.sin(a), face_y - 0.003 - dy, bz_ + radius * math.cos(a))
        rot = (Matrix.Rotation(a, 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "X")).to_euler()
        return loc, rot

    for word, ang in (("STORMY", -60), ("RAIN", -30), ("CHANGE", 0), ("FAIR", 30), ("VERY DRY", 60)):
        curve = bpy.data.curves.new(f"baro_{word}", "FONT")
        curve.body, curve.align_x, curve.align_y, curve.size = word, "CENTER", "CENTER", 0.016
        t = bpy.data.objects.new(f"baro_{word}", curve)
        t.location, t.rotation_euler = on_face(ang, 0.088)
        t.data.materials.append(ink)
        scene.collection.objects.link(t)
        tick, trot = on_face(ang, 0.108)
        tk = box(f"baro_tick_{word}", tick, (0.002, 0.002, 0.012), ink, bevel=0)
        tk.rotation_euler = trot
    needle_loc, needle_rot = on_face(WX["dial"], 0.045, dy=0.004)
    needle = box("baro_needle", needle_loc, (0.004, 0.002, 0.095), cast_iron, bevel=0)
    needle.rotation_euler = needle_rot
    cyl("baro_pin", (bx_, face_y - 0.008, bz_), 0.008, 0.006, brass, rot=rx)
    hotspot("fl-barometer", "The weather", [needle], kind="weather", overlay="weather")

    # Wall clock above it: no hands, the viewer draws them live (flourish-world.json "clock")
    ccx, ccz = CLOCK_AT
    cyl("clock_case", (ccx, D - 0.02, ccz), CLOCK_R + 0.022, 0.04, oak, bevel=0.01, rot=rx)
    fy = D - 0.042
    cface = cyl("clock_face", (ccx, fy, ccz), CLOCK_R, 0.004, card, rot=rx)
    bpy.ops.mesh.primitive_torus_add(major_radius=CLOCK_R + 0.004, minor_radius=0.006, location=(ccx, fy - 0.002, ccz), rotation=rx)
    bpy.context.active_object.data.materials.append(brass)
    for i in range(12):
        a = math.radians(i * 30)
        long = i % 3 == 0
        tick = box(f"clock_tick_{i}", (ccx + CLOCK_R * 0.84 * math.sin(a), fy - 0.0025, ccz + CLOCK_R * 0.84 * math.cos(a)),
                   (0.004 if not long else 0.007, 0.002, 0.012 if not long else 0.022), ink, bevel=0)
        tick.rotation_euler = (0, a, 0)            # seen from the room (looking +Y), clockwise from 12
    cyl("clock_pin", (ccx, fy - 0.005, ccz), 0.006, 0.006, brass, rot=rx)
    hotspot("fl-clock", "The time", [cface], kind="time", overlay="time")

    # Brass wall lamp left of the window, over the end of the range
    def wall_lamp(name, at, normal, watts):
        n = Vector(normal)
        right = Vector((0, 0, 1)).cross(n)
        parts = [cyl(f"{name}_plate", (0, 0, 0.008), 0.05, 0.016, brass, bevel=0.003),
                 cyl(f"{name}_arm", (0, 0.04, 0.11), 0.008, 0.2, brass),
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
        if watts:
            point_light(f"{name}_light", Vector(at) + n * 0.22 + Vector((0, 0, 0.1)), watts, (1.0, 0.68, 0.4), radius=0.04)
        return g

    wall_lamp("range_lamp", (0.98, D, 1.75), (0, -1, 0), 26 * WX["lamps"])

    # ---- Hallway wall: the oak four-panel door (closed; the hallway side has the dial), then the range
    lw, lh, lt = HD_W - 0.02, HD_H - 0.03, 0.045
    hy0 = HD_Y - HD_W / 2 + 0.01
    lx = -0.075                                    # the leaf sits in the middle of the wall, as in the hallway build
    door_parts = [box_span("hall_leaf", lx - lt / 2, lx + lt / 2, hy0, hy0 + lw, 0.012, 0.012 + lh, door_oak, bevel=0.004)]
    fx = lx + lt / 2
    for py in (0.235, lw - 0.235):
        for pz0, pz1 in ((0.2, 0.95), (1.12, 1.95)):
            door_parts.append(box_span(f"hall_panel_{py}_{pz0}", fx, fx + 0.006, hy0 + py - 0.14, hy0 + py + 0.14,
                                       pz0 + 0.02, pz1 - 0.02, door_oak, bevel=0.008))
            for nm, a0, a1, b0, b1 in (("l", py - 0.17, py - 0.145, pz0, pz1), ("r", py + 0.145, py + 0.17, pz0, pz1),
                                       ("b", py - 0.17, py + 0.17, pz0, pz0 + 0.025), ("t", py - 0.17, py + 0.17, pz1 - 0.025, pz1)):
                door_parts.append(box_span(f"hall_mould_{py}_{pz0}_{nm}", fx, fx + 0.014, hy0 + a0, hy0 + a1, b0, b1,
                                           door_dark, bevel=0.005))
    door_parts.append(cyl("hall_knob", (fx + 0.035, hy0 + lw - 0.07, 1.0), 0.028, 0.05, brass_worn, rot=(0, math.radians(90), 0)))
    for name, y0, y1, z0, z1 in (("a", HD_Y - HD_W / 2 - 0.08, HD_Y - HD_W / 2, 0, HD_H + 0.08),
                                 ("b", HD_Y + HD_W / 2, HD_Y + HD_W / 2 + 0.08, 0, HD_H + 0.08),
                                 ("t", HD_Y - HD_W / 2 - 0.08, HD_Y + HD_W / 2 + 0.08, HD_H, HD_H + 0.09)):
        box_span(f"hall_trim_{name}", 0, 0.025, y0, y1, z0, z1, paint, bevel=0.005)
    for y0, y1 in ((HD_Y - HD_W / 2, HD_Y - HD_W / 2 + 0.008), (HD_Y + HD_W / 2 - 0.008, HD_Y + HD_W / 2)):
        box_span(f"hall_jamb_{y0:.2f}", -0.15, 0, y0, y1, 0, HD_H, paint)
    box_span("hall_head", -0.15, 0, HD_Y - HD_W / 2, HD_Y + HD_W / 2, HD_H - 0.008, HD_H, paint)
    hotspot("fl-hall-door", "The hallway", door_parts, kind="door")

    # The range: large cream enamel solid-fuel range, black iron top, a kettle and a heavy pan
    ry = (RANGE_Y0 + RANGE_Y1) / 2
    rw = RANGE_Y1 - RANGE_Y0
    front = 0.7
    box_span("range_plinth", 0.03, front - 0.03, RANGE_Y0 + 0.03, RANGE_Y1 - 0.03, 0, 0.08, cast_iron, bevel=0.005)
    body = box_span("range_body", 0, front, RANGE_Y0, RANGE_Y1, 0.08, 0.9, enamel, bevel=0.035)
    box_span("range_top", -0.0, front + 0.015, RANGE_Y0 - 0.015, RANGE_Y1 + 0.015, 0.9, 0.94, cast_iron, bevel=0.008)
    for i, (yy, h_) in enumerate(((ry - 0.27, 0.31), (ry + 0.27, 0.31))):
        for row, (z, hh) in (("t", (0.66, 0.3)), ("b", (0.29, 0.3))):
            box_span(f"oven_{i}{row}", front, front + 0.02, yy - 0.24, yy + 0.24, z - hh / 2, z + hh / 2, enamel, bevel=0.018)
            box(f"latch_{i}{row}", (front + 0.03, yy + (0.17 if i == 0 else -0.17), z), (0.02, 0.06, 0.025), chrome, bevel=0.005)
            for dz in (-hh / 3, hh / 3):
                cyl(f"hinge_{i}{row}{dz:.2f}", (front + 0.02, yy + (-0.22 if i == 0 else 0.22), z + dz), 0.012, 0.05, chrome)
    cyl("range_rail", (front + 0.07, ry, 0.86), 0.012, rw - 0.05, brass, rot=(math.radians(90), 0, 0))
    for yy in (RANGE_Y0 + 0.04, RANGE_Y1 - 0.04):
        box(f"rail_bracket_{yy:.2f}", (front + 0.035, yy, 0.86), (0.07, 0.02, 0.02), brass, bevel=0.004)
    towel = box_span("range_towel", front + 0.06, front + 0.075, ry - 0.3, ry - 0.08, 0.55, 0.875, towel_mat, bevel=0.004)
    cyl("hotplate_lid_l", (0.36, ry - 0.27, 0.965), 0.17, 0.05, enamel, bevel=0.02)
    cyl("hotplate_knob_l", (0.36, ry - 0.27, 1.0), 0.02, 0.03, chrome)
    cyl("hotplate_r", (0.36, ry + 0.27, 0.946), 0.17, 0.012, cast_iron, bevel=0.003)
    # kettle on the near plate's lid, heavy cast-iron pan on the hot plate
    kettle_body = lathe("kettle", [(0.0, 0), (0.08, 0.0), (0.105, 0.03), (0.11, 0.07), (0.095, 0.12), (0.05, 0.15),
                                   (0.03, 0.16), (0.0, 0.165)], brass, (0.36, ry - 0.27, 0.99))
    tube("kettle_spout", [(0.36 + 0.07, ry - 0.27, 1.03), (0.36 + 0.14, ry - 0.27, 1.08), (0.36 + 0.17, ry - 0.27, 1.13)],
         lambda u: 0.018 - 0.008 * u, brass, segs=16, n=12)
    tube("kettle_handle", [(0.36 - 0.06, ry - 0.27, 1.13), (0.36, ry - 0.27, 1.23), (0.36 + 0.06, ry - 0.27, 1.13)],
         lambda u: 0.009, walnut, segs=12, n=16)
    pan = lathe("pan", [(0.0, 0.0), (0.14, 0.0), (0.155, 0.05), (0.15, 0.052)], cast_iron, (0.38, ry + 0.27, 0.952), thick=0.006)
    box("pan_handle", (0.62, ry + 0.27, 0.99), (0.2, 0.03, 0.02), cast_iron, bevel=0.006).rotation_euler = (0, math.radians(-12), 0)
    # plaster hood over the range, a copper-pan rail under it
    box_span("hood_low", 0, 0.62, RANGE_Y0 - 0.06, RANGE_Y1 + 0.06, 1.98, 2.12, plaster, bevel=0.02)
    box_span("hood_high", 0, 0.42, RANGE_Y0 + 0.02, RANGE_Y1 - 0.02, 2.12, H, plaster, bevel=0.01)
    box_span("hood_shelf", 0, 0.66, RANGE_Y0 - 0.08, RANGE_Y1 + 0.08, 1.96, 1.99, honey, bevel=0.005)
    cyl("pan_rail", (0.09, ry, 1.86), 0.011, rw - 0.02, copper, rot=(math.radians(90), 0, 0))
    for yy in (RANGE_Y0 + 0.02, RANGE_Y1 - 0.02):
        box(f"pan_rail_bracket_{yy:.2f}", (0.045, yy, 1.86), (0.09, 0.015, 0.015), iron, bevel=0.003)
    pans = []
    for i, (r, dpt) in enumerate(((0.07, 0.06), (0.085, 0.07), (0.1, 0.075), (0.09, 0.07), (0.075, 0.06))):
        yy = RANGE_Y0 + 0.14 + i * (rw - 0.28) / 4
        hang = 1.86 - 0.24 - r                     # handle up to the rail, the pan below it, base to the room
        p = lathe(f"copper_pan_{i}", [(0.0, 0.0), (r, 0.0), (r + 0.006, dpt), (r + 0.004, dpt + 0.002)], copper,
                  (0.04, yy, hang), thick=0.003)
        p.rotation_euler = (0, math.radians(-90), 0)   # open side to the wall
        p.location.x = 0.04 + dpt
        pans.append(p)
        pans.append(box(f"copper_pan_handle_{i}", (0.06, yy, hang + r + 0.11), (0.016, 0.022, 0.22), iron, bevel=0.005))
        cyl(f"pan_hook_{i}", (0.08, yy, 1.835), 0.004, 0.05, iron, verts=8, bevel=0)
    hotspot("fl-range", "The range", [body, kettle_body, pan] + pans, kind="ambient")
    model("wooden_cutting_board", (0.33, RANGE_Y1 + 0.0, 1.99), rot_z=90)
    for k, x in enumerate((0.2, 0.4)):
        model("jug_01", (x, RANGE_Y0 + 0.05 + k * 0.12, 1.99), rot_z=90 + 40 * k, scale=0.7)

    # jute runner in front of the range
    box_span("jute_rug", 0.78, 1.38, 3.25, 4.35, 0, 0.01, jute, bevel=0.004)

    # ---- Garden wall: the stable door, lower leaf shut, upper leaf open, the garden beyond
    sy0, sy1 = SD_Y - SD_W / 2, SD_Y + SD_W / 2
    for y0, y1 in ((sy0, sy0 + 0.01), (sy1 - 0.01, sy1)):
        box_span(f"sd_jamb_{y0:.2f}", W, W + 0.3, y0, y1, 0, SD_H, paint)
    box_span("sd_head", W, W + 0.3, sy0, sy1, SD_H - 0.01, SD_H, paint)
    box_span("sd_threshold", W - 0.02, W + 0.3, sy0, sy1, 0, 0.025, oak, bevel=0.004)
    for name, y0, y1, z0, z1 in (("a", sy0 - 0.08, sy0, 0, SD_H + 0.08), ("b", sy1, sy1 + 0.08, 0, SD_H + 0.08),
                                 ("t", sy0 - 0.08, sy1 + 0.08, SD_H, SD_H + 0.09)):
        box_span(f"sd_trim_{name}", W - 0.025, W, y0, y1, z0, z1, paint, bevel=0.005)
    gap = mat("plank_gap", srgb("#5c5040"), rough=0.8)

    def stable_leaf(name, z0, z1, local_parts=None):
        """A leaf built at the origin: x across the door (0 at the hinge), y through it (+ = room side)."""
        parts = [box_span(f"{name}_boards", 0, SD_W - 0.02, -0.022, 0.022, z0, z1, door_cream, bevel=0.003)]
        for k in range(1, 6):
            x = k * (SD_W - 0.02) / 6
            parts.append(box_span(f"{name}_gap_{k}", x - 0.003, x + 0.003, 0.0215, 0.0235, z0 + 0.01, z1 - 0.01, gap))
        for z in (z0 + 0.12, z1 - 0.12):
            parts.append(box_span(f"{name}_ledge_{z:.2f}", 0.03, SD_W - 0.05, 0.022, 0.045, z - 0.05, z + 0.05, door_cream, bevel=0.006))
            parts.append(box_span(f"{name}_strap_{z:.2f}", -0.01, 0.42, -0.03, -0.022, z - 0.022, z + 0.022, iron, bevel=0.003))
            parts.append(box_span(f"{name}_strap_in_{z:.2f}", -0.01, 0.12, 0.045, 0.05, z - 0.02, z + 0.02, iron, bevel=0.003))
        return parts + (local_parts or [])

    # lower leaf: shut, in the outer half of the reveal; knob and latch on the room side
    low = stable_leaf("sd_low", 0.03, SD_SPLIT, [cyl("sd_knob", (SD_W - 0.12, 0.07, 0.92), 0.025, 0.05, iron, rot=(math.radians(90), 0, 0)),
                                                 box_span("sd_bolt", SD_W - 0.2, SD_W - 0.06, 0.045, 0.06, SD_SPLIT - 0.06, SD_SPLIT - 0.035, iron)])
    # local x -> world -y? The hinge is on the front side (sy0); closed, local x runs to +y and local +y faces the room (-x)
    m_closed = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4()
    m_low = m_closed.copy()
    m_low.translation = Vector((W + 0.12, sy0 + 0.01, 0))
    low_g = group("sd_lower", m_low, low)
    # upper leaf: swung into the room on its hinge, about 150 degrees, so it stands off the wall by the door
    up = stable_leaf("sd_up", SD_SPLIT + 0.005, SD_H - 0.02)
    m_up = Matrix.Rotation(math.radians(150), 4, "Z") @ m_closed
    m_up.translation = Vector((W - 0.01, sy0 + 0.01, 0))
    up_g = group("sd_upper", m_up, up)
    hotspot("fl-back-door", "The garden door", meshes_of(low_g) + meshes_of(up_g), kind="door")
    # The garden through the open top: plate horizon 42% down, at eye height
    g_w, g_h = 9.0, 3.0
    backdrop("view_garden", os.path.join(PACK, WX["garden"]), (W + 3.5, 7.5, EYE + 0.42 * g_h - g_h / 2), (g_w, g_h), "-x",
             WX["backdrop"])
    box_span("garden_step", W + 0.3, W + 1.0, sy0 - 0.2, sy1 + 0.2, -0.12, -0.05, pbr("brick", "terracotta_floor_tiles", 0.8))

    # Trug of vegetables on the floor beside the door, soil still on them
    tx, ty = 4.08, 2.95
    trug = []
    a_, b_, c_ = 0.27, 0.16, 0.1
    verts, faces = [], []
    nu, nv = 28, 10
    for j in range(nv + 1):
        v = j / nv * (math.pi / 2)
        for i in range(nu):
            u = 2 * math.pi * i / nu
            verts.append((a_ * math.cos(u) * math.cos(v) * 0.6 + 0.0, b_ * math.sin(u) * math.cos(v),
                          -c_ * math.sin(v)))
    for j in range(nv):
        for i in range(nu):
            p0, p1 = j * nu + i, j * nu + (i + 1) % nu
            faces.append((p0, p1, p1 + nu, p0 + nu))
    for k in range(len(verts)):                     # rounder sides, flatter bottom: a Sussex trug
        x, y, z = verts[k]
        verts[k] = (x / 0.6 * (1 - 0.15 * (z / -c_)), y, z)
    bowl = mesh_obj("trug_bowl", verts, faces, trug_wood)
    bowl.modifiers.new("thick", "SOLIDIFY").thickness = 0.008
    bowl.location = (tx, ty, 0.14)
    bowl.rotation_euler = (0, 0, math.radians(92))
    trug.append(bowl)
    rim = tube("trug_rim", [(math.cos(2 * math.pi * k / 24) * a_, math.sin(2 * math.pi * k / 24) * b_, 0) for k in range(25)],
               lambda u: 0.009, trug_wood, segs=10, n=60)
    rim.location, rim.rotation_euler = (tx, ty, 0.14), (0, 0, math.radians(92))
    trug.append(rim)
    handle = tube("trug_handle", [(-a_ * 0.85, 0, 0.0), (-a_ * 0.6, 0, 0.22), (0, 0, 0.33), (a_ * 0.6, 0, 0.22), (a_ * 0.85, 0, 0.0)],
                  lambda u: 0.011, trug_wood, segs=10, n=30)
    handle.location, handle.rotation_euler = (tx, ty, 0.14), (0, 0, math.radians(92))
    trug.append(handle)
    for s in (-1, 1):
        trug.append(box(f"trug_foot_{s}", (tx, ty + s * 0.12, 0.02), (0.18, 0.025, 0.04), trug_wood, bevel=0.006))
    veg = []
    for i in range(5):                              # carrots with their tops, lying lengthwise
        ang = math.radians(92 + rnd.uniform(-12, 12))
        cx_, cy_ = tx + rnd.uniform(-0.05, 0.05), ty + 0.02 - i * 0.035
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.019, radius2=0.003, depth=0.17,
                                        location=(cx_, cy_, 0.16 + i * 0.004))
        c = bpy.context.active_object
        c.name = f"carrot_{i}"
        c.rotation_euler = (math.radians(rnd.uniform(70, 85)), 0, ang)
        bpy.ops.object.shade_smooth()
        c.data.materials.append(carrot)
        veg.append(c)
        tip = Vector((0, 0, 0.085))
        tip.rotate(c.rotation_euler)
        base = Vector(c.location) + tip
        for k in range(4):
            veg.append(leaf(f"carrot_top_{i}_{k}", base, (math.cos(ang + 3.3) + rnd.uniform(-0.3, 0.3), math.sin(ang + 3.3),
                                                          0.9 + rnd.uniform(0, 0.4)), 0.2, 0.035, greens, crinkle=0.006,
                            curl=0.5, seed=i * 10 + k))
    for i in range(3):                              # beetroot
        bx2, by2 = tx + rnd.uniform(-0.07, 0.07), ty - 0.1 + i * 0.07
        b = sphere(f"beet_{i}", (bx2, by2, 0.16), 0.036, beet, scale=(1, 1, 0.9))
        veg.append(b)
        for k in range(3):
            veg.append(leaf(f"beet_leaf_{i}_{k}", (bx2, by2, 0.19), (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.8, 0.8), 1.0),
                            0.22, 0.07, kale if k else greens, crinkle=0.01, curl=0.6, seed=40 + i * 5 + k))
    for i in range(6):                              # beans
        bx2, by2 = tx + 0.06 + rnd.uniform(-0.02, 0.03), ty + 0.1 + rnd.uniform(-0.04, 0.04)
        a = rnd.uniform(0, math.pi)
        veg.append(tube(f"bean_{i}", [(bx2 - 0.06 * math.cos(a), by2 - 0.06 * math.sin(a), 0.19),
                                      (bx2, by2, 0.2 + rnd.uniform(0, 0.01)), (bx2 + 0.06 * math.cos(a), by2 + 0.06 * math.sin(a), 0.19)],
                        lambda u: 0.005 * math.sin(math.pi * min(0.97, max(0.03, u))) + 0.001, bean, segs=8, n=10))
    for i in range(4):                              # kale
        veg.append(leaf(f"trug_kale_{i}", (tx - 0.05 + i * 0.03, ty - 0.18, 0.15), (rnd.uniform(-0.4, 0.4), -0.3, 1.0), 0.32, 0.11,
                        kale, crinkle=0.016, curl=0.4, seed=60 + i))
    for i in range(14):                             # loose soil
        sphere(f"soil_{i}", (tx + rnd.uniform(-0.3, 0.2), ty + rnd.uniform(-0.35, 0.35), 0.004), rnd.uniform(0.005, 0.014), soil,
               scale=(1, 1, 0.45))
    hotspot("fl-trug", "The trug", trug + veg, kind="ambient")

    # Botanical watercolour on the garden wall, toward the front corner
    art = image_mat("botanical", os.path.join(PACK, "10-botanical-flat.png"), rough=0.8)
    wall_plane("botanical", (W - 0.012, 1.55, 1.6), (0.3, 0.375), "-x", art)
    box_span("botanical_back", W - 0.01, W, 1.55 - 0.15, 1.55 + 0.15, 1.6 - 0.19, 1.6 + 0.19, oak)

    # ---- Front wall: the painted dresser, and the phonograph on its own little table at the hallway end
    dx0, dx1 = 1.6, 3.7
    base = box_span("dresser_base", dx0, dx1, 0, 0.52, 0.06, 0.86, dresser_paint, bevel=0.01)
    box_span("dresser_plinth", dx0 + 0.02, dx1 - 0.02, 0.02, 0.5, 0, 0.06, dresser_paint, bevel=0.004)
    third = (dx1 - dx0) / 3
    for i in range(3):
        x = dx0 + third * (i + 0.5)
        box_span(f"dresser_drawer_{i}", x - third / 2 + 0.03, x + third / 2 - 0.03, 0.52, 0.535, 0.67, 0.83, dresser_paint, bevel=0.006)
        cup = cyl(f"dresser_cup_{i}", (x, 0.545, 0.75), 0.03, 0.012, brass_worn, rot=(math.radians(90), 0, 0))
        box_span(f"dresser_door_{i}", x - third / 2 + 0.03, x + third / 2 - 0.03, 0.52, 0.535, 0.1, 0.63, dresser_paint, bevel=0.008)
        sphere(f"dresser_knob_{i}", (x + (0.17 if i < 2 else -0.17), 0.55, 0.45), 0.016, brass_worn)
    top = box_span("dresser_top", dx0 - 0.02, dx1 + 0.02, 0, 0.56, 0.86, 0.9, honey, bevel=0.008)
    box_span("dresser_back", dx0, dx1, 0, 0.02, 0.9, 2.2, dresser_paint)
    for x0 in (dx0, dx1 - 0.04):
        box_span(f"dresser_side_{x0:.2f}", x0, x0 + 0.04, 0, 0.3, 0.9, 2.2, dresser_paint, bevel=0.004)
    box_span("dresser_cornice", dx0 - 0.03, dx1 + 0.03, 0, 0.34, 2.2, 2.27, dresser_paint, bevel=0.01)
    shelves = []
    for z in (1.3, 1.68, 2.03):
        shelves.append(box_span(f"dresser_shelf_{z}", dx0 + 0.04, dx1 - 0.04, 0.02, 0.29, z - 0.02, z, dresser_paint, bevel=0.003))
        box_span(f"plate_rail_{z}", dx0 + 0.04, dx1 - 0.04, 0.27, 0.285, z, z + 0.03, dresser_paint, bevel=0.002)
    stock = []
    # top shelf: plates standing against the back, and two marigold jugs
    for i in range(7):
        x = dx0 + 0.2 + i * 0.13
        if i in (3,):
            continue
        p = cyl(f"plate_{i}", (x, 0.12, 2.03 + 0.12), 0.115, 0.016, cream_glaze if i % 3 else green_glaze, bevel=0.006,
                rot=(math.radians(76), 0, 0))
        stock.append(p)
    jug_profile = [(0.0, 0), (0.05, 0.0), (0.065, 0.04), (0.068, 0.09), (0.05, 0.14), (0.045, 0.17), (0.055, 0.19)]
    for i, (x, m_) in enumerate(((dx0 + 0.6, marigold_glaze), (dx1 - 0.25, marigold_glaze), (dx0 + 0.22, cream_glaze))):
        z = 2.03 if i < 2 else 1.68
        j = lathe(f"jug_{i}", jug_profile, m_, (x, 0.15, z), thick=0.004)
        handle_ = tube(f"jug_handle_{i}", [(x - 0.06, 0.15, z + 0.15), (x - 0.1, 0.15, z + 0.12), (x - 0.09, 0.15, z + 0.06), (x - 0.06, 0.15, z + 0.04)],
                       lambda u: 0.007, m_, segs=10, n=12)
        stock += [j, handle_]
    # two lower shelves: jars of grains, pulses, nuts and seeds
    fills = [("#d8c9a3", 1.68), ("#c8642a", 1.68), ("#e3cf9a", 1.68), ("#6e4a2b", 1.68), ("#7a8a3e", 1.68),
             ("#d9b13a", 1.3), ("#b07a4a", 1.3), ("#e8dcc0", 1.3), ("#4a3326", 1.3), ("#9a6b3a", 1.3)]
    xs = {1.68: [dx0 + 0.48, dx0 + 0.72, dx0 + 0.96, dx0 + 1.32, dx0 + 1.56], 1.3: [dx0 + 0.2, dx0 + 0.44, dx0 + 0.86, dx0 + 1.1, dx0 + 1.5]}
    count = {1.68: 0, 1.3: 0}
    for i, (colour, z) in enumerate(fills):
        x = xs[z][count[z]]
        count[z] += 1
        r, h = (0.06, 0.2) if i % 3 else (0.065, 0.24)
        stock.append(cyl(f"jar_{i}", (x, 0.14, z + h / 2 + 0.002), r, h, glass, bevel=0.01))
        f = color_noise_mat(f"fill_{i}", colour, colour, rough=0.9, scale=120, bump=0.8)
        next(n for n in f.node_tree.nodes if n.type == "VALTORGB").color_ramp.elements[0].color = tuple(c * 0.6 for c in srgb(colour)[:3]) + (1,)
        cyl(f"jar_fill_{i}", (x, 0.14, z + h * 0.37), r * 0.9, h * 0.7, f, bevel=0)
        cyl(f"jar_lid_{i}", (x, 0.14, z + h + 0.012), r * 0.88, 0.022, honey if i % 2 else chrome)
    for k in range(3):
        stock.append(cyl(f"green_bowl_{k}", (dx1 - 0.35, 0.14, 1.3 + 0.025 + k * 0.042), 0.1 - k * 0.012, 0.042, green_glaze, bevel=0.01))
    # on the worktop: the oil lamp (lit after dark and in grey weather), a crock of spoons, a bread crock
    lamp = model("vintage_oil_lamp", (dx1 - 0.22, 0.28, 0.9), scale=0.6)
    for o in meshes_of(lamp):
        if o.name.endswith("flame"):
            o.data.materials.clear()
            o.data.materials.append(flame if WX["lamps"] else card)
    if WX["lamps"]:
        point_light("oil_lamp_light", (dx1 - 0.22, 0.28, 0.9 + 0.33), 20 * WX["lamps"], (1.0, 0.64, 0.33), radius=0.03)
    crock = lathe("utensil_crock", [(0.0, 0), (0.06, 0), (0.065, 0.15), (0.06, 0.16)], cream_glaze, (dx0 + 0.3, 0.3, 0.9), thick=0.005)
    for k in range(4):
        a = math.radians(k * 90 + 20)
        model("wooden_spoon", (dx0 + 0.3 + 0.015 * math.cos(a), 0.3 + 0.015 * math.sin(a), 0.92), rot_z=k * 70)
    stock.append(crock)
    box_span("napkins", dx0 + 0.8, dx0 + 1.1, 0.12, 0.38, 0.9, 0.94, marigold_linen, bevel=0.01)
    hotspot("fl-dresser", "The dresser", [base, top] + shelves + stock, kind="ambient")

    # Phonograph on its side table: walnut case, black record, brass horn, a winding crank
    px, py = 0.9, 0.32
    st = model("side_table_01", (px, py, 0), rot_z=0)
    st.scale = (1.15, 1.15, 1.37)
    bpy.context.view_layer.update()
    ttop = max((o.matrix_world @ Vector(c)).z for o in meshes_of(st) for c in o.bound_box)
    yaw = math.degrees(math.atan2(CAM[0] - px, CAM[1] - py))          # the bell turns toward the room
    ph = []
    ph.append(box_span("ph_plinth", -0.23, 0.23, -0.2, 0.2, 0.02, 0.05, walnut, bevel=0.008))
    ph.append(box_span("ph_case", -0.2, 0.2, -0.18, 0.18, 0.05, 0.19, walnut, bevel=0.006))
    ph.append(box_span("ph_lid", -0.215, 0.215, -0.195, 0.195, 0.19, 0.205, walnut, bevel=0.005))
    for sx in (-1, 1):
        for sy in (-1, 1):
            ph.append(sphere(f"ph_foot_{sx}{sy}", (sx * 0.19, sy * 0.17, 0.012), 0.016, walnut, scale=(1, 1, 0.8)))
    plate = cyl("ph_badge", (0, 0.183, 0.12), 0.045, 0.004, brass_worn, rot=(math.radians(90), 0, 0))
    plate.scale = (1, 0.6, 1)
    ph.append(plate)
    ph.append(cyl("ph_platter", (0.0, 0.02, 0.212), 0.15, 0.012, iron, bevel=0.002))
    ph.append(cyl("ph_record", (0.0, 0.02, 0.22), 0.145, 0.003, vinyl, bevel=0))
    ph.append(cyl("ph_label", (0.0, 0.02, 0.2225), 0.042, 0.001, label_mat, bevel=0))
    ph.append(cyl("ph_spindle", (0.0, 0.02, 0.23), 0.004, 0.02, chrome, verts=12, bevel=0))
    # tone arm: from a post at the back right, round to the soundbox resting on the record
    ph.append(cyl("ph_post", (0.15, -0.13, 0.24), 0.018, 0.07, brass, bevel=0.003))
    ph.append(tube("ph_arm", [(0.15, -0.13, 0.27), (0.12, -0.02, 0.27), (0.08, 0.06, 0.26)], lambda u: 0.012 - 0.004 * u, brass, segs=14, n=12))
    ph.append(cyl("ph_soundbox", (0.07, 0.07, 0.25), 0.03, 0.014, brass_worn, rot=(0, math.radians(90), 0)))
    # horn: up from the post, bending forward into a scalloped bell
    horn = tube("ph_horn", [(0.15, -0.13, 0.27), (0.15, -0.16, 0.38), (0.1, -0.1, 0.5), (0.0, 0.02, 0.6), (-0.05, 0.14, 0.68)],
                lambda u: 0.016 + 0.015 * u + 0.19 * u ** 4.5, brass, segs=48, n=70, open_end=True, petals=8, petal_amp=0.07)
    ph.append(horn)
    # crank on the right side
    ph.append(cyl("ph_crank_boss", (0.205, 0.0, 0.12), 0.025, 0.012, brass, rot=(0, math.radians(90), 0)))
    ph.append(cyl("ph_crank_shaft", (0.25, 0.0, 0.12), 0.006, 0.08, brass, verts=12, rot=(0, math.radians(90), 0)))
    ph.append(box_span("ph_crank_arm", 0.285, 0.295, -0.005, 0.005, 0.12, 0.22, brass))
    ph.append(cyl("ph_crank_grip", (0.32, 0.0, 0.215), 0.012, 0.06, walnut, rot=(0, math.radians(90), 0)))
    phono = group("phonograph", Matrix.Translation((px, py, ttop)) @ Matrix.Rotation(math.radians(-yaw), 4, "Z"), ph)
    hotspot("fl-phonograph", "The phonograph", meshes_of(phono), kind="interactive")

    # ---- The hero: the scrubbed pine table in the middle, laid for a good breakfast
    cx, cy = TABLE_C
    tl, tw, th = TABLE_S
    table_top = box_span("table_top", cx - tl / 2, cx + tl / 2, cy - tw / 2, cy + tw / 2, th - 0.06, th, pine, bevel=0.012)
    for sx in (-1, 1):
        box_span(f"table_apron_x{sx}", cx + sx * (tl / 2 - 0.09) - 0.02, cx + sx * (tl / 2 - 0.09) + 0.02, cy - tw / 2 + 0.08,
                 cy + tw / 2 - 0.08, th - 0.17, th - 0.06, pine, bevel=0.004)
        box_span(f"table_apron_y{sx}", cx - tl / 2 + 0.08, cx + tl / 2 - 0.08, cy + sx * (tw / 2 - 0.09) - 0.02,
                 cy + sx * (tw / 2 - 0.09) + 0.02, th - 0.17, th - 0.06, pine, bevel=0.004)
        for sy in (-1, 1):
            lx_, ly_ = cx + sx * (tl / 2 - 0.09), cy + sy * (tw / 2 - 0.09)
            lathe(f"table_leg_{sx}{sy}", [(0.035, 0), (0.04, 0.05), (0.032, 0.12), (0.045, 0.25), (0.033, 0.38), (0.04, 0.5),
                                         (0.042, th - 0.06)], pine, (lx_, ly_, 0), segs=24)
    t_z = th
    # runner across the table toward the camera, hanging over the near edge
    rx0, rx1 = cx - 0.15 - 0.21, cx - 0.15 + 0.21
    runner = [box_span("runner_top", rx0, rx1, cy - tw / 2 - 0.004, cy + tw / 2 + 0.004, t_z, t_z + 0.003, runner_mat, bevel=0.001),
              box_span("runner_drop", rx0, rx1, cy - tw / 2 - 0.007, cy - tw / 2 - 0.004, t_z - 0.3, t_z + 0.003, runner_mat, bevel=0.001),
              box_span("runner_drop_far", rx0, rx1, cy + tw / 2 + 0.004, cy + tw / 2 + 0.007, t_z - 0.22, t_z + 0.003, runner_mat, bevel=0.001)]
    z_on = t_z + 0.003
    # bowl of brown eggs
    egg_bowl_at = (cx - 0.5, cy - 0.12)
    ebowl = lathe("egg_bowl", [(0.0, 0.0), (0.06, 0.0), (0.1, 0.03), (0.125, 0.07), (0.13, 0.085)], cream_glaze,
                  (*egg_bowl_at, z_on), thick=0.006)
    eggs = [ebowl]
    for i in range(8):
        a = i * 2.4
        r = 0.03 + 0.045 * (i % 3) / 2
        e = sphere(f"egg_{i}", (egg_bowl_at[0] + r * math.cos(a), egg_bowl_at[1] + r * math.sin(a), z_on + 0.05 + (0.02 if i > 5 else 0)),
                   0.022, egg_mats[i % 4], scale=(1, 1, 1.3))
        e.rotation_euler = (math.radians(rnd.uniform(40, 80)), 0, a)
        eggs.append(e)
    hotspot("fl-eggs", "The eggs", eggs, kind="ambient")
    # loaf on a board with a bread knife, flour on the board
    board = model("wooden_cutting_board", (cx + 0.05, cy - 0.15, z_on), rot_z=8, scale=1.05)
    loaf = sphere("loaf", (cx + 0.05, cy - 0.15, z_on + 0.06), 0.14, crust, scale=(1, 0.88, 0.55))
    bumpy(loaf, strength=0.012, size=0.05)
    for k in range(3):                              # three slashes across the top, floured
        s = box(f"loaf_score_{k}", (cx + 0.05 - 0.06 + k * 0.06, cy - 0.15, z_on + 0.135), (0.012, 0.16, 0.01), flour, bevel=0.004)
        s.rotation_euler = (0, math.radians((k - 1) * 14), math.radians(20))
    box("knife_blade", (cx + 0.12, cy - 0.27, z_on + 0.045), (0.2, 0.025, 0.002), chrome, bevel=0.001).rotation_euler = (0, 0, math.radians(-6))
    box("knife_handle", (cx - 0.02, cy - 0.26, z_on + 0.048), (0.11, 0.022, 0.016), walnut, bevel=0.005).rotation_euler = (0, 0, math.radians(-6))
    for k in range(12):
        sphere(f"flour_{k}", (cx + rnd.uniform(-0.15, 0.25), cy - 0.15 + rnd.uniform(-0.12, 0.12), z_on + 0.042), 0.008, flour,
               scale=(rnd.uniform(1, 3), rnd.uniform(1, 2), 0.15))
    # wooden bowl of kale, greens and herbs just picked
    gb_at = (cx - 0.35, cy + 0.2)
    gbowl = model("wooden_bowl_01", (*gb_at, z_on), scale=1.25)
    gs = [gbowl]
    for i in range(12):
        a = i * 2.39996
        d_ = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0))
        gs.append(leaf(f"bowl_kale_{i}", (gb_at[0] + 0.04 * math.cos(a), gb_at[1] + 0.04 * math.sin(a), z_on + 0.04), d_,
                       rnd.uniform(0.24, 0.34), rnd.uniform(0.08, 0.12), kale if i % 3 else greens, crinkle=0.016, curl=0.9,
                       seed=100 + i))
    for i in range(10):
        a = rnd.uniform(0, 6.28)
        gs.append(leaf(f"bowl_herb_{i}", (gb_at[0] + 0.08 * math.cos(a), gb_at[1] + 0.08 * math.sin(a), z_on + 0.05),
                       (math.cos(a), math.sin(a), 0.7), 0.12, 0.03, greens, crinkle=0.004, curl=0.6, seed=200 + i))
    hotspot("fl-greens", "The greens", gs, kind="ambient")
    # bowl of oats and seeds, a few spilled
    ob_at = (cx + 0.5, cy - 0.05)
    obowl = lathe("oat_bowl", [(0.0, 0.0), (0.055, 0.0), (0.1, 0.035), (0.12, 0.08), (0.125, 0.09)], stoneware, (*ob_at, z_on), thick=0.006)
    oat_fill = cyl("oat_fill", (*ob_at, z_on + 0.072), 0.112, 0.012, oats, bevel=0.006)
    bumpy(oat_fill, strength=0.006, size=0.02, subsurf=2)
    for k in range(40):
        sphere(f"oat_{k}", (ob_at[0] + rnd.uniform(-0.3, 0.15), ob_at[1] + rnd.uniform(-0.3, 0.05), z_on + 0.002), 0.006, oats,
               scale=(1.4, 1, 0.25)).rotation_euler = (0, 0, rnd.uniform(0, 3))
    # marigold jug, cream mugs, plates, napkins
    tj = lathe("table_jug", jug_profile, marigold_glaze, (cx - 0.78, cy + 0.15, z_on), thick=0.004, scale=(1.1, 1.1, 1.15))
    tube("table_jug_handle", [(cx - 0.85, cy + 0.15, z_on + 0.17), (cx - 0.9, cy + 0.15, z_on + 0.13), (cx - 0.88, cy + 0.15, z_on + 0.07),
                              (cx - 0.85, cy + 0.15, z_on + 0.05)], lambda u: 0.008, marigold_glaze, segs=10, n=12)
    for k, (mx, my) in enumerate(((cx - 0.7, cy - 0.15), (cx + 0.3, cy + 0.28))):
        lathe(f"mug_{k}", [(0.0, 0), (0.04, 0), (0.042, 0.09), (0.043, 0.095)], cream_glaze, (mx, my, z_on), thick=0.004)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.025, minor_radius=0.006, location=(mx + 0.05, my, z_on + 0.05),
                                         rotation=(math.radians(90), 0, 0))
        bpy.context.active_object.data.materials.append(cream_glaze)
    for k in range(3):
        cyl(f"table_plate_{k}", (cx + 0.6, cy + 0.27, z_on + 0.008 + k * 0.016), 0.12, 0.014, cream_glaze, bevel=0.006)
    box_span("table_napkins", cx + 0.48, cx + 0.74, cy + 0.17, cy + 0.37, z_on + 0.052, z_on + 0.07, marigold_linen, bevel=0.006)
    hotspot("fl-table", "The table", [table_top] + runner, kind="submit")

    # Four mismatched chairs
    c1 = model("dining_chair_02", (cx - 0.45, cy + tw / 2 + 0.28, 0), rot_z=4)
    c2 = model("painted_wooden_chair_01", (cx + 0.45, cy + tw / 2 + 0.3, 0), rot_z=-7)
    retint(c2, "#8a6a48", lo=0.6, hi=1.15)
    c3 = model("gallinera_chair", (cx - tl / 2 - 0.32, cy - 0.05, 0), rot_z=92)
    c4 = model("dining_chair_02", (cx + tl / 2 + 0.28, cy + 0.08, 0), rot_z=-84)
    retint(c4, "#6e4a2b", lo=0.6, hi=1.2)

    # ---- Light: the weather through the sea window and the open door, the lamps when it's grey or dark
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "kloofendal_overcast_puresky.hdr"))
    tint = wnt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (*WX["tint"], 1)
    wnt.links.new(env.outputs["Color"], tint.inputs[6])
    wnt.links.new(tint.outputs[2], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = WX["sky"]
    if WX["sun"]:
        watts, colour, elev, azim = WX["sun"]
        sun = bpy.data.lights.new("sun", "SUN")
        sun.energy, sun.color, sun.angle = watts, colour, math.radians(1.2)
        so = bpy.data.objects.new("sun", sun)
        # the low morning sun from the garden side, a little toward the sea: in at the open door and across the table
        e, a = math.radians(elev), math.radians(azim)
        d = Vector((-math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), -math.sin(e)))
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(so)
    # portals and soft fills, facing into the room
    area_light("sea_portal", (xc, wy, zc), (math.radians(-90), 0, 0), (ww, WIN_T - WIN_B), 0, (1, 1, 1), portal=True)
    b1 = area_light("sea_bounce", (xc, D - 0.05, zc), (math.radians(-90), 0, 0), (1.7, 1.3), WX["bounce"][0], WX["bounce"][1])
    b1.visible_camera = b1.visible_glossy = False
    door_z = (SD_SPLIT + SD_H) / 2
    area_light("door_portal", (W + 0.28, SD_Y, door_z), (0, math.radians(90), 0), (SD_H - SD_SPLIT, SD_W), 0, (1, 1, 1), portal=True)
    b2 = area_light("door_bounce", (W - 0.05, SD_Y, door_z), (0, math.radians(90), 0), (SD_H - SD_SPLIT, SD_W - 0.1),
                    WX["bounce"][0] * 0.5, WX["bounce"][1])
    b2.visible_camera = b2.visible_glossy = False
    point_light("warm_fill", (2.3, 1.8, 2.35), WX["fill"], (1.0, 0.7, 0.45), radius=0.8)

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
    scene.view_settings.exposure = WX["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def visible_from(cam, hs):
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok or (obj and (obj.name in hs["objects"] or obj.name.startswith(("glass_", "view_")))):
        return True
    return (loc - origin).length > dist - 0.15


def stop_hotspots(cam):
    out = {}
    for key, hs in HOTSPOTS.items():
        yaw, pitch = look(cam, hs["center"], cam[2])
        yaw = round((yaw - CAM_YAW + 540) % 360 - 180, 2)
        out[key] = {"label": hs["label"], "type": hs["type"], "overlay": hs["overlay"], "yaw": yaw, "pitch": pitch,
                    "distance": round((Vector(hs["center"]) - Vector(cam)).length, 2), "visible": visible_from(cam, hs)}
    return out


def main():
    build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "flourish.blend"))
    scene = bpy.context.scene
    data = {"room": "flourish", "stops": {"middle": {"position": list(CAM), "hotspots": stop_hotspots(CAM)}},
            "clock": {"center": [CLOCK_AT[0], D - 0.042, CLOCK_AT[1]], "normal": [0, -1, 0], "radius": CLOCK_R, "in_render": True}}
    with open(os.path.join(OUT, "flourish_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    pano_camera(scene, CAM, CAM_YAW)
    scene.render.filepath = os.path.join(OUT, f"flourish_pano_{WEATHER}{'_night' if NIGHT else ''}{'_preview' if PREVIEW else ''}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"[whisked] rendered {WEATHER}{' night' if NIGHT else ''}")
    print("[whisked] done")


main()
