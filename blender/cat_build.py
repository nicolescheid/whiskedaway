"""Erwina, the Inn cat: a round grey Scottish fold, modelled from scratch (no third-party base), rigged for the few
movements the Inn gives her (blink, ear twitch, head turn, tail flick), with a curled sleeping pose and her box.

  blender -b -P blender/cat_build.py -- --export X.glb      -> X.glb (about 450 KB), then for the page:
  npx -y @gltf-transform/cli@4.1.1 meshopt X.glb blender/explore/assets/erwina.glb --level medium   (about 150 KB)
  blender -b -P blender/cat_build.py -- --stills DIR        -> turntable stills for the look check
  blender -b -P blender/cat_build.py -- --comp DIR --pano P -> a quick comp on the Conservatory staging (8K pano P)

Z = up, metres, and she faces -Y (glTF: +Z). Colours are vertex colours, so the GLB needs no texture.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k: ARGS[ARGS.index(k) + 1] if k in ARGS and ARGS.index(k) + 1 < len(ARGS) else None
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smooth01(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


GREY = srgb("#6d727b")        # soft blue-grey
BACK = srgb("#575b63")        # a shade darker along her back
PALE = srgb("#cbc7c0")        # muzzle, chin, chest
PAW = srgb("#b4b1ab")
STRIPE = srgb("#474b53")      # the faint tabby
PINK = srgb("#c7908c")
INK = srgb("#2b2522")


# ---------------------------------------------------------------- scene and mesh helpers
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ellipsoid(name, c, r, rot=(0, 0, 0), seg=40):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg * 3 // 5), radius=1, location=c)
    o = bpy.context.object
    o.name = name
    o.scale = r
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def apply_all(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def fuse(name, parts, voxel=0.0028, smooth=10, faces=3000):
    """Join the parts, voxel-remesh them into one skin, soften the seams, then thin it to a phone-friendly count."""
    for p in parts:
        apply_all(p)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    m = o.modifiers.new("remesh", "REMESH")
    m.mode, m.voxel_size, m.use_smooth_shade = "VOXEL", voxel, True
    s = o.modifiers.new("smooth", "SMOOTH")
    s.factor, s.iterations = 0.6, smooth
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def decimate(o, tris):
    """Thin a mesh to about `tris` triangles (the remesh gives quads: two triangles each)."""
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if n > tris:
        d = o.modifiers.new("dec", "DECIMATE")
        d.ratio = tris / n
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=d.name)
    bpy.ops.object.shade_smooth()


def paint(o, fn):
    """Vertex colours from a function of the vertex's position (object space = her own space)."""
    me = o.data
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        c = fn(o.matrix_world @ v.co)
        attr.data[v.index].color = (*c, 1.0)
    me.color_attributes.active_color = attr


_mats = {}


def fur_mat():
    if "fur" in _mats:
        return _mats["fur"]
    m = bpy.data.materials.new("fur")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.78
    b.inputs["Sheen Weight"].default_value = 0.6
    b.inputs["Sheen Roughness"].default_value = 0.45
    b.inputs["Sheen Tint"].default_value = (0.92, 0.94, 1.0, 1)
    b.inputs["Subsurface Weight"].default_value = 0.08
    _mats["fur"] = m
    return m


def flat_mat(name, col, rough=0.5, emit=0.0, coat=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*col, 1)
        b.inputs["Emission Strength"].default_value = emit
    _mats[name] = m
    return m


def set_mat(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)


def tube(name, pts, r0, r1, ring=10, steps=40, tip=0.12):
    """A swept tube through pts (Catmull-Rom), radius r0 -> r1, the last `tip` of it rounding off. Returns (obj, ts)
    where ts[i] is how far along the tube vertex i is (0 base .. 1 tip), for the tail's weights."""
    def cr(p0, p1, p2, p3, t):
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    path = []
    for i in range(1, len(P) - 2):
        for k in range(steps // (len(P) - 3)):
            path.append(cr(P[i - 1], P[i], P[i + 1], P[i + 2], k / (steps // (len(P) - 3))))
    path.append(P[-2])
    n = len(path)
    bm = bmesh.new()
    rings, ts = [], []
    up = Vector((0, 0, 1))
    for i, p in enumerate(path):
        t = i / (n - 1)
        tan = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        side = tan.cross(up).normalized() if abs(tan.dot(up)) < 0.95 else Vector((1, 0, 0))
        nrm = side.cross(tan).normalized()
        r = r0 + (r1 - r0) * t
        if t > 1 - tip:                                            # a round end, like a fingertip
            r *= math.sqrt(max(0.0, 1 - ((t - (1 - tip)) / tip) ** 2))
        r = max(r, 0.0008)
        ring_v = []
        for j in range(ring):
            a = j / ring * math.tau
            ring_v.append(bm.verts.new(p + (side * math.cos(a) + nrm * math.sin(a)) * r))
            ts.append(t)
        rings.append(ring_v)
    for a, b in zip(rings, rings[1:]):
        for j in range(ring):
            bm.faces.new((a[j], a[(j + 1) % ring], b[(j + 1) % ring], b[j]))
    cap0 = bm.verts.new(path[0] - (path[1] - path[0]).normalized() * r0 * 0.3)
    ts.append(0.0)
    for j in range(ring):
        bm.faces.new((rings[0][(j + 1) % ring], rings[0][j], cap0))
    cap1 = bm.verts.new(path[-1])
    ts.append(1.0)
    for j in range(ring):
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % ring], cap1))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for poly in me.polygons:
        poly.use_smooth = True
    return o, ts, path


def curve_line(name, pts, width, mat_):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = width
    cu.bevel_resolution = 1
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*q, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.object
    set_mat(o, mat_)
    return o


def arc(c, w, h, n=9, depth=0.0, down=True):
    """A small arc (for the mouth and the closed eyes), centred on c, w wide, h deep, in the XZ plane."""
    out = []
    for i in range(n):
        u = i / (n - 1) * 2 - 1
        out.append((c[0] + u * w / 2, c[1] + depth * (1 - u * u), c[2] + (-1 if down else 1) * h * (1 - u * u)))
    return out


def ear(name, base, side):
    """A folded ear: a small rounded flap laid forward and down over the skull, the way a fold's ears sit like a cap."""
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.034, radius2=0.006, depth=0.044, location=(0, 0, 0.02))
    o = bpy.context.object
    o.name = name
    o.scale = (1.0, 0.42, 1.0)
    apply_all(o)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)    # pivot at the base
    # lay it forward (-Y) and down, a little outward
    o.rotation_euler = (math.radians(106), math.radians(side * 34), math.radians(side * 30))
    o.location = base
    apply_all(o)
    bpy.ops.object.shade_smooth()
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    return o


# ---------------------------------------------------------------- her colours
def body_col(p):
    x, y, z = p
    c = GREY
    c = mix(c, BACK, smooth01(0.0, 0.08, y) * smooth01(0.08, 0.2, z))
    chest = smooth01(0.05, 0.02, abs(x)) * smooth01(-0.04, -0.075, y) * smooth01(0.04, 0.08, z) * smooth01(0.22, 0.17, z)
    c = mix(c, PALE, chest * 0.9)
    c = mix(c, PAW, smooth01(0.035, 0.012, z) * smooth01(-0.05, -0.09, y))
    # faint bands across the back and haunches
    band = 0.5 + 0.5 * math.sin(z * 95 + abs(x) * 30)
    c = mix(c, STRIPE, smooth01(0.75, 1.0, band) * 0.35 * smooth01(-0.02, 0.05, y))
    return c


def head_col(p, centre=(0, -0.045, 0.245), face=(0, -1, 0)):
    # in her head's own frame: offset from the skull centre, forward = -Y
    x, y, z = (p[0] - centre[0], p[1] - centre[1], p[2] - centre[2])
    c = GREY
    muzzle = (Vector((abs(x) * 0.8, y + 0.075, z + 0.03))).length
    c = mix(c, PALE, smooth01(0.042, 0.022, muzzle))
    c = mix(c, PALE, smooth01(-0.035, -0.05, z) * smooth01(-0.04, -0.07, y))
    # the tabby "M": three soft lines up the forehead, and two whisker stripes on each cheek
    if y < -0.04 and z > 0.02:
        for k in (-1, 0, 1):                       # an M: the middle line straight, the outer two leaning out below
            cx = k * (0.017 + (0.06 - z) * 0.35)
            d = abs(x - cx)
            top = 0.075 if k == 0 else 0.07
            c = mix(c, STRIPE, smooth01(0.0065, 0.0025, d) * smooth01(0.025, 0.04, z) * smooth01(top, top - 0.014, z) * 0.55)
    if abs(x) > 0.058 and y < -0.02:
        for cz in (-0.006, -0.02):
            c = mix(c, STRIPE, smooth01(0.0045, 0.0018, abs(z - cz)) * smooth01(0.058, 0.07, abs(x)) * 0.7)
    c = mix(c, BACK, smooth01(0.0, 0.05, y) * smooth01(0.02, 0.06, z) * 0.7)
    return c


# ---------------------------------------------------------------- Erwina, sitting
def build_sitting():
    body = fuse("Erwina_body", [
        ellipsoid("b_low", (0, 0.03, 0.085), (0.112, 0.118, 0.09)),
        ellipsoid("b_chest", (0, -0.02, 0.15), (0.08, 0.075, 0.078)),
        ellipsoid("b_haunch_l", (-0.068, 0.05, 0.065), (0.055, 0.075, 0.06)),
        ellipsoid("b_haunch_r", (0.068, 0.05, 0.065), (0.055, 0.075, 0.06)),
        ellipsoid("b_leg_l", (-0.032, -0.072, 0.075), (0.025, 0.027, 0.07)),
        ellipsoid("b_leg_r", (0.032, -0.072, 0.075), (0.025, 0.027, 0.07)),
        ellipsoid("b_paw_l", (-0.034, -0.094, 0.016), (0.026, 0.034, 0.017)),
        ellipsoid("b_paw_r", (0.034, -0.094, 0.016), (0.026, 0.034, 0.017)),
        ellipsoid("b_foot_l", (-0.086, -0.022, 0.015), (0.028, 0.05, 0.015)),
        ellipsoid("b_foot_r", (0.086, -0.022, 0.015), (0.028, 0.05, 0.015)),
    ])
    decimate(body, 2400)
    paint(body, body_col)
    set_mat(body, fur_mat())

    head = fuse("Erwina_head", [
        ellipsoid("h_skull", (0, -0.045, 0.245), (0.088, 0.078, 0.077)),
        ellipsoid("h_cheek_l", (-0.042, -0.09, 0.222), (0.042, 0.035, 0.034)),
        ellipsoid("h_cheek_r", (0.042, -0.09, 0.222), (0.042, 0.035, 0.034)),
        ellipsoid("h_pad_l", (-0.013, -0.117, 0.212), (0.019, 0.017, 0.016)),
        ellipsoid("h_pad_r", (0.013, -0.117, 0.212), (0.019, 0.017, 0.016)),
        ellipsoid("h_chin", (0, -0.106, 0.196), (0.019, 0.015, 0.012)),
    ], voxel=0.0022)
    decimate(head, 3000)
    paint(head, head_col)
    set_mat(head, fur_mat())

    parts = {"body": body, "head": head}
    parts["ear_L"] = ear("Erwina_ear_L", (-0.054, -0.03, 0.31), -1)
    parts["ear_R"] = ear("Erwina_ear_R", (0.054, -0.03, 0.31), 1)
    for k in ("ear_L", "ear_R"):
        paint(parts[k], lambda p: mix(GREY, STRIPE, 0.25))
        set_mat(parts[k], fur_mat())

    eyes = {}
    for side, s in (("L", -1), ("R", 1)):
        e = ellipsoid(f"Erwina_eye_{side}", (s * 0.034, -0.111, 0.246), (0.0195, 0.011, 0.0205), seg=18)
        apply_all(e)
        bpy.ops.object.shade_smooth()
        set_mat(e, flat_mat("eye_amber", srgb("#d9a441"), rough=0.15, coat=1.0))
        pu = ellipsoid(f"Erwina_pupil_{side}", (s * 0.034, -0.1185, 0.2465), (0.0098, 0.0045, 0.0145), seg=12)
        apply_all(pu)
        bpy.ops.object.shade_smooth()
        set_mat(pu, flat_mat("eye_pupil", srgb("#14110f"), rough=0.1, coat=1.0))
        gl = ellipsoid(f"Erwina_glint_{side}", (s * 0.034 - 0.006, -0.1225, 0.2535), (0.0042, 0.0018, 0.0042), seg=8)
        apply_all(gl)
        set_mat(gl, flat_mat("eye_glint", (1, 1, 1), rough=0.1, emit=1.5))
        bpy.ops.object.select_all(action="DESELECT")
        for o in (e, pu, gl):
            o.select_set(True)
        bpy.context.view_layer.objects.active = e
        bpy.ops.object.join()
        eyes[side] = bpy.context.object
    parts["eye_L"], parts["eye_R"] = eyes["L"], eyes["R"]

    nose = ellipsoid("Erwina_nose", (0, -0.1325, 0.2255), (0.0085, 0.0055, 0.006), seg=12)
    apply_all(nose)
    bpy.ops.object.shade_smooth()
    set_mat(nose, flat_mat("nose", PINK, rough=0.35))
    ink = flat_mat("ink", INK, rough=0.6)
    m1 = curve_line("Erwina_mouth_l", arc((-0.0075, -0.1325, 0.2155), 0.015, 0.0045, depth=0.003), 0.0012, ink)
    m2 = curve_line("Erwina_mouth_r", arc((0.0075, -0.1325, 0.2155), 0.015, 0.0045, depth=0.003), 0.0012, ink)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (head, nose, m1, m2):
        o.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    parts["head"] = bpy.context.object

    tail_pts = [(0, 0.118, 0.03), (0.07, 0.112, 0.022), (0.118, 0.055, 0.019), (0.122, -0.025, 0.019),
                (0.112, -0.075, 0.02), (0.088, -0.126, 0.021)]
    tail, ts, path = tube("Erwina_tail", tail_pts, 0.021, 0.017)

    def tail_col(i):
        t = ts[i]
        band = 0.5 + 0.5 * math.cos(t * math.tau * 5.5)
        return mix(mix(GREY, BACK, 0.4), STRIPE, smooth01(0.7, 0.95, band) * 0.6 + smooth01(0.9, 1.0, t) * 0.3)
    me = tail.data
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        attr.data[v.index].color = (*tail_col(v.index), 1)
    set_mat(tail, fur_mat())
    parts["tail"] = tail

    rig(parts, ts, path)
    return parts


def rig(parts, ts, path):
    """One armature: root > body > head > ears/eyes, and root > tail.0..4. Every piece is skinned to it, so the page
    can turn her head, twitch an ear, blink (eye bones scale) and flick the tail by moving bones."""
    arm = bpy.data.armatures.new("Erwina_rig")
    ao = bpy.data.objects.new("Erwina", arm)
    bpy.context.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head, b.tail = h, t
        if parent:
            b.parent = eb[parent]
        return b
    bone("root", (0, 0, 0), (0, 0, 0.04))
    bone("body", (0, 0.02, 0.05), (0, -0.02, 0.19), "root")
    bone("head", (0, -0.035, 0.2), (0, -0.045, 0.3), "body")
    bone("ear_L", (-0.054, -0.03, 0.31), (-0.075, -0.064, 0.296), "head")
    bone("ear_R", (0.054, -0.03, 0.31), (0.075, -0.064, 0.296), "head")
    bone("eye_L", (-0.034, -0.105, 0.246), (-0.034, -0.125, 0.246), "head")
    bone("eye_R", (0.034, -0.105, 0.246), (0.034, -0.125, 0.246), "head")
    n = len(path)
    seg = [path[round(i * (n - 1) / 5)] for i in range(6)]
    for i in range(5):
        bone(f"tail.{i}", seg[i], seg[i + 1], "root" if i == 0 else f"tail.{i - 1}")
    bpy.ops.object.mode_set(mode="OBJECT")

    def skin(o, groups):
        o.parent = ao
        mod = o.modifiers.new("rig", "ARMATURE")
        mod.object = ao
        for g, w in groups.items():
            vg = o.vertex_groups.new(name=g)
            for idx, wt in w:
                vg.add([idx], wt, "REPLACE")
    allv = lambda o: [(v.index, 1.0) for v in o.data.vertices]
    skin(parts["body"], {"body": allv(parts["body"])})
    skin(parts["head"], {"head": allv(parts["head"])})
    for k in ("ear_L", "ear_R", "eye_L", "eye_R"):
        skin(parts[k], {k: allv(parts[k])})
    # tail: each vertex between its two nearest bones
    tg = {f"tail.{i}": [] for i in range(5)}
    for v in parts["tail"].data.vertices:
        f = ts[v.index] * 5 - 0.5
        i0 = max(0, min(4, math.floor(f)))
        i1 = min(4, i0 + 1)
        w1 = max(0.0, min(1.0, f - i0)) if i1 != i0 else 0.0
        tg[f"tail.{i0}"].append((v.index, 1 - w1))
        if w1 > 0:
            tg[f"tail.{i1}"].append((v.index, w1))
    skin(parts["tail"], tg)
    return ao


# ---------------------------------------------------------------- Erwina, curled asleep (for the warm shelf)
def build_curled():
    body = fuse("Curled_body", [
        ellipsoid("c_loaf", (0, 0.01, 0.072), (0.14, 0.115, 0.074)),
        ellipsoid("c_haunch", (0.06, 0.045, 0.075), (0.075, 0.075, 0.068)),
        ellipsoid("c_paws", (-0.055, -0.1, 0.03), (0.05, 0.03, 0.022)),
    ])
    decimate(body, 1800)
    paint(body, lambda p: body_col((p[0] * 0.8, p[1], p[2] * 1.6)))
    set_mat(body, fur_mat())
    hc = Vector((-0.07, -0.085, 0.095))
    head = fuse("Curled_head", [
        ellipsoid("ch_skull", hc, (0.082, 0.072, 0.07)),
        ellipsoid("ch_cheek_l", hc + Vector((-0.04, -0.04, -0.022)), (0.04, 0.032, 0.032)),
        ellipsoid("ch_cheek_r", hc + Vector((0.04, -0.04, -0.022)), (0.04, 0.032, 0.032)),
        ellipsoid("ch_pad_l", hc + Vector((-0.012, -0.068, -0.032)), (0.018, 0.016, 0.015)),
        ellipsoid("ch_pad_r", hc + Vector((0.012, -0.068, -0.032)), (0.018, 0.016, 0.015)),
    ], voxel=0.0022)
    decimate(head, 2400)
    paint(head, lambda p: head_col(p, centre=tuple(hc)))
    set_mat(head, fur_mat())
    ink = flat_mat("ink", INK, rough=0.6)
    pieces = [head]
    for s in (-1, 1):
        pieces.append(curve_line(f"Curled_eye_{s}", arc((hc.x + s * 0.032, hc.y - 0.0705, hc.z + 0.004), 0.022, 0.006,
                                                          depth=0.004, down=True), 0.0013, ink))
        e = ear(f"Curled_ear_{s}", (hc.x + s * 0.05, hc.y + 0.014, hc.z + 0.066), s)
        paint(e, lambda p: mix(GREY, STRIPE, 0.25))
        set_mat(e, fur_mat())
        pieces.append(e)
    nose = ellipsoid("Curled_nose", (hc.x, hc.y - 0.0855, hc.z - 0.019), (0.008, 0.005, 0.0055), seg=12)
    apply_all(nose)
    set_mat(nose, flat_mat("nose", PINK, rough=0.35))
    pieces.append(nose)
    bpy.ops.object.select_all(action="DESELECT")
    for o in pieces:
        o.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    head = bpy.context.object
    tail, ts, _ = tube("Curled_tail", [(0.12, 0.08, 0.025), (0.15, -0.02, 0.022), (0.11, -0.11, 0.022),
                                       (0.02, -0.14, 0.024), (-0.06, -0.135, 0.03)], 0.021, 0.017)
    me = tail.data
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        t = ts[v.index]
        band = 0.5 + 0.5 * math.cos(t * math.tau * 5.5)
        attr.data[v.index].color = (*mix(mix(GREY, BACK, 0.4), STRIPE, smooth01(0.7, 0.95, band) * 0.6 + smooth01(0.85, 1, t) * 0.5), 1)
    set_mat(tail, fur_mat())
    root = bpy.data.objects.new("Erwina_curled", None)
    bpy.context.collection.objects.link(root)
    for o in (body, head, tail):
        o.parent = root
    return root


# ---------------------------------------------------------------- the box
def build_box():
    card = flat_mat("card", srgb("#b88d5c"), rough=0.85)
    card_in = flat_mat("card_in", srgb("#8a6640"), rough=0.9)
    root = bpy.data.objects.new("Box", None)
    bpy.context.collection.objects.link(root)
    W, D, H, T = 0.3, 0.24, 0.17, 0.004
    walls = [((0, -D / 2, H / 2), (W, T, H)), ((0, D / 2, H / 2), (W, T, H)),
             ((-W / 2, 0, H / 2), (T, D, H)), ((W / 2, 0, H / 2), (T, D, H)), ((0, 0, T / 2), (W, D, T))]
    for i, (c, s) in enumerate(walls):
        bpy.ops.mesh.primitive_cube_add(size=1, location=c)
        o = bpy.context.object
        o.name = f"Box_wall_{i}"
        o.scale = s
        apply_all(o)
        set_mat(o, card)
        o.parent = root
    # flaps: front one up and open, side ones splayed, the back one half shut (she might be under it)
    flaps = [("front", (0, -D / 2, H), (W, D / 2, T), (125, 0, 0), (0, -D / 4, 0)),
             ("left", (-W / 2, 0, H), (W / 2 - 0.02, D, T), (0, 120, 0), (-W / 4 + 0.01, 0, 0)),
             ("right", (W / 2, 0, H), (W / 2 - 0.02, D, T), (0, -100, 0), (W / 4 - 0.01, 0, 0)),
             ("back", (0, D / 2, H), (W, D / 2, T), (55, 0, 0), (0, D / 4, 0))]
    for name, hinge, s, rot, off in flaps:
        bpy.ops.mesh.primitive_cube_add(size=1, location=off)
        o = bpy.context.object
        o.name = f"Box_flap_{name}"
        o.scale = s
        apply_all(o)
        bpy.ops.object.transform_apply(location=True)
        o.location = hinge
        o.rotation_euler = [math.radians(a) for a in rot]
        set_mat(o, card)
        o.parent = root
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, H * 0.55))
    dark = bpy.context.object
    dark.name = "Box_dark"
    dark.scale = (W - 0.01, D - 0.01, 1)
    set_mat(dark, card_in)
    dark.parent = root
    return root


# ---------------------------------------------------------------- stills
def studio(res=1000, bg="#f4efe4"):
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
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Base Contrast"
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*srgb(bg), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sc.view_settings.exposure = -0.35
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "floor"
    set_mat(floor, flat_mat("floor", srgb(bg), rough=0.9))
    for name, loc, e, size, col in (("key", (-0.8, -1.0, 1.2), 60, 0.8, "#fff1de"), ("rim", (0.9, 0.9, 0.8), 40, 0.6, "#dfe8ff"),
                                    ("fill", (1.2, -0.8, 0.4), 12, 1.2, "#ffffff")):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size, ld.color = e, size, srgb(col)
        lo = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(lo)
        lo.location = loc
        point_at(lo, (0, 0, 0.12))


def point_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def shoot(path, cam_loc, target, lens=85):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    co = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(co)
    co.location = cam_loc
    point_at(co, target)
    sc.camera = co
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(co)


def stills(d):
    os.makedirs(d, exist_ok=True)
    clear()
    parts = build_sitting()
    curled = build_curled()
    box = build_box()
    studio()
    show = lambda root, on: [setattr(o, "hide_render", not on) for o in [root] + list(root.children_recursive)]
    sit = bpy.data.objects["Erwina"]
    show(curled, False)
    show(box, False)
    c = (0, 0, 0.15)
    shoot(os.path.join(d, "erwina-1-front.png"), (0, -1.15, 0.2), c)
    shoot(os.path.join(d, "erwina-2-three-quarter.png"), (-0.78, -0.86, 0.32), c)
    shoot(os.path.join(d, "erwina-3-side.png"), (-1.15, 0.0, 0.18), c)
    shoot(os.path.join(d, "erwina-4-ears.png"), (-0.2, -0.36, 0.48), (0, -0.05, 0.27), lens=85)
    show(sit, False)
    show(curled, True)
    shoot(os.path.join(d, "erwina-5-curled.png"), (-0.75, -0.9, 0.55), (0, -0.02, 0.06))
    show(curled, False)
    show(box, True)
    shoot(os.path.join(d, "erwina-6-box.png"), (-0.7, -1.0, 0.6), (0, 0, 0.12))


# ---------------------------------------------------------------- a quick comp on the Conservatory staging
CON_EYE = Vector((0.8, 3.15, 1.6))
CON_SPOT = Vector((1.66, 2.565, 0.8))     # staging, door end: the corner past the lane oil lamp, nearest the garden door
CON_LAMP = Vector((1.47, 2.55, 0.8))      # the lane oil lamp (glasshouse_build.oil_lamps), which stands in front of her
SUN_AZ = -35


def comp(d, pano):
    """Render her alone (film transparent, a shadow catcher for the slats) from the Conservatory's camera, then lay her
    over a perspective crop of the 8K pano with the same yaw, pitch and field of view."""
    os.makedirs(d, exist_ok=True)
    clear()
    build_sitting()
    rig_o = bpy.data.objects["Erwina"]
    to = CON_EYE - CON_SPOT
    rig_o.location = CON_SPOT
    rig_o.rotation_euler = (0, 0, math.atan2(to.x, -to.y) + math.radians(-8))   # face the camera, a little turned
    sc = bpy.context.scene
    studio(res=900)
    for name in ("key", "rim", "fill", "floor"):
        bpy.data.objects.remove(bpy.data.objects[name])
    sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    sc.render.film_transparent = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#c9b89c"), 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy, sun.angle, sun.color = 4.5, math.radians(2), srgb("#ffe2b8")
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    az = math.radians(SUN_AZ)
    sdir = Vector((math.cos(az), math.sin(az), 0.9)).normalized()        # from the garden, a little lane-ward, high
    so.rotation_euler = (-sdir).to_track_quat("-Z", "Y").to_euler()
    # the oil lamp is nearer the camera than she is: a holdout stand-in so it hides her where it should (the page
    # will use the same shape as a depth-only occluder)
    hold = bpy.data.materials.new("holdout")
    hold.use_nodes = True
    nt = hold.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    nt.links.new(nt.nodes.new("ShaderNodeHoldout").outputs[0], nt.nodes["Material Output"].inputs[0])
    for r, z0, z1 in ((0.05, 0.0, 0.03), (0.022, 0.03, 0.07), (0.045, 0.07, 0.17), (0.012, 0.17, 0.42)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=z1 - z0, location=CON_LAMP + Vector((0, 0, (z0 + z1) / 2)))
        set_mat(bpy.context.object, hold)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(1.55, 2.3, CON_SPOT.z))     # the staging top, and no further
    catcher = bpy.context.object
    catcher.scale = (0.44, 0.72, 1)
    catcher.is_shadow_catcher = True
    set_mat(catcher, flat_mat("catcher", (0.5, 0.4, 0.3)))
    v = CON_SPOT + Vector((0, 0, 0.12)) - CON_EYE
    yaw = math.degrees(math.atan2(-v.y, v.x))                    # pano centre = +X, + = right (toward -Y)
    pitch = math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))
    fov = 60
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit = "HORIZONTAL"
    cd.angle = math.radians(fov)
    co = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(co)
    co.location = CON_EYE
    point_at(co, CON_EYE + v)
    sc.camera = co
    layer = os.path.join(d, "_comp_cat.png")
    sc.render.filepath = layer
    bpy.ops.render.render(write_still=True)
    with open(os.path.join(d, "_comp_view.txt"), "w") as f:
        f.write(f"{yaw:.3f} {pitch:.3f} {fov} 1200 800\n")
    print("COMP", yaw, pitch)


# ---------------------------------------------------------------- export
def export(path):
    clear()
    build_sitting()
    build_curled()
    build_box()
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_animations=False,
                              export_skins=True, export_vertex_color="MATERIAL", export_yup=True,
                              export_texcoords=False)


if "--stills" in ARGS:
    stills(arg("--stills"))
if "--comp" in ARGS:
    comp(arg("--comp"), arg("--pano"))
if "--export" in ARGS:
    export(arg("--export") if arg("--export") and not arg("--export").startswith("--") else os.path.join(OUT, "erwina.glb"))
