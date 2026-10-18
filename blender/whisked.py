"""
Shared Blender helpers for the Inn's room builds (materials, primitives, Poly Haven imports, lights,
hotspots, render setup). The hallway build imports this; cuddlecore_build.py still carries its own
copies of the same helpers.

Axes: X = left/right, Y = forward, Z = up. Metres. Poly Haven models import facing -Y.
"""
import bpy
import math
import os
import random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "out")
ART = os.path.join(os.path.dirname(HERE), "art-inbox")


def srgb(hex_str):
    h = hex_str.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def principled(m):
    m.use_nodes = True
    return m.node_tree, m.node_tree.nodes["Principled BSDF"]


def mat(name, color, rough=0.6, metal=0.0, transmission=0.0, ior=1.45, emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    _, p = principled(m)
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["IOR"].default_value = ior
    p.inputs["Coat Weight"].default_value = coat
    if emission:
        p.inputs["Emission Color"].default_value = emission
        p.inputs["Emission Strength"].default_value = strength
    return m


def pbr(name, tex_id, size_m=2.0, tint=None, tint_mix=0.0, rough_add=0.0, bump=0.6, rot_z=0.0):
    """Scanned Poly Haven material, box-projected in object space so it keeps real-world scale."""
    folder = os.path.join(ASSETS, "textures", tex_id)
    m = bpy.data.materials.new(name)
    nt, p = principled(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size_m,) * 3
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_z))
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

    col = tex("diff", False).outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        # tint_mix >= 1: multiply; 0..1: paint over with a flat colour, keeping the scan's relief
        mix.blend_type = "MULTIPLY" if tint_mix >= 1 else "MIX"
        mix.inputs["Factor"].default_value = min(tint_mix, 1.0)
        nt.links.new(col, mix.inputs[6])
        mix.inputs[7].default_value = tint
        col = mix.outputs[2]
    aomix = nt.nodes.new("ShaderNodeMix")
    aomix.data_type = "RGBA"
    aomix.blend_type = "MULTIPLY"
    aomix.inputs["Factor"].default_value = 0.6
    nt.links.new(col, aomix.inputs[6])
    nt.links.new(tex("ao", True).outputs["Color"], aomix.inputs[7])
    nt.links.new(aomix.outputs[2], p.inputs["Base Color"])

    rough = tex("rough", True)
    if rough_add:
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        add.use_clamp = True
        add.inputs[1].default_value = rough_add
        nt.links.new(rough.outputs["Color"], add.inputs[0])
        nt.links.new(add.outputs[0], p.inputs["Roughness"])
    else:
        nt.links.new(rough.outputs["Color"], p.inputs["Roughness"])

    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = bump
    nt.links.new(tex("nor", True).outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return m


def image_mat(name, path, rough=0.85, tile=None, normal_from=None, normal_strength=0.6, circle=None):
    """Principled material from a flat image. tile = metres per repeat (box-projected), else the mesh's UVs.
    circle = UV radius outside which the surface is transparent (for round plates on square planes)."""
    m = bpy.data.materials.new(name)
    nt, p = principled(m)
    p.inputs["Roughness"].default_value = rough
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    mp = None
    if tile:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / tile,) * 3
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        t.projection = "BOX"
        t.projection_blend = 0.3
    nt.links.new(t.outputs["Color"], p.inputs["Base Color"])
    if normal_from:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(ASSETS, "textures", normal_from, "nor.jpg"), check_existing=True)
        n.image.colorspace_settings.name = "Non-Color"
        if mp:
            nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
            n.projection = "BOX"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    if circle:
        uv = nt.nodes.new("ShaderNodeTexCoord")
        sub = nt.nodes.new("ShaderNodeVectorMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = (0.5, 0.5, 0.0)
        nt.links.new(uv.outputs["UV"], sub.inputs[0])
        ln = nt.nodes.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        nt.links.new(sub.outputs[0], ln.inputs[0])
        gt = nt.nodes.new("ShaderNodeMath")
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = circle
        nt.links.new(ln.outputs["Value"], gt.inputs[0])
        clear = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(gt.outputs[0], mix.inputs[0])
        nt.links.new(p.outputs[0], mix.inputs[1])
        nt.links.new(clear.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


def emission_mat(name, path, strength=1.0, saturation=1.0):
    """An image that glows by itself: used for the views outside the windows.
    saturation > 1 wins back the colour AgX takes out of bright values, so the view reads like the source image."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    t.interpolation = "Cubic"                        # the view is magnified a little in an 8K pano
    col = t.outputs["Color"]
    if saturation != 1.0:
        hs = nt.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = saturation
        nt.links.new(col, hs.inputs["Color"])
        col = hs.outputs["Color"]
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    nt.links.new(col, e.inputs["Color"])
    nt.links.new(e.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    return m


def window_glass(name, wet=0.0):
    """Clear window glass. Rays go straight through (no refraction, no tint), with a faint Fresnel reflection,
    so the view outside stays sharp. A refractive glass box bends and blurs the view and reads as frosted.
    wet: 0 dry .. 1 storm. Raindrops on the glass; only the drops refract, the glass between them stays clear."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    out = nt.nodes["Material Output"]
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    shine = nt.nodes.new("ShaderNodeBsdfGlossy")
    shine.inputs["Roughness"].default_value = 0.02
    fres = nt.nodes.new("ShaderNodeFresnel")
    fres.inputs["IOR"].default_value = 1.5
    weak = nt.nodes.new("ShaderNodeMath")
    weak.operation = "MULTIPLY"
    weak.inputs[1].default_value = 0.5              # half of real glass: a hint of reflection, no veil
    nt.links.new(fres.outputs["Fac"], weak.inputs[0])
    pane = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(weak.outputs[0], pane.inputs[0])
    nt.links.new(clear.outputs[0], pane.inputs[1])
    nt.links.new(shine.outputs[0], pane.inputs[2])
    surface = pane.outputs[0]
    if wet:
        # Drops: Voronoi cells stretched a little down the glass, thresholded to small beads
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (55, 55, 30)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "F1"
        vor.inputs["Randomness"].default_value = 1.0
        nt.links.new(mp.outputs["Vector"], vor.inputs["Vector"])
        sparse = nt.nodes.new("ShaderNodeTexNoise")       # drops gather in patches rather than evenly
        sparse.inputs["Scale"].default_value = 6
        nt.links.new(tc.outputs["Object"], sparse.inputs["Vector"])
        r = nt.nodes.new("ShaderNodeMapRange")            # drop radius per patch: 0 (dry) .. 0.36 of a cell
        r.inputs["From Min"].default_value = 0.55 - 0.25 * wet
        r.inputs["From Max"].default_value = 0.75 - 0.25 * wet
        r.inputs["To Max"].default_value = 0.36
        nt.links.new(sparse.outputs["Fac"], r.inputs["Value"])
        bead = nt.nodes.new("ShaderNodeMath")             # 1 inside a drop, 0 outside, soft rim
        bead.operation = "SUBTRACT"
        nt.links.new(r.outputs["Result"], bead.inputs[0])
        nt.links.new(vor.outputs["Distance"], bead.inputs[1])
        mask = nt.nodes.new("ShaderNodeMapRange")
        mask.inputs["From Min"].default_value = 0.0
        mask.inputs["From Max"].default_value = 0.05
        nt.links.new(bead.outputs[0], mask.inputs["Value"])
        bmp = nt.nodes.new("ShaderNodeBump")              # domed drop: height grows toward the centre
        bmp.inputs["Strength"].default_value = 0.8
        nt.links.new(bead.outputs[0], bmp.inputs["Height"])
        drop = nt.nodes.new("ShaderNodeBsdfPrincipled")
        drop.inputs["Base Color"].default_value = (1, 1, 1, 1)
        drop.inputs["Roughness"].default_value = 0.12
        drop.inputs["Transmission Weight"].default_value = 1.0
        drop.inputs["IOR"].default_value = 1.33
        nt.links.new(bmp.outputs["Normal"], drop.inputs["Normal"])
        wetmix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(mask.outputs["Result"], wetmix.inputs[0])
        nt.links.new(surface, wetmix.inputs[1])
        nt.links.new(drop.outputs[0], wetmix.inputs[2])
        surface = wetmix.outputs[0]
    nt.links.new(surface, out.inputs["Surface"])
    return m


def crop_image(src, box, dest):
    """Crop a pixel box (left, top, right, bottom) out of src and save it as dest. Uses Blender's own image IO."""
    import numpy as np
    if os.path.exists(dest) and os.path.getmtime(dest) > os.path.getmtime(src):
        return dest
    img = bpy.data.images.load(src)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    l, t, r, b = box
    part = px[h - b:h - t, l:r]                     # Blender's rows run bottom-up
    out = bpy.data.images.new(os.path.basename(dest), r - l, b - t, alpha=True)
    out.pixels = part.ravel()
    out.filepath_raw = dest
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(img)
    return dest


def finish(o, material, bevel):
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    if material:
        o.data.materials.append(material)
    return o


def box(name, loc, size, material, bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    # Bake only the scale: keeping the origin at loc means a later rotation turns the box in place
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, material, bevel)


def box_span(name, x0, x1, y0, y1, z0, z1, material, bevel=0.0):
    """A box given by its extents rather than centre and size."""
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)),
               material, bevel=bevel)


def cyl(name, loc, r, h, material, verts=48, bevel=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    return finish(o, material, bevel)


def sphere(name, loc, r, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def model(aid, loc, rot_z=0.0, scale=1.0):
    """Import a Poly Haven glTF, parent it to an empty, and place it. Returns the empty."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "models", aid, f"{aid}.gltf"))
    new = [o for o in bpy.context.scene.objects if o not in before]
    return _root(aid, new, loc, rot_z, scale)


def blend_model(aid, loc, rot_z=0.0, scale=1.0, only=None):
    """Append a Poly Haven model from its .blend (for models whose glTF is broken). only: object names to keep."""
    path = os.path.join(ASSETS, "models", aid, f"{aid}.blend")
    with bpy.data.libraries.load(path) as (src, dst):
        dst.objects = [n for n in src.objects if (only is None and n.startswith(aid)) or (only and n in only)]
    for o in dst.objects:
        o.parent = None
        bpy.context.scene.collection.objects.link(o)
    return _root(aid, list(dst.objects), loc, rot_z, scale)


def _root(aid, objs, loc, rot_z, scale):
    root = bpy.data.objects.new(aid, None)
    bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(rot_z))
    root.scale = (scale,) * 3
    bpy.context.view_layer.update()
    return root


def meshes_of(root):
    return [o for o in root.children_recursive if o.type == "MESH"]


def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def bbox_center(objs):
    lo, hi = bbox(objs)
    return [(lo[i] + hi[i]) / 2 for i in range(3)]


def retint(root, hex_color, lo=0.55, hi=1.15):
    """Repaint a model in hex_color while keeping its texture's wear and dirt as light/dark variation."""
    tint = srgb(hex_color)
    for o in meshes_of(root):
        for m in o.data.materials:
            if not m or not m.node_tree:
                continue
            nt = m.node_tree
            p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not p or not p.inputs["Base Color"].is_linked:
                continue
            src = p.inputs["Base Color"].links[0].from_socket
            bw = nt.nodes.new("ShaderNodeRGBToBW")
            nt.links.new(src, bw.inputs["Color"])
            rng = nt.nodes.new("ShaderNodeMapRange")
            rng.inputs["To Min"].default_value = lo
            rng.inputs["To Max"].default_value = hi
            nt.links.new(bw.outputs["Val"], rng.inputs["Value"])
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[6].default_value = tint
            nt.links.new(rng.outputs["Result"], mix.inputs[7])
            nt.links.new(mix.outputs[2], p.inputs["Base Color"])


def swap_material(root, material):
    for o in meshes_of(root):
        o.data.materials.clear()
        o.data.materials.append(material)


def point_light(name, loc, watts, color, radius=0.02):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = watts
    data.color = color
    data.shadow_soft_size = radius
    o = bpy.data.objects.new(name, data)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def area_light(name, loc, rot, size, watts, color, portal=False):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = watts
    data.color = color
    if portal:
        data.cycles.is_portal = True
    o = bpy.data.objects.new(name, data)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o


def curtain(name, cx, y, z_top, width, height, material, pleats=8, amp=0.035, seed=0, axis="x"):
    """A gathered linen curtain built as a pleated mesh: fuller folds toward the hem. axis: the way it hangs across."""
    rnd = random.Random(seed)
    nx, nz = pleats * 10, 48
    verts, faces = [], []
    for k in range(nz):
        t = k / (nz - 1)
        for i in range(nx):
            u = i / (nx - 1)
            fold = math.sin(u * pleats * 2 * math.pi + rnd.uniform(-0.05, 0.05))
            depth = amp * fold * (0.7 + 0.6 * t)
            across = cx - width / 2 + width * u + (0.04 * t * (u - 0.5))   # slight flare at the hem
            z = z_top - height * t + 0.01 * math.sin(u * 9 + seed) * t
            verts.append((across, y + depth, z) if axis == "x" else (y + depth, across, z))
    for k in range(nz - 1):
        for i in range(nx - 1):
            a = k * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.004
    for poly in mesh.polygons:
        poly.use_smooth = True
    o.data.materials.append(material)
    return o


def text(name, body, loc, rot, size, material, align="CENTER"):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.align_x, curve.align_y, curve.size = body, align, "CENTER", size
    curve.extrude = size * 0.04
    o = bpy.data.objects.new(name, curve)
    o.location, o.rotation_euler = loc, rot
    o.data.materials.append(material)
    bpy.context.scene.collection.objects.link(o)
    return o


def look(cam, target, eye_z):
    """Yaw and pitch (degrees) from a camera position to a point. Yaw 0 = +Y, + = to the right; pitch + = up."""
    dx, dy, dz = target[0] - cam[0], target[1] - cam[1], target[2] - eye_z
    return (round(math.degrees(math.atan2(dx, dy)), 2),
            round(math.degrees(math.atan2(dz, math.hypot(dx, dy))), 2))


def center_of(target):
    bpy.context.view_layer.update()
    if isinstance(target, (list, tuple)) and target and hasattr(target[0], "bound_box"):
        return bbox_center(target)
    if hasattr(target, "bound_box"):
        return bbox_center(meshes_of(target) or [target])
    return list(target)


def use_gpu(scene):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == backend]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = "GPU"
                print(f"[whisked] rendering on {backend}: {[d.name for d in gpus]}")
                return
        except TypeError:
            continue


def key_rot_z(obj, frames_degrees, base=0.0):
    """Keyframe an object's Z rotation: [(frame, degrees), ...], added to base degrees. Eased Bezier keys."""
    for frame, deg in frames_degrees:
        obj.rotation_euler.z = math.radians(base + deg)
        obj.keyframe_insert("rotation_euler", index=2, frame=frame)


def fly_camera(scene, keys, name="fly"):
    """A moving perspective camera for video. keys: [(frame, location, look_at, lens_mm), ...].
    The camera tracks an empty that moves on its own keys, so turns stay smooth."""
    target = bpy.data.objects.new(f"{name}_target", None)
    scene.collection.objects.link(target)
    cam_data = bpy.data.cameras.new(name)
    cam_data.sensor_width = 36
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    track = cam.constraints.new("TRACK_TO")
    track.target, track.track_axis, track.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"
    for frame, loc, at, lens in keys:
        cam.location = loc
        cam.keyframe_insert("location", frame=frame)
        target.location = at
        target.keyframe_insert("location", frame=frame)
        cam_data.lens = lens
        cam_data.keyframe_insert("lens", frame=frame)
    scene.camera = cam
    scene.frame_start, scene.frame_end = keys[0][0], keys[-1][0]
    return cam


def video_settings(scene, rough, out_prefix, frames_step=1):
    """1080p video frames as JPEG (rough: small, fast and noisy, every other frame, to check timing and moves)."""
    scene.render.fps = 24
    scene.render.resolution_x, scene.render.resolution_y = (640, 360) if rough else (1920, 1080)
    scene.cycles.samples = 16 if rough else 128
    scene.frame_step = 2 if rough else frames_step
    scene.render.use_persistent_data = True
    # JPEG even for the final: the cloud pod's results leave PNGs out, and at 96 it's clean for a video edit
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88 if rough else 96
    scene.render.filepath = out_prefix


def pano_camera(scene, loc, yaw_deg=0.0):
    """360 equirectangular camera. yaw_deg 0 puts +Y in the middle of the image."""
    cam_data = bpy.data.cameras.new("pano")
    cam_data.type = "PANO"
    cam_data.panorama_type = "EQUIRECTANGULAR"
    cam = bpy.data.objects.new("pano", cam_data)
    cam.location = loc
    cam.rotation_euler = (math.radians(90), 0, -math.radians(yaw_deg))
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


# ---------------------------------------------------------------- the glazed door between the glasshouse and the Chiapothecary

def sage_paint(name, colour="#8d9b80"):
    """Sage paint (or another colour) over old timber, chipped here and there to the wood."""
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
    paint.inputs[7].default_value = srgb(colour)
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


def old_glass(name):
    """Old hand-made glass: clear but wavy, so whatever is behind it swims and blurs."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.93, 0.96, 0.9, 1)
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["IOR"].default_value = 1.52
    p.inputs["Roughness"].default_value = 0.06
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (9, 9, 4)                  # ripples run a little longer vertically
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Detail"].default_value = 3
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(n.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


# One door, built by both rooms from this function: herb-green paint, 3 x 5 small panes of wavy old glass, a low
# panel, brass furniture on both faces. Local frame: x along the door from the hinge edge, z up, y through the wall
# (-y is the glasshouse face). It hangs on the lane side and opens into the glasshouse.
GLAZED_DOOR_W, GLAZED_DOOR_H = 0.85, 2.0


def glazed_door(matrix, brass, brass_worn, iron):
    door_paint = sage_paint("chia_green", "#5c7c5c")
    glass_old = old_glass("chia_door_glass")
    lw, lh, lt = GLAZED_DOOR_W - 0.02, GLAZED_DOOR_H - 0.03, 0.045
    st, gz0, gz1 = 0.1, 0.68, lh - 0.1                               # stile width, glazing bottom and top
    parts = []
    for nm, a0, a1, b0, b1 in (("stile_l", 0, st, 0.012, 0.012 + lh), ("stile_r", lw - st, lw, 0.012, 0.012 + lh),
                               ("rail_b", st, lw - st, 0.012, 0.19), ("rail_m", st, lw - st, 0.55, gz0),
                               ("rail_t", st, lw - st, gz1, 0.012 + lh)):
        parts.append(box_span(f"cd_{nm}", a0, a1, -lt / 2, lt / 2, b0, b1, door_paint, bevel=0.004))
    parts.append(box_span("cd_panel", st, lw - st, -0.012, 0.012, 0.19, 0.55, door_paint, bevel=0.003))
    for face in (-1, 1):                                            # a mould round the low panel, both faces
        for nm, a0, a1, b0, b1 in (("l", st, st + 0.02, 0.19, 0.55), ("r", lw - st - 0.02, lw - st, 0.19, 0.55),
                                   ("b", st, lw - st, 0.19, 0.21), ("t", st, lw - st, 0.53, 0.55)):
            ya, yb = sorted((face * 0.012, face * 0.022))
            parts.append(box_span(f"cd_mould_{face}_{nm}", a0, a1, ya, yb, b0, b1, door_paint, bevel=0.003))
    cols, rows = 3, 5
    for k in range(1, cols):
        x = st + (lw - 2 * st) * k / cols
        parts.append(box_span(f"cd_bar_v{k}", x - 0.011, x + 0.011, -0.016, 0.016, gz0, gz1, door_paint, bevel=0.003))
    for k in range(1, rows):
        z = gz0 + (gz1 - gz0) * k / rows
        parts.append(box_span(f"cd_bar_h{k}", st, lw - st, -0.016, 0.016, z - 0.011, z + 0.011, door_paint, bevel=0.003))
    pane = box_span("cd_glass", st, lw - st, -0.003, 0.003, gz0, gz1, glass_old, bevel=0)
    pane.visible_shadow = False                                     # sunlight gets through to the other room
    parts.append(pane)
    for f, tag in ((-1, ""), (1, "_b")):                             # the glasshouse face, then the shop face
        side = f * lt / 2

        def plate(nm, x0, x1, t0, t1, z0, z1, m, bevel):
            parts.append(box_span(f"{nm}{tag}", x0, x1, *sorted((side + f * t0, side + f * t1)), z0, z1, m, bevel=bevel))

        parts.append(cyl(f"cd_knob{tag}", (lw - 0.065, side + f * 0.035, 1.0), 0.026, 0.05, brass_worn, rot=(math.radians(90), 0, 0)))
        plate("cd_rose", lw - 0.09, lw - 0.04, 0, 0.006, 0.9, 1.1, brass, 0.003)
        plate("cd_keyhole", lw - 0.07, lw - 0.06, 0.005, 0.007, 0.93, 0.955, iron, 0)
        plate("cd_finger_plate", lw - 0.075, lw - 0.03, 0, 0.004, 1.2, 1.48, brass, 0.002)
    for hz in (0.25, 1.75):
        parts.append(cyl(f"cd_hinge_{hz}", (0.005, 0, hz), 0.01, 0.1, brass_worn))
    root = bpy.data.objects.new("chiapothecary_door", None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.matrix_world = matrix
    bpy.context.view_layer.update()
    return root


# ---------------------------------------------------------------- glimpses: one room seen through another's doorway

def _aim(eye, target):
    """Rotation for a camera at eye looking at target, up = +Z."""
    return (Vector(target) - Vector(eye)).normalized().to_track_quat("-Z", "Y")


def glimpse_camera(scene, eye, target, fov_deg, res=1600):
    """A square perspective camera, for rendering a room as another room's panorama camera sees it through a
    doorway. glimpse_plate() puts the picture back in that doorway."""
    cam_data = bpy.data.cameras.new("glimpse")
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.angle = math.radians(fov_deg)
    cam = bpy.data.objects.new("glimpse", cam_data)
    cam.location = eye
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = _aim(eye, target)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = res
    return cam


def glimpse_plate(name, path, eye, target, fov_deg, corner, along, up, strength=1.0, tint=(1, 1, 1), cuts=24):
    """A glowing picture filling a doorway: a grid over the rectangle corner + s*along + t*up, each vertex given the
    UV where glimpse_camera(eye, target, fov_deg) saw that point. From eye, the picture lines up with the room beyond."""
    q = _aim(eye, target)
    r, u, f = q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), q @ Vector((0, 0, -1))
    k = 1 / (2 * math.tan(math.radians(fov_deg) / 2))
    c0, a, b = Vector(corner), Vector(along), Vector(up)
    verts, uvs, faces = [], [], []
    for j in range(cuts + 1):
        for i in range(cuts + 1):
            p = c0 + a * (i / cuts) + b * (j / cuts)
            d = p - Vector(eye)
            z = d.dot(f)
            verts.append(tuple(p))
            uvs.append((0.5 + k * d.dot(r) / z, 0.5 + k * d.dot(u) / z))
    for j in range(cuts):
        for i in range(cuts):
            n = j * (cuts + 1) + i
            faces.append((n, n + 1, n + cuts + 2, n + cuts + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            uv.data[li].uv = uvs[me.loops[li].vertex_index]
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    m = emission_mat(name, path, strength)
    nt = m.node_tree
    next(n for n in nt.nodes if n.type == "TEX_IMAGE").extension = "EXTEND"
    if tuple(tint) != (1, 1, 1):
        e = next(n for n in nt.nodes if n.type == "EMISSION")
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(e.inputs["Color"].links[0].from_socket, mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        nt.links.new(mix.outputs[2], e.inputs["Color"])
    o.data.materials.append(m)
    o.visible_shadow = False
    return o


# Where the glasshouse and the Chiapothecary meet. Both rooms measure y from the Inn's front; the Chiapothecary's
# x = the glasshouse's x + CHIA_FROM_GH (its garden wall is the Inn wall, 0.3 m thick). The glazed door is centred
# at y = 1.9 in both. Each room sees the other through the door as a picture on a plate in the doorway, rendered
# from its own camera position by the other room's build (--glimpse).
CHIA_FROM_GH = 4.8
CHIA_EYE = (2.25, 1.7, 1.6)                        # the Chiapothecary's camera (its coordinates)
GH_EYE = (0.8, 3.15, 1.6)                          # the glasshouse's camera (its coordinates)
# seen from the glasshouse: a plate on the shop face of the Inn wall (glasshouse coordinates)
SHOP_PLATE = dict(corner=(-0.31, 0.875, -0.05), along=(0, 1.65, 0), up=(0, 0, 2.35), fov=100)
# seen from the shop: a plate on the glasshouse face of the Inn wall (Chiapothecary coordinates)
GH_PLATE = dict(corner=(4.81, 1.175, -0.05), along=(0, 1.45, 0), up=(0, 0, 2.35), fov=60)


def plate_target(plate):
    return tuple(c + a / 2 + u / 2 for c, a, u in zip(plate["corner"], plate["along"], plate["up"]))
