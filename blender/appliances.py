"""
The Inn's cooking appliances (Your kitchen): modelled simply, for a storybook inn. Cream enamel, brass, rounded
retro shapes; nothing glossy black or plastic-modern. Shared by flourish_build.py and cuddlecore_build.py.

Each builder makes its parts in local metres, base centred on the origin, front facing local +Y, then parents them
to an empty at `loc` turned by `rot_z` degrees about Z (0 = front faces +Y, 90 = front faces -X, -90 = +X, 180 = -Y).
It returns that empty (so `meshes_of(empty)` gives the parts, as for the Poly Haven models).

    from appliances import APPLIANCES, appliance_mats
    m = appliance_mats()
    slow = APPLIANCES["slow-cooker"](m, (x, y, z), rot_z=90)
"""
import bpy
import math

from mathutils import Matrix, Vector
from whisked import box, cyl, mat, sphere, srgb


def appliance_mats():
    return {
        "enamel": mat("app_enamel", srgb("#ece3cf"), rough=0.3, coat=0.6),
        "honey": mat("app_honey_glaze", srgb("#d9a441"), rough=0.28, coat=0.5),
        "sage": mat("app_sage_enamel", srgb("#66805d"), rough=0.32, coat=0.5),
        "brass": mat("app_brass", srgb("#bd9655"), rough=0.3, metal=1.0),
        "iron": mat("app_iron", srgb("#2a2622"), rough=0.6, metal=0.8),
        "dark": mat("app_dark_glass", srgb("#1d1f1f"), rough=0.12, coat=0.5),
        "glass": mat("app_glass", (0.96, 0.98, 0.97, 1), rough=0.03, transmission=1.0, ior=1.5),
        "rubber": mat("app_rubber", srgb("#3a342c"), rough=0.8),
        "cream": mat("app_cream_knob", srgb("#f1e8d4"), rough=0.4, coat=0.3),
    }


def _group(name, parts, loc, rot_z):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot_z), 4, "Z")
    bpy.context.view_layer.update()
    return root


def _dial(name, x, y, z, r, m, parts):
    """A round brass knob on the front face (the cylinder's axis points out along +Y)."""
    parts.append(cyl(f"{name}_dial", (x, y, z), r, 0.02, m["brass"], verts=32, bevel=0.003, rot=(math.radians(90), 0, 0)))
    parts.append(box(f"{name}_pointer", (x, y + 0.011, z + r * 0.45), (0.004, 0.004, r * 0.8), m["iron"], bevel=0.0005))


def slow_cooker(m, loc, rot_z=0.0, name="slow_cooker"):
    """An oval crock on a cream enamel base: honey-glaze pot and lid, brass band, handles and a dial. 0.4 x 0.3 x 0.33 m."""
    p = []
    sx = 1.38
    base = cyl(f"{name}_base", (0, 0, 0.05), 0.145, 0.1, m["enamel"], verts=64, bevel=0.016)
    base.scale = (sx, 1, 1)
    p.append(base)
    band = cyl(f"{name}_band", (0, 0, 0.104), 0.149, 0.014, m["brass"], verts=64, bevel=0.003)
    band.scale = (sx, 1, 1)
    p.append(band)
    pot = cyl(f"{name}_pot", (0, 0, 0.18), 0.15, 0.14, m["honey"], verts=64, bevel=0.03)
    pot.scale = (sx, 1, 1)
    p.append(pot)
    lid = sphere(f"{name}_lid", (0, 0, 0.245), 0.15, m["honey"], scale=(sx, 1, 0.42))
    p.append(lid)
    p.append(sphere(f"{name}_knob", (0, 0, 0.3), 0.024, m["brass"]))
    p.append(cyl(f"{name}_knob_stem", (0, 0, 0.292), 0.009, 0.02, m["brass"], verts=16, bevel=0))
    for s in (-1, 1):
        p.append(box(f"{name}_handle_{s}", (s * 0.213, 0, 0.2), (0.032, 0.06, 0.022), m["brass"], bevel=0.007))
    for s in (-1, 1):
        p.append(cyl(f"{name}_foot_{s}", (s * 0.12, 0.05, 0.006), 0.016, 0.012, m["rubber"], verts=16, bevel=0))
    _dial(name, 0, 0.145, 0.055, 0.026, m, p)
    p.append(sphere(f"{name}_lamp", (0.075, 0.139, 0.055), 0.009, m["honey"], scale=(1, 0.5, 1)))
    return _group(name, p, loc, rot_z)


def food_processor(m, loc, rot_z=0.0, name="food_processor"):
    """A cream enamel motor base, glass bowl, brass trim and feed tube. 0.24 x 0.22 x 0.42 m."""
    p = []
    p.append(box(f"{name}_base", (0, 0, 0.075), (0.21, 0.22, 0.15), m["enamel"], bevel=0.038))
    p.append(cyl(f"{name}_ring", (0, 0, 0.154), 0.098, 0.014, m["brass"], verts=48, bevel=0.003))
    bowl = cyl(f"{name}_bowl", (0, 0, 0.24), 0.095, 0.16, m["glass"], verts=48, bevel=0.012)
    p.append(bowl)
    p.append(cyl(f"{name}_blade_hub", (0, 0, 0.2), 0.014, 0.05, m["brass"], verts=16, bevel=0.002))
    p.append(box(f"{name}_blade", (0, 0, 0.176), (0.11, 0.018, 0.004), m["brass"], bevel=0.001))
    p.append(cyl(f"{name}_lid", (0, 0, 0.332), 0.1, 0.026, m["enamel"], verts=48, bevel=0.008))
    p.append(cyl(f"{name}_tube", (0.03, 0, 0.375), 0.036, 0.07, m["enamel"], verts=32, bevel=0.006))
    p.append(cyl(f"{name}_pusher", (0.03, 0, 0.42), 0.028, 0.03, m["brass"], verts=32, bevel=0.006))
    p.append(box(f"{name}_handle", (-0.113, 0, 0.255), (0.024, 0.036, 0.11), m["brass"], bevel=0.008))
    _dial(name, 0, 0.11, 0.075, 0.024, m, p)
    for k, x in enumerate((-0.062, 0.062)):
        p.append(cyl(f"{name}_btn_{k}", (x, 0.11, 0.075), 0.011, 0.012, m["cream"], verts=20, bevel=0.002,
                     rot=(math.radians(90), 0, 0)))
    return _group(name, p, loc, rot_z)


def air_fryer(m, loc, rot_z=0.0, name="air_fryer"):
    """A rounded cream enamel drum with a pull-out drawer, brass handle and two dials. 0.30 x 0.36 x 0.34 m."""
    p = []
    p.append(box(f"{name}_body", (0, 0, 0.18), (0.30, 0.36, 0.32), m["enamel"], bevel=0.07))
    p.append(box(f"{name}_drawer", (0, 0.178, 0.135), (0.25, 0.014, 0.19), m["enamel"], bevel=0.012))
    p.append(box(f"{name}_drawer_trim", (0, 0.171, 0.135), (0.262, 0.01, 0.202), m["brass"], bevel=0.004))
    p.append(box(f"{name}_handle", (0, 0.205, 0.2), (0.2, 0.022, 0.016), m["brass"], bevel=0.006))
    for s in (-1, 1):
        p.append(box(f"{name}_handle_post_{s}", (s * 0.085, 0.19, 0.2), (0.016, 0.03, 0.016), m["brass"], bevel=0.004))
    p.append(box(f"{name}_window", (0, 0.178, 0.288), (0.07, 0.01, 0.034), m["dark"], bevel=0.004))
    _dial(name, -0.092, 0.178, 0.288, 0.026, m, p)
    _dial(name + "_b", 0.092, 0.178, 0.288, 0.026, m, p)
    for k in range(4):
        p.append(box(f"{name}_vent_{k}", (0, -0.04 - k * 0.026, 0.341), (0.15, 0.008, 0.004), m["iron"], bevel=0.001))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(f"{name}_foot_{sx}{sy}", (sx * 0.11, sy * 0.13, 0.008), 0.018, 0.016, m["rubber"], verts=16, bevel=0))
    return _group(name, p, loc, rot_z)


def microwave(m, loc, rot_z=0.0, name="microwave"):
    """A cream enamel box with a brass-framed window, a brass door bar and two dials. 0.46 x 0.34 x 0.28 m."""
    p = []
    p.append(box(f"{name}_body", (0, 0, 0.152), (0.46, 0.34, 0.272), m["enamel"], bevel=0.032))
    p.append(box(f"{name}_door_frame", (-0.045, 0.172, 0.152), (0.315, 0.012, 0.222), m["brass"], bevel=0.004))
    p.append(box(f"{name}_door_glass", (-0.045, 0.179, 0.152), (0.285, 0.012, 0.192), m["dark"], bevel=0.003))
    p.append(box(f"{name}_door_bar", (0.135, 0.19, 0.152), (0.014, 0.024, 0.15), m["brass"], bevel=0.005))
    p.append(box(f"{name}_panel", (0.185, 0.171, 0.152), (0.07, 0.006, 0.222), m["cream"], bevel=0.002))
    _dial(name, 0.188, 0.172, 0.205, 0.027, m, p)
    _dial(name + "_b", 0.188, 0.172, 0.1, 0.027, m, p)
    p.append(box(f"{name}_display", (0.188, 0.176, 0.152), (0.045, 0.006, 0.02), m["dark"], bevel=0.002))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(f"{name}_foot_{sx}{sy}", (sx * 0.19, sy * 0.13, 0.008), 0.016, 0.016, m["brass"], verts=16, bevel=0))
    return _group(name, p, loc, rot_z)


def _lathe(name, profile, material, segs=64, thick=0.004):
    verts, faces = [], []
    for r, z in profile:
        for i in range(segs):
            a = 2 * math.pi * i / segs
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for k in range(len(profile) - 1):
        for i in range(segs):
            a, b = k * segs + i, k * segs + (i + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    if profile[0][0] == 0:       # a closed pole: join the first ring to the centre point instead of leaving a hole
        verts.append((0, 0, profile[0][1]))
        c = len(verts) - 1
        faces += [(c, (i + 1) % segs, i) for i in range(segs)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for pl in me.polygons:
        pl.use_smooth = True
    o.data.materials.append(material)
    mod = o.modifiers.new("thick", "SOLIDIFY")
    mod.thickness = thick
    return o


def kettle_grill(m, loc, rot_z=0.0, name="kettle_grill"):
    """A kettle barbecue on three iron legs: sage enamel bowl and lid, brass rim and handle, a wooden side handle.
    0.62 m across, 1.18 m to the lid handle."""
    p = []
    z_rim = 0.64
    bowl = _lathe(f"{name}_bowl", [(0.0, 0.0), (0.09, 0.008), (0.19, 0.06), (0.26, 0.15), (0.295, 0.25), (0.3, z_rim - 0.34)],
                  m["sage"])
    bowl.location = (0, 0, 0.34)
    p.append(bowl)
    lid = _lathe(f"{name}_lid", [(0.31, 0.0), (0.3, 0.05), (0.26, 0.12), (0.18, 0.18), (0.08, 0.215), (0.0, 0.225)], m["sage"])
    lid.location = (0, 0, z_rim)
    lid.rotation_euler = (0, 0, 0)
    p.append(lid)
    p.append(cyl(f"{name}_rim", (0, 0, z_rim), 0.305, 0.016, m["brass"], verts=64, bevel=0.003))
    p.append(cyl(f"{name}_vent", (0, 0, z_rim + 0.232), 0.03, 0.02, m["brass"], verts=24, bevel=0.004))
    for s in (-1, 1):
        p.append(cyl(f"{name}_handle_post_{s}", (s * 0.09, 0.0, z_rim + 0.255), 0.009, 0.05, m["brass"], verts=12, bevel=0))
    hb = cyl(f"{name}_handle_bar", (0, 0, z_rim + 0.285), 0.012, 0.21, m["brass"], verts=16, bevel=0, rot=(0, math.radians(90), 0))
    p.append(hb)
    # wooden handle on the side of the bowl (a turned peg and a crossbar)
    p.append(box(f"{name}_side_handle", (0.36, 0, z_rim - 0.05), (0.14, 0.03, 0.03), m["iron"], bevel=0.008))
    p.append(cyl(f"{name}_side_grip", (0.42, 0, z_rim - 0.05), 0.016, 0.1, m["honey"], verts=16, bevel=0.004,
                 rot=(0, math.radians(90), 0)))
    # ash shelf and three iron legs splayed to the ground
    p.append(cyl(f"{name}_shelf", (0, 0, 0.18), 0.19, 0.012, m["iron"], verts=48, bevel=0.002))
    for k in range(3):
        a = math.radians(90 + k * 120)
        top = (0.21 * math.cos(a), 0.21 * math.sin(a), 0.38)
        bot = (0.33 * math.cos(a), 0.33 * math.sin(a), 0.0)
        d = (bot[0] - top[0], bot[1] - top[1], bot[2] - top[2])
        L = math.sqrt(sum(v * v for v in d))
        leg = cyl(f"{name}_leg_{k}", tuple((top[i] + bot[i]) / 2 for i in range(3)), 0.0105, L, m["iron"], verts=12, bevel=0)
        leg.rotation_mode = "QUATERNION"
        leg.rotation_quaternion = Vector(d).to_track_quat("Z", "Y")
        p.append(leg)
    return _group(name, p, loc, rot_z)


APPLIANCES = {
    "slow-cooker": slow_cooker,
    "food-processor": food_processor,
    "air-fryer": air_fryer,
    "microwave": microwave,
    "bbq": kettle_grill,
}
