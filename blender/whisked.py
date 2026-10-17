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


def emission_mat(name, path, strength=1.0):
    """An image that glows by itself: used for the views outside the windows."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    nt.links.new(t.outputs["Color"], e.inputs["Color"])
    nt.links.new(e.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
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
