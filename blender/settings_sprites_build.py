"""Sprites for the check-in settings objects (docs: art-settings-plan). Each is a small transparent PNG, rendered once under
one soft neutral light with a shadow catcher, then tinted and placed in the panorama by explore/settings-objects.js.

  blender -b -P blender/settings_sprites_build.py -- --out DIR [--only lamp,suncatcher,yarn,twine,ribbon] [--res 768]

Writes DIR/<name>.png for: lamp_off, lamp_lit, suncatcher, and yarn_0..4, twine_0..4, ribbon_0..4 (0 = fully wound, nothing set;
1..4 = the patience stops quick, half, hour, any, each a little more unwound). Z up, metres, camera looks along +Y.
Every sprite is framed with the same orthographic width (SPAN) so the page can scale by metres.
"""
import bpy
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import box, cyl, mat, sphere, srgb  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k, d=None: ARGS[ARGS.index(k) + 1] if k in ARGS and ARGS.index(k) + 1 < len(ARGS) else d
OUT = arg("--out", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "settings"))
RES = int(arg("--res", "768"))
ONLY = (arg("--only") or "lamp,suncatcher,yarn,twine,ribbon").split(",")

# orthographic width in metres per sprite (the page scales a sprite by this)
SPAN = {"lamp": 0.46, "suncatcher": 0.44, "yarn": 0.42, "twine": 0.42, "ribbon": 0.42}
CENTRE_X = {"lamp": 0.0, "suncatcher": 0.0, "yarn": 0.05, "twine": 0.06, "ribbon": 0.04}
FOCUS = {"lamp": 0.18, "suncatcher": 0.0, "yarn": 0.05, "twine": 0.06, "ribbon": 0.05}   # camera target height


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def stage(kind, ground=True):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception:
        pass
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.world = bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.85, 0.82, 0.78, 1)
    bg.inputs[1].default_value = 0.45
    key = bpy.data.lights.new("key", "AREA")
    key.energy, key.size, key.color = 45, 1.2, srgb("#fff1dc")[:3]
    ko = bpy.data.objects.new("key", key)
    sc.collection.objects.link(ko)
    ko.location = (-0.5, -0.8, 0.9)
    ko.rotation_euler = (math.radians(60), 0, math.radians(-30))
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy, fill.size = 12, 1.5
    fo = bpy.data.objects.new("fill", fill)
    sc.collection.objects.link(fo)
    fo.location = (0.8, -0.6, 0.5)
    fo.rotation_euler = (math.radians(75), 0, math.radians(40))
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = SPAN[kind]
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    el = math.radians(14 if kind in ("lamp", "suncatcher") else 30)
    d = 2.0
    tgt = Vector((CENTRE_X[kind], 0, FOCUS[kind]))
    co.location = tgt + Vector((0, -d * math.cos(el), d * math.sin(el)))
    co.rotation_euler = (math.pi / 2 - el, 0, 0)
    sc.camera = co
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
        g = bpy.context.active_object
        g.is_shadow_catcher = True


def render(name):
    os.makedirs(OUT, exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("wrote", sc.render.filepath)


def lathe(name, pts, material, verts=48):
    """A turned shape from (radius, height) points, closed to the axis."""
    me = bpy.data.meshes.new(name)
    vs, fs = [], []
    n = len(pts)
    for i in range(verts):
        a = 2 * math.pi * i / verts
        for r, z in pts:
            vs.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(verts):
        j = (i + 1) % verts
        for k in range(n - 1):
            fs.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    me.from_pydata(vs, [], fs)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(material)
    return o


def thread(name, pts, r, material):
    """A bevelled curve through the points, as string, twine or ribbon (flat when r is a (w, h) pair)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 12
    if isinstance(r, tuple):
        cu.bevel_mode = "OBJECT"
        prof = bpy.data.curves.new(name + "_p", "CURVE")
        prof.dimensions = "2D"
        s = prof.splines.new("POLY")
        s.points.add(3)
        w, h = r
        for p, (x, y) in zip(s.points, [(-w, -h), (w, -h), (w, h), (-w, h)]):
            p.co = (x, y, 0, 1)
        s.use_cyclic_u = True
        po = bpy.data.objects.new(name + "_p", prof)
        bpy.context.scene.collection.objects.link(po)
        cu.bevel_object = po
    else:
        cu.bevel_depth = r
        cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    cu.materials.append(material)
    return o


def wound(m, scale=60.0, rough=0.85):
    """Stripes across a material so wound thread reads as winding, not a smooth ball."""
    nt = m.node_tree
    p = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type, wv.bands_direction, wv.inputs["Scale"].default_value = "BANDS", "DIAGONAL", scale
    wv.inputs["Distortion"].default_value = 6
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.7
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    nt.links.new(wv.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = tuple(c * 0.72 for c in p.inputs["Base Color"].default_value[:3]) + (1,)
    mix.inputs["A"].default_value = p.inputs["Base Color"].default_value
    nt.links.new(wv.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough


# ---------------------------------------------------------------- the objects
def lamp(lit):
    """A little enamel table lamp with a pleated cream shade (0.3 m): the Flourish lamp."""
    enamel = mat("enamel", srgb("#cdbf9f"), rough=0.35, coat=0.4)
    brass = mat("brass", srgb("#bd9655"), rough=0.3, metal=1.0)
    shade_c = srgb("#e3c98f")
    shade = mat("shade", shade_c, rough=0.9, emission=(1.0, 0.72, 0.36, 1) if lit else None, strength=1.1 if lit else 0.0)
    lathe("base", [(0, 0), (0.06, 0.0), (0.066, 0.012), (0.055, 0.06), (0.03, 0.1), (0.014, 0.13), (0.0, 0.13)], enamel)
    cyl("stem", (0, 0, 0.16), 0.007, 0.07, brass, bevel=0.0)
    lathe("shade", [(0.045, 0.19), (0.12, 0.19 + 0.002), (0.095, 0.3), (0.06, 0.3), (0.045, 0.19)], shade, verts=60)
    cyl("shade_rim", (0, 0, 0.19), 0.121, 0.004, brass, verts=60, bevel=0.0)
    if lit:
        # the bulb, only seen through the shade's open underside
        sphere("bulb", (0, 0, 0.215), 0.024, mat("bulb", (1, 0.9, 0.6, 1), emission=(1, 0.8, 0.45, 1), strength=40))
    cyl("cord_plug", (0.07, 0.02, 0.003), 0.004, 0.006, brass, bevel=0.0)


def suncatcher():
    """A faceted crystal hanging on a thin chain from a brass cap (about 0.2 m hanging from 0.18)."""
    brass = mat("brass", srgb("#bd9655"), rough=0.3, metal=1.0)
    glass = mat("crystal", (0.92, 0.97, 1, 1), rough=0.02, transmission=1.0, ior=1.55)
    glass.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.3
    pts = [(0, 0.0), (0.036, 0.08), (0.05, 0.12), (0.036, 0.16), (0, 0.27)]
    c = lathe("crystal", pts, glass, verts=8)
    for p in c.data.polygons:
        p.use_smooth = False                         # facets, not a smooth bead
    c.location = (0, 0, -0.13)
    cyl("cap", (0, 0, 0.145), 0.014, 0.02, brass, bevel=0.0)
    cyl("chain", (0, 0, 0.215), 0.0016, 0.13, brass, bevel=0.0)
    sphere("tiny_bead", (0, 0, 0.12), 0.011, brass)


def yarn(i):
    """A ball of rose-pink wool (0.06 m radius wound) that shrinks as the thread is pulled out, which is laid in a loose curve."""
    col = srgb("#b8455f")
    m = mat("wool", col, rough=0.95)
    wound(m, 55)
    r = 0.062 * (1 - 0.16 * i)
    sphere("ball", (-0.07 + (0.062 - r) * 0.2, 0, r), r, m, scale=(1, 1, 0.94))
    L = 0.0 if i == 0 else 0.05 + i * 0.045                     # how much thread lies out
    s = mat("thread", col, rough=0.9)
    if i == 0:
        # tucked: a short end resting on the ball
        thread("end", [(-0.07 + 0.03, -0.045, 0.6 * r + 0.012), (-0.015, -0.05, 0.02), (0.0, -0.045, 0.004)], 0.0035, s)
        return
    pts = [(-0.07 + r * 0.8, -r * 0.55, 0.012 + r * 0.1)]
    n = 6
    for k in range(1, n + 1):
        t = k / n
        pts.append((-0.07 + r + L * t, -0.05 * math.sin(t * math.pi * 1.6) * (0.6 + t), 0.004))
    thread("thread", pts, 0.0036, s)


def twine(i):
    """A cone of natural twine on a little wooden foot (about 0.11 m tall wound), paying out from its top."""
    col = srgb("#c8a66d")
    m = mat("twine", col, rough=0.95)
    wound(m, 90)
    frac = 1 - 0.14 * i                                          # how much of the cone is left
    wood = mat("foot", srgb("#a8794a"), rough=0.55)
    cyl("foot", (0, 0, 0.007), 0.05, 0.014, wood, bevel=0.002)
    h = 0.11 * frac + 0.02
    r0 = 0.045 * (0.6 + 0.4 * frac)
    lathe("cone", [(0, 0.014), (r0, 0.014), (r0 * 0.62, 0.014 + h * 0.62), (0.012, 0.014 + h), (0, 0.014 + h + 0.004)], m, verts=56)
    L = 0.0 if i == 0 else 0.05 + i * 0.04
    s = mat("tw", col, rough=0.9)
    top = (0, 0, 0.014 + h)
    if i == 0:
        thread("end", [top, (0.02, -0.02, 0.014 + h * 0.8), (0.03, -0.045, 0.004)], 0.0028, s)
        return
    pts = [top, (0.02, -0.03, 0.014 + h * 0.7), (0.05, -0.05, 0.01)]
    n = 6
    for k in range(1, n + 1):
        t = k / n
        pts.append((0.05 + L * t, -0.05 + 0.045 * math.sin(t * math.pi * 1.8), 0.003))
    thread("tw", pts, 0.0028, s)


def ribbon(i):
    """A wooden spool of rose satin ribbon, wound thick when full, ribbon laid out across the table as it's used."""
    col = srgb("#cc4f82")
    wood = mat("spool", srgb("#c79a62"), rough=0.5)
    sat = mat("satin", col, rough=0.4)
    sat.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.0
    h = 0.07
    core = 0.014
    wr = 0.045 * (1 - 0.15 * i) + 0.012                          # wound radius
    cyl("axle", (-0.05, 0, h / 2), core, h, wood, bevel=0.001)
    cyl("flange_a", (-0.05, 0, 0.003), 0.056, 0.006, wood, bevel=0.001)
    cyl("flange_b", (-0.05, 0, h - 0.003), 0.056, 0.006, wood, bevel=0.001)
    cyl("wound", (-0.05, 0, h / 2), wr, h - 0.012, sat, bevel=0.0)
    wm = mat("wrap", col, rough=0.3)
    L = 0.0 if i == 0 else 0.04 + i * 0.045
    x0 = -0.05 + wr
    if i == 0:
        thread("tail", [(x0 - 0.002, 0, h / 2 + 0.004), (x0 + 0.02, -0.02, 0.012), (x0 + 0.045, -0.03, 0.002)], (0.0085, 0.0007), wm)
        return
    pts = [(x0 - 0.002, 0, 0.02), (x0 + 0.02, -0.02, 0.006)]
    n = 6
    for k in range(1, n + 1):
        t = k / n
        pts.append((x0 + 0.02 + L * t, -0.02 + 0.05 * math.sin(t * math.pi * 1.4 + 0.3), 0.0015 + 0.0006 * k))
    thread("tail", pts, (0.0085, 0.0007), wm)


def run(kind, name, build, *a):
    clear()
    stage(kind, ground=kind != "suncatcher")
    build(*a)
    render(name)


if "lamp" in ONLY:
    run("lamp", "lamp_off", lamp, False)
    run("lamp", "lamp_lit", lamp, True)
if "suncatcher" in ONLY:
    run("suncatcher", "suncatcher", suncatcher)
for kind, fn in (("yarn", yarn), ("twine", twine), ("ribbon", ribbon)):
    if kind in ONLY:
        for i in range(5):
            run(kind, f"{kind}_{i}", fn, i)
