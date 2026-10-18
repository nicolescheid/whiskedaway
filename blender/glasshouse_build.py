"""
The glasshouse: a long lean-to of sage-green glazing against the Inn's sunny side, full of medicinal,
health and beauty plants. Built once, rendered as a 360 equirectangular panorama in each of the four
seasons from one camera. Camera, structure and pots never move; only the plants, the light and the
view outside change, so the seasons can cross-fade in the browser.

Layout from art-inbox/glasshouse/ (ChatGPT's concept pack: notes.md, layout.json) and docs/inn-floorplan.html.
Needs the Poly Haven assets:  python -I blender/fetch_assets.py
Then run headless:
  blender -b --factory-startup --python blender/glasshouse_build.py -- [--season=spring] [--preview] [--no-render]

Axes follow layout.json: X = Inn wall (0) to the garden glazing (1.8), Y = lane end (0) to the sea end (6.3),
Z = up. Metres. This matches the hallway's axes (X toward the garden, Y toward the sea).
The herbs are modelled here (Poly Haven has no lavender, chamomile and the rest): see the "plants" section.
"""
import bpy
import colorsys
import json
import math
import os
import random
import sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from whisked import (ART, ASSETS, OUT, area_light, box, box_span, center_of, crop_image, cyl, image_mat, look,  # noqa: E402
                     mat, meshes_of, model, pano_camera, pbr, sphere, srgb, text, use_gpu, window_glass)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
NO_RENDER = "--no-render" in ARGS
SEASON = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--season=")), "spring")

os.makedirs(OUT, exist_ok=True)
PACK = os.path.join(ART, "glasshouse")
HALL = os.path.join(ART, "inn-hallway")

# Per season: sky (Poly Haven HDRI and its strength), the plate outside the glass, condensation on the roof,
# frost on the walls, exposure. Sun heights follow notes.md: spring ~30-38, summer ~40-48, autumn low, winter cloud.
SEASONS = {
    "spring": dict(hdri="kloofendal_38d_partly_cloudy_puresky", sky=1.0, plate="13-outside-spring.png", wet=0.1, frost=0.0, exposure=0.0),
    "summer": dict(hdri="kloofendal_48d_partly_cloudy_puresky", sky=1.0, plate="14-outside-summer.png", wet=0.06, frost=0.0, exposure=-0.1),
    "autumn": dict(hdri="kloofendal_28d_misty_puresky", sky=1.1, plate="15-outside-autumn.png", wet=0.14, frost=0.0, exposure=0.2),
    "winter": dict(hdri="kloofendal_overcast_puresky", sky=1.3, plate="16-outside-winter.png", wet=0.2, frost=0.35, exposure=0.5),
}
S = SEASONS[SEASON]
ORDER = ["spring", "summer", "autumn", "winter"]   # the wheel, clockwise from the top plate

W, L = 1.8, 6.3              # inside: Inn wall to garden glass, lane end to sea end
ROOF_HI, ROOF_LO = 2.75, 2.15
EYE = 1.6
CAM = (0.8, 3.15, EYE)       # on the path, square to the garden door
CAM_YAW = 90                 # the middle of the panorama looks at the garden door (+X)
SUN_AZ = -35                 # sun direction in plan, degrees from +X toward +Y: from the garden, a little lane-ward
STAGE_Z = 0.8                # staging top
GD_Y, GD_W, GD_H = 3.15, 0.82, 1.95    # garden door: centre, opening
CD_Y, CD_W, CD_H = 1.9, 0.85, 2.0      # Chiapothecary door in the Inn wall
DIAL_AT = (0.0, 1.2, 1.35)             # room dial, lane side of the Chiapothecary door
WHEEL_AT = (W - 0.03, 2.5, 1.36)       # seasons wheel, lane side of the garden door
WHEEL_R = 0.15

HOTSPOTS = {}


def roof_z(x):
    return ROOF_HI - (ROOF_HI - ROOF_LO) * x / W


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


def poly(name, pts, material, shadow=True):
    """One flat polygon (a pane of glass)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    o.visible_shadow = shadow
    return o


def bar(name, a, b, w, d, material, bevel=0.004):
    """A timber bar of section w x d from point a to point b (d is measured in the vertical plane)."""
    a, b = Vector(a), Vector(b)
    o = box(name, (a + b) / 2, ((b - a).length, w, d), material, bevel=bevel)
    dvec = (b - a).normalized()
    o.rotation_euler = Vector((1, 0, 0)).rotation_difference(dvec).to_euler()
    return o


# ---------------------------------------------------------------- materials

def lin(hex_str):
    return srgb(hex_str)


def vary(c, rnd, v=0.12, warm=0.0):
    """Jitter a linear colour: brightness by +-v, and a pull toward yellow-brown by warm (0..1)."""
    k = rnd.uniform(1 - v, 1 + v)
    r, g, b = c[0] * k, c[1] * k, c[2] * k
    if warm:
        t = (0.42, 0.33, 0.05)
        r, g, b = r + (t[0] - r) * warm, g + (t[1] - g) * warm, b + (t[2] - b) * warm
    return (r, g, b, 1.0)


def plant_mats():
    """Three shared materials coloured per face from the mesh's 'col' attribute: leaves, stems, petals."""
    out = []
    for name, rough, trans, sss in (("leaf", 0.5, 0.28, 0.0), ("stem", 0.65, 0.08, 0.0), ("petal", 0.45, 0.42, 0.0)):
        m = bpy.data.materials.new(f"plant_{name}")
        m.use_nodes = True
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        a = nt.nodes.new("ShaderNodeAttribute")
        a.attribute_name = "col"
        nt.links.new(a.outputs["Color"], p.inputs["Base Color"])
        p.inputs["Roughness"].default_value = rough
        p.inputs["Specular IOR Level"].default_value = 0.35
        tl = nt.nodes.new("ShaderNodeBsdfTranslucent")
        bright = nt.nodes.new("ShaderNodeMix")
        bright.data_type = "RGBA"
        bright.blend_type = "MULTIPLY"
        bright.inputs["Factor"].default_value = 1.0
        nt.links.new(a.outputs["Color"], bright.inputs[6])
        bright.inputs[7].default_value = (1.1, 1.25, 0.7, 1)       # light through a leaf comes out yellower
        nt.links.new(bright.outputs[2], tl.inputs["Color"])
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = trans
        nt.links.new(p.outputs[0], mix.inputs[1])
        nt.links.new(tl.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
        out.append(m)
    return out


def sage_paint(name):
    """Sage paint over old timber, chipped here and there to the wood."""
    folder = os.path.join(ASSETS, "textures", "wood_table_worn")
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2,) * 3
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def tex(kind, non_color):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(folder, f"{kind}.jpg"), check_existing=True)
        if non_color:
            t.image.colorspace_settings.name = "Non-Color"
        t.projection = "BOX"
        t.projection_blend = 0.25
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    wood = tex("diff", False)
    paint = nt.nodes.new("ShaderNodeMix")                 # paint keeps a little of the grain showing through
    paint.data_type = "RGBA"
    paint.inputs["Factor"].default_value = 0.82
    nt.links.new(wood.outputs["Color"], paint.inputs[6])
    paint.inputs[7].default_value = lin("#8d9b80")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14
    noise.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    chip = nt.nodes.new("ShaderNodeMapRange")
    chip.inputs["From Min"].default_value = 0.66
    chip.inputs["From Max"].default_value = 0.70
    nt.links.new(noise.outputs["Fac"], chip.inputs["Value"])
    bare = nt.nodes.new("ShaderNodeMix")
    bare.data_type = "RGBA"
    nt.links.new(chip.outputs["Result"], bare.inputs["Factor"])
    nt.links.new(paint.outputs[2], bare.inputs[6])
    nt.links.new(wood.outputs["Color"], bare.inputs[7])
    nt.links.new(bare.outputs[2], p.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(chip.outputs["Result"], rough.inputs["Value"])
    rough.inputs["To Min"].default_value = 0.62
    rough.inputs["To Max"].default_value = 0.85
    nt.links.new(rough.outputs["Result"], p.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.5
    nt.links.new(tex("nor", True).outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return m


def terracotta(name):
    """Clay pots: warm terracotta, a different firing per pot, chalky white bloom and a dark damp band low down."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.88
    info = nt.nodes.new("ShaderNodeObjectInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")             # one firing colour per pot
    ramp.color_ramp.elements[0].color = lin("#a9603f")
    ramp.color_ramp.elements[1].color = lin("#c5865c")
    nt.links.new(info.outputs["Random"], ramp.inputs["Fac"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mottle = nt.nodes.new("ShaderNodeTexNoise")
    mottle.inputs["Scale"].default_value = 9
    mottle.inputs["Detail"].default_value = 10
    nt.links.new(tc.outputs["Object"], mottle.inputs["Vector"])
    bloom_n = nt.nodes.new("ShaderNodeTexNoise")
    bloom_n.inputs["Scale"].default_value = 5
    bloom_n.inputs["Detail"].default_value = 6
    bloom_n.inputs["Roughness"].default_value = 0.7
    nt.links.new(tc.outputs["Object"], bloom_n.inputs["Vector"])
    bloom = nt.nodes.new("ShaderNodeMapRange")
    bloom.inputs["From Min"].default_value = 0.5
    bloom.inputs["From Max"].default_value = 0.72
    bloom.inputs["To Max"].default_value = 0.85
    nt.links.new(bloom_n.outputs["Fac"], bloom.inputs["Value"])
    base = nt.nodes.new("ShaderNodeMix")
    base.data_type = "RGBA"
    base.blend_type = "MULTIPLY"
    base.inputs["Factor"].default_value = 0.35
    nt.links.new(ramp.outputs["Color"], base.inputs[6])
    nt.links.new(mottle.outputs["Color"], base.inputs[7])
    chalk = nt.nodes.new("ShaderNodeMix")
    chalk.data_type = "RGBA"
    nt.links.new(bloom.outputs["Result"], chalk.inputs["Factor"])
    nt.links.new(base.outputs[2], chalk.inputs[6])
    chalk.inputs[7].default_value = lin("#e4dccd")
    # damp band: Generated Z (0 at the foot, 1 at the rim) below about a fifth of the height
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    damp = nt.nodes.new("ShaderNodeMapRange")
    damp.inputs["From Min"].default_value = 0.22
    damp.inputs["From Max"].default_value = 0.05
    damp.inputs["To Max"].default_value = 0.45
    nt.links.new(sep.outputs["Z"], damp.inputs["Value"])
    dark = nt.nodes.new("ShaderNodeMix")
    dark.data_type = "RGBA"
    nt.links.new(damp.outputs["Result"], dark.inputs["Factor"])
    nt.links.new(chalk.outputs[2], dark.inputs[6])
    dark.inputs[7].default_value = lin("#5a3424")
    nt.links.new(dark.outputs[2], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(mottle.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def frosty_glass(name, wet, frost):
    """window_glass with, in winter, frost feathering in from the bottom and edges of each pane."""
    m = window_glass(name, wet=wet)
    if not frost:
        return m
    nt = m.node_tree
    out = nt.nodes["Material Output"]
    surface = out.inputs["Surface"].links[0].from_socket
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    low = nt.nodes.new("ShaderNodeMapRange")              # thickest just above the sill, gone by eye height
    low.inputs["From Min"].default_value = 1.5
    low.inputs["From Max"].default_value = 0.8
    nt.links.new(sep.outputs["Z"], low.inputs["Value"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 9
    n.inputs["Detail"].default_value = 12
    nt.links.new(geo.outputs["Position"], n.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[2].default_value = frost - 0.55
    nt.links.new(n.outputs["Fac"], add.inputs[0])
    nt.links.new(low.outputs["Result"], add.inputs[1])
    mask = nt.nodes.new("ShaderNodeMapRange")
    mask.inputs["From Min"].default_value = 0.0
    mask.inputs["From Max"].default_value = 0.25
    mask.inputs["To Max"].default_value = 0.85
    nt.links.new(add.outputs[0], mask.inputs["Value"])
    ice = nt.nodes.new("ShaderNodeBsdfPrincipled")
    ice.inputs["Base Color"].default_value = (0.92, 0.95, 0.97, 1)
    ice.inputs["Roughness"].default_value = 0.5
    ice.inputs["Transmission Weight"].default_value = 0.6
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mask.outputs["Result"], mix.inputs[0])
    nt.links.new(surface, mix.inputs[1])
    nt.links.new(ice.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def backdrop_mat(name, path, strength=1.0):
    """The garden plate: glows by itself, fades out at the top so the real sky (the HDRI) takes over."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    t.interpolation = "Cubic"
    t.extension = "EXTEND"
    hs = nt.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Saturation"].default_value = 1.12
    nt.links.new(t.outputs["Color"], hs.inputs["Color"])
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    nt.links.new(hs.outputs["Color"], e.inputs["Color"])
    uv = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    fade = nt.nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 0.8
    fade.inputs["From Max"].default_value = 0.99
    nt.links.new(sep.outputs["Y"], fade.inputs["Value"])
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fade.outputs["Result"], mix.inputs[0])
    nt.links.new(e.outputs[0], mix.inputs[1])
    nt.links.new(clear.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


# ---------------------------------------------------------------- plant geometry

UP = Vector((0, 0, 1))
LEAF, STEM, PETAL = 0, 1, 2


class Geo:
    """Collects the faces of one plant (leaves, stems, petals), each face with its own colour, then makes one mesh."""

    def __init__(self):
        self.v, self.f, self.c, self.m = [], [], [], []

    def face(self, idx, col, mi):
        self.f.append(idx)
        self.c.append(col)
        self.m.append(mi)

    def add(self, p):
        self.v.append(tuple(p))
        return len(self.v) - 1

    def leaf(self, base, d, length, width, col, shape="ovate", droop=0.25, fold=0.2, n_hint=None, seg=5, mi=LEAF):
        d = Vector(d).normalized()
        hint = Vector(n_hint) if n_hint is not None else UP
        s = d.cross(hint)
        if s.length < 1e-4:
            s = d.cross(Vector((1, 0, 0)))
        s.normalize()
        n = s.cross(d).normalized()
        prof = {"ovate": lambda t: math.sin(math.pi * t ** 0.85),
                "lance": lambda t: math.sin(math.pi * t ** 0.6) * (1 - 0.25 * t),
                "needle": lambda t: 1 - 0.75 * t,
                "oblong": lambda t: math.sin(math.pi * t) ** 0.4,
                "round": lambda t: math.sin(math.pi * t ** 0.9) ** 0.7,
                "petal": lambda t: math.sin(math.pi * (0.15 + 0.85 * t) ** 1.2) ** 0.6}[shape]
        rows = []
        base = Vector(base)
        for i in range(seg + 1):
            t = i / seg
            c = base + d * length * t + Vector((0, 0, -droop * length * t * t))
            w = width * max(prof(t), 0.04) / 2
            rows.append((self.add(c - s * w + n * fold * w), self.add(c + n * fold * 0.0), self.add(c + s * w + n * fold * w)))
        for i in range(seg):
            a, b = rows[i], rows[i + 1]
            self.face((a[0], a[1], b[1], b[0]), col, mi)
            self.face((a[1], a[2], b[2], b[1]), col, mi)

    def stem(self, pts, r0, r1, col, mi=STEM, sides=4):
        pts = [Vector(p) for p in pts]
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            a = t.cross(UP)
            if a.length < 1e-4:
                a = t.cross(Vector((1, 0, 0)))
            a.normalize()
            b = t.cross(a)
            r = r0 + (r1 - r0) * i / max(len(pts) - 1, 1)
            rings.append([self.add(p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r)
                          for k in range(sides)])
        for i in range(len(rings) - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                self.face((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]), col, mi)

    def blob(self, c, r, col, mi=PETAL, stretch=(1, 1, 1), axis=None):
        c = Vector(c)
        ax = [Vector((r * stretch[0], 0, 0)), Vector((0, r * stretch[1], 0)), Vector((0, 0, r * stretch[2]))]
        if axis is not None:
            rot = UP.rotation_difference(Vector(axis).normalized())
            ax = [rot @ a for a in ax]
        ids = [self.add(c + a) for a in ax] + [self.add(c - a) for a in ax]
        px, py, pz, nx, ny, nz = ids
        for f in ((px, py, pz), (py, nx, pz), (nx, ny, pz), (ny, px, pz), (py, px, nz), (nx, py, nz), (ny, nx, nz), (px, ny, nz)):
            self.face(f, col, mi)

    def cone(self, c, normal, r, h, col, mi=PETAL, segs=10):
        c, normal = Vector(c), Vector(normal).normalized()
        a = normal.cross(UP)
        if a.length < 1e-4:
            a = normal.cross(Vector((1, 0, 0)))
        a.normalize()
        b = normal.cross(a)
        ring = [self.add(c + (a * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)]
        tip = self.add(c + normal * h)
        for k in range(segs):
            self.face((ring[k], ring[(k + 1) % segs], tip), col, mi)

    def make(self, name, mats, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        ca = me.color_attributes.new("col", "FLOAT_COLOR", "CORNER")
        flat = []
        for f, c in zip(self.f, self.c):
            flat.extend(list(c) * len(f))
        ca.data.foreach_set("color", flat)
        me.polygons.foreach_set("material_index", self.m)
        me.polygons.foreach_set("use_smooth", [True] * len(self.f))
        for m in mats:
            me.materials.append(m)
        me.update()
        o = bpy.data.objects.new(name, me)
        o.location = loc
        bpy.context.scene.collection.objects.link(o)
        return o


def basis(normal):
    n = Vector(normal).normalized()
    a = n.cross(UP)
    if a.length < 1e-4:
        a = Vector((1, 0, 0))
    a.normalize()
    return a, n.cross(a), n


def curve(p0, d, length, bend=0.0, n=5, rnd=None, wobble=0.0):
    """Points along a stem from p0 heading d, bending downward by bend (fraction of length) toward the tip."""
    d = Vector(d).normalized()
    pts = []
    for i in range(n + 1):
        t = i / n
        p = Vector(p0) + d * length * t + Vector((0, 0, -bend * length * t * t))
        if rnd and wobble and i:
            p += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * wobble * length * t
        pts.append(p)
    return pts


def at(pts, t):
    """Point a fraction t along a polyline (by index, close enough for short stems)."""
    f = t * (len(pts) - 1)
    i = min(int(f), len(pts) - 2)
    return pts[i].lerp(pts[i + 1], f - i)


def dir_at(pts, t):
    f = t * (len(pts) - 1)
    i = min(int(f), len(pts) - 2)
    return (pts[i + 1] - pts[i]).normalized()


def spread_dir(rnd, tilt_lo, tilt_hi):
    a = rnd.uniform(0, 2 * math.pi)
    t = math.radians(rnd.uniform(tilt_lo, tilt_hi))
    return Vector((math.sin(t) * math.cos(a), math.sin(t) * math.sin(a), math.cos(t))), a


def daisy(g, c, normal, R, petals, petal_col, disc_col, disc_r, disc_h, petal_w, droop, rnd, rings=1):
    a, b, n = basis(normal)
    g.cone(c, n, disc_r, disc_h, disc_col)
    for ring in range(rings):
        k_n = petals - ring * 4
        off = rnd.uniform(0, 1)
        for k in range(k_n):
            ang = 2 * math.pi * (k + off + 0.5 * ring) / k_n
            radial = a * math.cos(ang) + b * math.sin(ang)
            dr = math.radians(droop + rnd.uniform(-8, 8)) - ring * 0.25
            d = radial * math.cos(dr) - n * math.sin(dr) + n * 0.02
            g.leaf(c + radial * disc_r * 0.7 + n * disc_h * 0.15 * ring, d, (R - disc_r) * (1 - 0.18 * ring) * rnd.uniform(0.85, 1.1),
                   petal_w, vary(petal_col, rnd, 0.08), shape="petal", droop=0, fold=0.15, n_hint=n, seg=3, mi=PETAL)


def star(g, c, normal, R, col, centre_col, rnd, points=5):
    a, b, n = basis(normal)
    for k in range(points):
        ang = 2 * math.pi * k / points
        radial = a * math.cos(ang) + b * math.sin(ang)
        g.leaf(c, radial * 0.94 - n * 0.06, R, R * 0.55, vary(col, rnd, 0.08), shape="lance", droop=0, fold=0.05, n_hint=n, seg=3, mi=PETAL)
    g.cone(c, n, R * 0.18, R * 0.55, centre_col)


def spike(g, top, d, length, r, col, rnd, whorls=7, per=6):
    d = Vector(d).normalized()
    a, b, _ = basis(d)
    for w in range(whorls):
        t = w / max(whorls - 1, 1)
        c = Vector(top) - d * length * (1 - t)
        rr = r * (1.15 - 0.5 * t)
        for k in range(per if t < 0.9 else 3):
            ang = 2 * math.pi * k / per + w * 0.6
            p = c + (a * math.cos(ang) + b * math.sin(ang)) * rr
            g.blob(p, r * 0.75, vary(col, rnd, 0.1), stretch=(1, 1, 1.5), axis=d)


# ---------------------------------------------------------------- the plants

GREEN = {"lavender": "#7f9278", "rosemary": "#3f5838", "thyme": "#5b6e45", "sage": "#8e9e86", "mint": "#3f6a33",
         "balm": "#78a03a", "basil": "#4d6b33", "chamomile": "#6c8a45", "calendula": "#6b8c42", "echinacea": "#4a6b37",
         "borage": "#5a7a46", "fennel": "#7d9b4c", "ginger": "#4d7a36", "turmeric": "#5d8a3b", "aloe": "#86a07a",
         "roselle": "#4f6d36", "passion": "#557f35"}
STEMS = {"woody": "#6b5a42", "green": "#5d7a3c", "purple": "#5a3a46", "red": "#7a2e2a", "dry": "#8a7656"}

# Growth by season: g = how much of the plant there is (0..1), y = how many leaves have yellowed
GROW = {"spring": dict(g=0.75, y=0.02), "summer": dict(g=1.0, y=0.04), "autumn": dict(g=0.85, y=0.35), "winter": dict(g=0.45, y=0.15)}


def leaf_col(name, rnd, season, extra_yellow=0.0):
    yl = GROW[season]["y"] + extra_yellow
    c = lin(GREEN[name])
    if season == "spring":
        c = vary(c, rnd, 0.0, 0.0)
        c = (c[0] * 1.05 + 0.01, c[1] * 1.12, c[2] * 0.95, 1)       # fresh growth reads a touch brighter
    if rnd.random() < yl:
        return vary(c, rnd, 0.1, rnd.uniform(0.45, 0.85))
    return vary(c, rnd, 0.12, rnd.uniform(0, 0.08))


def p_lavender(g, base, rnd, s, H=0.32):
    shoots = {"spring": 42, "summer": 55, "autumn": 50, "winter": 36}[s]
    for _ in range(shoots):
        d, _a = spread_dir(rnd, 8, 55)
        ln = H * rnd.uniform(0.45, 0.8) * (0.85 if s == "winter" else 1)
        pts = curve(base + Vector((rnd.uniform(-.02, .02), rnd.uniform(-.02, .02), 0)), d, ln, 0.05, 4)
        g.stem(pts, 0.0018, 0.0009, vary(lin(STEMS["woody"] if s == "winter" else "#7d8a6a"), rnd))
        for k in range(1, 9):
            t = k / 9
            p = at(pts, t)
            sd = dir_at(pts, t)
            for side in (-1, 1):
                ld = (sd * 0.55 + sd.cross(UP).normalized() * side * 0.75 + UP * 0.1)
                g.leaf(p, ld, 0.034 * (1.1 - 0.4 * t), 0.0055, leaf_col("lavender", rnd, s), shape="needle", droop=0.1, fold=0.0, seg=2)
    spikes = {"spring": (9, "#9a8cc6", 0.6), "summer": (30, "#5e4596", 1.0), "autumn": (22, "#8b8174", 0.9), "winter": (0, "", 0)}[s]
    n, col, size = spikes
    for _ in range(n):
        d, _a = spread_dir(rnd, 3, 30)
        ln = H * rnd.uniform(1.05, 1.5)
        pts = curve(base + Vector((rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), 0)), d, ln, 0.03, 5)
        g.stem(pts, 0.0012, 0.0008, vary(lin("#8a9478" if s != "autumn" else "#9a8e70"), rnd))
        spike(g, pts[-1], dir_at(pts, 1), 0.06 * size, 0.0045, lin(col), rnd, whorls=int(8 * size), per=6)


def p_rosemary(g, base, rnd, s, H=0.62):
    stems = {"spring": 15, "summer": 18, "autumn": 17, "winter": 15}[s]
    for i in range(stems):
        d, _a = spread_dir(rnd, 2, 22)
        ln = H * rnd.uniform(0.6, 1.0)
        pts = curve(base + Vector((rnd.uniform(-.04, .04), rnd.uniform(-.04, .04), 0)), d, ln, -0.02, 6, rnd, 0.04)
        g.stem(pts, 0.0045, 0.0015, vary(lin(STEMS["woody"]), rnd))
        nodes = int(ln / 0.012)
        for k in range(3, nodes):
            t = k / nodes
            p = at(pts, t)
            sd = dir_at(pts, t)
            for side in range(2):
                ang = k * 1.9 + side * math.pi
                side_v = sd.cross(UP).normalized()
                rad = side_v * math.cos(ang) + side_v.cross(sd) * math.sin(ang)
                g.leaf(p, sd * 0.45 + rad * 0.9, 0.026, 0.0042, leaf_col("rosemary", rnd, s, -0.1 if s != "winter" else 0),
                       shape="needle", droop=0.02, fold=0.25, seg=2)
        if s == "spring" and i % 2 == 0:
            for _ in range(5):
                p = at(pts, rnd.uniform(0.7, 0.95))
                g.blob(p + Vector((rnd.uniform(-.01, .01), rnd.uniform(-.01, .01), 0.005)), 0.0035, vary(lin("#aebde6"), rnd))


def p_thyme(g, base, rnd, s, H=0.14):
    stems = {"spring": 55, "summer": 70, "autumn": 60, "winter": 45}[s]
    for _ in range(stems):
        d, _a = spread_dir(rnd, 30, 82)
        ln = H * rnd.uniform(0.6, 1.1)
        pts = curve(base + Vector((rnd.uniform(-.02, .02), rnd.uniform(-.02, .02), 0)), d, ln, 0.15, 4, rnd, 0.1)
        g.stem(pts, 0.0011, 0.0006, vary(lin("#6e5a44"), rnd), sides=3)
        n = 10
        for k in range(1, n + 1):
            t = k / (n + 1)
            p = at(pts, t)
            sd = dir_at(pts, t)
            sv = sd.cross(UP).normalized()
            for side in (-1, 1):
                g.leaf(p, sd * 0.4 + sv * side + UP * 0.3, 0.0075, 0.0038, leaf_col("thyme", rnd, s), shape="ovate", droop=0.0, fold=0.3, seg=2)
        if s == "summer" and rnd.random() < 0.5:
            g.blob(pts[-1] + Vector((0, 0, 0.004)), 0.004, vary(lin("#e3c3d8"), rnd), stretch=(1, 1, 1.4))


def p_sage(g, base, rnd, s, H=0.36):
    stems = {"spring": 10, "summer": 14, "autumn": 12, "winter": 9}[s]
    leaves = {"spring": 5, "summer": 7, "autumn": 6, "winter": 4}[s]
    for _ in range(stems):
        d, a = spread_dir(rnd, 10, 50)
        ln = H * rnd.uniform(0.6, 1.0) * (0.8 if s == "winter" else 1)
        pts = curve(base, d, ln, 0.05, 4)
        g.stem(pts, 0.003, 0.0015, vary(lin("#7a7356"), rnd))
        for k in range(leaves):
            t = 0.3 + 0.7 * k / leaves
            p = at(pts, t)
            sd = dir_at(pts, t)
            ang = k * 2.4 + a
            rad = Vector((math.cos(ang), math.sin(ang), 0))
            c = lin("#a9b59a") if (s == "spring" and t > 0.7) else lin(GREEN["sage"])
            if s == "winter":
                c = lin("#78846f")
            g.leaf(p, rad * 0.8 + sd * 0.5, 0.06 * (1.1 - 0.4 * t), 0.024, vary(c, rnd, 0.08, 0.05 if rnd.random() < GROW[s]["y"] else 0),
                   shape="ovate", droop=0.25, fold=0.35, seg=4)


def p_opposite(g, base, rnd, s, kind, H, stems, leaf_l, leaf_w, stem_col, flowers=None):
    """Mint, lemon balm, holy basil: square stems with leaves in opposite pairs, each pair turned 90 degrees."""
    if s == "winter":
        H, stems = H * 0.18, max(3, stems // 2)
    elif s == "spring":
        H = H * 0.75
    elif s == "autumn":
        stems = int(stems * 0.8)
    for i in range(stems):
        d, a = spread_dir(rnd, 3, 30)
        ln = H * rnd.uniform(0.65, 1.0)
        pts = curve(base + Vector((rnd.uniform(-.035, .035), rnd.uniform(-.035, .035), 0)), d, ln, 0.04, 5)
        g.stem(pts, 0.0025, 0.0014, vary(lin(STEMS[stem_col]), rnd))
        nodes = max(2, int(ln / 0.045))
        for k in range(nodes):
            t = 0.2 + 0.8 * (k + 1) / nodes
            p = at(pts, t)
            sd = dir_at(pts, t)
            ang = a + k * math.pi / 2
            rad = Vector((math.cos(ang), math.sin(ang), 0))
            size = 1.15 - 0.55 * t
            if s == "autumn" and t < 0.45 and rnd.random() < 0.5:
                continue                                            # the lower leaves have dropped
            for side in (-1, 1):
                g.leaf(p, rad * side * 0.85 + sd * 0.35, leaf_l * size, leaf_w * size, leaf_col(kind, rnd, s), shape="ovate", droop=0.3,
                       fold=0.3, seg=4)
        if flowers and s in ("summer", "autumn") and i % 2 == 0:
            col = flowers if s == "summer" else "#8a7a60"
            spike(g, pts[-1] + dir_at(pts, 1) * 0.04, dir_at(pts, 1), 0.04, 0.003, lin(col), rnd, whorls=6, per=5)


def p_chamomile(g, base, rnd, s, H=0.26):
    gs = {"spring": 0.8, "summer": 1.0, "autumn": 0.75, "winter": 0.35}[s]
    for _ in range(int(26 * gs) + 4):
        d, _a = spread_dir(rnd, 10, 65)
        ln = H * 0.55 * rnd.uniform(0.5, 1.0) * gs
        pts = curve(base, d, ln, 0.1, 4)
        g.stem(pts, 0.0012, 0.0007, vary(lin(STEMS["green"]), rnd), sides=3)
        for k in range(1, 6):                                       # thread-fine feathery foliage
            p = at(pts, k / 6)
            sd = dir_at(pts, k / 6)
            for _j in range(4):
                g.leaf(p, sd * 0.6 + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0, 0.6))), 0.02, 0.0024,
                       leaf_col("chamomile", rnd, s), shape="needle", droop=0.05, fold=0, seg=2)
    heads = {"spring": 6, "summer": 26, "autumn": 9, "winter": 0}[s]
    for _ in range(heads):
        d, _a = spread_dir(rnd, 4, 35)
        ln = H * rnd.uniform(0.75, 1.15)
        pts = curve(base + Vector((rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), 0)), d, ln, 0.05, 5, rnd, 0.05)
        g.stem(pts, 0.001, 0.0008, vary(lin(STEMS["green"] if s != "autumn" else STEMS["dry"]), rnd), sides=3)
        top = pts[-1]
        nrm = (dir_at(pts, 1) + UP).normalized()
        if s == "autumn":
            g.cone(top, nrm, 0.0045, 0.006, vary(lin("#a18a46"), rnd))
        else:
            daisy(g, top, nrm, 0.011, 13, lin("#f3f0e6"), lin("#dfb126"), 0.0045, 0.006, 0.0035, 10, rnd)


def p_calendula(g, base, rnd, s, H=0.32):
    n_leaves = {"spring": 14, "summer": 20, "autumn": 14, "winter": 5}[s]
    for _ in range(n_leaves):
        d, _a = spread_dir(rnd, 25, 75)
        ln = (0.08 if s != "winter" else 0.035) * rnd.uniform(0.8, 1.2)
        g.leaf(base + Vector((0, 0, 0.01)), d, ln, ln * 0.3, leaf_col("calendula", rnd, s), shape="oblong", droop=0.25, fold=0.2, seg=4)
    heads = {"spring": 4, "summer": 9, "autumn": 3, "winter": 0}[s]
    for i in range(heads + (4 if s == "autumn" else 0)):
        d, _a = spread_dir(rnd, 5, 35)
        ln = H * rnd.uniform(0.7, 1.05)
        pts = curve(base, d, ln, 0.04, 5)
        g.stem(pts, 0.0028, 0.0018, vary(lin(STEMS["green"]), rnd))
        for k in (0.35, 0.6):
            g.leaf(at(pts, k), Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.4)), 0.05, 0.016, leaf_col("calendula", rnd, s),
                   shape="oblong", droop=0.2, fold=0.2, seg=3)
        top = pts[-1]
        nrm = (dir_at(pts, 1) + UP * 0.7).normalized()
        if i >= heads:                                              # autumn: curled seedheads
            for k in range(9):
                ang = 2 * math.pi * k / 9
                g.blob(top + Vector((math.cos(ang), math.sin(ang), 0)) * 0.006, 0.003, vary(lin("#6b5a33"), rnd), mi=STEM)
            continue
        col = lin("#e8731a") if rnd.random() < 0.6 else lin("#f09c1c")
        daisy(g, top, nrm, 0.028, 20, col, lin("#a2501a"), 0.006, 0.004, 0.006, 8, rnd, rings=2)
    if s == "winter":
        for _ in range(4):                                           # a few seedlings coming up
            p = base + Vector((rnd.uniform(-.05, .05), rnd.uniform(-.05, .05), 0))
            seedling(g, p, rnd, 0.02)


def p_echinacea(g, base, rnd, s, H=0.62):
    basal = {"spring": 10, "summer": 12, "autumn": 10, "winter": 3}[s]
    for _ in range(basal):
        d, _a = spread_dir(rnd, 25, 65)
        c = leaf_col("echinacea", rnd, s, 0.3 if s == "winter" else 0)
        if s == "winter":
            c = vary(lin("#6e5d3e"), rnd)
        g.leaf(base + Vector((0, 0, 0.01)), d, 0.13 * rnd.uniform(0.8, 1.1), 0.035, c, shape="lance", droop=0.3, fold=0.2, seg=4)
    heads = {"spring": 0, "summer": 6, "autumn": 6, "winter": 5}[s]
    for _ in range(heads):
        d, _a = spread_dir(rnd, 2, 20)
        pts = curve(base, d, H * rnd.uniform(0.75, 1.05), 0.0, 6, rnd, 0.03)
        stem_c = STEMS["green"] if s == "summer" else STEMS["dry"]
        g.stem(pts, 0.0035, 0.0025, vary(lin(stem_c), rnd))
        if s != "winter":
            for k in (0.3, 0.5):
                g.leaf(at(pts, k), Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.2)), 0.07, 0.02, leaf_col("echinacea", rnd, s),
                       shape="lance", droop=0.25, seg=3)
        top, nrm = pts[-1], (dir_at(pts, 1) + UP).normalized()
        if s == "summer":
            daisy(g, top, nrm, 0.045, 14, lin("#c76a90"), lin("#b2622a"), 0.012, 0.016, 0.009, 42, rnd)
        else:
            g.cone(top - nrm * 0.004, nrm, 0.011, 0.02, vary(lin("#3a2a1c"), rnd), mi=STEM)


def p_borage(g, base, rnd, s, H=0.5):
    if s == "winter":
        for _ in range(5):
            seedling(g, base + Vector((rnd.uniform(-.06, .06), rnd.uniform(-.06, .06), 0)), rnd, 0.03)
        return
    for _ in range({"spring": 7, "summer": 8, "autumn": 5}[s]):
        d, _a = spread_dir(rnd, 40, 75)
        g.leaf(base + Vector((0, 0, 0.01)), d, 0.15 * rnd.uniform(0.75, 1.1), 0.07, leaf_col("borage", rnd, s, 0.15 if s == "autumn" else 0),
               shape="ovate", droop=0.35, fold=0.25, seg=5)
    if s == "spring":
        return
    for i in range(5):
        d, _a = spread_dir(rnd, 10, 40)
        pts = curve(base, d, H * rnd.uniform(0.7, 1.0), 0.15, 5, rnd, 0.05)
        g.stem(pts, 0.004, 0.0022, vary(lin(STEMS["green"] if s == "summer" else STEMS["dry"]), rnd))
        g.leaf(at(pts, 0.4), Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.2)), 0.08, 0.035, leaf_col("borage", rnd, s), shape="ovate", seg=4)
        for k in range(5 if s == "summer" else 0):                  # nodding clusters of blue stars
            p = pts[-1] + Vector((rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), rnd.uniform(-.03, 0.0)))
            g.stem([pts[-1], p + Vector((0, 0, 0.012)), p], 0.0012, 0.0008, vary(lin("#6b4a5c"), rnd), sides=3)
            star(g, p, Vector((rnd.uniform(-.6, .6), rnd.uniform(-.6, .6), -1)), 0.012, lin("#4a6fd6"), lin("#2a2030"), rnd)


def p_fennel(g, base, rnd, s, H=1.05):
    h = H * {"spring": 0.6, "summer": 1.0, "autumn": 0.95, "winter": 0.22}[s]
    col_name = "fennel"
    for i in range(8):
        d, _a = spread_dir(rnd, 2, 14)
        ln = h * rnd.uniform(0.7, 1.0)
        pts = curve(base + Vector((rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), 0)), d, ln, 0.0, 6, rnd, 0.03)
        g.stem(pts, 0.006, 0.003, vary(lin("#7a9a4a" if s != "autumn" else "#a59a6a"), rnd))
        for k in range(2, 7):                                       # feathery fronds: clouds of fine threads
            t = k / 7
            p = at(pts, t)
            out = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.5)).normalized()
            fl = 0.12 * (1.2 - t) * (0.6 if s == "winter" else 1)
            mid = p + out * fl * 0.5
            for _j in range(int(30 * (0.5 if s == "winter" else 1))):
                q = mid + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 1))) * fl * 0.45
                c = leaf_col(col_name, rnd, s, 0.4 if s == "autumn" else 0)
                g.leaf(q, Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 1))), 0.035, 0.0018, c,
                       shape="needle", droop=0.0, fold=0, seg=1)
        if s in ("summer", "autumn") and i % 2 == 0:                # umbels: yellow in flower, tan in seed
            top = pts[-1]
            col = lin("#d4bd3c") if s == "summer" else lin("#a38c5e")
            for _k in range(14):
                ray = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.9)).normalized()
                tip = top + ray * 0.05
                g.stem([top, tip], 0.0008, 0.0006, vary(lin("#8a9a52"), rnd), sides=3)
                for _m in range(4):
                    g.blob(tip + Vector((rnd.uniform(-.008, .008), rnd.uniform(-.008, .008), 0.002)), 0.0022, vary(col, rnd))


def p_ginger(g, base, rnd, s, H=0.75):
    canes = {"spring": 4, "summer": 9, "autumn": 8, "winter": 4}[s]
    h = H * {"spring": 0.35, "summer": 1.0, "autumn": 0.85, "winter": 0.12}[s]
    for i in range(canes):
        d, a = spread_dir(rnd, 2, 16)
        pts = curve(base + Vector((rnd.uniform(-.06, .06), rnd.uniform(-.06, .06), 0)), d, h * rnd.uniform(0.7, 1.0), 0.0, 5)
        if s == "winter":
            g.stem(pts, 0.005, 0.004, vary(lin(STEMS["dry"]), rnd))
            continue
        g.stem(pts, 0.005, 0.003, vary(lin("#6d8a46"), rnd))
        n = max(2, int(len(pts) * 2))
        for k in range(1, n + 1):                                  # two-ranked: leaves alternate in one plane
            t = 0.25 + 0.75 * k / n
            side = 1 if k % 2 else -1
            rad = Vector((math.cos(a), math.sin(a), 0)) * side
            g.leaf(at(pts, t), rad * 0.9 + UP * 0.45, 0.17 * (1.1 - 0.3 * t), 0.026, leaf_col("ginger", rnd, s, 0.3 if s == "autumn" else 0),
                   shape="lance", droop=0.35, fold=0.15, seg=5)


def p_turmeric(g, base, rnd, s, H=0.6):
    n = {"spring": 3, "summer": 7, "autumn": 6, "winter": 0}[s]
    if s == "winter":
        for _ in range(2):
            g.stem([base, base + Vector((rnd.uniform(-.02, .02), rnd.uniform(-.02, .02), 0.06))], 0.006, 0.004, vary(lin(STEMS["dry"]), rnd))
    scale = 0.6 if s == "spring" else 1.0
    for _ in range(n):
        d, _a = spread_dir(rnd, 6, 28)
        pts = curve(base, d, 0.22 * scale, 0.0, 3)
        g.stem(pts, 0.006, 0.005, vary(lin("#6f8d48"), rnd))
        g.leaf(pts[-1], d + UP * 0.6, 0.38 * scale * rnd.uniform(0.85, 1.1), 0.1 * scale, leaf_col("turmeric", rnd, s, 0.35 if s == "autumn" else 0),
               shape="oblong", droop=0.35, fold=0.3, seg=6)


def p_aloe(g, base, rnd, s, H=0.4):
    for k in range(16):
        ring = k / 16
        ang = k * 2.4
        tilt = math.radians(70 - 55 * ring)                         # outer blades splay, inner ones stand up
        d = Vector((math.cos(ang) * math.sin(tilt), math.sin(ang) * math.sin(tilt), math.cos(tilt)))
        ln = 0.3 * (1.0 - 0.35 * ring) * rnd.uniform(0.9, 1.05)
        g.leaf(base + Vector((0, 0, 0.015)), d, ln, 0.05 * (1 - 0.3 * ring), vary(lin(GREEN["aloe"]), rnd, 0.07),
               shape="lance", droop=0.12, fold=0.9, seg=6)


def p_roselle(g, base, rnd, s, H=0.95):
    h = H * {"spring": 0.45, "summer": 1.0, "autumn": 0.95, "winter": 0.35}[s]
    for i in range(4):
        d, _a = spread_dir(rnd, 3, 14)
        pts = curve(base + Vector((rnd.uniform(-.04, .04), rnd.uniform(-.04, .04), 0)), d, h * rnd.uniform(0.75, 1.0), 0.0, 6, rnd, 0.03)
        g.stem(pts, 0.006, 0.003, vary(lin(STEMS["red"] if s != "winter" else STEMS["dry"]), rnd))
        nodes = 7 if s != "winter" else 2
        for k in range(nodes):
            t = 0.25 + 0.75 * k / nodes
            p = at(pts, t)
            ang = k * 2.4 + i
            rad = Vector((math.cos(ang), math.sin(ang), 0.2))
            if s == "autumn" and rnd.random() < 0.6:                # fleshy red calyces at the nodes
                g.blob(p + rad * 0.015, 0.011, vary(lin("#a51d2a"), rnd, 0.1), mi=PETAL, stretch=(1, 1, 1.6), axis=rad + UP)
            petiole = p + rad * 0.04 + UP * 0.01
            g.stem([p, petiole], 0.0015, 0.0012, vary(lin(STEMS["red"]), rnd), sides=3)
            for lobe in (-0.6, 0, 0.6):                              # three-lobed leaves
                ld = Vector((math.cos(ang + lobe), math.sin(ang + lobe), 0.15))
                g.leaf(petiole, ld, 0.075 * (1.0 if lobe == 0 else 0.75), 0.018, leaf_col("roselle", rnd, s), shape="lance", droop=0.3, seg=3)
        if s == "summer" and i < 2:
            top = at(pts, 0.8)
            daisy(g, top + Vector((0.02, 0, 0)), Vector((1, 0.3, 0.6)), 0.035, 5, lin("#f0dc98"), lin("#7a1a22"), 0.008, 0.006, 0.03, 15, rnd)


def p_passion_leaf(g, p, rnd, s, normal):
    col = leaf_col("passion", rnd, s, 0.45 if s == "autumn" else 0)
    if s == "autumn":
        col = vary(col, rnd, 0.1, 0.25)                             # olive, going yellow
    a, b, n = basis(normal)
    ang = rnd.uniform(0, 2 * math.pi)
    for lobe in (-0.65, 0, 0.65):
        d = a * math.cos(ang + lobe) + b * math.sin(ang + lobe) + n * 0.25
        g.leaf(p, d, 0.07 * (1 if lobe == 0 else 0.8), 0.024, col, shape="lance", droop=0.05, fold=0.15, n_hint=n, seg=3)


def p_passion_flower(g, c, rnd, normal):
    a, b, n = basis(normal)
    for k in range(10):                                             # sepals and petals, white with a lilac blush
        ang = 2 * math.pi * k / 10
        rad = a * math.cos(ang) + b * math.sin(ang)
        g.leaf(c, rad * 0.97 - n * 0.1, 0.034, 0.011, vary(lin("#ece4f2" if k % 2 else "#d9cbe6"), rnd, 0.05), shape="oblong", droop=0,
               fold=0.1, n_hint=n, seg=3, mi=PETAL)
    for k in range(44):                                             # the corona: fine filaments banded purple and white
        ang = 2 * math.pi * k / 44
        rad = a * math.cos(ang) + b * math.sin(ang)
        col = lin("#5b2a7a") if k % 3 else lin("#f2eef6")
        g.leaf(c + n * 0.003, rad * 0.9 + n * 0.25, 0.027, 0.0013, col, shape="needle", droop=0, fold=0, n_hint=n, seg=2, mi=PETAL)
    g.stem([c, c + n * 0.022], 0.0022, 0.0018, lin("#7e9a52"), mi=PETAL, sides=5)
    for k in range(5):                                              # stamens
        ang = 2 * math.pi * k / 5
        g.blob(c + n * 0.024 + (a * math.cos(ang) + b * math.sin(ang)) * 0.008, 0.0028, lin("#d9c26a"), stretch=(1.6, 0.6, 0.6))


def passionflower(name, mats, s, rnd):
    """The vine: up the sea-end garden corner, along under the eaves to the lane end, side shoots up the rafters."""
    g = Geo()
    root = Vector((W - 0.18, L - 0.2, 0.3))
    eave_z = ROOF_LO - 0.06
    path = [root, Vector((W - 0.1, L - 0.12, 0.9)), Vector((W - 0.08, L - 0.1, 1.6)), Vector((W - 0.1, L - 0.15, eave_z))]
    for i in range(1, 25):                                          # along the eaves, gently swagged
        y = L - 0.15 - i * 0.235
        path.append(Vector((W - 0.12 - 0.03 * math.sin(i * 1.3), y, eave_z - 0.04 - 0.05 * abs(math.sin(i * 0.9)))))
    g.stem(path, 0.006, 0.004, vary(lin("#6f6a3e"), rnd), sides=5)
    leaf_every = {"spring": 1.0, "summer": 1.0, "autumn": 0.7, "winter": 0.08}[s]
    flowers = {"spring": 7, "summer": 15, "autumn": 0, "winter": 0}[s]
    shoots = []
    for i in range(3, len(path) - 1, 2):                            # shoots up every other rafter
        if i % 4 == 1:
            continue
        p0 = path[i]
        pts = [p0]
        for k in range(1, 7):
            x = p0.x - k * 0.17
            pts.append(Vector((x, p0.y + 0.03 * math.sin(k), roof_z(x) - 0.07)))
        shoots.append(pts)
        g.stem(pts, 0.0035, 0.002, vary(lin("#7a7442"), rnd), sides=4)
    curvy = [path[3:]] + shoots
    count = 0
    for pts in curvy:
        for k in range(len(pts) - 1):
            for j in range(3):
                t = (k + j / 3) / (len(pts) - 1)
                if rnd.random() > leaf_every:
                    continue
                p = at(pts, t) + Vector((rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), -0.02))
                g.stem([at(pts, t), p], 0.0013, 0.001, vary(lin("#7a8a48"), rnd), sides=3)
                p_passion_leaf(g, p, rnd, s, Vector((rnd.uniform(-.5, .5), rnd.uniform(-.5, .5), -1)))
                count += 1
            if rnd.random() < 0.35 and s != "winter":               # tendrils: little spirals
                c0 = at(pts, (k + 0.5) / (len(pts) - 1))
                sp = [c0 + Vector((0.012 * math.cos(u), 0.012 * math.sin(u), -0.004 * u)) for u in [x * 0.6 for x in range(14)]]
                g.stem(sp, 0.0007, 0.0005, lin("#8fa456"), sides=3)
    spots = [at(curvy[rnd.randrange(len(curvy))], rnd.uniform(0.1, 0.95)) for _ in range(flowers)]
    for p in spots:
        p_passion_flower(g, p + Vector((0, 0, -0.04)), rnd, Vector((rnd.uniform(-.5, .5), rnd.uniform(-.5, .5), -1)))
    if s == "autumn":
        for _ in range(4):                                          # a few ripening fruit
            p = at(curvy[rnd.randrange(len(curvy))], rnd.uniform(0.2, 0.9))
            g.blob(p + Vector((0, 0, -0.05)), 0.02, vary(lin("#8d9a52"), rnd), mi=LEAF, stretch=(1, 1, 1.3))
    o = g.make(name, mats)
    return o, path[len(path) // 2 + 2]


def seedling(g, p, rnd, size=0.025, col="#7aa548"):
    h = size * rnd.uniform(0.6, 1.2)
    top = Vector(p) + Vector((rnd.uniform(-.003, .003), rnd.uniform(-.003, .003), h))
    g.stem([p, top], 0.0008, 0.0006, vary(lin("#9ab36a"), rnd), sides=3)
    a = rnd.uniform(0, math.pi)
    for side in (-1, 1):
        g.leaf(top, Vector((math.cos(a) * side, math.sin(a) * side, 0.35)), size * 0.45, size * 0.3, vary(lin(col), rnd), shape="round",
               droop=0.1, fold=0.2, seg=2)


PLANTS = {
    "lavender": p_lavender, "rosemary": p_rosemary, "thyme": p_thyme, "sage": p_sage,
    "mint": lambda g, b, r, s: p_opposite(g, b, r, s, "mint", 0.42, 12, 0.055, 0.026, "purple", "#c9a9d6"),
    "balm": lambda g, b, r, s: p_opposite(g, b, r, s, "balm", 0.4, 11, 0.06, 0.04, "green"),
    "basil": lambda g, b, r, s: p_opposite(g, b, r, s, "basil", 0.42, 9, 0.05, 0.026, "purple", "#c48ab8"),
    "chamomile": p_chamomile, "calendula": p_calendula, "echinacea": p_echinacea, "borage": p_borage, "fennel": p_fennel,
    "ginger": p_ginger, "turmeric": p_turmeric, "aloe": p_aloe, "roselle": p_roselle,
}
BUSHY = {"lavender", "rosemary", "thyme", "sage", "mint", "balm", "basil", "chamomile", "calendula", "borage", "echinacea"}
PLANT_SCALE = 1.35                                                  # the plants as modelled, scaled up to fill their pots
HEIGHT = {"lavender": 0.42, "rosemary": 0.55, "thyme": 0.1, "sage": 0.3, "mint": 0.3, "balm": 0.3, "basil": 0.32, "chamomile": 0.24,
          "calendula": 0.28, "echinacea": 0.5, "borage": 0.35, "fennel": 0.8, "ginger": 0.6, "turmeric": 0.45, "aloe": 0.25, "roselle": 0.75}

# Pots: (plant, x, y, z of the pot's foot, rim radius, height). The order is fixed: each pot's random seed is its index.
STAGE = STAGE_Z
POTS = [
    # lane run of staging, from the lane end
    ("thyme", 1.56, 0.33, STAGE, 0.085, 0.14), ("balm", 1.44, 0.64, STAGE, 0.12, 0.19), ("chamomile", 1.66, 0.84, STAGE, 0.08, 0.13),
    ("calendula", 1.43, 1.56, STAGE, 0.1, 0.16), ("thyme", 1.66, 1.68, STAGE, 0.07, 0.12), ("basil", 1.52, 1.95, STAGE, 0.11, 0.18),
    ("chamomile", 1.42, 2.3, STAGE, 0.085, 0.14), ("calendula", 1.66, 2.22, STAGE, 0.075, 0.12),
    # sea run of staging
    ("aloe", 1.55, 3.86, STAGE, 0.11, 0.17), ("borage", 1.44, 4.22, STAGE, 0.12, 0.19), ("sage", 1.66, 4.42, STAGE, 0.1, 0.16),
    ("lavender", 1.46, 4.7, STAGE, 0.11, 0.17), ("lavender", 1.43, 5.48, STAGE, 0.12, 0.19), ("chamomile", 1.67, 5.62, STAGE, 0.075, 0.12),
    ("echinacea", 1.5, 5.86, STAGE, 0.11, 0.18), ("thyme", 1.68, 6.06, STAGE, 0.07, 0.11),
    # floor, garden side, in front of and under the staging
    ("ginger", 1.2, 0.48, 0.0, 0.17, 0.3), ("turmeric", 1.17, 1.12, 0.0, 0.16, 0.28), ("mint", 1.56, 5.15, 0.0, 0.12, 0.2),
    ("calendula", 1.58, 1.95, 0.0, 0.1, 0.16),
    # floor, sea end
    ("rosemary", 1.05, 6.0, 0.0, 0.2, 0.32), ("fennel", 0.35, 5.88, 0.0, 0.18, 0.34), ("sage", 0.62, 6.05, 0.0, 0.12, 0.18),
    # floor along the Inn wall, clear of the Chiapothecary door
    ("roselle", 0.32, 0.42, 0.0, 0.19, 0.3), ("thyme", 0.2, 0.85, 0.0, 0.08, 0.12), ("mint", 0.25, 2.78, 0.0, 0.12, 0.2),
    ("balm", 0.22, 3.38, 0.0, 0.1, 0.16), ("borage", 0.27, 4.05, 0.0, 0.13, 0.2), ("lavender", 0.25, 4.7, 0.0, 0.13, 0.2),
    ("echinacea", 0.24, 5.3, 0.0, 0.12, 0.2), ("chamomile", 0.5, 4.38, 0.0, 0.08, 0.12),
    # more, so it looks lived in: the staging's gaps, under the staging, along the wall
    ("mint", 1.68, 0.55, STAGE, 0.07, 0.11), ("thyme", 1.69, 4.08, STAGE, 0.065, 0.1), ("basil", 1.67, 5.36, STAGE, 0.07, 0.11),
    ("sage", 1.7, 2.05, STAGE, 0.065, 0.1),
    ("chamomile", 1.62, 1.5, 0.0, 0.09, 0.14), ("thyme", 1.45, 2.2, 0.0, 0.08, 0.13), ("calendula", 1.6, 4.85, 0.0, 0.1, 0.15),
    ("balm", 1.5, 5.62, 0.0, 0.11, 0.17),
    ("calendula", 0.2, 3.75, 0.0, 0.09, 0.14), ("thyme", 0.45, 5.05, 0.0, 0.08, 0.12), ("basil", 0.48, 0.78, 0.0, 0.1, 0.15),
    ("rosemary", 0.22, 1.3, 0.0, 0.11, 0.17),
]
PASSION_POT = (W - 0.18, L - 0.2, 0.0, 0.15, 0.26)
SEED_TRAYS = [(1.54, 1.18, 0.0), (1.55, 5.08, 90.0)]                 # on the staging: x, y, turn


def clay_pot(name, x, y, z, r, h, pot_mat, soil_mat, saucer=False):
    """A lathe-turned flowerpot with a rolled rim, open at the top, with soil in it. Returns the soil's top centre."""
    prof = [(0.0, 0.0), (0.66 * r, 0.0), (0.68 * r, 0.01), (0.9 * r, 0.8 * h), (0.93 * r, 0.8 * h), (1.0 * r, 0.82 * h),
            (1.0 * r, h), (0.9 * r, h), (0.88 * r, 0.83 * h), (0.6 * r, 0.06)]
    segs = 40
    verts, faces = [], []
    for i, (rr, zz) in enumerate(prof):
        for k in range(segs):
            a = 2 * math.pi * k / segs
            verts.append((rr * math.cos(a), rr * math.sin(a), zz))
    for i in range(len(prof) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.polygons.foreach_set("use_smooth", [True] * len(faces))
    o = bpy.data.objects.new(name, me)
    o.location = (x, y, z)
    o.rotation_euler = (0, 0, random.Random(name).uniform(0, 6.28))
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(pot_mat)
    soil_z = z + 0.86 * h
    cyl(f"{name}_soil", (x, y, soil_z - 0.01), 0.885 * r, 0.02, soil_mat, verts=24, bevel=0.004)
    if saucer:
        cyl(f"{name}_saucer", (x, y, z + 0.008), 0.85 * r, 0.016, pot_mat, verts=32, bevel=0.005)
    return Vector((x, y, soil_z)), o


def herb_bunch(g, top, rnd, kind, s):
    """A bunch hung upside down from the drying beam, tied with twine."""
    cols = {"lavender": "#7d8c76", "rosemary": "#4a5c40", "sage": "#8a9580", "thyme": "#5e6b48", "chamomile": "#7e8c55"}
    dry = 0.25 if s != "autumn" else 0.15
    for _ in range(16):
        d = Vector((rnd.uniform(-.25, .25), rnd.uniform(-.25, .25), -1))
        pts = curve(top + Vector((rnd.uniform(-.008, .008), rnd.uniform(-.008, .008), 0)), d, rnd.uniform(0.18, 0.26), 0.0, 4)
        g.stem(pts, 0.0015, 0.001, vary(lin("#7d6c4a"), rnd), sides=3)
        for k in range(2, 9):
            p = at(pts, k / 9)
            for side in (-1, 1):
                ld = Vector((side * rnd.uniform(.3, 1), rnd.uniform(-1, 1), -0.5))
                if kind in ("lavender", "rosemary", "thyme"):
                    g.leaf(p, ld, 0.02, 0.0025, vary(lin(cols[kind]), rnd, 0.1, dry), shape="needle", droop=0.0, seg=2)
                else:
                    g.leaf(p, ld, 0.04, 0.016, vary(lin(cols[kind]), rnd, 0.1, dry), shape="ovate", droop=0.2, fold=0.3, seg=3)
        if kind == "lavender":
            spike(g, pts[-1], d, 0.05, 0.004, lin("#6a5590"), rnd, whorls=6, per=5)
        if kind == "chamomile":
            g.cone(pts[-1], -d, 0.005, 0.006, lin("#c9b25a"))
    g.stem([top + Vector((0, 0, 0.12)), top + Vector((0, 0, 0.0))], 0.0012, 0.0012, lin("#b8a383"), sides=3)
    for k in range(4):                                              # the twine wrap
        g.stem([top + Vector((0.012 * math.cos(u), 0.012 * math.sin(u), -0.01 - 0.003 * k)) for u in [x * 0.8 for x in range(9)]],
               0.0014, 0.0014, lin("#b8a383"), sides=3)


# ---------------------------------------------------------------- build

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rnd = random.Random(7)                                          # dressing that never moves between seasons

    plaster = pbr("plaster", "white_plaster_rough_01", 3.0, tint=srgb("#e8dcc4"), tint_mix=0.85, bump=0.6)
    floor_m = pbr("floor", "terracotta_floor_tiles", 0.9, tint=srgb("#b8794f"), tint_mix=0.3, rough_add=0.1, bump=0.7)
    staging = pbr("staging", "worn_planks", 1.6, tint=srgb("#a67c4e"), tint_mix=0.35, rough_add=0.1, rot_z=90)
    beam_wood = pbr("beam", "wood_table_worn", 1.5, tint=srgb("#8a6236"), tint_mix=0.4, rot_z=90)
    door_oak = pbr("door_oak", "medieval_wood", 2.0, tint=srgb("#9b693e"), tint_mix=0.55)
    door_dark = pbr("door_dark", "medieval_wood", 2.0, tint=srgb("#6e4a2b"), tint_mix=0.6)
    soil = pbr("soil", "forest_ground_06", 0.8, tint=srgb("#3d3024"), tint_mix=0.5, bump=0.9)
    gravel = pbr("gravel", "gravel_floor_02", 1.5, bump=0.8)
    sage = sage_paint("sage_paint")
    paint = mat("cream_paint", srgb("#eee5d3"), rough=0.55)
    brass = mat("brass", srgb("#b07f52"), rough=0.4, metal=1.0)
    brass_worn = mat("brass_worn", srgb("#bd9655"), rough=0.3, metal=1.0)
    ink = mat("engraving", srgb("#3a2a18"), rough=0.5, metal=0.6)
    iron = mat("iron", srgb("#2a2622"), 0.6, 0.8)
    twine = pbr("twine", "rough_linen", 0.1, tint=srgb("#b8a383"), tint_mix=1.0, bump=0.8)
    pot_mat = terracotta("terracotta")
    side_glass = frosty_glass("glass", 0.0, S["frost"])
    roof_glass = frosty_glass("roof_glass", S["wet"], 0.0)
    pmats = plant_mats()

    # ---- Floor, the Inn wall (running past both glass ends, as the house does), its first-floor window
    box_span("floor", -0.05, W + 0.1, -0.1, L + 0.1, -0.1, 0.0, floor_m)
    box_span("ground_out", W + 0.1, W + 1.8, -2.4, L + 1.6, -0.12, -0.02, gravel)
    for name, y0, y1 in (("ground_lane", -2.4, -0.1), ("ground_sea", L + 0.1, L + 1.6)):
        box_span(name, 0.0, W + 0.1, y0, y1, -0.12, -0.02, gravel)
    wx0, wx1 = -0.3, 0.0
    cd0, cd1 = CD_Y - CD_W / 2, CD_Y + CD_W / 2
    box_span("inn_wall_lane", wx0, wx1, -2.4, cd0, 0, 5.6, plaster)
    box_span("inn_wall_sea", wx0, wx1, cd1, L + 1.6, 0, 5.6, plaster)
    box_span("inn_wall_over_door", wx0, wx1, cd0, cd1, CD_H, 5.6, plaster)
    box_span("behind_door", wx0 - 0.4, wx0, cd0, cd1, 0, CD_H, mat("still_room_dark", srgb("#2a2018"), 0.9))
    # first-floor landing window, seen up through the roof glass
    wy, wz0, wz1 = 3.4, 3.3, 4.5
    box_span("landing_window_glass", -0.12, -0.1, wy - 0.42, wy + 0.42, wz0, wz1, mat("dark_glass", srgb("#39434a"), 0.08))
    for name, a0, a1, b0, b1 in (("l", wy - 0.46, wy - 0.4, wz0, wz1), ("r", wy + 0.4, wy + 0.46, wz0, wz1), ("t", wy - 0.46, wy + 0.46, wz1 - 0.04, wz1 + 0.02),
                                 ("m", wy - 0.42, wy + 0.42, (wz0 + wz1) / 2 - 0.025, (wz0 + wz1) / 2 + 0.025), ("v", wy - 0.015, wy + 0.015, wz0, wz1)):
        box_span(f"landing_window_{name}", -0.1, 0.01, a0, a1, b0, b1, paint, bevel=0.004)
    box_span("landing_window_sill", -0.08, 0.06, wy - 0.52, wy + 0.52, wz0 - 0.06, wz0, plaster, bevel=0.01)

    # ---- Chiapothecary door: old oak, four panels, the same family as the hallway doors (closed: not open yet)
    lw, lh, lt = CD_W - 0.02, CD_H - 0.03, 0.045
    parts = [box_span("cd_leaf", 0, lw, -lt / 2, lt / 2, 0.012, 0.012 + lh, door_oak, bevel=0.004)]
    for px in (0.22, lw - 0.22):
        for pz0, pz1 in ((0.2, 0.92), (1.08, 1.86)):
            parts.append(box_span(f"cd_panel_{px}_{pz0}", px - 0.135, px + 0.135, -lt / 2 - 0.006, -lt / 2, pz0 + 0.02, pz1 - 0.02, door_oak, bevel=0.008))
            for nm, a0, a1, b0, b1 in (("l", px - 0.165, px - 0.14, pz0, pz1), ("r", px + 0.14, px + 0.165, pz0, pz1),
                                       ("b", px - 0.165, px + 0.165, pz0, pz0 + 0.025), ("t", px - 0.165, px + 0.165, pz1 - 0.025, pz1)):
                parts.append(box_span(f"cd_mould_{px}_{pz0}_{nm}", a0, a1, -lt / 2 - 0.014, -lt / 2, b0, b1, door_dark, bevel=0.005))
    parts.append(cyl("cd_knob", (lw - 0.07, -lt / 2 - 0.035, 1.0), 0.028, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
    for hz in (0.25, 1.75):
        parts.append(cyl(f"cd_hinge_{hz}", (0.005, 0, hz), 0.009, 0.1, iron))
    # local x along the door (toward the sea), local -y out of the wall into the glasshouse (+X)
    m = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4()
    m.translation = Vector((-0.06, cd0 + 0.01, 0))
    cd_root = group("chiapothecary_door", m, parts)
    for nm, y0, y1 in (("a", cd0 - 0.08, cd0), ("b", cd1, cd1 + 0.08)):
        box_span(f"cd_trim_{nm}", 0.0, 0.025, y0, y1, 0, CD_H + 0.08, paint, bevel=0.005)
    box_span("cd_trim_t", 0.0, 0.025, cd0 - 0.08, cd1 + 0.08, CD_H, CD_H + 0.09, paint, bevel=0.005)
    for y0, y1 in ((cd0, cd0 + 0.008), (cd1 - 0.008, cd1)):
        box_span(f"cd_jamb_{y0:.2f}", wx0, wx1, y0, y1, 0, CD_H, paint)
    box_span("cd_head", wx0, wx1, cd0, cd1, CD_H - 0.008, CD_H, paint)
    box_span("cd_step", -0.06, 0.04, cd0, cd1, 0, 0.02, door_oak, bevel=0.004)
    hotspot("gh-chiapothecary-door", "Chiapothecary", meshes_of(cd_root), kind="door")

    # ---- The room dial, the same as the hallway's, its pointer left on the Glasshouse
    dial_face = image_mat("dial_face", os.path.join(HALL, "05-dial-plate-flat.png"), rough=0.35, circle=0.4825)
    dial_face.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    dial_r = 0.1
    dparts = []
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0035))
    face = bpy.context.active_object
    face.name = "gh_dial_face"
    face.scale = (2 * dial_r / 0.965,) * 2 + (1,)
    bpy.ops.object.transform_apply(scale=True)
    face.data.materials.append(dial_face)
    dparts += [face, cyl("gh_dial_rim", (0, 0, 0), dial_r, 0.006, brass, verts=96, bevel=0.002)]
    for st in json.load(open(os.path.join(HALL, "dial-layout.json"), encoding="utf8"))["stations"]:
        if not st["label"]:
            continue
        a = math.radians(st["angle_clockwise_from_top_deg"])
        words = st["label"].split(" ")
        body = "\n".join(words) if len(words) > 1 else st["label"]
        size = 0.0042 if len(words) > 1 else (0.0036 if len(body) > 10 else 0.0044)
        dparts.append(text(f"gh_dial_name_{st['index']}", body, (0.0785 * math.sin(a), 0.0785 * math.cos(a), 0.0045), (0, 0, 0), size, ink))
    ptr = [cyl("gh_hub", (0, 0, 0.012), 0.014, 0.012, brass_worn, bevel=0.003), sphere("gh_hub_cap", (0, 0, 0.019), 0.008, brass_worn)]
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.006, radius2=0.0025, depth=0.062, location=(0, 0.035, 0.012),
                                    rotation=(math.radians(-90), 0, 0))
    shaft = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    shaft.data.materials.append(brass_worn)
    ptr += [shaft, sphere("gh_pointer_tip", (0, 0.068, 0.012), 0.0065, brass_worn), sphere("gh_pointer_tail", (0, -0.026, 0.012), 0.006, brass_worn)]
    dparts.append(group("gh_pointer_set", Matrix.Rotation(-math.radians(200), 4, "Z"), ptr))
    group("gh_dial", frame_matrix((0.006, DIAL_AT[1], DIAL_AT[2]), (1, 0, 0), (0, 1, 0)), dparts)
    hotspot("gh-dial", "The dial", [face], kind="dial", overlay="dial")

    # ---- Drying beam along the Inn wall, on iron brackets, with bunches hung from it
    bz = 2.2
    box_span("drying_beam", 0.06, 0.15, 0.35, L - 0.35, bz, bz + 0.08, beam_wood, bevel=0.01)
    for y in (0.5, 2.6, 4.4, L - 0.5):
        box_span(f"beam_bracket_{y}", 0.0, 0.15, y - 0.015, y + 0.015, bz - 0.01, bz, iron, bevel=0.002)
    hb = Geo()
    hrnd = random.Random(11)
    hang = {"spring": 3, "summer": 5, "autumn": 9, "winter": 6}[SEASON]
    kinds = ["lavender", "rosemary", "sage", "thyme", "chamomile", "lavender", "sage", "rosemary", "thyme"]
    ys = [0.75, 1.15, 2.75, 3.15, 3.6, 4.0, 4.9, 5.3, 5.7]
    for i in range(hang):
        herb_bunch(hb, Vector((0.105, ys[i], bz - 0.005)), hrnd, kinds[i], SEASON)
    if hang:
        bunches = hb.make("drying_herbs", pmats)
        hotspot("drying-herbs", "Drying herbs", [bunches])
    else:
        hotspot("drying-herbs", "Drying herbs", (0.1, 3.0, 2.05))

    # ---- Garden wall: boarded below the staging, glazed above, sage bars, the garden door in the middle
    gx = W
    d0, d1 = GD_Y - GD_W / 2, GD_Y + GD_W / 2
    for y0, y1 in ((0.0, d0 - 0.04), (d1 + 0.04, L)):
        box_span(f"kick_{y0:.1f}", gx - 0.01, gx + 0.02, y0, y1, 0, STAGE_Z - 0.02, sage, bevel=0.002)
        for k in range(int((y1 - y0) / 0.11)):
            yy = y0 + 0.11 * (k + 1)
            box_span(f"kick_groove_{y0:.1f}_{k}", gx - 0.014, gx - 0.008, yy - 0.003, yy + 0.003, 0.02, STAGE_Z - 0.04, sage, bevel=0)
        poly(f"glass_garden_{y0:.1f}", [(gx + 0.02, y0, STAGE_Z), (gx + 0.02, y1, STAGE_Z), (gx + 0.02, y1, ROOF_LO), (gx + 0.02, y0, ROOF_LO)],
             side_glass, shadow=False)
        box_span(f"sill_{y0:.1f}", gx - 0.03, gx + 0.05, y0, y1, STAGE_Z - 0.03, STAGE_Z, sage, bevel=0.004)
    box_span("transom_lane", gx - 0.02, gx + 0.04, 0, d0 - 0.04, 1.97, 2.03, sage, bevel=0.003)
    box_span("transom_sea", gx - 0.02, gx + 0.04, d1 + 0.04, L, 1.97, 2.03, sage, bevel=0.003)
    box_span("wall_plate", gx - 0.04, gx + 0.06, -0.04, L + 0.04, ROOF_LO - 0.06, ROOF_LO + 0.02, sage, bevel=0.005)
    poly("glass_over_door", [(gx + 0.02, d0 - 0.04, 2.03), (gx + 0.02, d1 + 0.04, 2.03), (gx + 0.02, d1 + 0.04, ROOF_LO), (gx + 0.02, d0 - 0.04, ROOF_LO)],
         side_glass, shadow=False)
    bar_ys = [0.0, 0.67, 1.34, 2.01, d0 - 0.04, d1 + 0.04, 4.27, 4.94, 5.62, L]
    for y in bar_ys:
        main = y in (0.0, L, d0 - 0.04, d1 + 0.04)
        w = 0.08 if main else 0.045
        box_span(f"bar_g_{y:.2f}", gx - (0.04 if main else 0.02), gx + 0.04, y - w / 2, y + w / 2, 0 if main else STAGE_Z, ROOF_LO, sage, bevel=0.004)
    # the seasons wheel's post: a broader board between bars, beside the door
    box_span("wheel_post", gx - 0.02, gx + 0.03, WHEEL_AT[1] - 0.07, WHEEL_AT[1] + 0.07, STAGE_Z, 1.97, sage, bevel=0.005)

    # Garden door: boarded below, two tall panes above, old brass knob
    leaf = []
    dt = 0.045
    dx0, dx1 = gx - 0.005, gx + dt - 0.005
    leaf.append(box_span("gd_board", dx0 + 0.01, dx1 - 0.01, d0 + 0.005, d1 - 0.005, 0.02, 0.86, sage, bevel=0.003))
    for k in range(1, 7):
        yy = d0 + k * GD_W / 7
        leaf.append(box_span(f"gd_groove_{k}", dx0 + 0.006, dx0 + 0.012, yy - 0.003, yy + 0.003, 0.1, 0.8, sage, bevel=0))
    for nm, a0, a1, b0, b1 in (("stile_l", d0 + 0.005, d0 + 0.09, 0.02, GD_H), ("stile_r", d1 - 0.09, d1 - 0.005, 0.02, GD_H),
                               ("rail_b", d0 + 0.005, d1 - 0.005, 0.02, 0.12), ("rail_m", d0 + 0.005, d1 - 0.005, 0.84, 0.96),
                               ("rail_t", d0 + 0.005, d1 - 0.005, GD_H - 0.09, GD_H), ("muntin", GD_Y - 0.018, GD_Y + 0.018, 0.96, GD_H - 0.09)):
        leaf.append(box_span(f"gd_{nm}", dx0, dx1, a0, a1, b0, b1, sage, bevel=0.004))
    door_glass = poly("gd_glass", [(gx + 0.015, d0 + 0.09, 0.96), (gx + 0.015, d1 - 0.09, 0.96), (gx + 0.015, d1 - 0.09, GD_H - 0.09),
                                   (gx + 0.015, d0 + 0.09, GD_H - 0.09)], side_glass, shadow=False)
    leaf.append(door_glass)
    leaf.append(cyl("gd_knob", (dx0 - 0.03, d0 + 0.13, 1.0), 0.026, 0.05, brass_worn, rot=(0, math.radians(90), 0)))
    leaf.append(box_span("gd_knob_plate", dx0 - 0.006, dx0, d0 + 0.105, d0 + 0.155, 0.88, 1.08, brass, bevel=0.003))
    leaf.append(box_span("gd_keyhole", dx0 - 0.007, dx0 - 0.005, d0 + 0.126, d0 + 0.134, 0.93, 0.955, iron, bevel=0))
    box_span("gd_head", gx - 0.04, gx + 0.04, d0 - 0.04, d1 + 0.04, GD_H, 2.03, sage, bevel=0.004)
    box_span("gd_threshold", gx - 0.06, gx + 0.08, d0 - 0.04, d1 + 0.04, 0, 0.025, beam_wood, bevel=0.004)
    hotspot("garden-door", "The garden door", leaf, kind="door")

    # ---- End walls: boarded to 0.6 m, glazed to the roof line, two bars and a transom
    for nm, y in (("lane", 0.0), ("sea", L)):
        s_ = -1 if y == 0 else 1
        box_span(f"end_board_{nm}", 0.0, gx, y - 0.01, y + 0.02 * s_, 0, 0.6, sage, bevel=0.002)
        box_span(f"end_sill_{nm}", 0.0, gx, y - 0.03, y + 0.03, 0.57, 0.6, sage, bevel=0.004)
        yy = y + 0.02 * s_
        poly(f"glass_end_{nm}", [(0.0, yy, 0.6), (gx, yy, 0.6), (gx, yy, ROOF_LO), (0.0, yy, ROOF_HI)], side_glass, shadow=False)
        for x in (0.6, 1.2):
            box_span(f"end_bar_{nm}_{x}", x - 0.0225, x + 0.0225, y - 0.02, y + 0.02, 0.6, roof_z(x), sage, bevel=0.003)
        box_span(f"end_transom_{nm}", 0.0, gx, y - 0.02, y + 0.02, 1.97, 2.03, sage, bevel=0.003)
        box_span(f"end_post_wall_{nm}", 0.0, 0.06, y - 0.03, y + 0.03, 0, ROOF_HI, sage, bevel=0.004)

    # ---- Roof: one glass plane falling from the Inn wall to the eaves, sage glazing bars on a ledger
    box_span("roof_ledger", 0.0, 0.09, -0.04, L + 0.04, ROOF_HI - 0.02, ROOF_HI + 0.09, sage, bevel=0.005)
    rz = 0.012
    poly("roof_glass", [(0.0, -0.02, ROOF_HI + rz), (0.0, L + 0.02, ROOF_HI + rz), (gx + 0.06, L + 0.02, roof_z(gx + 0.06) + rz),
                        (gx + 0.06, -0.02, roof_z(gx + 0.06) + rz)], roof_glass, shadow=False)
    for k in range(11):
        y = k * L / 10
        bar(f"rafter_{k}", (0.02, y, ROOF_HI - 0.03), (gx + 0.06, y, roof_z(gx + 0.06) - 0.03), 0.045 if 0 < k < 10 else 0.07, 0.07, sage)

    # ---- Staging along the garden glass, split at the door: slatted tops, square legs, a low rail
    for y0, y1 in ((0.12, d0 - 0.08), (d1 + 0.08, L - 0.12)):
        x0, x1 = gx - 0.47, gx - 0.03
        for k in range(5):
            sx = x0 + 0.005 + k * 0.088
            box_span(f"slat_{y0:.1f}_{k}", sx, sx + 0.08, y0, y1, STAGE_Z - 0.025, STAGE_Z, staging, bevel=0.003)
        for xr in (x0 + 0.03, x1 - 0.03):
            box_span(f"rail_{y0:.1f}_{xr:.2f}", xr - 0.025, xr + 0.025, y0, y1, STAGE_Z - 0.09, STAGE_Z - 0.025, staging, bevel=0.004)
            box_span(f"low_rail_{y0:.1f}_{xr:.2f}", xr - 0.02, xr + 0.02, y0, y1, 0.1, 0.15, staging, bevel=0.004)
        n_legs = 3 if y1 - y0 > 1.8 else 2
        for i in range(n_legs):
            ly = y0 + 0.03 + (y1 - y0 - 0.06) * i / (n_legs - 1)
            for xr in (x0 + 0.03, x1 - 0.03):
                box_span(f"leg_{y0:.1f}_{i}_{xr:.2f}", xr - 0.025, xr + 0.025, ly - 0.025, ly + 0.025, 0, STAGE_Z - 0.025, staging, bevel=0.004)
            box_span(f"leg_tie_{y0:.1f}_{i}", x0 + 0.03, x1 - 0.03, ly - 0.02, ly + 0.02, STAGE_Z - 0.09, STAGE_Z - 0.04, staging, bevel=0.004)

    # ---- Pots and plants
    for i, (kind, x, y, z, r, h) in enumerate(POTS):
        top, _pot = clay_pot(f"pot_{i:02d}_{kind}", x, y, z, r, h, pot_mat, soil, saucer=(z == 0 and r > 0.11))
        g = Geo()
        prnd = random.Random(100 + i)
        PLANTS[kind](g, Vector((0, 0, 0)), prnd, SEASON)
        if kind in BUSHY:                                           # a second growth from another seed: fuller, less regular
            PLANTS[kind](g, Vector((0, 0, 0)), random.Random(1100 + i), SEASON)
        if g.f:
            o = g.make(f"plant_{i:02d}_{kind}", pmats, loc=top)
            o.scale = (PLANT_SCALE * prnd.uniform(0.9, 1.12),) * 3
            o.rotation_euler = (0, 0, prnd.uniform(0, 6.28))
    clay_pot("pot_passionflower", *PASSION_POT, pot_mat, soil, saucer=True)
    passionflower("passionflower", pmats, SEASON, random.Random(42))

    # Hotspot centres for the plants: the first pot of each kind, a little above the soil
    labels = {"lavender": "Lavender", "rosemary": "Rosemary", "thyme": "Thyme", "sage": "Sage", "mint": "Peppermint",
              "balm": "Lemon balm", "basil": "Holy basil", "chamomile": "Chamomile", "calendula": "Calendula", "echinacea": "Echinacea",
              "borage": "Borage", "fennel": "Fennel", "ginger": "Ginger", "turmeric": "Turmeric", "aloe": "Aloe vera", "roselle": "Hibiscus"}
    prefer = {"lavender": 11, "chamomile": 6, "calendula": 3, "thyme": 4, "sage": 10, "mint": 25}   # the clearest pot of each, from the camera
    for kind, label in labels.items():
        idx = prefer.get(kind, next(i for i, p in enumerate(POTS) if p[0] == kind))
        _k, x, y, z, r, h = POTS[idx]
        hotspot(f"plant-{kind}", label, (x, y, z + 0.86 * h + HEIGHT[kind] * 0.45))
    hotspot("passionflower", "Passionflower", (W - 0.15, GD_Y + 0.35, ROOF_LO - 0.08))

    # ---- Planter boxes on the floor under the staging: nettle (kept to its own bed) and dandelion
    def fit(root, length):
        lo, hi = [min(v) for v in zip(*[o.matrix_world @ Vector(c) for o in meshes_of(root) for c in o.bound_box])], \
                 [max(v) for v in zip(*[o.matrix_world @ Vector(c) for o in meshes_of(root) for c in o.bound_box])]
        span = max(hi[0] - lo[0], hi[1] - lo[1])
        root.scale = (length / span,) * 3
        bpy.context.view_layer.update()
        return lo, hi

    nb = model("planter_box_01", (gx - 0.25, 4.3, 0), rot_z=90)
    fit(nb, 0.62)
    nettle_scale = {"spring": 0.55, "summer": 0.75, "autumn": 0.7, "winter": 0.3}[SEASON]
    for k, dy in enumerate((-0.16, 0.12)):
        model("nettle_plant", (gx - 0.25, 4.3 + dy, 0.2), rot_z=40 + 90 * k, scale=nettle_scale)
    hotspot("nettle-bed", "The nettle bed", (gx - 0.25, 4.3, 0.42))
    db = model("planter_box_02", (gx - 0.25, 0.75, 0), rot_z=90)
    fit(db, 0.55)
    if SEASON != "winter":
        for k, dy in enumerate((-0.12, 0.1)):
            model("dandelion_01", (gx - 0.25, 0.75 + dy, 0.2), rot_z=70 * k, scale=0.8 if SEASON != "autumn" else 0.6)
    model("watering_can_metal_01", (gx - 0.3, 3.92, 0), rot_z=200)

    # ---- Seed trays with seedlings, a trowel, twine and seed packets on the staging
    sd = {"spring": 1.0, "summer": 0.55, "autumn": 0.3, "winter": 0.25}[SEASON]
    for i, (x, y, rot) in enumerate(SEED_TRAYS):
        tray = model("seeding_tray_01", (x, y, STAGE_Z), rot_z=rot)
        fit(tray, 0.4)
        top_z = max((o.matrix_world @ Vector(c)).z for o in meshes_of(tray) for c in o.bound_box)
        xs = [min((o.matrix_world @ Vector(c)).x for o in meshes_of(tray) for c in o.bound_box),
              max((o.matrix_world @ Vector(c)).x for o in meshes_of(tray) for c in o.bound_box)]
        ys_ = [min((o.matrix_world @ Vector(c)).y for o in meshes_of(tray) for c in o.bound_box),
               max((o.matrix_world @ Vector(c)).y for o in meshes_of(tray) for c in o.bound_box)]
        box_span(f"tray_soil_{i}", xs[0] + 0.02, xs[1] - 0.02, ys_[0] + 0.02, ys_[1] - 0.02, top_z - 0.025, top_z - 0.012, soil, bevel=0.003)
        g = Geo()
        srnd = random.Random(300 + i)
        for gx_ in range(6):
            for gy_ in range(9):
                if srnd.random() > sd:
                    continue
                p = Vector((xs[0] + 0.04 + (xs[1] - xs[0] - 0.08) * gx_ / 5 + srnd.uniform(-.006, .006),
                            ys_[0] + 0.04 + (ys_[1] - ys_[0] - 0.08) * gy_ / 8 + srnd.uniform(-.006, .006), top_z - 0.012))
                seedling(g, p, srnd, 0.035 if SEASON in ("spring", "summer") else 0.02)
        if g.f:
            g.make(f"seedlings_{i}", pmats)
        if i == 0:
            hotspot("seedlings", "Seedlings", (xs[0] / 2 + xs[1] / 2, ys_[0] / 2 + ys_[1] / 2, top_z + 0.04))
    model("trowel_01", (1.47, 2.48, STAGE_Z + 0.01), rot_z=-60)
    model("garden_gloves_01", (1.6, 4.0 + 1.05, STAGE_Z), rot_z=20).scale = (0.9,) * 3
    cyl("twine_spool", (1.68, 1.4, STAGE_Z + 0.03), 0.032, 0.055, twine, verts=32, bevel=0.006)
    cyl("twine_core", (1.68, 1.4, STAGE_Z + 0.03), 0.012, 0.06, beam_wood, verts=16, bevel=0.002)
    packets = []
    for k, box_px in enumerate(((84, 14, 492, 496), (556, 14, 972, 496), (1036, 14, 1450, 494))):
        png = crop_image(os.path.join(PACK, "18-seed-packets-flat.png"), box_px, os.path.join(OUT, f"crop_seed_packet_{k}.png"))
        bpy.ops.mesh.primitive_plane_add(size=1, location=(1.58 + 0.03 * k, 2.02 + 0.075 * k - 0.36, STAGE_Z + 0.004 + 0.002 * k),
                                         rotation=(0, 0, math.radians(-75 + 14 * k)))
        pk = bpy.context.active_object
        pk.name = f"seed_packet_{k}"
        pk.scale = (0.085, 0.1, 1)
        pk.data.materials.append(image_mat(f"seed_packet_{k}", png, rough=0.9))
        packets.append(pk)
    hotspot("seed-packets", "Seed packets", packets)

    # ---- Wind chime by the garden door, hung from the head on the lane side
    chime = []
    cx, cy, ctop = gx - 0.1, d0 + 0.12, GD_H - 0.01
    chime.append(cyl("chime_cord", (cx, cy, ctop - 0.04), 0.0012, 0.08, twine, verts=6, bevel=0))
    chime.append(cyl("chime_cap", (cx, cy, ctop - 0.085), 0.035, 0.012, beam_wood, verts=32, bevel=0.003))
    for k, ln in enumerate((0.22, 0.19, 0.16, 0.13, 0.1)):
        a = 2 * math.pi * k / 5
        px, py = cx + 0.024 * math.cos(a), cy + 0.024 * math.sin(a)
        chime.append(cyl(f"chime_thread_{k}", (px, py, ctop - 0.105), 0.0006, 0.03, twine, verts=4, bevel=0))
        chime.append(cyl(f"chime_tube_{k}", (px, py, ctop - 0.12 - ln / 2), 0.006, ln, brass, verts=16, bevel=0.001))
    chime.append(cyl("chime_clapper", (cx, cy, ctop - 0.2), 0.016, 0.008, beam_wood, verts=24, bevel=0.002))
    chime.append(box("chime_sail", (cx, cy, ctop - 0.3), (0.004, 0.035, 0.06), beam_wood, bevel=0.001))
    hotspot("wind-chime", "The wind chime", chime)

    # ---- The seasons wheel: brass rim, old timber face (17-seasons-wheel-flat), names Claude engraves,
    # and a turning handle set to the season shown
    wparts = []
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.012))
    wface = bpy.context.active_object
    wface.name = "seasons_wheel_face"
    wface.scale = (2 * WHEEL_R / 0.936,) * 2 + (1,)                  # the disc spans 93.6% of the flat image
    bpy.ops.object.transform_apply(scale=True)
    wface.data.materials.append(image_mat("seasons_wheel_face", os.path.join(PACK, "17-seasons-wheel-flat.png"), rough=0.5, circle=0.468))
    wparts += [wface, cyl("seasons_wheel_back", (0, 0, 0.003), WHEEL_R - 0.002, 0.006, beam_wood, verts=96, bevel=0.002),
               cyl("seasons_wheel_rim", (0, 0, 0.005), WHEEL_R + 0.004, 0.012, brass, verts=96, bevel=0.003)]
    for k, name in enumerate(ORDER):
        a = math.radians(90 * k)
        r = WHEEL_R * 0.74
        wparts.append(text(f"seasons_name_{name}", name.capitalize(), (r * math.sin(a), r * math.cos(a), 0.0135), (0, 0, 0), 0.0105, ink))
    a = math.radians(90 * ORDER.index(SEASON))
    handle = [cyl("wheel_boss", (0, 0, 0.022), 0.018, 0.02, brass_worn, verts=32, bevel=0.004)]
    handle.append(box("wheel_arm", (0, 0.04, 0.03), (0.016, 0.07, 0.008), brass_worn, bevel=0.003))
    handle.append(cyl("wheel_grip", (0, 0.066, 0.05), 0.009, 0.04, beam_wood, verts=16, bevel=0.003))
    wparts.append(group("wheel_handle", Matrix.Rotation(-a, 4, "Z"), handle))
    group("seasons_wheel", frame_matrix((WHEEL_AT[0] - 0.005, WHEEL_AT[1], WHEEL_AT[2]), (-1, 0, 0), (0, -1, 0)), wparts)
    hotspot("seasons-wheel", "The seasons wheel", [wface], kind="season", overlay="season")

    # ---- Fallen leaves and soil crumbs on the floor and staging (more leaves in autumn)
    g = Geo()
    lrnd = random.Random(5)
    n_leaves = {"spring": 6, "summer": 10, "autumn": 46, "winter": 18}[SEASON]
    for _ in range(n_leaves):
        p = Vector((lrnd.uniform(0.3, 1.45), lrnd.uniform(0.2, L - 0.2), 0.002))
        col = vary(lin("#c9a23a" if SEASON != "winter" else "#8a6a40"), lrnd, 0.15, lrnd.uniform(0, 0.3))
        g.leaf(p, Vector((lrnd.uniform(-1, 1), lrnd.uniform(-1, 1), 0.02)), lrnd.uniform(0.03, 0.06), 0.025, col, shape="ovate",
               droop=-0.05, fold=0.15, seg=3)
    crumbs = random.Random(6)
    for _ in range(160):
        on_stage = crumbs.random() < 0.6
        if on_stage:
            p = Vector((crumbs.uniform(gx - 0.45, gx - 0.05), crumbs.choice([crumbs.uniform(0.15, d0 - 0.1), crumbs.uniform(d1 + 0.1, L - 0.15)]), STAGE_Z + 0.002))
        else:
            p = Vector((crumbs.uniform(0.15, 1.4), crumbs.uniform(0.2, L - 0.2), 0.002))
        g.blob(p, crumbs.uniform(0.002, 0.005), vary(lin("#3a2d22"), crumbs, 0.2), mi=STEM, stretch=(1, 1, 0.5))
    g.make("floor_litter", pmats)

    # ---- The garden outside: one curved plate around the glass sides, centred on the camera
    R, span = 8.0, math.radians(220)
    iw, ih = 2170, 725
    arc = R * span
    hgt = arc * ih / iw
    horizon = 0.42                                                  # the plate's horizon, from its foot
    z0 = EYE - horizon * hgt
    verts, faces, uvs = [], [], []
    segs = 96
    for i in range(segs + 1):
        u = i / segs
        th = span / 2 - u * span                                    # +Y (sea) on the left of the plate
        x, y = CAM[0] + R * math.cos(th), CAM[1] + R * math.sin(th)
        verts += [(x, y, z0), (x, y, z0 + hgt)]
    for i in range(segs):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new("garden_view")
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for poly_ in me.polygons:
        for li, vi in zip(poly_.loop_indices, poly_.vertices):
            uvl.data[li].uv = ((vi // 2) / segs, vi % 2)
    plate = bpy.data.objects.new("garden_view", me)
    scene.collection.objects.link(plate)
    plate.data.materials.append(backdrop_mat("garden_view", os.path.join(PACK, S["plate"]), 1.0))
    for attr in ("visible_shadow", "visible_diffuse", "visible_volume_scatter"):
        setattr(plate, attr, False)
    hotspot("garden-view", "The garden", (CAM[0] + 5, CAM[1] + 0.8, 1.3), kind="ambient")

    # ---- Light: the season's sky (HDRI, its sun turned to come in over the garden), nothing else
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", f"{S['hdri']}.hdr"))
    tc = wnt.nodes.new("ShaderNodeTexCoord")
    mp = wnt.nodes.new("ShaderNodeMapping")
    wnt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    wnt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    mp.inputs["Rotation"].default_value = (0, 0, sun_turn(env.image))
    wnt.links.new(env.outputs["Color"], wnt.nodes["Background"].inputs["Color"])
    wnt.nodes["Background"].inputs["Strength"].default_value = S["sky"]
    # portals on the glass help Cycles find the sky through it
    area_light("portal_roof", (W / 2 + 0.03, L / 2, (ROOF_HI + ROOF_LO) / 2 + 0.03),
               (0, math.atan2(ROOF_HI - ROOF_LO, W), 0), (W + 0.1, L), 0, (1, 1, 1), portal=True)
    area_light("portal_garden", (gx + 0.05, L / 2, (STAGE_Z + ROOF_LO) / 2), (0, math.radians(90), 0), (ROOF_LO - STAGE_Z, L), 0, (1, 1, 1), portal=True)

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
    scene.view_settings.exposure = S["exposure"]
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def sun_turn(img):
    """Z rotation for the sky texture so its brightest point (the sun) sits at SUN_AZ, seen from inside."""
    import numpy as np
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    lum = px[..., 0] + px[..., 1] + px[..., 2]
    iy, ix = np.unravel_index(int(np.argmax(lum)), lum.shape)
    u, v = (ix + 0.5) / w, (iy + 0.5) / h
    beta_tex = 2 * math.pi * (0.5 - u)                              # Cycles: u = 0.5 - atan2(y, x) / 2pi
    rot = beta_tex - math.radians(SUN_AZ)
    print(f"[whisked] sky sun at elevation {math.degrees(math.pi * (v - 0.5)):.0f}, turned {math.degrees(rot):.0f} deg")
    return rot


def visible_from(cam, hs):
    deps = bpy.context.evaluated_depsgraph_get()
    origin = Vector(cam)
    target = Vector(hs["center"])
    d = target - origin
    dist = d.length
    ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(deps, origin, d.normalized(), distance=dist)
    if not ok:
        return True
    if obj and (obj.name in hs["objects"] or obj.name.startswith(("glass", "gd_glass"))
                or (not hs["objects"] and obj.name.startswith(("plant_", "pot_", "passionflower", "nettle", "dandelion")))):
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
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "glasshouse.blend"))
    scene = bpy.context.scene
    data = {"room": "glasshouse", "stops": {"middle": {"position": list(CAM), "hotspots": stop_hotspots(CAM)}}}
    with open(os.path.join(OUT, "glasshouse_hotspots.json"), "w") as fh:
        json.dump(data, fh, indent=2)
    if NO_RENDER:
        print("[whisked] done (no render)")
        return
    pano_camera(scene, CAM, CAM_YAW)
    scene.render.filepath = os.path.join(OUT, f"glasshouse_pano_{SEASON}{'_preview' if PREVIEW else ''}.jpg")
    bpy.ops.render.render(write_still=True)
    print(f"[whisked] rendered {SEASON}")
    print("[whisked] done")


main()
