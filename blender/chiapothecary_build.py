"""
The Chiapothecary: an old herbal pharmacy in the Inn, where the wall of little drawers holds chia and everything
that goes with it, and the puddings are experiments with superpowers. Builds the room, renders a 360
equirectangular panorama per barometer reading, by day or late at night, and writes hotspot angles for the
browser viewer.

Layout from art-inbox/chiapothecary/ (ChatGPT's concept pack: notes.md, layout.json), docs/inn-floorplan.html,
the hallway (its door at the hallway's y = 2) and the glasshouse (the glazed door at y = 1.9 in its Inn wall).
Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/chiapothecary_build.py -- [--weather=rain] [--night] [--preview] [--no-render]
  ... -- --glimpse     renders the shop as the glasshouse camera sees it through the glazed door
                       (out/chiapothecary_glimpse.jpg, which glasshouse_build.py puts behind its door glass)

Axes follow layout.json: X = the hallway wall (0) to the garden wall (4.5, the Inn wall the glasshouse leans on),
Y = the lane (0) to the back wall (4.5, Flourish behind it), Z = up. Metres. The front wall lines up with Sweet
Spells' across the hallway, so both shop windows look at the same lane. y is the glasshouse's y too.
The camera stands in front of the counter; the middle of the panorama looks at the wall of drawers (+Y).
"""
import bpy
import bmesh
import json
import math
import os
import random
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ART, ASSETS, CHIA_EYE, CHIA_FROM_GH, GH_EYE, GH_PLATE, GLAZED_DOOR_H, GLAZED_DOOR_W, OUT,  # noqa: E402
                     SHOP_PLATE, area_light, box, box_span, center_of, cyl, emission_mat, glazed_door, glimpse_camera,
                     glimpse_plate, image_mat, look, mat, meshes_of, model, pano_camera, pbr, plate_target, point_light,
                     sage_paint, sphere, srgb, text, use_gpu, window_glass)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS
GLIMPSE = "--glimpse" in ARGS
NIGHT = "--night" in ARGS and not GLIMPSE
WEATHER = "fair" if GLIMPSE else next((a.split("=", 1)[1] for a in ARGS if a.startswith("--weather=")), "rain")
SEASON = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--season=")), "spring")   # the glasshouse beyond

os.makedirs(OUT, exist_ok=True)
PACK = os.path.join(ART, "chiapothecary")
LANE = os.path.join(ART, "sweet-spells")             # the village lane, shared with Sweet Spells (files 14-23)
HALL = os.path.join(ART, "inn-hallway")

# One look per barometer reading, as in Sweet Spells (same lane views). sky: world strength and tint; backdrop:
# the lane's brightness; sun: (watts/m2, colour, elevation, azimuth) or None; bounce: fill from the window;
# wet: raindrops on the glass; green: daylight coming through the glazed door from the glasshouse (watts);
# beyond: the glasshouse picture's brightness; fill: warm room fill; lamps: the wall lamps (0 = off).
WEATHERS = {
    "rain":     dict(view="14-lane-rain.png", sky=1.1, tint=(1.0, 1.0, 1.0), backdrop=0.75, sun=None,
                     bounce=(55, (0.78, 0.86, 1.0)), wet=0.5, green=60, beyond=0.6, fill=5, lamps=0.6, exposure=0.2),
    "fair":     dict(view="15-lane-fair.png", sky=2.0, tint=(1.0, 0.97, 0.92), backdrop=1.05,
                     sun=(6.0, (1.0, 0.93, 0.8), 32, -35), bounce=(85, (1.0, 0.97, 0.92)), wet=0.0, green=140, beyond=1.0,
                     fill=3, lamps=0.0, exposure=0.1),
    "change":   dict(view="16-lane-change.png", sky=1.5, tint=(0.95, 0.98, 1.0), backdrop=0.85, sun=None,
                     bounce=(75, (0.92, 0.95, 1.0)), wet=0.0, green=100, beyond=0.8, fill=4, lamps=0.3, exposure=0.15),
    "stormy":   dict(view="17-lane-stormy.png", sky=0.5, tint=(0.85, 0.9, 1.0), backdrop=0.5, sun=None,
                     bounce=(26, (0.7, 0.8, 1.0)), wet=0.75, green=30, beyond=0.4, fill=5, lamps=1.0, exposure=0.3),
    "very-dry": dict(view="18-lane-very-dry.png", sky=2.3, tint=(1.0, 0.92, 0.8), backdrop=1.1,
                     sun=(7.0, (1.0, 0.86, 0.66), 26, -35), bounce=(80, (1.0, 0.92, 0.82)), wet=0.0, green=150, beyond=1.05,
                     fill=2, lamps=0.0, exposure=0.1),
}
WX = dict(WEATHERS[WEATHER])
NIGHT_VIEWS = {"rain": "19-lane-night-rain.png", "fair": "20-lane-night-fair.png", "change": "21-lane-night-change.png",
               "stormy": "22-lane-night-stormy.png", "very-dry": "23-lane-night-very-dry.png"}
if NIGHT:
    WX.update(view=NIGHT_VIEWS[WEATHER], sky=0.04, tint=(0.55, 0.62, 1.0), backdrop=0.8, sun=None,
              bounce=(4, (0.55, 0.62, 1.0)), green=0, beyond=0.06, fill=1.2, lamps=0.9, exposure=-0.05)

W, D, H = 4.5, 4.5, 2.7               # inside the room
EYE = CHIA_EYE[2]
CAM = CHIA_EYE                        # in front of the counter
CAM_YAW = 0                           # the middle of the panorama looks at the wall of drawers (+Y)
GW = 0.3                              # the garden wall is the Inn's outer wall (the glasshouse leans on it)
DOOR_Y, DOOR_W, DOOR_H = 3.4, 0.9, 2.1      # hallway door (hall side: the hallway's y = 2.0), a little ajar
AJAR = 24                                   # degrees, as the hallway shows it
DIAL_AT = (0.0, 2.62, 1.3)                  # room dial, lane side of the hallway door, as in the hallway
CD_Y = 1.9                                  # the glazed door to the glasshouse, centre (the glasshouse's y too)
WIN_X0, WIN_X1, SILL, HEAD = 1.3, 3.2, 0.95, 2.3   # the shop window in the front wall
CAB_X0, CAB_X1, CAB_D = 0.9, 3.6, 0.43              # the wall of drawers on the back wall
COLS, ROWS = 8, 5
DRAWER_Z0, DRAWER_H = 0.62, 0.29                    # bottom of the lowest drawer row, row pitch
COUNTER = (1.05, 3.45, 2.75, 3.45)                  # x0, x1, y0, y1
TOP = 0.95                                          # counter top
FRIDGE = (0.02, 0.68, 1.3, 1.96, 1.85)              # x0, x1, y0, y1, height; faces the room (+X)
CAGE = (4.5 - 0.32, 0.95, 1.32)                     # cage base centre, on its bracket beside the glazed door

# The drawers: what's in each, by (row from the bottom, column from the hallway side). The labels stay blank in the
# render; the browser can name them from this map. Open drawers show their contents.
INGREDIENTS = ["black chia", "white chia", "coconut flakes", "cacao nibs", "goji berries", "dried mango",
               "freeze-dried raspberry", "cinnamon bark", "cardamom", "vanilla pods", "matcha", "pumpkin seeds",
               "toasted oats", "buckwheat", "linseed", "hemp hearts", "dates", "sultanas", "dried apricot", "almonds",
               "hazelnuts", "pistachios", "sesame", "cacao powder", "maca", "turmeric", "ginger", "nutmeg", "star anise",
               "rose petals", "lavender", "dried blueberries", "dried cherries", "banana chips", "pineapple", "lime zest",
               "orange peel", "honey crystals", "carob", "sea salt"]
# Only rows 1 and 2 open: lower ones hide behind the counter, higher ones are above the eye and show no contents.
OPEN = {(2, 0): (0.22, "black chia"), (1, 1): (0.2, "goji berries"), (2, 3): (0.18, "white chia"),
        (1, 5): (0.21, "cacao nibs"), (2, 6): (0.19, "coconut flakes"), (1, 7): (0.17, "matcha")}

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
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = matrix
    bpy.context.view_layer.update()
    return root


# ---------------------------------------------------------------- mesh helpers (as in Sweet Spells)

def mesh_obj(name, verts, faces, material, smooth=True, recalc=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = smooth
    if material:
        o.data.materials.append(material)
    return o


def lathe(name, prof, material, loc, segs=48, wobble=None, shell=0.0):
    """A turned shape: prof is [(radius, z), ...] from the bottom up. shell > 0 gives the open surface thickness."""
    verts, faces = [], []
    for r, z in prof:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = max(r, 0.0004) * (wobble(a) if wobble else 1.0)
            verts.append((loc[0] + rr * math.cos(a), loc[1] + rr * math.sin(a), loc[2] + z))
    for k in range(len(prof) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    o = mesh_obj(name, verts, faces, material, recalc=False)
    if shell:
        o.modifiers.new("shell", "SOLIDIFY").thickness = shell
    return o


def tube(name, pts, r, material, radii=None, caps=True, res=4):
    """A smooth tube through pts (NURBS)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = caps
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for k, (pt, p) in enumerate(zip(sp.points, pts)):
        pt.co = (p[0], p[1], p[2], 1.0)
        pt.radius = radii[k] if radii else 1.0
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def berry(name, loc, r, material, seed=0):
    """A raspberry: a core with drupelets on it (one mesh)."""
    bm = bmesh.new()
    rnd = random.Random(seed)
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * 0.8, matrix=Matrix.Diagonal((1, 1, 1.15, 1)))
    n = 46
    for k in range(n):
        zf = 1 - 2 * (k + 0.5) / n
        if zf > 0.82:
            continue
        ang = k * 2.39996
        rad = math.sqrt(1 - zf * zf)
        p = Vector((r * rad * math.cos(ang), r * rad * math.sin(ang), r * 1.12 * zf)) * rnd.uniform(0.97, 1.03)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 0.3, matrix=Matrix.Translation(p))
    return _bm_obj(name, bm, material, loc, (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.28)))


def _bm_obj(name, bm, material, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = smooth
    o.location, o.rotation_euler = loc, rot
    o.data.materials.append(material)
    return o


def scatter(name, centre, half, n, size, material, seed=0, kind="seed", z_jitter=0.0, shape=(1, 1, 1), mound=0.0):
    """Many small pieces in one mesh, lying in a box of half-extents half around centre, heaped up to mound
    metres in the middle.
    kind: seed (ellipsoid), chunk (rough broken piece), flake (thin curled sliver), pod (long capsule)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    for _ in range(n):
        p = Vector((centre[0] + rnd.uniform(-half[0], half[0]), centre[1] + rnd.uniform(-half[1], half[1]),
                    centre[2] + rnd.uniform(-half[2], half[2]) + rnd.uniform(0, z_jitter)))
        if mound:
            e = ((p.x - centre[0]) / half[0]) ** 2 + ((p.y - centre[1]) / half[1]) ** 2
            p.z += mound * max(0.0, 1 - e) ** 0.5
        s = size * rnd.uniform(0.75, 1.25)
        rot = Matrix.Rotation(rnd.uniform(0, 6.28), 4, "Z") @ Matrix.Rotation(rnd.uniform(-0.5, 0.5), 4, "X")
        if kind == "seed":
            sc = Matrix.Diagonal((s * 0.7 * shape[0], s * shape[1], s * 0.45 * shape[2], 1))
            sub = 1
        elif kind == "chunk":
            sc = Matrix.Diagonal((s * rnd.uniform(0.6, 1.2), s * rnd.uniform(0.6, 1.2), s * rnd.uniform(0.4, 0.8), 1))
            sub = 0
            rot = rot @ Matrix.Rotation(rnd.uniform(0, 6.28), 4, "Y")
        elif kind == "flake":
            sc = Matrix.Diagonal((s * 0.35, s * 1.0, s * 0.05, 1))
            sub = 1
            rot = rot @ Matrix.Rotation(rnd.uniform(-1.2, 1.2), 4, "Y")
        else:                                                        # pod
            sc = Matrix.Diagonal((s * 0.38, s * 1.0, s * 0.38, 1))
            sub = 1
        before = set(bm.verts)
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=Matrix.Translation(p) @ rot @ sc)
        if kind == "chunk":                                          # break the shape up a little
            for v in set(bm.verts) - before:
                v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * s * 0.18
    return _bm_obj(name, bm, material, smooth=kind != "chunk")


# ---------------------------------------------------------------- materials

def speckle(name, base, fleck, scale=600.0, amount=0.35, rough=0.8, bump=0.3, sss=0.0, coat=0.0):
    """A surface of small grains or flecks: chia seeds, a speckled stone, chia pudding."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    rng = nt.nodes.new("ShaderNodeMapRange")                   # 1 on a fleck, 0 between them
    rng.inputs["From Min"].default_value = amount
    rng.inputs["From Max"].default_value = amount * 0.6
    nt.links.new(vor.outputs["Distance"], rng.inputs["Value"])
    big = nt.nodes.new("ShaderNodeTexNoise")                   # flecks gather a little unevenly
    big.inputs["Scale"].default_value = scale / 40
    nt.links.new(tc.outputs["Object"], big.inputs["Vector"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(rng.outputs["Result"], mul.inputs[0])
    nt.links.new(big.outputs["Fac"], mul.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(mul.outputs[0], mix.inputs["Factor"])
    mix.inputs[6].default_value = srgb(base)
    mix.inputs[7].default_value = srgb(fleck)
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    p.inputs["Subsurface Weight"].default_value = sss
    p.inputs["Coat Weight"].default_value = coat
    if bump:
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.001
        nt.links.new(vor.outputs["Distance"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    return m


def lacquer(name, hex_color):
    """Worn red-brown lacquer over wood: the drawer fronts."""
    m = pbr(name, "wood_table_worn", 0.6, tint=srgb(hex_color), tint_mix=0.62, rot_z=90, bump=0.5)
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Coat Weight"].default_value = 0.25
    p.inputs["Coat Roughness"].default_value = 0.35
    return m


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # Materials: the Inn's scans, recoloured to ChatGPT's Chiapothecary notes
    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#f4efe4"), tint_mix=0.85, bump=0.6)
    floor_m = pbr("floor", "old_wooden_floor_01", 2.5, tint=srgb("#94663c"), tint_mix=0.3, rough_add=0.12, bump=0.8)
    beam_wood = pbr("beams", "wood_table_worn", 1.5, tint=srgb("#7a5532"), tint_mix=0.45, rot_z=90)
    oak = pbr("oak", "wood_table_worn", 1.0, tint=srgb("#9b693e"), tint_mix=0.35, rot_z=90)
    counter_wood = pbr("counter_wood", "wood_table_worn", 1.2, tint=srgb("#7e4c2c"), tint_mix=0.4, rot_z=90, bump=0.8)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    red = lacquer("drawer_lacquer", "#7d3f27")
    red_b = lacquer("drawer_lacquer_b", "#8f4a2d")
    drawer_box = pbr("drawer_box", "wood_table_worn", 0.5, tint=srgb("#a97a4c"), tint_mix=0.3, rot_z=90)
    green = sage_paint("herb_green", "#5c7c5c")
    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    brass = mat("brass", srgb("#b07f52"), rough=0.42, metal=1.0)
    brass_worn = mat("brass_worn", srgb("#bd9655"), rough=0.28, metal=1.0)
    plate_brass = mat("plate_brass", srgb("#b8925a"), rough=0.35, metal=1.0)
    iron = mat("iron", srgb("#25221f"), rough=0.7, metal=0.7)
    chrome = mat("chrome", srgb("#c9c8c4"), rough=0.25, metal=1.0)
    enamel = mat("enamel", srgb("#e9e1ce"), rough=0.32, coat=0.4)
    ink = mat("engraving", srgb("#3a2a18"), rough=0.5, metal=0.6)
    glass = mat("glass", (0.97, 0.98, 0.98, 1), rough=0.02, transmission=1.0, ior=1.5)
    kraft = image_mat("kraft", os.path.join(PACK, "12-chia-botanical-kraft-tile.png"), rough=0.9, tile=0.22)
    string = mat("string", srgb("#dac8a4"), rough=0.9)
    stone = speckle("stone", "#4f4c43", "#8d887c", scale=180, amount=0.3, rough=0.85, bump=0.4)
    milk = mat("milk", srgb("#eee7d8"), rough=0.35)
    milk.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.6
    pudding = speckle("chia_pudding", "#ded5c2", "#3b352e", scale=700, amount=0.22, rough=0.4, bump=0.1, sss=0.35)
    seeds_black = speckle("seeds_black", "#34302c", "#8f877a", scale=650, amount=0.32, rough=0.55, bump=0.5)
    seeds_white = speckle("seeds_white", "#d6cfbf", "#9a917f", scale=650, amount=0.3, rough=0.6, bump=0.5)
    seed_m = mat("chia_seed", srgb("#2f2b27"), rough=0.45, coat=0.2)
    matcha = speckle("matcha", "#7d9a48", "#5d7a34", scale=300, amount=0.25, rough=0.95, bump=0.15)
    coconut = mat("coconut", srgb("#f1ead9"), rough=0.7)
    cacao = mat("cacao_nib", srgb("#3a2419"), rough=0.6)
    goji = mat("goji", srgb("#c2361e"), rough=0.45, coat=0.2)
    goji.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.3
    rasp = mat("raspberry", srgb("#b3263f"), rough=0.35)
    rasp.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.4
    mango = mat("mango", srgb("#f1a52a"), rough=0.35)
    mango.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.4
    pistachio = mat("pistachio", srgb("#8aa04a"), rough=0.6)
    layers = {"berry": mat("berry_layer", srgb("#8e1f35"), rough=0.25, coat=0.3),
              "mango": mat("mango_layer", srgb("#e8952a"), rough=0.3, coat=0.2),
              "matcha": speckle("matcha_layer", "#9cb365", "#3b352e", scale=700, amount=0.2, rough=0.45, sss=0.3),
              "cacao": speckle("cacao_layer", "#6b4330", "#2a1a12", scale=700, amount=0.22, rough=0.45, sss=0.2)}
    for lm in layers.values():
        lm.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.3

    # ---- Shell: floor, ceiling, walls with their openings, beams, skirting
    d0, d1 = DOOR_Y - DOOR_W / 2, DOOR_Y + DOOR_W / 2
    c0, c1 = CD_Y - GLAZED_DOOR_W / 2, CD_Y + GLAZED_DOOR_W / 2
    box_span("floor", -0.2, W + 0.2, -0.3, D + 0.2, -0.1, 0, floor_m)
    box_span("ceiling", -0.2, W + 0.2, -0.3, D + 0.2, H, H + 0.1, plaster)
    box_span("wall_back", -0.15, W + GW, D, D + 0.15, 0, H, plaster)
    box_span("wall_hall_a", -0.15, 0, -0.3, d0, 0, H, plaster)
    box_span("wall_hall_b", -0.15, 0, d1, D + 0.15, 0, H, plaster)
    box_span("wall_hall_over", -0.15, 0, d0, d1, DOOR_H, H, plaster)
    box_span("wall_garden_a", W, W + GW, -0.3, c0, 0, H, plaster)
    box_span("wall_garden_b", W, W + GW, c1, D + 0.15, 0, H, plaster)
    box_span("wall_garden_over", W, W + GW, c0, c1, GLAZED_DOOR_H, H, plaster)
    box_span("wall_front_l", -0.15, WIN_X0, -0.3, 0, 0, H, plaster)
    box_span("wall_front_r", WIN_X1, W + GW, -0.3, 0, 0, H, plaster)
    box_span("wall_front_under", WIN_X0, WIN_X1, -0.3, 0, 0, SILL, plaster)
    box_span("wall_front_over", WIN_X0, WIN_X1, -0.3, 0, HEAD, H, plaster)
    for i, y in enumerate((0.7, 2.25, 3.8)):
        box_span(f"beam_{i}", 0, W, y - 0.1, y + 0.1, H - 0.2, H, beam_wood, bevel=0.015)
    for name, x0, x1, y0, y1 in (("skirt_hall_a", 0, 0.02, 0, d0 - 0.08), ("skirt_hall_b", 0, 0.02, d1 + 0.08, D),
                                 ("skirt_back", 0, W, D - 0.02, D), ("skirt_front", 0, W, 0, 0.02),
                                 ("skirt_garden_a", W - 0.02, W, 0, c0 - 0.08), ("skirt_garden_b", W - 0.02, W, c1 + 0.08, D)):
        box_span(name, x0, x1, y0, y1, 0, 0.16, paint, bevel=0.003)

    # ---- The shop window: cream casements of small panes, a deep oak sill with jars of seeds
    window = window_glass("shop_glass", wet=WX["wet"])
    fw = 0.06                                                        # frame and post width
    for nm, x0, x1, z0, z1 in (("l", WIN_X0, WIN_X0 + fw, SILL, HEAD), ("r", WIN_X1 - fw, WIN_X1, SILL, HEAD),
                               ("b", WIN_X0, WIN_X1, SILL, SILL + fw), ("t", WIN_X0, WIN_X1, HEAD - fw, HEAD)):
        box_span(f"win_frame_{nm}", x0, x1, -0.12, -0.04, z0, z1, paint, bevel=0.004)
    for k in range(1, 4):                                            # four casements, each two small panes high
        x = WIN_X0 + (WIN_X1 - WIN_X0) * k / 4
        box_span(f"win_post_{k}", x - 0.025, x + 0.025, -0.12, -0.04, SILL, HEAD, paint, bevel=0.004)
    box_span("win_transom", WIN_X0, WIN_X1, -0.12, -0.04, 1.86, 1.91, paint, bevel=0.004)
    for z in (SILL + (1.86 - SILL) / 2,):
        box_span("win_bar_low", WIN_X0, WIN_X1, -0.1, -0.07, z - 0.012, z + 0.012, paint, bevel=0.003)
    for k in range(4):                                               # a thin upright bar in each light
        x = WIN_X0 + (WIN_X1 - WIN_X0) * (k + 0.5) / 4
        box_span(f"win_bar_{k}", x - 0.012, x + 0.012, -0.1, -0.07, SILL, HEAD, paint, bevel=0.003)
    pane = box_span("win_pane", WIN_X0, WIN_X1, -0.088, -0.082, SILL, HEAD, window)
    pane.visible_shadow = False
    for nm, x0, x1 in (("l", WIN_X0 - 0.07, WIN_X0), ("r", WIN_X1, WIN_X1 + 0.07)):
        box_span(f"win_trim_{nm}", x0, x1, 0, 0.02, SILL - 0.04, HEAD + 0.07, paint, bevel=0.004)
    box_span("win_trim_t", WIN_X0 - 0.07, WIN_X1 + 0.07, 0, 0.02, HEAD, HEAD + 0.07, paint, bevel=0.004)
    sill = box_span("win_sill", WIN_X0 - 0.1, WIN_X1 + 0.1, -0.04, 0.24, SILL - 0.04, SILL, oak, bevel=0.006)
    jar_fill = [seeds_black, seeds_white, speckle("oats", "#d8c39a", "#b39b70", scale=90, amount=0.4, rough=0.8),
                matcha, speckle("pumpkin", "#7f8f4c", "#5c6a34", scale=70, amount=0.4, rough=0.6), coconut,
                goji, cacao]
    for k in range(7):
        x = WIN_X0 + 0.2 + k * (WIN_X1 - WIN_X0 - 0.4) / 6
        jar(f"sill_jar_{k}", (x, 0.1, SILL), 0.045, 0.13, glass, jar_fill[k], green)
    model("potted_plant_02", (WIN_X0 + 0.04, 0.12, SILL), rot_z=40, scale=0.45)
    model("potted_plant_02", (WIN_X1 - 0.04, 0.12, SILL), rot_z=200, scale=0.4)

    # The lane outside: Sweet Spells' plate, in the same place in the world (its room x 5.55, the Inn's middle, is
    # this room's x = -1.05; both front walls are at y = 0), so the two windows look at the same lane.
    bd_w, bd_h, bd_y, bd_x = 24.0, 8.0, -7.5, -1.05
    bd_top = EYE + 0.58 * bd_h
    bpy.ops.mesh.primitive_plane_add(size=1, location=(bd_x, bd_y, bd_top - bd_h / 2),
                                     rotation=(math.radians(90), 0, math.radians(180)))
    bd = bpy.context.active_object
    bd.name = "lane_view"
    bd.scale = (bd_w, bd_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    bd.visible_shadow = False
    bd.data.materials.append(emission_mat("lane_view", os.path.join(LANE, WX["view"]), WX["backdrop"]))
    hotspot("chia-lane-window", "The lane", [pane], kind="ambient")

    # ---- The wall of drawers: forty in a herb-green case, eight across, five high, red-brown lacquer, blank
    # brass plates. Cupboards below, a shelf of big jars on top.
    cy0, cy1 = D - CAB_D, D
    top_z = DRAWER_Z0 + ROWS * DRAWER_H + 0.02
    case = [box_span("cab_side_l", CAB_X0, CAB_X0 + 0.05, cy0, cy1, 0, top_z, green, bevel=0.004),
            box_span("cab_side_r", CAB_X1 - 0.05, CAB_X1, cy0, cy1, 0, top_z, green, bevel=0.004),
            box_span("cab_back", CAB_X0, CAB_X1, cy1 - 0.02, cy1, 0, top_z, green),
            box_span("cab_plinth", CAB_X0 + 0.02, CAB_X1 - 0.02, cy0 + 0.03, cy1, 0, 0.1, green, bevel=0.003),
            box_span("cab_top", CAB_X0 - 0.04, CAB_X1 + 0.04, cy0 - 0.04, cy1, top_z, top_z + 0.05, green, bevel=0.006),
            box_span("cab_cornice", CAB_X0 - 0.06, CAB_X1 + 0.06, cy0 - 0.06, cy1, top_z + 0.05, top_z + 0.08, green, bevel=0.008),
            box_span("cab_waist", CAB_X0, CAB_X1, cy0 - 0.02, cy1, DRAWER_Z0 - 0.04, DRAWER_Z0, green, bevel=0.004)]
    # cupboards under the drawers: four doors
    for k in range(4):
        x0 = CAB_X0 + 0.05 + k * (CAB_X1 - CAB_X0 - 0.1) / 4
        x1 = x0 + (CAB_X1 - CAB_X0 - 0.1) / 4
        box_span(f"cab_door_{k}", x0 + 0.01, x1 - 0.01, cy0 - 0.01, cy0 + 0.01, 0.12, DRAWER_Z0 - 0.06, red, bevel=0.006)
        sphere(f"cab_door_knob_{k}", (x1 - 0.06 if k % 2 == 0 else x0 + 0.06, cy0 - 0.025, 0.42), 0.014, brass)
    inner0, inner1 = CAB_X0 + 0.05, CAB_X1 - 0.05
    pitch = (inner1 - inner0) / COLS
    for k in range(1, COLS):                                          # green dividers between the columns
        x = inner0 + k * pitch
        case.append(box_span(f"cab_div_v{k}", x - 0.009, x + 0.009, cy0, cy1, DRAWER_Z0, top_z, green))
    for r in range(1, ROWS):
        z = DRAWER_Z0 + r * DRAWER_H
        case.append(box_span(f"cab_div_h{r}", inner0, inner1, cy0, cy1, z - 0.009, z + 0.009, green))
    drawers, open_drawers = [], {}
    drnd = random.Random(5)
    fills = {"black chia": seeds_black, "white chia": seeds_white, "matcha": matcha}
    for r in range(ROWS):
        for c in range(COLS):
            x0 = inner0 + c * pitch + 0.012
            x1 = inner0 + (c + 1) * pitch - 0.012
            z0 = DRAWER_Z0 + r * DRAWER_H + 0.012
            z1 = DRAWER_Z0 + (r + 1) * DRAWER_H - 0.012
            out, what = OPEN.get((r, c), (drnd.choice((0.0, 0.0, 0.0, 0.004, 0.008)), None))
            fy = cy0 - out                                           # face of the drawer front
            parts = [box_span(f"drawer_{r}_{c}", x0, x1, fy, fy + 0.022, z0, z1, red if (r + c) % 3 else red_b, bevel=0.004)]
            xm = (x0 + x1) / 2
            parts.append(box_span(f"drawer_plate_{r}_{c}", xm - 0.055, xm + 0.055, fy - 0.003, fy, z1 - 0.075, z1 - 0.04, plate_brass, bevel=0.002))
            for px in (xm - 0.05, xm + 0.05):
                parts.append(sphere(f"drawer_pin_{r}_{c}_{px:.3f}", (px, fy - 0.003, z1 - 0.0575), 0.0025, brass))
            parts.append(cyl(f"drawer_knob_{r}_{c}", (xm, fy - 0.012, (z0 + z1) / 2 - 0.02), 0.016, 0.02, brass_worn,
                             rot=(math.radians(90), 0, 0), verts=24, bevel=0.004))
            parts.append(sphere(f"drawer_knob_cap_{r}_{c}", (xm, fy - 0.024, (z0 + z1) / 2 - 0.02), 0.017, brass_worn, scale=(1, 0.6, 1)))
            drawers += parts
            if out > 0.05:                                            # the open ones: sides, back, bottom, contents
                bz, by1 = z0 + 0.01, fy + 0.31
                parts += [box_span(f"drawer_side_l_{r}_{c}", x0 + 0.005, x0 + 0.016, fy + 0.02, by1, bz, z1 - 0.03, drawer_box),
                          box_span(f"drawer_side_r_{r}_{c}", x1 - 0.016, x1 - 0.005, fy + 0.02, by1, bz, z1 - 0.03, drawer_box),
                          box_span(f"drawer_back_{r}_{c}", x0 + 0.005, x1 - 0.005, by1 - 0.012, by1, bz, z1 - 0.03, drawer_box),
                          box_span(f"drawer_bottom_{r}_{c}", x0 + 0.005, x1 - 0.005, fy + 0.02, by1, bz, bz + 0.01, drawer_box)]
                fz = z1 - 0.022                                       # heaped a little above the front, so it shows
                cx, cy, hx, hy = xm, fy + 0.13, (x1 - x0) / 2 - 0.022, 0.105   # the part pulled out of the case
                if what in fills:
                    bed = box_span(f"drawer_fill_{r}_{c}", cx - hx, cx + hx, cy - hy, cy + hy, bz + 0.01, fz, fills[what], bevel=0.008)
                    heap = sphere(f"drawer_heap_{r}_{c}", (cx, cy, fz), hx * 0.95, fills[what], scale=(1, hy / hx, 0.36))
                    parts += [bed, heap]                              # heaped up in the middle
                else:
                    bed_m = {"coconut flakes": coconut, "cacao nibs": cacao, "goji berries": goji}[what]
                    parts.append(box_span(f"drawer_fill_{r}_{c}", cx - hx, cx + hx, cy - hy, cy + hy, bz + 0.01, fz - 0.012, bed_m))
                    parts.append(sphere(f"drawer_heap_{r}_{c}", (cx, cy, fz - 0.012), hx * 0.9, bed_m, scale=(1, hy / hx, 0.32)))
                    kind, size, n = {"coconut flakes": ("flake", 0.014, 200), "cacao nibs": ("chunk", 0.0045, 600),
                                     "goji berries": ("pod", 0.0085, 240)}[what]
                    parts.append(scatter(f"drawer_pieces_{r}_{c}", (cx, cy, fz - 0.006), (hx - 0.004, hy - 0.004, 0.004), n, size, bed_m,
                                         seed=r * 10 + c, kind=kind, z_jitter=0.008, mound=0.035))
                open_drawers[what] = parts
    for what, parts in open_drawers.items():
        hotspot(f"drawer-{what.replace(' ', '-')}", what.capitalize(), parts, kind="ambient")
    hotspot("drawers", "The drawers", [o for o in drawers if o.name.startswith("drawer_plate")], kind="interactive", overlay="add-ins")

    # big jars on the top shelf, green lids, with trailing plants at the ends
    top_fill = [seeds_black, coconut, seeds_white, speckle("oats_b", "#d8c39a", "#b39b70", scale=90, amount=0.4, rough=0.8),
                speckle("pumpkin_b", "#7f8f4c", "#5c6a34", scale=70, amount=0.4, rough=0.6), coconut, goji, cacao]
    for k in range(8):
        x = CAB_X0 + 0.32 + k * (CAB_X1 - CAB_X0 - 0.64) / 7
        jar(f"top_jar_{k}", (x, cy0 + 0.2, top_z + 0.08), 0.075, 0.2, glass, top_fill[k], green)
    model("potted_plant_02", (CAB_X0 + 0.02, cy0 + 0.2, top_z + 0.08), rot_z=30, scale=0.55)
    model("potted_plant_02", (CAB_X1 - 0.02, cy0 + 0.2, top_z + 0.08), rot_z=150, scale=0.55)

    # ---- The counter: thick worn top, panelled front facing the shop
    x0, x1, y0, y1 = COUNTER
    box_span("counter_body", x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.02, 0.06, TOP - 0.05, counter_wood, bevel=0.01)
    box_span("counter_plinth", x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.04, 0.0, 0.07, beam_wood)
    box_span("counter_top", x0, x1, y0, y1, TOP - 0.055, TOP, counter_wood, bevel=0.012)
    for k in range(3):                                                # three panels on the front
        px0 = x0 + 0.1 + k * (x1 - x0 - 0.2) / 3
        px1 = px0 + (x1 - x0 - 0.2) / 3
        box_span(f"counter_panel_{k}", px0 + 0.04, px1 - 0.04, y0 + 0.018, y0 + 0.03, 0.18, TOP - 0.14, counter_wood, bevel=0.006)
        for nm, a0, a1, b0, b1 in (("l", px0 + 0.02, px0 + 0.04, 0.16, TOP - 0.12), ("r", px1 - 0.04, px1 - 0.02, 0.16, TOP - 0.12),
                                   ("b", px0 + 0.02, px1 - 0.02, 0.16, 0.18), ("t", px0 + 0.02, px1 - 0.02, TOP - 0.14, TOP - 0.12)):
            box_span(f"counter_mould_{k}_{nm}", a0, a1, y0 + 0.012, y0 + 0.03, b0, b1, beam_wood, bevel=0.003)
    hotspot("counter", "The counter", [bpy.data.objects["counter_top"]], kind="ambient")

    # The brass balance: equal arms, two pans on chains, a few plain weights on its wooden base
    bx, byy = 1.42, 3.12
    base = box_span("scale_base", bx - 0.17, bx + 0.17, byy - 0.07, byy + 0.07, TOP, TOP + 0.04, door_dark, bevel=0.006)
    sc = [base, lathe("scale_column", [(0.0, 0.0), (0.04, 0.0), (0.04, 0.012), (0.014, 0.03), (0.01, 0.36), (0.016, 0.375),
                                        (0.016, 0.385), (0.0, 0.39)], brass, (bx, byy, TOP + 0.04))]
    beam_z = TOP + 0.04 + 0.375
    sc.append(box("scale_beam", (bx, byy, beam_z), (0.44, 0.012, 0.014), brass, bevel=0.003))
    sc.append(sphere("scale_pivot", (bx, byy, beam_z), 0.014, brass_worn))
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.006, radius2=0.001, depth=0.07, location=(bx, byy, beam_z + 0.04))
    needle = bpy.context.active_object
    needle.name = "scale_needle"
    needle.data.materials.append(brass_worn)
    sc.append(needle)
    for s in (-1, 1):
        hx_ = bx + s * 0.2
        sc.append(sphere(f"scale_end_{s}", (hx_, byy, beam_z), 0.009, brass))
        pan_z = TOP + 0.15
        for k in range(3):                                             # three chains to each pan
            a = 2 * math.pi * k / 3
            px, py = hx_ + 0.065 * math.cos(a), byy + 0.065 * math.sin(a)
            sc.append(tube(f"scale_chain_{s}_{k}", [(hx_, byy, beam_z - 0.005), (px, py, pan_z + 0.012)], 0.0012, brass, res=2))
        sc.append(lathe(f"scale_pan_{s}", [(0.0, 0.0), (0.05, 0.002), (0.075, 0.014), (0.08, 0.02)], brass, (hx_, byy, pan_z), shell=0.0025))
    for k, (dx, r_, h_) in enumerate(((-0.12, 0.016, 0.028), (-0.08, 0.012, 0.022), (0.1, 0.019, 0.034))):
        sc.append(cyl(f"weight_{k}", (bx + dx, byy - 0.035, TOP + 0.04 + h_ / 2), r_, h_, brass_worn, verts=24, bevel=0.003))
        sc.append(sphere(f"weight_knob_{k}", (bx + dx, byy - 0.035, TOP + 0.04 + h_ + 0.006), r_ * 0.45, brass_worn))
    # a little heap of chia in the left pan
    sc.append(sphere("scale_chia", (bx - 0.2, byy, TOP + 0.168), 0.035, seeds_black, scale=(1, 1, 0.3)))
    hotspot("scales", "The scales", sc, kind="ambient")

    # Mortar and pestle in dark speckled stone, a brass scoop, a few seeds spilt round it
    mx, my = 1.9, 3.02
    mortar = lathe("mortar", [(0.0, 0.0), (0.06, 0.0), (0.08, 0.02), (0.088, 0.06), (0.084, 0.1), (0.07, 0.1), (0.065, 0.07),
                              (0.045, 0.035), (0.0, 0.03)], stone, (mx, my, TOP), segs=64)
    pestle = cyl("pestle", (mx + 0.03, my + 0.02, TOP + 0.13), 0.02, 0.2, stone, verts=32, bevel=0.012,
                 rot=(math.radians(-28), math.radians(24), 0))
    sphere("mortar_chia", (mx, my, TOP + 0.045), 0.06, seeds_black, scale=(1, 1, 0.25))
    scoop = [lathe("scoop_bowl", [(0.0, 0.0), (0.02, 0.002), (0.028, 0.015), (0.03, 0.022)], brass_worn, (mx + 0.18, my - 0.1, TOP + 0.003), shell=0.0015),
             cyl("scoop_handle", (mx + 0.25, my - 0.12, TOP + 0.014), 0.005, 0.1, brass_worn, rot=(0, math.radians(84), math.radians(-15)))]
    scatter("spilt_chia", (mx + 0.06, my - 0.12, TOP + 0.001), (0.16, 0.06, 0.0), 160, 0.0011, seed_m, seed=3)
    hotspot("mortar", "The mortar and pestle", [mortar, pestle], kind="ambient")

    # Two little wooden bowls at the front of the counter, so a couple of the drawers' treasures show from the shop
    for k, (bx_, by_, m_, kind, size, n) in enumerate(((1.7, 2.88, goji, "pod", 0.0085, 70), (2.45, 2.9, coconut, "flake", 0.013, 60))):
        lathe(f"counter_bowl_{k}", [(0.0, 0.0), (0.03, 0.0), (0.05, 0.018), (0.062, 0.034), (0.064, 0.037)], oak, (bx_, by_, TOP), shell=0.005)
        sphere(f"counter_bowl_bed_{k}", (bx_, by_, TOP + 0.022), 0.052, m_, scale=(1, 1, 0.3))
        scatter(f"counter_bowl_pieces_{k}", (bx_, by_, TOP + 0.03), (0.042, 0.042, 0.002), n, size, m_, seed=70 + k, kind=kind, mound=0.016)

    # Paper parcels in the botanical kraft, tied with string
    for k, (px, py, sx, sy, sz, rz) in enumerate(((2.22, 3.18, 0.12, 0.09, 0.06, 12), (2.33, 3.08, 0.1, 0.08, 0.05, -20))):
        b = box(f"parcel_{k}", (px, py, TOP + sz / 2), (sx, sy, sz), kraft, bevel=0.006)
        b.rotation_euler = (0, 0, math.radians(rz))
        for nm, size in (("a", (sx + 0.004, 0.004, sz + 0.004)), ("b", (0.004, sy + 0.004, sz + 0.004))):
            s_ = box(f"parcel_string_{k}_{nm}", (px, py, TOP + sz / 2), size, string, bevel=0.0015)
            s_.rotation_euler = (0, 0, math.radians(rz))
        sphere(f"parcel_knot_{k}", (px, py, TOP + sz + 0.004), 0.007, string)
    box("parcel_2", (2.22, 3.18, TOP + 0.08), (0.08, 0.07, 0.04), kraft, bevel=0.005).rotation_euler = (0, 0, math.radians(-4))

    # Four pudding jars on the counter: berry, mango, matcha, cacao, in layers, toppings on top
    puds = []
    for k, (flav, top_m) in enumerate((("berry", rasp), ("mango", mango), ("matcha", pistachio), ("cacao", cacao))):
        jx, jy = 2.58 + k * 0.11, 2.95
        puds += pudding_jar(f"pud_{flav}", (jx, jy, TOP), glass, pudding, layers[flav], top_m, flav, seed=k)
    hotspot("pudding-jars", "Mix an experiment", puds, kind="submit")

    # Two infusion flasks on a brass stand, with little taps: amber fruit tea and a red berry infusion, bubbling gently
    fx, fy = 3.18, 3.15
    stand = [box_span("flask_base", fx - 0.17, fx + 0.17, fy - 0.07, fy + 0.07, TOP, TOP + 0.015, iron, bevel=0.003)]
    for s in (-1, 1):
        stand.append(cyl(f"flask_post_{s}", (fx + s * 0.16, fy, TOP + 0.2), 0.006, 0.38, brass))
    stand.append(cyl("flask_rail", (fx, fy, TOP + 0.39), 0.006, 0.34, brass, rot=(0, math.radians(90), 0)))
    stand.append(cyl("flask_post_mid", (fx, fy, TOP + 0.24), 0.008, 0.46, brass))
    sphere("flask_finial", (fx, fy, TOP + 0.475), 0.013, brass_worn)
    tea = mat("amber_tea", srgb("#c47a1c"), rough=0.05, transmission=0.9, ior=1.34)
    tea.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#d08a2a")
    red_inf = mat("berry_infusion", srgb("#8e1a24"), rough=0.05, transmission=0.85, ior=1.34)
    flasks = []
    for s, liq, bits in ((-1, tea, mango), (1, red_inf, rasp)):
        cx = fx + s * 0.085
        z0 = TOP + 0.09
        prof = [(0.0, 0.0), (0.03, 0.004), (0.058, 0.03), (0.068, 0.07), (0.064, 0.11), (0.04, 0.14), (0.018, 0.16), (0.016, 0.2),
                (0.02, 0.205)]
        flasks.append(lathe(f"flask_{s}", prof, glass, (cx, fy, z0), segs=48, shell=0.0025))
        fill = [(0.0, 0.004), (0.028, 0.008), (0.054, 0.032), (0.064, 0.07), (0.06, 0.105), (0.0, 0.105)]
        lathe(f"flask_liquid_{s}", fill, liq, (cx, fy, z0), segs=48)
        cyl(f"flask_cork_{s}", (cx, fy, z0 + 0.215), 0.017, 0.03, mat(f"cork_{s}", srgb("#a7895e"), rough=0.9), verts=16, bevel=0.003)
        stand.append(lathe(f"flask_ring_{s}", [(0.05, 0.0), (0.056, 0.0), (0.056, 0.008), (0.05, 0.008)], brass, (cx, fy, z0 + 0.06)))
        stand.append(cyl(f"flask_arm_{s}", (cx + s * 0.035, fy, z0 + 0.064), 0.004, 0.06, brass, rot=(0, math.radians(90), 0)))
        stand.append(cyl(f"flask_tap_{s}", (cx, fy - 0.03, z0 - 0.025), 0.006, 0.05, brass_worn))
        stand.append(cyl(f"flask_tap_spout_{s}", (cx, fy - 0.05, z0 - 0.045), 0.005, 0.03, brass_worn, rot=(math.radians(90), 0, 0)))
        stand.append(cyl(f"flask_tap_key_{s}", (cx, fy - 0.03, z0 - 0.01), 0.004, 0.035, brass_worn, rot=(0, math.radians(90), 0)))
        stand.append(lathe(f"flask_cup_{s}", [(0.0, 0.0), (0.025, 0.0), (0.035, 0.012), (0.036, 0.016)], brass, (cx, fy - 0.05, TOP + 0.015), shell=0.0015))
        prnd = random.Random(40 + s)
        for k in range(5):                                         # fruit pieces floating in it
            a, rr = prnd.uniform(0, 6.28), prnd.uniform(0.0, 0.035)
            box(f"flask_bit_{s}_{k}", (cx + rr * math.cos(a), fy + rr * math.sin(a), z0 + prnd.uniform(0.03, 0.09)),
                (0.012, 0.01, 0.008), bits, bevel=0.002).rotation_euler = (prnd.uniform(0, 3), prnd.uniform(0, 3), 0)
        for k in range(16):                                        # a few small bubbles rising
            a, rr = prnd.uniform(0, 6.28), prnd.uniform(0.0, 0.03)
            sphere(f"flask_bubble_{s}_{k}", (cx + rr * math.cos(a), fy + rr * math.sin(a), z0 + prnd.uniform(0.02, 0.1)),
                   prnd.uniform(0.0015, 0.004), glass)
    hotspot("flasks", "The flasks", flasks + stand, kind="interactive", overlay="superpower")

    # ---- The display fridge: a rounded 1950s cream upright with a glass door, milks and finished puddings inside
    fx0, fx1, fy0, fy1, fh = FRIDGE
    # a hollow cabinet, open at the front behind the glass door
    box_span("fridge_back", fx0, fx0 + 0.05, fy0, fy1, 0.08, fh, enamel, bevel=0.03)
    box_span("fridge_side_a", fx0, fx1 - 0.04, fy0, fy0 + 0.1, 0.08, fh, enamel, bevel=0.05)
    box_span("fridge_side_b", fx0, fx1 - 0.04, fy1 - 0.1, fy1, 0.08, fh, enamel, bevel=0.05)
    box_span("fridge_top", fx0, fx1 - 0.04, fy0, fy1, fh - 0.17, fh, enamel, bevel=0.07)
    box_span("fridge_bottom", fx0, fx1 - 0.04, fy0, fy1, 0.08, 0.3, enamel, bevel=0.03)
    box_span("fridge_plinth", fx0 + 0.03, fx1 - 0.08, fy0 + 0.03, fy1 - 0.03, 0.0, 0.09, iron)
    for k in range(4):
        box_span(f"fridge_foot_{k}", fx1 - 0.12, fx1 - 0.08, fy0 + 0.06 + k * 0.17, fy0 + 0.1 + k * 0.17, 0.0, 0.08, chrome)
    # the door: an enamel frame round a big glass window, chrome trim, a long chrome pull on the lane side
    dx0, dx1 = fx1 - 0.045, fx1
    door = [box_span("fridge_door_frame_l", dx0, dx1, fy0 + 0.01, fy0 + 0.1, 0.12, fh - 0.03, enamel, bevel=0.02),
            box_span("fridge_door_frame_r", dx0, dx1, fy1 - 0.1, fy1 - 0.01, 0.12, fh - 0.03, enamel, bevel=0.02),
            box_span("fridge_door_frame_b", dx0, dx1, fy0 + 0.01, fy1 - 0.01, 0.12, 0.3, enamel, bevel=0.02),
            box_span("fridge_door_frame_t", dx0, dx1, fy0 + 0.01, fy1 - 0.01, fh - 0.17, fh - 0.03, enamel, bevel=0.02)]
    for nm, a0, a1, b0, b1 in (("l", fy0 + 0.095, fy0 + 0.105, 0.3, fh - 0.17), ("r", fy1 - 0.105, fy1 - 0.095, 0.3, fh - 0.17),
                               ("b", fy0 + 0.095, fy1 - 0.095, 0.295, 0.305), ("t", fy0 + 0.095, fy1 - 0.095, fh - 0.175, fh - 0.165)):
        door.append(box_span(f"fridge_trim_{nm}", dx1 - 0.005, dx1 + 0.004, a0, a1, b0, b1, chrome, bevel=0.002))
    fglass = box_span("fridge_glass", dx0 + 0.015, dx0 + 0.021, fy0 + 0.1, fy1 - 0.1, 0.3, fh - 0.17, window_glass("fridge_glass"))
    fglass.visible_shadow = False
    door.append(fglass)
    door.append(cyl("fridge_pull", (dx1 + 0.03, fy0 + 0.05, 1.05), 0.011, 0.5, chrome, verts=24))
    for z in (0.82, 1.28):
        door.append(box_span(f"fridge_pull_post_{z}", dx1, dx1 + 0.03, fy0 + 0.044, fy0 + 0.056, z - 0.01, z + 0.01, chrome))
    for k in range(6):
        box_span(f"fridge_grille_{k}", fx1 - 0.075, fx1 - 0.07, fy0 + 0.08, fy1 - 0.08, 0.1 + 0.014 * k, 0.106 + 0.014 * k, chrome)
    # inside: pale enamel lining, four glass shelves, a warm lamp along the top
    ix0, iy0, iy1 = fx0 + 0.05, fy0 + 0.1, fy1 - 0.1
    box_span("fridge_inside_back", ix0, ix0 + 0.01, iy0, iy1, 0.3, fh - 0.17, mat("fridge_lining", srgb("#f3eee2"), rough=0.4))
    lamp_strip = box_span("fridge_lamp", ix0 + 0.03, ix0 + 0.06, iy0 + 0.02, iy1 - 0.02, fh - 0.2, fh - 0.185,
                          mat("fridge_lamp", (1, 0.9, 0.7, 1), emission=(1.0, 0.85, 0.6, 1), strength=12))
    lamp_strip.visible_shadow = False
    shelves = [0.34, 0.68, 1.0, 1.32]
    for z in shelves[1:]:
        box_span(f"fridge_shelf_{z}", ix0, dx0 - 0.005, iy0, iy1, z - 0.006, z, glass)
    point_light("fridge_light", (ix0 + 0.2, (iy0 + iy1) / 2, fh - 0.25), 6 if not NIGHT else 5, (1.0, 0.82, 0.6), radius=0.08)
    # top shelf: five milk bottles (oat, almond, coconut, soy, dairy: all pale, the browser names them)
    milks = []
    for k in range(5):
        yy = iy0 + 0.05 + k * (iy1 - iy0 - 0.1) / 4
        milks += milk_bottle(f"milk_{k}", (ix0 + 0.16, yy, shelves[3]), glass, milk, green if k % 2 else paint, k)
    hotspot("fridge", "The fridge", milks + door, kind="interactive", overlay="milk")
    # middle shelves: finished puddings, the four flavours again
    for si, z in enumerate(shelves[1:3]):
        for k, (flav, top_m) in enumerate((("berry", rasp), ("mango", mango), ("matcha", pistachio), ("cacao", cacao))):
            yy = iy0 + 0.06 + k * (iy1 - iy0 - 0.12) / 3
            pudding_jar(f"fridge_pud_{si}_{flav}", (ix0 + 0.18, yy, z), glass, pudding, layers[flav], top_m, flav, seed=10 + si * 4 + k, r=0.032)
    # bottom: a little crate of fruit
    box_span("fridge_crate", ix0 + 0.06, ix0 + 0.3, iy0 + 0.04, iy1 - 0.04, shelves[0], shelves[0] + 0.1, oak, bevel=0.005)
    model("lemon", (ix0 + 0.18, iy0 + 0.12, shelves[0] + 0.06), rot_z=20, scale=1.0)
    model("lemon", (ix0 + 0.15, iy0 + 0.24, shelves[0] + 0.06), rot_z=80, scale=0.95)
    for k in range(3):
        sphere(f"fridge_lime_{k}", (ix0 + 0.2, iy0 + 0.33 + 0.045 * k, shelves[0] + 0.12), 0.026, mat(f"lime_{k}", srgb("#6e9a2c"), rough=0.4))
    for k in range(2):
        sphere(f"fridge_mango_{k}", (ix0 + 0.13, iy1 - 0.12 - 0.07 * k, shelves[0] + 0.13), 0.042, mango, scale=(1, 0.8, 0.75))
    model("potted_plant_02", ((fx0 + fx1) / 2 - 0.05, (fy0 + fy1) / 2, fh), rot_z=60, scale=0.5)
    lathe("fridge_pot", [(0.0, 0.0), (0.08, 0.0), (0.09, 0.01), (0.09, 0.12), (0.095, 0.13)],
          mat("copper", srgb("#b46a43"), rough=0.35, metal=1.0), ((fx0 + fx1) / 2 - 0.05, fy0 + 0.13, fh), shell=0.003)

    # ---- The hallway door: old oak, four panels, as the hallway's, left a little ajar. The hallway beyond.
    lw, lh, lt = DOOR_W - 0.02, DOOR_H - 0.03, 0.045
    dparts = [box_span("door_leaf", 0, lw, -lt / 2, lt / 2, 0.012, 0.012 + lh, door_oak, bevel=0.004)]
    for face in (-1, 1):
        for px in (0.235, lw - 0.235):
            for pz0, pz1 in ((0.2, 0.95), (1.12, 1.95)):
                ya, yb = sorted((face * lt / 2, face * (lt / 2 + 0.006)))
                dparts.append(box_span(f"door_panel_{face}_{px}_{pz0}", px - 0.14, px + 0.14, ya, yb, pz0 + 0.02, pz1 - 0.02, door_oak, bevel=0.008))
                for nm, a0, a1, b0, b1 in (("l", px - 0.17, px - 0.145, pz0, pz1), ("r", px + 0.145, px + 0.17, pz0, pz1),
                                           ("b", px - 0.17, px + 0.17, pz0, pz0 + 0.025), ("t", px - 0.17, px + 0.17, pz1 - 0.025, pz1)):
                    ya, yb = sorted((face * lt / 2, face * (lt / 2 + 0.014)))
                    dparts.append(box_span(f"door_mould_{face}_{px}_{pz0}_{nm}", a0, a1, ya, yb, b0, b1, door_dark, bevel=0.005))
        dparts.append(cyl(f"door_knob_{face}", (lw - 0.07, face * (lt / 2 + 0.035), 1.0), 0.028, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
    for hz in (0.25, 1.85):
        dparts.append(cyl(f"door_hinge_{hz}", (0.005, 0, hz), 0.009, 0.1, iron))
    # hinged on the front side (as the hallway shows it), opening into the shop: local x along the leaf from the
    # hinge, local -y into the room; swung AJAR degrees off the wall
    m = Matrix.Translation((-0.04, d0 + 0.01, 0)) @ Matrix.Rotation(-math.radians(AJAR), 4, "Z") @ \
        Matrix(((0, 1, 0), (1, 0, 0), (0, 0, 1))).to_4x4() @ Matrix.Diagonal((1, -1, 1, 1))
    door_root = group("hall_door", m, dparts)
    for nm, y0, y1 in (("a", d0 - 0.08, d0), ("b", d1, d1 + 0.08)):
        box_span(f"door_trim_{nm}", 0, 0.025, y0, y1, 0, DOOR_H + 0.08, paint, bevel=0.005)
    box_span("door_trim_t", 0, 0.025, d0 - 0.08, d1 + 0.08, DOOR_H, DOOR_H + 0.09, paint, bevel=0.005)
    for y0, y1 in ((d0, d0 + 0.008), (d1 - 0.008, d1)):
        box_span(f"door_jamb_{y0:.2f}", -0.15, 0, y0, y1, 0, DOOR_H, paint)
    box_span("door_head", -0.15, 0, d0, d1, DOOR_H - 0.008, DOOR_H, paint)
    hotspot("chia-exit-door", "Into the hallway", meshes_of(door_root), kind="door")
    # the hallway through the gap: oak boards, cream walls, the Sweet Spells door across the way, a warm lamp
    hx0 = -1.95
    hall_plaster = pbr("hall_plaster", "white_plaster_rough_01", 3.0, tint=srgb("#ede3cf"), tint_mix=0.85, bump=0.6)
    box_span("hall_floor", hx0, -0.15, d0 - 2.0, d1 + 2.0, -0.1, 0, floor_m)
    box_span("hall_ceiling", hx0, -0.15, d0 - 2.0, d1 + 2.0, H, H + 0.1, hall_plaster)
    box_span("hall_wall_far", hx0 - 0.15, hx0, d0 - 2.0, d1 + 2.0, 0, H, hall_plaster)
    box_span("hall_door_far", hx0, hx0 + 0.04, DOOR_Y - 0.43, DOOR_Y + 0.43, 0.01, 2.05, door_oak, bevel=0.004)
    box_span("hall_runner", hx0 + 0.4, -0.55, d0 - 2.0, d1 + 2.0, 0, 0.008, mat("hall_runner", srgb("#7b3a2c"), rough=0.9))
    point_light("hall_lamp", (-0.9, DOOR_Y + 0.6, 2.2), 25 if (NIGHT or WX["lamps"]) else 12, (1.0, 0.66, 0.38), radius=0.2)

    # ---- The room dial, the same as the hallway's, its pointer left on the Chiapothecary (station 160)
    dial_face = image_mat("dial_face", os.path.join(HALL, "05-dial-plate-flat.png"), rough=0.35, circle=0.4825)
    dial_face.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    dial_r = 0.1
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0035))
    face = bpy.context.active_object
    face.name = "chia_dial_face"
    face.scale = (2 * dial_r / 0.965,) * 2 + (1,)
    bpy.ops.object.transform_apply(scale=True)
    face.data.materials.append(dial_face)
    dl = [face, cyl("chia_dial_rim", (0, 0, 0), dial_r, 0.006, brass, verts=96, bevel=0.002)]
    for st in json.load(open(os.path.join(HALL, "dial-layout.json"), encoding="utf8"))["stations"]:
        if not st["label"]:
            continue
        a = math.radians(st["angle_clockwise_from_top_deg"])
        words = st["label"].split(" ")
        body_ = "\n".join(words) if len(words) > 1 else st["label"]
        size = 0.0042 if len(words) > 1 else (0.0036 if len(body_) > 10 else 0.0044)
        dl.append(text(f"chia_dial_name_{st['index']}", body_, (0.0785 * math.sin(a), 0.0785 * math.cos(a), 0.0045), (0, 0, 0), size, ink))
    ptr = [cyl("chia_hub", (0, 0, 0.012), 0.014, 0.012, brass_worn, bevel=0.003), sphere("chia_hub_cap", (0, 0, 0.019), 0.008, brass_worn)]
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.006, radius2=0.0025, depth=0.062, location=(0, 0.035, 0.012),
                                    rotation=(math.radians(-90), 0, 0))
    shaft = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    shaft.data.materials.append(brass_worn)
    ptr += [shaft, sphere("chia_pointer_tip", (0, 0.068, 0.012), 0.0065, brass_worn), sphere("chia_pointer_tail", (0, -0.026, 0.012), 0.006, brass_worn)]
    dl.append(group("chia_pointer_set", Matrix.Rotation(-math.radians(160), 4, "Z"), ptr))
    group("chia_dial", frame_matrix((0.006, DIAL_AT[1], DIAL_AT[2]), (1, 0, 0), (0, 1, 0)), dl)
    hotspot("chia-dial", "The dial", [face], kind="dial", overlay="dial")

    # ---- The glazed door into the glasshouse: the glasshouse's own door (whisked.glazed_door), seen from the shop.
    # Same frame as glasshouse_build.py, moved by CHIA_FROM_GH: hinged on the lane side, opening into the glasshouse.
    m = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4()
    m.translation = Vector((CHIA_FROM_GH - 0.06, c0 + 0.01, 0))
    gd_root = glazed_door(m, brass, brass_worn, iron)
    for nm, y0, y1 in (("a", c0 - 0.08, c0), ("b", c1, c1 + 0.08)):
        box_span(f"gd_trim_{nm}", W - 0.025, W, y0, y1, 0, GLAZED_DOOR_H + 0.08, paint, bevel=0.005)
    box_span("gd_trim_t", W - 0.025, W, c0 - 0.08, c1 + 0.08, GLAZED_DOOR_H, GLAZED_DOOR_H + 0.09, paint, bevel=0.005)
    for y0, y1 in ((c0, c0 + 0.008), (c1 - 0.008, c1)):
        box_span(f"gd_jamb_{y0:.2f}", W, W + GW, y0, y1, 0, GLAZED_DOOR_H, paint)
    box_span("gd_head", W, W + GW, c0, c1, GLAZED_DOOR_H - 0.008, GLAZED_DOOR_H, paint)
    box_span("gd_threshold", W, W + GW, c0, c1, 0, 0.015, oak, bevel=0.003)
    hotspot("chia-glasshouse-door", "Into the glasshouse", meshes_of(gd_root), kind="door")
    # Beyond the glass: the glasshouse, as its build renders it from this camera (glasshouse_build.py --glimpse)
    beyond = os.path.join(OUT, f"glasshouse_glimpse_{SEASON}.jpg")
    if os.path.exists(beyond) and not GLIMPSE:
        glimpse_plate("glasshouse_glimpse", beyond, CAM, plate_target(GH_PLATE), GH_PLATE["fov"], GH_PLATE["corner"],
                      GH_PLATE["along"], GH_PLATE["up"], strength=WX["beyond"],
                      tint=(0.55, 0.62, 1.0) if NIGHT else (1, 1, 1))
    elif not GLIMPSE:
        print(f"[whisked] no {os.path.basename(beyond)} yet: a plain green glow stands in for the glasshouse")
        box_span("glasshouse_stand_in", W + GW + 0.01, W + GW + 0.03, c0 - 0.3, c1 + 0.3, 0, 2.4,
                 mat("stand_in", srgb("#9fb58a"), emission=srgb("#cfe0b4"), strength=1.5 * WX["beyond"]))
    if WX["green"]:                                                   # glasshouse daylight through the door glass
        gl = area_light("glasshouse_light", (W + GW - 0.025, CD_Y, 1.3), (0, math.radians(90), 0), (0.7, 1.4), WX["green"],
                        (0.92, 1.0, 0.88))
        gl.visible_camera = gl.visible_glossy = gl.visible_transmission = False

    # ---- The clockwork songbird in its brass cage, on a bracket beside the glazed door
    cgx, cgy, cgz = CAGE
    cr, ch = 0.14, 0.26                                               # cage radius, height of the straight bars
    cage = [lathe("cage_base", [(0.0, 0.0), (cr + 0.01, 0.0), (cr + 0.012, 0.012), (cr + 0.006, 0.05), (cr, 0.055), (0.0, 0.055)],
                  brass, (cgx, cgy, cgz), segs=64)]
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        cage.append(sphere(f"cage_foot_{k}", (cgx + (cr - 0.01) * math.cos(a), cgy + (cr - 0.01) * math.sin(a), cgz - 0.006), 0.009, brass))
    cage.append(sphere("cage_drawer_knob", (cgx - cr - 0.01, cgy, cgz + 0.028), 0.007, brass_worn))
    nbar = 28
    bz0, bz1 = cgz + 0.055, cgz + 0.055 + ch
    for k in range(nbar):
        a = 2 * math.pi * k / nbar
        pts = [(cgx + cr * math.cos(a), cgy + cr * math.sin(a), bz0)]
        pts += [(cgx + cr * math.cos(t) * math.cos(a), cgy + cr * math.cos(t) * math.sin(a), bz1 + cr * 0.8 * math.sin(t))
                for t in [j / 6 * math.pi / 2 for j in range(7)]]
        cage.append(tube(f"cage_bar_{k}", pts, 0.0016, brass, res=2))
    for z in (bz0 + 0.004, bz0 + ch * 0.55, bz1):
        bpy.ops.mesh.primitive_torus_add(major_radius=cr, minor_radius=0.0035, location=(cgx, cgy, z), major_segments=64)
        ring = bpy.context.active_object
        ring.name = f"cage_ring_{z:.2f}"
        ring.data.materials.append(brass)
        cage.append(ring)
    top = bz1 + cr * 0.8
    cage.append(sphere("cage_top", (cgx, cgy, top), 0.016, brass))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.025, minor_radius=0.004, location=(cgx, cgy, top + 0.04), rotation=(math.radians(90), 0, 0))
    hang = bpy.context.active_object
    hang.name = "cage_hang_ring"
    hang.data.materials.append(brass)
    cage.append(hang)
    # the little gate, on the room side
    gate_a = math.pi                                                   # facing the room (-X)
    cage.append(box("cage_gate_latch", (cgx + (cr + 0.004) * math.cos(gate_a + 0.25), cgy + (cr + 0.004) * math.sin(gate_a + 0.25), bz0 + 0.12),
                    (0.006, 0.012, 0.03), brass_worn, bevel=0.002))
    cage.append(cyl("cage_perch", (cgx, cgy, bz0 + 0.1), 0.0045, 2 * cr - 0.01, brass_worn, rot=(math.radians(90), 0, 0)))
    cage.append(cyl("cage_perch_post", (cgx, cgy, bz0 + 0.05), 0.005, 0.1, brass))
    # the bracket: a scrolled iron arm from the wall, the cage hanging from its end on a short chain
    bk_z = top + 0.12
    cage.append(box_span("cage_wall_plate", W - 0.012, W, cgy - 0.03, cgy + 0.03, bk_z - 0.12, bk_z + 0.04, brass, bevel=0.003))
    cage.append(tube("cage_bracket", [(W - 0.01, cgy, bk_z), (cgx + 0.15, cgy, bk_z + 0.01), (cgx + 0.03, cgy, bk_z), (cgx, cgy, bk_z - 0.01)],
                     0.006, brass, res=3))
    cage.append(tube("cage_bracket_brace", [(W - 0.01, cgy, bk_z - 0.11), (cgx + 0.2, cgy, bk_z - 0.06), (cgx + 0.12, cgy, bk_z - 0.005)],
                     0.004, brass, res=3))
    cage.append(tube("cage_chain", [(cgx, cgy, bk_z - 0.01), (cgx, cgy, top + 0.065)], 0.002, brass, res=2))
    bird = songbird((cgx, cgy, bz0 + 0.1 + 0.0045), brass_worn, brass, iron, glass)
    hotspot("songbird", "The clockwork songbird", bird + cage[:3], kind="ambient")

    # ---- Garden wall, back part: a shelf of herbs under a framed botanical print
    box_span("herb_shelf", W - 0.22, W, 2.75, 3.9, 1.0, 1.035, oak, bevel=0.006)
    for y in (2.9, 3.75):
        box_span(f"herb_shelf_bracket_{y}", W - 0.18, W, y - 0.012, y + 0.012, 0.86, 1.0, iron)
    model("potted_plant_02", (W - 0.11, 3.0, 1.035), rot_z=110, scale=0.42)
    model("potted_plant_04", (W - 0.11, 3.35, 1.035), rot_z=10, scale=0.55)
    model("potted_plant_02", (W - 0.11, 3.7, 1.035), rot_z=250, scale=0.38)
    print_m = image_mat("botanical_print", os.path.join(PACK, "12-chia-botanical-kraft-tile.png"), rough=0.85)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(W - 0.022, 3.32, 1.68), rotation=(math.radians(90), 0, math.radians(90)))
    pr = bpy.context.active_object
    pr.name = "botanical_print"
    pr.scale = (0.4, 0.4, 1)
    bpy.ops.object.transform_apply(scale=True)
    pr.data.materials.append(print_m)
    for nm, y0, y1, z0, z1 in (("l", 3.1, 3.12, 1.46, 1.9), ("r", 3.52, 3.54, 1.46, 1.9), ("b", 3.1, 3.54, 1.46, 1.48), ("t", 3.1, 3.54, 1.88, 1.9)):
        box_span(f"print_frame_{nm}", W - 0.03, W, y0, y1, z0, z1, oak, bevel=0.003)
    hotspot("botanical-print", "The chia plant", [pr], kind="ambient")

    # ---- A basket of chia in sacks by the window, a tall plant in the hallway corner of the front wall
    model("wicker_basket_02", (3.85, 0.45, 0), rot_z=-15, scale=1.3)
    for k, (dx, dy) in enumerate(((-0.08, -0.04), (0.07, 0.05))):
        sack = sphere(f"chia_sack_{k}", (3.85 + dx, 0.45 + dy, 0.2), 0.11, mat(f"sack_{k}", srgb("#b99a6c"), rough=0.95), scale=(1, 0.9, 1.25))
        sphere(f"chia_sack_top_{k}", (3.85 + dx, 0.45 + dy, 0.33), 0.085, seeds_black, scale=(1, 1, 0.3))
    model("potted_plant_04", (0.45, 0.45, 0), rot_z=40, scale=1.2)

    # ---- Wall lamps: brass sconces, lit when it's dark out
    bulb = mat("bulb", (1, 0.85, 0.6, 1), emission=(1.0, 0.72, 0.42, 1), strength=18)

    def wall_lamp(name, at_, normal, watts=10):
        n = Vector(normal)
        right = Vector((0, 0, 1)).cross(n)
        parts_ = [cyl(f"{name}_plate", (0, 0, 0.008), 0.05, 0.016, brass, bevel=0.003),
                  cyl(f"{name}_arm", (0, 0.04, 0.11), 0.008, 0.2, brass),
                  cyl(f"{name}_arm2", (0, 0.11, 0.2), 0.008, 0.16, brass, rot=(math.radians(90), 0, 0))]
        bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.09, radius2=0.035, depth=0.09, end_fill_type="NOTHING", location=(0, 0.13, 0.22))
        shade = bpy.context.active_object
        shade.name = f"{name}_shade"
        shade.rotation_euler = (math.radians(-90), 0, 0)
        shade.modifiers.new("thick", "SOLIDIFY").thickness = 0.003
        bpy.ops.object.shade_smooth()
        shade.data.materials.append(brass)
        parts_ += [shade, sphere(f"{name}_bulb", (0, 0.1, 0.22), 0.024, bulb if WX["lamps"] else glass)]
        group(name, frame_matrix(at_, normal, right), parts_)
        if WX["lamps"]:
            point_light(f"{name}_light", Vector(at_) + n * 0.22 + Vector((0, 0, 0.1)), watts * WX["lamps"], (1.0, 0.66, 0.38), radius=0.04)

    wall_lamp("lamp_hall", (0, 2.2, 1.85), (1, 0, 0))
    wall_lamp("lamp_garden", (W, 2.55, 1.85), (-1, 0, 0))
    wall_lamp("lamp_back_l", (0.45, D, 1.9), (0, -1, 0), watts=8)
    wall_lamp("lamp_back_r", (4.05, D, 1.9), (0, -1, 0), watts=8)

    # ---- A rug in front of the counter
    # ChatGPT's encaustic tile (13), woven into a flat-weave rug rather than laid as a floor
    rug_m = image_mat("rug", os.path.join(PACK, "13-encaustic-floor-tile.png"), rough=0.9, tile=0.24, normal_from="rough_linen", normal_strength=0.8)
    nt = rug_m.node_tree
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
    dim = nt.nodes.new("ShaderNodeMix")                               # faded with years of feet: darker, warmer
    dim.data_type, dim.blend_type = "RGBA", "MULTIPLY"
    dim.inputs["Factor"].default_value = 1.0
    dim.inputs[7].default_value = srgb("#a8916f")
    nt.links.new(tex.outputs["Color"], dim.inputs[6])
    nt.links.new(dim.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
    box_span("rug", 1.45, 3.05, 1.95, 2.62, 0, 0.01, rug_m, bevel=0.004)

    # ---- Light: the weather's sky through the window, the glasshouse through the door, warm practicals inside
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "kloofendal_overcast_puresky.hdr"))
    tint = wnt.nodes.new("ShaderNodeMix")
    tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (*WX["tint"], 1)
    wnt.links.new(env.outputs["Color"], tint.inputs[6])
    wnt.links.new(tint.outputs[2], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = WX["sky"]
    if WX["sun"]:
        watts, colour, elev, azim = WX["sun"]
        sun = bpy.data.lights.new("sun", "SUN")
        sun.energy, sun.color, sun.angle = watts, colour, math.radians(1.5)
        so = bpy.data.objects.new("sun", sun)
        # from the garden side of the lane: in through the shop window, toward the back and the hallway
        d = Vector((math.sin(math.radians(azim)), math.cos(math.radians(azim)), -math.tan(math.radians(elev)))).normalized()
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(so)
    area_light("win_portal", ((WIN_X0 + WIN_X1) / 2, -0.1, (SILL + HEAD) / 2), (math.radians(90), 0, 0),
               (WIN_X1 - WIN_X0, HEAD - SILL), 0, (1, 1, 1), portal=True)
    bounce = area_light("win_bounce", ((WIN_X0 + WIN_X1) / 2, 0.08, 1.5), (math.radians(90), 0, 0), (1.8, 1.2), WX["bounce"][0], WX["bounce"][1])
    bounce.visible_camera = bounce.visible_glossy = False
    point_light("warm_fill", (2.25, 2.4, 2.4), WX["fill"], (1.0, 0.68, 0.4), radius=0.8)

    # ---- Render settings
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = 128 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.cycles.transparent_max_bounces = 24
    scene.render.resolution_x = 2048 if PREVIEW else 8192
    scene.render.resolution_y = 1024 if PREVIEW else 4096
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = WX["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


# ---------------------------------------------------------------- objects

def jar(name, loc, r, h, glass, fill_m, lid_m):
    """A plain glass storage jar, three-quarters full, with a lid."""
    x, y, z = loc
    j = lathe(name, [(0.0, 0.0), (r, 0.0), (r, h * 0.9), (r * 0.86, h * 0.95), (r * 0.86, h)], glass, loc, segs=40, shell=0.003)
    lathe(f"{name}_fill", [(0.0, 0.004), (r - 0.005, 0.004), (r - 0.005, h * 0.72), (0.0, h * 0.75)], fill_m, loc, segs=40)
    cyl(f"{name}_lid", (x, y, z + h + 0.012), r * 0.92, 0.026, lid_m, verts=40, bevel=0.004)
    return j


def pudding_jar(name, loc, glass, pudding, layer_m, top_m, flav, seed=0, r=0.038):
    """A layered chia pudding: chia pudding, a fruit layer, more pudding, toppings."""
    x, y, z = loc
    h = r * 2.9
    parts = [lathe(name, [(0.0, 0.0), (r, 0.0), (r, h * 0.92), (r * 0.94, h)], glass, loc, segs=40, shell=0.0025)]
    ri = r - 0.004
    for k, (z0, z1, m_) in enumerate(((0.004, h * 0.42, pudding), (h * 0.42, h * 0.58, layer_m), (h * 0.58, h * 0.8, pudding))):
        parts.append(cyl(f"{name}_layer_{k}", (x, y, z + (z0 + z1) / 2), ri, z1 - z0, m_, verts=40, bevel=0.002))
    rnd = random.Random(seed)
    tz = z + h * 0.8
    for k in range(6 if flav in ("berry", "mango") else 14):
        a, rr = rnd.uniform(0, 6.28), rnd.uniform(0, ri - 0.01)
        p = (x + rr * math.cos(a), y + rr * math.sin(a), tz + 0.008)
        if flav == "berry":
            parts.append(berry(f"{name}_top_{k}", p, 0.009, top_m, seed=seed * 20 + k))
        elif flav == "mango":
            b = box(f"{name}_top_{k}", p, (0.013, 0.013, 0.013), top_m, bevel=0.002)
            b.rotation_euler = (rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0, 3))
            parts.append(b)
        else:                                                        # matcha: pistachio bits; cacao: nibs
            b = box(f"{name}_top_{k}", (p[0], p[1], tz + 0.004), (0.006, 0.005, 0.004), top_m, bevel=0.001)
            b.rotation_euler = (rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0, 3))
            parts.append(b)
    return parts


def milk_bottle(name, loc, glass, milk, cap_m, seed):
    """A plain reusable glass milk bottle, pale milk inside, a metal cap."""
    x, y, z = loc
    h = 0.2 + 0.01 * (seed % 2)
    prof = [(0.0, 0.0), (0.034, 0.0), (0.036, 0.01), (0.036, h * 0.55), (0.026, h * 0.78), (0.018, h * 0.9), (0.018, h)]
    b = lathe(name, prof, glass, loc, segs=40, shell=0.0025)
    fill = [(0.0, 0.004), (0.032, 0.006), (0.033, h * 0.55), (0.024, h * 0.76), (0.0, h * 0.76)]
    lathe(f"{name}_milk", fill, milk, loc, segs=40)
    cap = cyl(f"{name}_cap", (x, y, z + h + 0.006), 0.02, 0.014, cap_m, verts=32, bevel=0.003)
    return [b, cap]


def songbird(perch, brass_worn, brass, iron, glass):
    """The clockwork songbird, about 12 cm from beak to tail, standing on the perch. Brass feather plates, a beak
    a little open, dark eyes, a winding key on the flank that faces the room. Faces the shop window (-Y), so the
    camera sees it side on. Every part is its own object, so it can move later."""
    px, py, pz = perch
    feather = speckle("bird_brass", "#c39a58", "#8c6a34", scale=220, amount=0.42, rough=0.3, bump=0.6)
    feather.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    eye_m = mat("bird_eye", srgb("#151210"), rough=0.1, coat=1.0)
    parts = []
    bz = pz + 0.035
    body = sphere("bird_body", (px, py + 0.005, bz), 0.024, feather, scale=(0.85, 1.35, 0.95))
    body.rotation_euler = (math.radians(-18), 0, 0)
    parts.append(body)
    parts.append(sphere("bird_breast", (px, py - 0.015, bz - 0.004), 0.019, feather, scale=(0.95, 1.0, 1.05)))
    hz = bz + 0.03
    hy = py - 0.026
    parts.append(sphere("bird_head", (px, hy, hz), 0.0155, feather))
    for s in (-1, 1):
        parts.append(sphere(f"bird_eye_{s}", (px + s * 0.0125, hy - 0.006, hz + 0.004), 0.0032, eye_m))
        parts.append(sphere(f"bird_eye_ring_{s}", (px + s * 0.0118, hy - 0.006, hz + 0.004), 0.0042, brass, scale=(0.5, 1, 1)))
    for k, tilt in enumerate((-8, 14)):                               # beak, a little open
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.0045, radius2=0.0004, depth=0.017, location=(px, hy - 0.021, hz - 0.001 + 0.0015 * (k * 2 - 1)),
                                        rotation=(math.radians(90 + tilt), 0, 0))
        b = bpy.context.active_object
        b.name = f"bird_beak_{k}"
        bpy.ops.object.shade_smooth()
        b.data.materials.append(brass_worn)
        b.scale = (1, 1, 1) if k else (1, 0.8, 1)
        parts.append(b)
    for s in (-1, 1):                                                 # wings: overlapping plates along the flank
        for k in range(3):
            w = sphere(f"bird_wing_{s}_{k}", (px + s * 0.019, py + 0.006 + 0.012 * k, bz + 0.006 - 0.003 * k), 0.017 - 0.002 * k, feather,
                       scale=(0.25, 1.2, 0.6))
            w.rotation_euler = (math.radians(-22), s * math.radians(8), 0)
            parts.append(w)
    tail = box("bird_tail", (px, py + 0.055, bz - 0.006), (0.022, 0.05, 0.004), feather, bevel=0.0015)
    tail.rotation_euler = (math.radians(-24), 0, 0)
    parts.append(tail)
    for k in (-1, 1):                                                 # tail feather seams
        t2 = box(f"bird_tail_seam_{k}", (px + k * 0.006, py + 0.056, bz - 0.0045), (0.0015, 0.046, 0.0045), brass, bevel=0.0005)
        t2.rotation_euler = (math.radians(-24), 0, 0)
        parts.append(t2)
    for s in (-1, 1):                                                 # legs and feet round the perch
        parts.append(cyl(f"bird_leg_{s}", (px + s * 0.007, py + 0.002, pz + 0.012), 0.0018, 0.022, iron, verts=8, bevel=0))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0055, minor_radius=0.0013, location=(px + s * 0.007, py + 0.002, pz),
                                         rotation=(0, math.radians(90), 0))
        f = bpy.context.active_object
        f.name = f"bird_foot_{s}"
        f.data.materials.append(iron)
        parts.append(f)
    # the winding key, on the flank facing the room (-X)
    kx = px - 0.024
    parts.append(cyl("bird_key_stem", (kx - 0.006, py + 0.006, bz), 0.0016, 0.012, brass_worn, rot=(0, math.radians(90), 0), verts=12, bevel=0))
    for s in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0045, minor_radius=0.0013, location=(kx - 0.013, py + 0.006 + s * 0.005, bz),
                                         rotation=(0, math.radians(90), 0))
        k_ = bpy.context.active_object
        k_.name = f"bird_key_bow_{s}"
        k_.data.materials.append(brass_worn)
        parts.append(k_)
    return parts


# ---------------------------------------------------------------- hotspots and main

def visible_from(cam, hs):
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok:
        return True
    if obj and (obj.name in hs["objects"] or "glass" in obj.name or obj.name.startswith(("win_pane", "cage_", "flask_bubble", "fridge_"))):
        return True
    return (loc - origin).length > dist - 0.15


def stop_hotspots(cam):
    out = {}
    for key, hs in HOTSPOTS.items():
        yaw, pitch = look(cam, hs["center"], cam[2])
        yaw = round((yaw - CAM_YAW + 540) % 360 - 180, 2)          # relative to the middle of the panorama
        out[key] = {"label": hs["label"], "type": hs["type"], "overlay": hs["overlay"], "yaw": yaw, "pitch": pitch,
                    "distance": round((Vector(hs["center"]) - Vector(cam)).length, 2), "visible": visible_from(cam, hs)}
    return out


def main():
    build()
    scene = bpy.context.scene
    if GLIMPSE:
        # The shop as the glasshouse camera sees it through the glazed door. The Inn wall, the door and anything
        # on the glasshouse side are hidden: the glasshouse draws those itself, and this picture goes behind them.
        for o in scene.objects:
            if o.type == "MESH" and min((o.matrix_world @ Vector(c)).x for c in o.bound_box) >= W - 0.01:
                o.visible_camera = False                             # still there for light and shadow
        eye = (GH_EYE[0] + CHIA_FROM_GH, GH_EYE[1], GH_EYE[2])
        to = plate_target(SHOP_PLATE)
        glimpse_camera(scene, eye, (to[0] + CHIA_FROM_GH, to[1], to[2]), SHOP_PLATE["fov"], res=1200 if PREVIEW else 1600)
        scene.render.filepath = os.path.join(OUT, "chiapothecary_glimpse.jpg")
        if not NO_RENDER:
            bpy.ops.render.render(write_still=True)
        print("[whisked] rendered the glimpse for the glasshouse")
        return
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "chiapothecary.blend"))
    rc = {f"{r},{c}": INGREDIENTS[r * COLS + c] for r in range(ROWS) for c in range(COLS)}
    data = {"room": "chiapothecary", "drawers": {"rows_from_bottom": ROWS, "columns_from_hallway": COLS, "map": rc},
            "stops": {"middle": {"position": list(CAM), "hotspots": stop_hotspots(CAM)}}}
    with open(os.path.join(OUT, "chiapothecary_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    pano_camera(scene, CAM, CAM_YAW)
    scene.render.filepath = os.path.join(OUT, f"chiapothecary_pano_{WEATHER}{'_night' if NIGHT else ''}{'_preview' if PREVIEW else ''}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"[whisked] rendered {WEATHER}{' night' if NIGHT else ''}")
    print("[whisked] done")


main()

# MOVES LATER (the renders are stills; these could be animated over the panorama, or as short loops):
# - the songbird: wind the key (bird_key_*), the beak opens and closes (bird_beak_*), head, wings and tail move
#   a little; it sings like a tui (a free-to-use recording, with a wind-up tick). A white throat tuft could come
#   in a later art pass.
# - bubbles rising in the flasks (flask_bubble_*), a drip from a tap
# - the balance pans settling (scale_pan_*, scale_chain_*, scale_beam)
# - drawers sliding open when touched
