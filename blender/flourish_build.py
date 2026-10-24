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
from appliances import APPLIANCES, appliance_mats  # noqa: E402
from tools import TOOLS, tool_mats  # noqa: E402
from whisked import (ART, ASSETS, OUT, area_light, box, box_span, center_of, cyl, emission_mat, image_mat, look,  # noqa: E402
                     mat, meshes_of, model, pano_camera, pbr, point_light, retint, sphere, srgb, swap_material, text,
                     use_gpu, window_glass)

import timeofday  # noqa: E402
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
                     backdrop=1.1, sun=(9.0, (1.0, 0.9, 0.76), 18, 25), bounce=(75, (1.0, 0.97, 0.93)), wet=0.0, lamps=0.0,
                     fill=8, exposure=0.55),
    "change":   dict(sea="16-window-change.png", garden="26-garden-change.png", dial=0, sky=1.6, tint=(0.96, 0.98, 1.0),
                     backdrop=0.9, sun=None, bounce=(75, (0.93, 0.96, 1.0)), wet=0.0, lamps=0.6, fill=14, exposure=0.6),
    "stormy":   dict(sea="17-window-stormy.png", garden="27-garden-stormy.png", dial=-60, sky=0.55, tint=(0.85, 0.9, 1.0),
                     backdrop=0.5, sun=None, bounce=(28, (0.72, 0.8, 1.0)), wet=0.75, lamps=1.4, fill=16, exposure=0.7),
    "very-dry": dict(sea="18-window-very-dry.png", garden="28-garden-very-dry.png", dial=60, sky=2.3, tint=(1.0, 0.93, 0.82),
                     backdrop=1.15, sun=(10.0, (1.0, 0.86, 0.66), 22, 22), bounce=(70, (1.0, 0.93, 0.84)), wet=0.0, lamps=0.0,
                     fill=7, exposure=0.55),
}
WX = dict(WEATHERS[WEATHER])
NIGHT_SEA = {"rain": "19-night-rain.png", "fair": "20-night-fair.png", "change": "21-night-change.png",
             "stormy": "22-night-stormy.png", "very-dry": "23-night-very-dry.png"}
if NIGHT:
    # Late night: the same weather after dark, every lamp lit
    WX.update(sea=NIGHT_SEA[WEATHER], garden="29-garden-night.png", sky=0.04, tint=(0.55, 0.62, 1.0), backdrop=0.8,
              sun=None, bounce=(4, (0.55, 0.62, 1.0)), lamps=1.4, fill=6, exposure=0.9)

# Dawn and dusk: --dawn / --dusk (timeofday.py). The sea window faces west: the sun reaches it at dusk.
TIME = "dawn" if "--dawn" in ARGS else "dusk" if "--dusk" in ARGS else None
if TIME:
    _d = WEATHERS[WEATHER]
    WX.update(timeofday.look(TIME, WX, "dusk", 25, "lamps"))
    WX.update(sea=timeofday.plate(os.path.join(PACK, _d["sea"]), os.path.join(PACK, NIGHT_SEA[WEATHER]), TIME, f"flourish_sea_{WEATHER}"),
              garden=timeofday.plate(os.path.join(PACK, _d["garden"]), os.path.join(PACK, "29-garden-night.png"), TIME, f"flourish_garden_{WEATHER}"))

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

def hotspot(key, label, target, kind="interactive", overlay=None, appliance=None):
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
    if appliance:
        HOTSPOTS[key]["appliance"] = appliance


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


def leaf(name, base, direction, length, width, material, crinkle=0.012, curl=0.3, seed=0, nx=8, ny=14,
         frill=0.0, frill_waves=0, lobes=0, lobe_amp=0.0, rib=None, blunt=False):
    """A leaf (kale, beet top, herb) as a bent, crinkled strip, from base along direction.
    frill: a tight ruffle along the edges (curly kale); lobes: a scalloped outline (parsley); rib: a midrib material;
    blunt: a rounded tip instead of a point."""
    rnd = random.Random(seed)
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()
    ph = rnd.uniform(0, 6)
    verts, faces, axis = [], [], []
    for j in range(ny):
        t = j / (ny - 1)
        w = width * math.sin(math.pi * min(1, t * 1.05)) ** 0.7
        if blunt:
            w = width * max(0.0, 1 - abs(2 * t - 1) ** 2.5) ** 0.5 * (0.4 + 0.6 * min(1, 3 * t))
        if lobes:
            w *= 1 - lobe_amp * (1 - abs(math.sin(lobes * math.pi * t)))
        for i in range(nx):
            s = i / (nx - 1) * 2 - 1
            bend = curl * t * t * length                    # droops toward the tip
            ripple = crinkle * math.sin(9 * s + ph) * math.sin(13 * t + ph) * (0.3 + abs(s))
            cup = 0.25 * w * s * s
            ruff = bunch = 0.0
            if frill:
                e = abs(s) ** 2.2 * min(1, 4 * t)
                ruff = frill * e * (math.sin(2 * math.pi * frill_waves * t + ph + 2.5 * s)
                                    + 0.5 * math.sin(2 * math.pi * 2.3 * frill_waves * t + 2 * ph - 4 * s)
                                    + 0.3 * math.sin(2 * math.pi * 4.1 * frill_waves * t + 3 * ph + 7 * s))
                # the edge also bunches along the leaf, so the curls fold over rather than stand up as teeth
                bunch = 0.8 * frill * e * math.cos(2 * math.pi * frill_waves * t + ph + 2.5 * s)
            p = Vector(base) + d * (t * length + bunch) + side * (s * w / 2) - up * bend + up * (ripple + cup + ruff)
            verts.append(tuple(p))
            if i == nx // 2:
                axis.append(p + up * 0.0015)
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    o = mesh_obj(name, verts, faces, material)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.0015
    if rib:
        tube(f"{name}_rib", axis[:int(len(axis) * 0.85)], lambda u: 0.0032 * (1 - 0.8 * u), rib, segs=8, n=ny)
    return o


def aged_brass_mat(name):
    """Old brass: yellower than copper, dulled unevenly, tarnished brown in the hollows."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Metallic"].default_value = 1.0
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 7
    nz.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = srgb("#8a6a3c")
    ramp.color_ramp.elements[1].color = srgb("#b8975c")
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.06
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[7].default_value = srgb("#4a3820")              # tarnish
    nt.links.new(ramp.outputs["Color"], mix.inputs[6])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(ao.outputs["AO"], inv.inputs[1])
    nt.links.new(inv.outputs[0], mix.inputs["Factor"])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.3
    rr.inputs["To Max"].default_value = 0.55
    nt.links.new(nz.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], p.inputs["Roughness"])
    return m


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def boule(name, loc, R=0.135, H=0.1, seed=3):
    """A round country loaf, built as real geometry: a domed crust with a cross scored and opened on top,
    crackled all over, floured on the crown. Colours and flour go into mesh attributes for the material."""
    from mathutils import noise
    noise.seed_set(seed)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    me = o.data
    cols, flours = [], []
    turn = math.radians(20)
    deep, gold, pale, crumb = Vector(srgb("#6e3612")[:3]), Vector(srgb("#b06a2a")[:3]), Vector(srgb("#d2a066")[:3]), \
        Vector(srgb("#e2bf8a")[:3])
    for v in me.vertices:
        x, y, z = v.co.normalized()
        top = smoothstep(0.25, 0.75, z)
        # rounded dome, the base flattened where it sat in the banneton
        zt = H * z if z > 0 else max(H * 0.3 * z, -0.022)
        side = 1 + 0.06 * math.sin(math.pi * max(0.0, z))       # a little oven spring round the waist
        p = Vector((x * R * side, y * R * side * 0.95, zt))
        u, w = x * math.cos(turn) - y * math.sin(turn), x * math.sin(turn) + y * math.cos(turn)
        g = max(math.exp(-(u / 0.1) ** 2), math.exp(-(w / 0.1) ** 2)) * top          # the open scores
        ear = max(math.exp(-((abs(u) - 0.17) / 0.06) ** 2), math.exp(-((abs(w) - 0.17) / 0.06) ** 2)) * top * (1 - g)
        dists, _pts = noise.voronoi(p * 34, distance_metric="DISTANCE")
        crack = 1 - smoothstep(0.0, 0.1, dists[1] - dists[0])
        lump = noise.fractal(p * 16, 0.6, 2.0, 4)
        disp = -0.022 * g + 0.009 * ear - 0.0009 * crack * smoothstep(0.0, 0.5, z) * (1 - g) + 0.004 * lump
        v.co = p + Vector((x, y, z * 1.4)).normalized() * disp
        # colour: deep at the crown and on the ears, golden down the sides, pale crumb in the scores, pale base
        c = gold.lerp(deep, min(1.0, 0.75 * top + 0.6 * ear + 0.25 * lump))
        c = c.lerp(pale, crack * 0.18 * top)
        c = c.lerp(crumb, smoothstep(0.35, 0.8, g))
        c = c.lerp(pale, smoothstep(-0.1, -0.5, z))
        cols.append((*c, 1.0))
        dust = smoothstep(0.0, 0.45, noise.noise(p * 18) + 0.3 * noise.noise(p * 70))
        flours.append(dust * smoothstep(0.05, 0.6, z) * (1 - 0.7 * g))
    ca = me.color_attributes.new("crust_col", "FLOAT_COLOR", "POINT")
    fa = me.attributes.new("flour", "FLOAT", "POINT")
    for i, c in enumerate(cols):
        ca.data[i].color = c
        fa.data[i].value = flours[i]
    bpy.ops.object.shade_smooth()
    o.modifiers.new("smooth", "SUBSURF").levels = 1

    m = bpy.data.materials.new(f"{name}_crust")
    m.use_nodes = True
    nt = m.node_tree
    p_ = nt.nodes["Principled BSDF"]
    a_col = nt.nodes.new("ShaderNodeAttribute")
    a_col.attribute_name = "crust_col"
    a_fl = nt.nodes.new("ShaderNodeAttribute")
    a_fl.attribute_name = "flour"
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")                 # fine crackle the mesh is too coarse for
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 150
    vor.inputs["Randomness"].default_value = 1.0
    warp = nt.nodes.new("ShaderNodeTexNoise")
    warp.inputs["Scale"].default_value = 40
    wmix = nt.nodes.new("ShaderNodeVectorMath")
    wmix.operation = "MULTIPLY_ADD"
    wmix.inputs[1].default_value = (0.006, 0.006, 0.006)
    nt.links.new(tc.outputs["Object"], warp.inputs["Vector"])
    nt.links.new(warp.outputs["Color"], wmix.inputs[0])
    nt.links.new(tc.outputs["Object"], wmix.inputs[2])
    nt.links.new(wmix.outputs[0], vor.inputs["Vector"])
    pore = nt.nodes.new("ShaderNodeTexNoise")
    pore.inputs["Scale"].default_value = 420
    pore.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], pore.inputs["Vector"])
    fine = nt.nodes.new("ShaderNodeMapRange")
    fine.inputs["From Max"].default_value = 0.06
    nt.links.new(vor.outputs["Distance"], fine.inputs["Value"])
    crackle = nt.nodes.new("ShaderNodeMix")                    # paler in the fine cracks
    crackle.data_type = "RGBA"
    crackle.inputs[7].default_value = srgb("#d9ad72")
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(fine.outputs["Result"], inv.inputs[1])
    k = nt.nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 0.16
    nt.links.new(inv.outputs[0], k.inputs[0])
    nt.links.new(k.outputs[0], crackle.inputs["Factor"])
    nt.links.new(a_col.outputs["Color"], crackle.inputs[6])
    dusted = nt.nodes.new("ShaderNodeMix")
    dusted.data_type = "RGBA"
    dusted.inputs[7].default_value = srgb("#f1ebdf")
    fl = nt.nodes.new("ShaderNodeMath")                        # flour sits patchy, never solid
    fl.operation = "MULTIPLY"
    nt.links.new(a_fl.outputs["Fac"], fl.inputs[0])
    nt.links.new(pore.outputs["Fac"], fl.inputs[1])
    fl2 = nt.nodes.new("ShaderNodeMath")
    fl2.operation = "MULTIPLY"
    fl2.use_clamp = True
    fl2.inputs[1].default_value = 1.8
    nt.links.new(fl.outputs[0], fl2.inputs[0])
    nt.links.new(fl2.outputs[0], dusted.inputs["Factor"])
    nt.links.new(crackle.outputs[2], dusted.inputs[6])
    nt.links.new(dusted.outputs[2], p_.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.55
    rough.inputs["To Max"].default_value = 0.95
    nt.links.new(fl2.outputs[0], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], p_.inputs["Roughness"])
    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 0.2
    b1.inputs["Distance"].default_value = 0.002
    nt.links.new(fine.outputs["Result"], b1.inputs["Height"])
    b2 = nt.nodes.new("ShaderNodeBump")
    b2.inputs["Strength"].default_value = 0.25
    b2.inputs["Distance"].default_value = 0.0005
    nt.links.new(pore.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])
    nt.links.new(b2.outputs["Normal"], p_.inputs["Normal"])
    me.materials.append(m)
    return o


# Dry goods for the dresser jars: (shape, size x/y/z in metres) per kind; the thin axis is z, laid against the glass
GRAINS = {
    "barley":    ("bead", (0.0055, 0.0038, 0.0032)),
    "lentil":    ("disc", (0.0042, 0.0042, 0.0017)),
    "chickpea":  ("lumpy", (0.0085, 0.008, 0.0078)),
    "hazelnut":  ("point", (0.014, 0.0125, 0.0125)),
    "pumpkin":   ("point", (0.015, 0.0085, 0.0028)),
    "split_pea": ("disc", (0.006, 0.006, 0.0028)),
    "almond":    ("point", (0.022, 0.013, 0.0075)),
    "rice":      ("bead", (0.0065, 0.0022, 0.002)),
    "walnut":    ("lumpy", (0.024, 0.02, 0.012)),
}


def grain_piece(kind, colour):
    """One grain, seed or nut at the origin, hidden; the jar fills instance it."""
    shape, (sx, sy, sz) = GRAINS[kind]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=1)
    o = bpy.context.active_object
    o.name = f"grain_{kind}"
    from mathutils import noise
    for v in o.data.vertices:
        x, y, z = v.co
        if shape == "point":                       # almonds, seeds, hazelnuts: taper to a tip
            k = 1 - 0.45 * max(0.0, x)
            y, z = y * k, z * k
        elif shape == "disc":
            z *= 0.7 + 0.3 * abs(z)
        elif shape == "lumpy":
            n = 1 + 0.18 * noise.noise(Vector((x, y, z)) * 2.5)
            x, y, z = x * n, y * n, z * n
        v.co = (x * sx / 2, y * sy / 2, z * sz / 2)
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new(f"grain_{kind}")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.55 if kind in ("lentil", "split_pea", "pumpkin") else 0.7
    info = nt.nodes.new("ShaderNodeObjectInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    base = srgb(colour)
    ramp.color_ramp.elements[0].color = tuple(c * 0.7 for c in base[:3]) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1.0, c * 1.12) for c in base[:3]) + (1,)
    nt.links.new(info.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 900 if kind in ("walnut", "almond", "hazelnut") else 300
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = 0.5 if kind in ("walnut", "almond", "hazelnut") else 0.15
    nt.links.new(nz.outputs["Fac"], b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    o.data.materials.append(m)
    o.hide_render = True
    o.hide_viewport = True
    return o


def grain_scatter(target, piece, spacing, seed):
    """Geometry nodes: cover target's surface with piece, packed, each lying against the surface, turned at random."""
    ng = bpy.data.node_groups.new(f"{target.name}_grains", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    dist = N.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = "POISSON"
    dist.inputs["Distance Min"].default_value = spacing
    dist.inputs["Density Max"].default_value = 3.0 / spacing ** 2
    dist.inputs["Seed"].default_value = seed
    info = N.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = piece
    rnd_rot = N.new("FunctionNodeRandomValue")
    rnd_rot.data_type = "FLOAT_VECTOR"
    vin = [s for s in rnd_rot.inputs if s.type == "VECTOR"]
    vin[0].default_value = (-0.5, -0.5, 0.0)
    vin[1].default_value = (0.5, 0.5, 2 * math.pi)
    rnd_rot.inputs["Seed"].default_value = seed + 1
    e2r = N.new("FunctionNodeEulerToRotation")
    rot = N.new("FunctionNodeRotateRotation")
    rot.rotation_space = "LOCAL"
    rnd_s = N.new("FunctionNodeRandomValue")
    rnd_s.data_type = "FLOAT"
    fin = [s for s in rnd_s.inputs if s.type == "VALUE" and s.name in ("Min", "Max")]
    fin[0].default_value, fin[1].default_value = 0.8, 1.15
    rnd_s.inputs["Seed"].default_value = seed + 2
    inst = N.new("GeometryNodeInstanceOnPoints")
    join = N.new("GeometryNodeJoinGeometry")
    L = ng.links.new
    L(gi.outputs[0], dist.inputs["Mesh"])
    L(dist.outputs["Points"], inst.inputs["Points"])
    L(info.outputs["Geometry"], inst.inputs["Instance"])
    L(next(s for s in rnd_rot.outputs if s.type == "VECTOR"), e2r.inputs[0])
    L(dist.outputs["Rotation"], rot.inputs["Rotation"])
    L(e2r.outputs[0], rot.inputs["Rotate By"])
    L(rot.outputs[0], inst.inputs["Rotation"])
    L(next(s for s in rnd_s.outputs if s.type == "VALUE"), inst.inputs["Scale"])
    L(gi.outputs[0], join.inputs[0])
    L(inst.outputs["Instances"], join.inputs[0])
    L(join.outputs[0], go.inputs[0])
    target.modifiers.new("grains", "NODES").node_group = ng
    return target


def grain_jar(name, x, y, z, r, h, kind, colour, glass, lid_mat, seed):
    """A thin-walled storage jar, three-quarters full of a dry good packed against the glass, a mounded top."""
    jar = lathe(name, [(r * 0.94, 0.0), (r, 0.006), (r, h - 0.024), (r * 0.94, h - 0.01), (r * 0.9, h - 0.004), (r * 0.9, h)],
                glass, (x, y, z), segs=64, thick=0.003)
    jar.modifiers["thick"].offset = -1
    _shape, size = GRAINS[kind]
    piece = grain_piece(kind, colour)
    rc = r - 0.004 - 0.5 * size[2] - 0.2 * size[0]
    fh = h * 0.68
    core_mat = mat(f"{name}_gaps", tuple(c * 0.35 for c in srgb(colour)[:3]) + (1,), rough=0.9)
    core = lathe(f"{name}_fill", [(rc, 0.006), (rc, fh), (rc * 0.75, fh + 0.008), (rc * 0.35, fh + 0.014), (0.0, fh + 0.016)],
                 core_mat, (x, y, z), segs=48)
    grain_scatter(core, piece, max(0.002, 0.8 * min(size[0], size[1])), seed)
    lid = cyl(f"{name}_lid", (x, y, z + h + 0.01), r * 0.95, 0.022, lid_mat)
    return [jar, core, lid]


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
    honey = pbr("honey_oak", "worn_planks", 1.2, tint=srgb("#b18451"), tint_mix=0.45, bump=0.4)
    pine = pbr("scrubbed_pine", "worn_planks", 1.6, tint=srgb("#c9a676"), tint_mix=0.45, rough_add=0.1, bump=0.4)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    door_cream = pbr("door_cream", "worn_planks", 1.2, tint=srgb("#e6dcc4"), tint_mix=0.8, rough_add=0.1)
    walnut = pbr("walnut", "wood_table_worn", 0.6, tint=srgb("#6b4128"), tint_mix=0.6)
    trug_wood = pbr("trug_wood", "wood_table_worn", 0.5, tint=srgb("#aa8253"), tint_mix=0.5, rough_add=0.1, rot_z=90)
    jute = pbr("jute", "rough_linen", 0.3, tint=srgb("#a88a5c"), tint_mix=1.0, bump=1.2)
    marigold_linen = pbr("marigold_linen", "rough_linen", 0.5, tint=srgb("#d9a441"), tint_mix=0.85, bump=0.5)
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
    flour = mat("flour", srgb("#eee8dc"), rough=0.95)
    egg_mats = [mat(f"egg_{i}", srgb(c), rough=0.5) for i, c in enumerate(("#b67e55", "#a86f48", "#c29169", "#9c6640"))]
    oats = color_noise_mat("oats", "#7f6038", "#c2a26c", rough=0.85, scale=140, bump=1.0)
    soil = color_noise_mat("soil", "#2c2416", "#514331", rough=0.95, scale=60, bump=0.5)
    kale = color_noise_mat("kale", "#24382a", "#4d6a4a", rough=0.5, scale=30, bump=0.4, sss=0.0)   # blue-green
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
    # Stiles and rails stand 24 mm proud of the panels; a moulding steps down inside each opening to a raised field
    sx_, pw_ = 0.024, 0.17
    cols_ = [(py - pw_, py + pw_) for py in (0.235, lw - 0.235)]
    rows_ = [(0.2, 0.95), (1.12, 1.95)]
    door_parts.append(box_span("hall_stile_l", fx, fx + sx_, hy0, hy0 + cols_[0][0], 0.012, 0.012 + lh, door_oak, bevel=0.004))
    door_parts.append(box_span("hall_muntin", fx, fx + sx_, hy0 + cols_[0][1], hy0 + cols_[1][0], 0.012, 0.012 + lh, door_oak, bevel=0.004))
    door_parts.append(box_span("hall_stile_r", fx, fx + sx_, hy0 + cols_[1][1], hy0 + lw, 0.012, 0.012 + lh, door_oak, bevel=0.004))
    for nm, z0, z1 in (("bottom", 0.012, rows_[0][0]), ("lock", rows_[0][1], rows_[1][0]), ("top", rows_[1][1], 0.012 + lh)):
        for c0, c1 in cols_:
            door_parts.append(box_span(f"hall_rail_{nm}_{c0:.2f}", fx, fx + sx_, hy0 + c0 - 0.004, hy0 + c1 + 0.004, z0, z1,
                                       door_oak, bevel=0.004))
    for c0, c1 in cols_:
        for pz0, pz1 in rows_:
            tag = f"{c0:.2f}_{pz0}"
            mw = 0.018                              # the moulding: 16 mm proud, bevelled down into the opening
            for nm, a0, a1, b0, b1 in (("l", c0, c0 + mw, pz0, pz1), ("r", c1 - mw, c1, pz0, pz1),
                                       ("b", c0, c1, pz0, pz0 + mw), ("t", c0, c1, pz1 - mw, pz1)):
                door_parts.append(box_span(f"hall_mould_{tag}_{nm}", fx, fx + 0.016, hy0 + a0, hy0 + a1, b0, b1,
                                           door_dark, bevel=0.007))
            # the fielded panel: a flat margin at the leaf face, then a raised field with wide bevelled edges
            door_parts.append(box_span(f"hall_field_{tag}", fx, fx + 0.011, hy0 + c0 + 0.055, hy0 + c1 - 0.055,
                                       pz0 + 0.055, pz1 - 0.055, door_oak, bevel=0.01))
    door_parts.append(cyl("hall_knob", (fx + sx_ + 0.03, hy0 + lw - 0.07, 1.0), 0.028, 0.05, brass_worn, rot=(0, math.radians(90), 0)))
    door_parts.append(cyl("hall_rose", (fx + sx_ + 0.004, hy0 + lw - 0.07, 1.0), 0.03, 0.008, brass_worn, rot=(0, math.radians(90), 0)))
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
    # upper leaf: swung right round into the room and back against the wall, so the morning sun comes straight in
    up = stable_leaf("sd_up", SD_SPLIT + 0.005, SD_H - 0.02)
    m_up = Matrix.Rotation(math.radians(160), 4, "Z") @ m_closed
    m_up.translation = Vector((W - 0.01, sy0 + 0.01, 0))
    up_g = group("sd_upper", m_up, up)
    # so it reads as a hinged leaf: iron pintles on the jamb at the strap heights, and a stay rod holding it back to the wall
    for z_ in (SD_SPLIT + 0.005 + 0.12, SD_H - 0.02 - 0.12):
        cyl(f"sd_pintle_{z_:.2f}", (W - 0.025, sy0 + 0.012, z_), 0.011, 0.11, iron, verts=12, bevel=0)
    bpy.context.view_layer.update()
    free = up_g.matrix_world @ Vector((SD_W - 0.04, 0.05, 1.5))
    hook = (W - 0.012, free.y, 1.5)
    cyl("sd_hook_plate", (W - 0.01, free.y, 1.5), 0.02, 0.012, iron, verts=16, bevel=0, rot=(0, math.radians(90), 0))
    rod = cyl("sd_stay", ((hook[0] + free.x) / 2, free.y, 1.5), 0.005, abs(hook[0] - free.x), iron, verts=8, bevel=0, rot=(0, math.radians(90), 0))
    cyl("sd_stay_eye", (free.x, free.y, 1.5), 0.012, 0.012, iron, verts=16, bevel=0, rot=(0, math.radians(90), 0))
    hotspot("fl-back-door", "The garden door", meshes_of(low_g) + meshes_of(up_g), kind="door")
    # The garden through the open top: plate horizon 42% down, at eye height
    g_w, g_h = 9.0, 3.0
    backdrop("view_garden", os.path.join(PACK, WX["garden"]), (W + 3.5, 7.5, EYE + 0.42 * g_h - g_h / 2), (g_w, g_h), "-x",
             WX["backdrop"])
    brick = pbr("brick", "terracotta_floor_tiles", 0.8)
    box_span("garden_step", W + 0.3, W + 1.0, sy0 - 0.2, sy1 + 0.2, -0.12, -0.05, brick)
    box_span("garden_patio", W + 0.3, W + 2.9, sy0 - 0.2, D + 2.2, -0.12, -0.05, brick)     # the barbecue's flags

    # Trug of vegetables on the floor beside the door, soil still on them
    tx, ty = 4.1, 2.3
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

    # Peg rail on the hallway wall, between the door and the front corner: an apron and a tea towel
    box_span("peg_rail", 0, 0.03, 0.55, 1.95, 1.62, 1.72, honey, bevel=0.005)
    for k, y in enumerate((0.75, 1.1, 1.45, 1.8)):
        cyl(f"peg_{k}", (0.07, y, 1.67), 0.013, 0.08, honey, rot=(0, math.radians(90), 0))
    box_span("apron", 0.03, 0.05, 0.92, 1.28, 0.95, 1.66, marigold_linen, bevel=0.01)
    box_span("apron_tie", 0.03, 0.045, 1.08, 1.12, 1.66, 1.69, marigold_linen)
    box_span("peg_towel", 0.04, 0.055, 1.63, 1.95, 1.25, 1.66, towel_mat, bevel=0.006)
    model("wicker_basket_01", (0.3, 1.0, 0), rot_z=80, scale=1.1)
    model("potted_plant_04", (4.2, 0.35, 0), rot_z=30, scale=1.6)

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
    fills = [("barley", "#d8c9a3", 1.68), ("lentil", "#c8642a", 1.68), ("chickpea", "#e3cf9a", 1.68), ("hazelnut", "#8a5a32", 1.68),
             ("pumpkin", "#6f8a3e", 1.68), ("split_pea", "#d9b13a", 1.3), ("almond", "#b07a4a", 1.3), ("rice", "#ece2c8", 1.3),
             ("lentil", "#4d4a3a", 1.3), ("walnut", "#a8794a", 1.3)]
    xs = {1.68: [dx0 + 0.48, dx0 + 0.72, dx0 + 0.96, dx0 + 1.32, dx0 + 1.56], 1.3: [dx0 + 0.2, dx0 + 0.44, dx0 + 0.86, dx0 + 1.1, dx0 + 1.5]}
    count = {1.68: 0, 1.3: 0}
    for i, (kind, colour, z) in enumerate(fills):
        x = xs[z][count[z]]
        count[z] += 1
        r, h = (0.06, 0.2) if i % 3 else (0.065, 0.24)
        stock += grain_jar(f"jar_{i}", x, 0.14, z + 0.002, r, h, kind, colour, glass, honey if i % 2 else chrome, seed=300 + i)
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
    for k in range(5):
        a = math.radians(k * 72 + 20)
        sp = cyl(f"crock_spoon_{k}", (dx0 + 0.3 + 0.02 * math.cos(a), 0.3 + 0.02 * math.sin(a), 0.9 + 0.17), 0.007, 0.3, honey,
                 verts=10, rot=(math.radians(8 * math.sin(a)), math.radians(8 * math.cos(a)), 0))
        if k % 2 == 0:
            sphere(f"crock_spoon_head_{k}", (dx0 + 0.3 + 0.04 * math.cos(a), 0.3 + 0.04 * math.sin(a), 1.22), 0.022, honey, scale=(1, 0.5, 1.5))
    stock.append(crock)
    box_span("napkins", dx0 + 0.8, dx0 + 1.1, 0.12, 0.38, 0.9, 0.94, marigold_linen, bevel=0.01)
    hotspot("fl-dresser", "The dresser", [base, top] + shelves + stock, kind="ambient")

    # ---- Your kitchen: the cooking appliances. A food processor on the hutch's worktop, left of the spoon crock's neighbour
    # napkins; a low bench of the same paint on the garden wall (under the botanical print) for the air fryer and slow cooker;
    # a kettle barbecue outside the stable door, seen through its open top half.
    am = appliance_mats()
    fp = APPLIANCES["food-processor"](am, (2.15, 0.3, 0.9), rot_z=0, name="app_food_processor")
    fp.scale = (0.85, 0.85, 0.85)            # clear of the hutch's lowest shelf
    bpy.context.view_layer.update()
    hotspot("fl-food-processor", "The food processor", fp, kind="kitchen", appliance="food-processor")
    bx0, by0, by1 = W - 0.52, 0.7, 2.0
    box_span("bench_base", bx0, W, by0, by1, 0.06, 0.86, dresser_paint, bevel=0.01)
    box_span("bench_plinth", bx0 + 0.02, W, by0 + 0.02, by1 - 0.02, 0, 0.06, dresser_paint, bevel=0.004)
    for i in range(2):
        yc = by0 + (by1 - by0) * (i + 0.5) / 2
        box_span(f"bench_door_{i}", bx0 - 0.015, bx0, yc - 0.28, yc + 0.28, 0.1, 0.8, dresser_paint, bevel=0.008)
        sphere(f"bench_knob_{i}", (bx0 - 0.03, yc + (0.2 if i == 0 else -0.2), 0.62), 0.016, brass_worn)
    box_span("bench_top", bx0 - 0.03, W, by0 - 0.02, by1 + 0.02, 0.86, 0.9, honey, bevel=0.008)
    af = APPLIANCES["air-fryer"](am, (W - 0.27, 1.18, 0.9), rot_z=90, name="app_air_fryer")
    hotspot("fl-air-fryer", "The air fryer", af, kind="kitchen", appliance="air-fryer")
    sc = APPLIANCES["slow-cooker"](am, (W - 0.27, 1.64, 0.9), rot_z=90, name="app_slow_cooker")
    hotspot("fl-slow-cooker", "The slow cooker", sc, kind="kitchen", appliance="slow-cooker")
    hearth = pbr("hearth_brick", "terracotta_floor_tiles", 0.5, tint=srgb("#b9a58a"), tint_mix=0.5)
    box_span("bbq_hearth", 5.9, 6.7, 5.0, 5.8, -0.12, 0.7, hearth, bevel=0.01)             # a brick plinth, so the lid and bowl clear the shut lower leaf
    box_span("bbq_hearth_cap", 5.86, 6.74, 4.96, 5.84, 0.7, 0.74, hearth, bevel=0.01)
    bbq = APPLIANCES["bbq"](am, (6.3, 5.4, 0.74), rot_z=215, name="app_bbq")
    hotspot("fl-bbq", "The barbecue", bbq, kind="kitchen", appliance="bbq")

    # ---- Teaching tools: a knife block and scales on the hutch worktop; a colander and a heavy skillet on the peg rail
    tm = tool_mats()
    kb = TOOLS["knife-block"](tm, (2.88, 0.3, 0.9), rot_z=0, name="app_knife_block")
    hotspot("fl-knife-block", "The knife block", kb, kind="ambient")
    sc2 = TOOLS["scales"](tm, (3.22, 0.3, 0.9), rot_z=0, name="app_scales")
    hotspot("fl-scales", "The scales", sc2, kind="ambient")
    col = TOOLS["colander"](tm, (0.1, 0.75, 1.7), rot_z=-90, name="app_colander")
    hotspot("fl-colander", "The colander", col, kind="ambient")
    sk = TOOLS["skillet"](tm, (0.1, 1.45, 1.7), rot_z=-90, name="app_skillet")
    hotspot("fl-skillet", "The skillet", sk, kind="ambient")

    # Phonograph on its side table: walnut case, black record, brass horn, a winding crank
    px, py = 0.9, 0.32
    old_brass = aged_brass_mat("aged_brass")          # the horn read as copper in plain brass
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
    plate = cyl("ph_badge", (0, 0.183, 0.12), 0.045, 0.004, old_brass, rot=(math.radians(90), 0, 0))
    plate.scale = (1, 0.6, 1)
    ph.append(plate)
    ph.append(cyl("ph_platter", (0.0, 0.02, 0.212), 0.15, 0.012, iron, bevel=0.002))
    ph.append(cyl("ph_record", (0.0, 0.02, 0.22), 0.145, 0.003, vinyl, bevel=0))
    ph.append(cyl("ph_label", (0.0, 0.02, 0.2225), 0.042, 0.001, label_mat, bevel=0))
    ph.append(cyl("ph_spindle", (0.0, 0.02, 0.23), 0.004, 0.02, chrome, verts=12, bevel=0))
    # tone arm: from a post at the back right, round to the soundbox resting on the record
    ph.append(cyl("ph_post", (0.15, -0.13, 0.24), 0.018, 0.07, old_brass, bevel=0.003))
    ph.append(tube("ph_arm", [(0.15, -0.13, 0.27), (0.12, -0.02, 0.27), (0.08, 0.06, 0.26)], lambda u: 0.012 - 0.004 * u, old_brass, segs=14, n=12))
    ph.append(cyl("ph_soundbox", (0.07, 0.07, 0.25), 0.03, 0.014, old_brass, rot=(0, math.radians(90), 0)))
    # horn: up from the post, bending forward into a scalloped bell
    horn = tube("ph_horn", [(0.15, -0.13, 0.27), (0.15, -0.16, 0.38), (0.1, -0.1, 0.5), (0.0, 0.02, 0.6), (-0.05, 0.14, 0.68)],
                lambda u: 0.016 + 0.015 * u + 0.19 * u ** 4.5, old_brass, segs=48, n=70, open_end=True, petals=8, petal_amp=0.07)
    ph.append(horn)
    # crank on the right side
    ph.append(cyl("ph_crank_boss", (0.205, 0.0, 0.12), 0.025, 0.012, old_brass, rot=(0, math.radians(90), 0)))
    ph.append(cyl("ph_crank_shaft", (0.25, 0.0, 0.12), 0.006, 0.08, old_brass, verts=12, rot=(0, math.radians(90), 0)))
    ph.append(box_span("ph_crank_arm", 0.285, 0.295, -0.005, 0.005, 0.12, 0.22, old_brass))
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
    bpy.context.view_layer.update()
    board_top = max((o.matrix_world @ Vector(c)).z for o in meshes_of(board) for c in o.bound_box)
    loaf = boule("loaf", (cx + 0.05, cy - 0.15, board_top + 0.02), R=0.13, H=0.1)
    loaf.rotation_euler = (0, 0, math.radians(8))
    box("knife_blade", (cx + 0.12, cy - 0.27, z_on + 0.045), (0.2, 0.025, 0.002), chrome, bevel=0.001).rotation_euler = (0, 0, math.radians(-6))
    box("knife_handle", (cx - 0.02, cy - 0.26, z_on + 0.048), (0.11, 0.022, 0.016), walnut, bevel=0.005).rotation_euler = (0, 0, math.radians(-6))
    for k in range(260):                            # a dusting of flour round the loaf, finer toward the edges
        a, r = rnd.uniform(0, 6.28), 0.13 + 0.12 * rnd.random() ** 1.5
        sphere(f"flour_{k}", (cx + 0.05 + r * math.cos(a), cy - 0.15 + 0.8 * r * math.sin(a), board_top + 0.0005),
               rnd.uniform(0.0006, 0.0018) * (1.3 - r * 2), flour, scale=(rnd.uniform(1, 2.2), rnd.uniform(1, 1.6), 0.12))
    # wooden bowl of kale, greens and herbs just picked
    gb_at = (cx - 0.35, cy + 0.2)
    gbowl = lathe("greens_bowl", [(0.0, 0.0), (0.07, 0.0), (0.12, 0.04), (0.14, 0.09), (0.145, 0.1)], green_glaze,
                  (*gb_at, z_on), thick=0.006)
    gs = [gbowl]
    kale_rib = mat("kale_rib", srgb("#a9b98f"), rough=0.5)
    for i in range(36):                             # curly kale: broad, round-ended, tightly frilled, mounded and flopping over the rim
        a = i * 2.39996 + rnd.uniform(-0.3, 0.3)
        inner = i < 12
        r0 = rnd.uniform(0.0, 0.04) if inner else rnd.uniform(0.04, 0.09)
        out = rnd.uniform(0.2, 0.6) if inner else rnd.uniform(0.7, 1.3)
        gs.append(leaf(f"bowl_kale_{i}", (gb_at[0] + r0 * math.cos(a), gb_at[1] + r0 * math.sin(a), z_on + rnd.uniform(0.05, 0.08)),
                       (math.cos(a) * out, math.sin(a) * out, 1.0), rnd.uniform(0.08, 0.11) if inner else rnd.uniform(0.1, 0.13),
                       rnd.uniform(0.08, 0.11), kale, crinkle=0.01, curl=rnd.uniform(0.3, 0.6) if inner else rnd.uniform(0.6, 0.9),
                       seed=100 + i, nx=18, ny=60, frill=0.011, frill_waves=rnd.uniform(9, 12), rib=kale_rib, blunt=True))
    parsley = color_noise_mat("parsley", "#3a7424", "#5c9a32", rough=0.42, scale=30, bump=0.15)
    stalk = mat("parsley_stalk", srgb("#6f9a45"), rough=0.5)
    for i in range(12):                             # flat-leaf parsley: thin stalks, each with three-lobed leaflets
        a = rnd.uniform(0, 6.28)
        r0 = rnd.uniform(0.03, 0.08)
        s0 = Vector((gb_at[0] + r0 * math.cos(a), gb_at[1] + r0 * math.sin(a), z_on + 0.06))
        d0 = Vector((math.cos(a) * rnd.uniform(0.4, 0.9), math.sin(a) * rnd.uniform(0.4, 0.9), 1.0)).normalized()
        L0 = rnd.uniform(0.08, 0.12)
        tip = s0 + d0 * L0 + Vector((0, 0, -0.015))
        gs.append(tube(f"parsley_stalk_{i}", [s0, s0 + d0 * L0 * 0.55, tip], lambda u: 0.0016 - 0.0006 * u, stalk, segs=8, n=10))
        for k, turn in enumerate((-0.9, 0.0, 0.9)):     # a leaflet at the tip and one either side
            dl = (d0 + Vector((-d0.y, d0.x, 0)) * turn).normalized()
            dl.z -= 0.25
            gs.append(leaf(f"parsley_{i}_{k}", tip, dl, rnd.uniform(0.032, 0.042), rnd.uniform(0.028, 0.036), parsley,
                           crinkle=0.002, curl=0.35, seed=200 + i * 3 + k, nx=10, ny=16, lobes=3, lobe_amp=0.35))
    hotspot("fl-greens", "The greens", gs, kind="ambient")
    # bowl of oats and seeds, a few spilled
    ob_at = (cx + 0.5, cy - 0.05)
    obowl = lathe("oat_bowl", [(0.0, 0.0), (0.055, 0.0), (0.1, 0.035), (0.12, 0.08), (0.125, 0.09)], stoneware, (*ob_at, z_on), thick=0.006)
    oat_fill = cyl("oat_fill", (*ob_at, z_on + 0.072), 0.112, 0.012, oats, bevel=0.006)
    bumpy(oat_fill, strength=0.006, size=0.02, subsurf=2)
    for k in range(110):
        a, r = rnd.uniform(0, 6.28), 0.1 * math.sqrt(rnd.uniform(0, 1))
        sphere(f"bowl_oat_{k}", (ob_at[0] + r * math.cos(a), ob_at[1] + r * math.sin(a), z_on + 0.079 + 0.012 * (1 - r / 0.1)),
               0.007, oats, scale=(1.4, 1, 0.3)).rotation_euler = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 3))
    seed_mats = [mat("pumpkin_seed", srgb("#5d6b35"), rough=0.6), mat("sunflower_seed", srgb("#8a7d68"), rough=0.6)]
    for k in range(26):
        a, r = rnd.uniform(0, 6.28), rnd.uniform(0, 0.09)
        sphere(f"seed_{k}", (ob_at[0] + r * math.cos(a), ob_at[1] + r * math.sin(a), z_on + 0.08), 0.007, seed_mats[k % 2],
               scale=(1.5, 0.8, 0.35)).rotation_euler = (0, 0, rnd.uniform(0, 3))
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
    c1 = model("painted_wooden_chair_01", (cx - 0.45, cy + tw / 2 + 0.28, 0), rot_z=4)
    retint(c1, "#6e4a2b", lo=0.6, hi=1.2)
    c2 = model("painted_wooden_chair_01", (cx + 0.45, cy + tw / 2 + 0.3, 0), rot_z=-7)
    retint(c2, "#8a6a48", lo=0.6, hi=1.15)
    c3 = model("gallinera_chair", (cx - tl / 2 - 0.32, cy - 0.05, 0), rot_z=92)
    retint(c3, "#8a6440", lo=0.6, hi=1.2)
    c4 = model("painted_wooden_chair_01", (cx + tl / 2 + 0.3, cy + 0.25, 0), rot_z=-80)
    retint(c4, "#a07a4e", lo=0.6, hi=1.15)

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
        if hs.get("appliance"):
            out[key]["appliance"] = hs["appliance"]
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
    scene.render.filepath = os.path.join(OUT, f"flourish_pano_{WEATHER}{'_night' if NIGHT else '_' + TIME if TIME else ''}{'_preview' if PREVIEW else ''}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"[whisked] rendered {WEATHER}{' night' if NIGHT else ''}")
    print("[whisked] done")


main()
