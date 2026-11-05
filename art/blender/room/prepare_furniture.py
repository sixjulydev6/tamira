"""Prepare the Poliigon "Replica" furniture for the tower room (headless, local Blender).

Input: the three asset zips' Cycles .blend + COL/METALNESS maps, extracted to <src>/<Name>/.
Output: <out>/room_furniture_kit.blend with one object per (piece, room material), no UVs or images,
decimated for the web, in a shared local frame:
    origin at the footprint centre on the floor, Blender +Z up, FRONT facing Blender -Y (three.js +Z).
build_room.py appends these when FURN_KIT is set and places them; materials are matched by name to
its MATS palette, so the furniture uses the room's existing colours only.

Each source is one mesh with one image-driven material, but its parts are separate loose pieces.
Every piece is classified from its own sampled colour/metalness (rules below, checked against the
previews) and recoloured to a room material:
    Slope armchair   leather shell -> leather_tan, sled frame + bolts -> metal_black
    Nimbus table     top -> wood_walnut, gold ring/legs -> metal_brass, black sleeves -> metal_black
    Reversi sofa     upholstery -> fabric_sofa, pillows -> fabric_cushion / fabric_ochre (middle),
                     plinth strips -> metal_black
Licence: Poliigon assets (not CC0). Keep the kit out of public repos until the licence is checked.

Run:  Blender -b --factory-startup --disable-autoexec --python prepare_furniture.py -- <src> <out>
"""
import bpy, bmesh, sys, os, glob, math
from mathutils import Vector, Matrix

PIECES = {
    # name: (source folder, yaw to put the front on -Y, decimate ratio)
    "sofa":     ("SofaReversiReplica001", -math.pi / 2, 0.07),
    "armchair": ("ArmchairSlopeReplica001", -math.pi / 2, 0.16),
    "table":    ("CoffeeTableNimbusGoldReplica001", 0.0, 0.1),
}
MIN_PART = 0.02     # parts smaller than 2 cm (bolts, glides) are dropped: invisible at room scale
SMOOTH_ANGLE = math.radians(35)
KEEP_FULL = {"wood_walnut"}  # the 4 mm table-top disc: decimating it leaves a radial shading fan
SAMPLE = 512        # maps are averaged at 512 px; only a part's mean colour is used


def load_map(folder, tag):
    path = next(iter(glob.glob(os.path.join(folder, f"*_{tag}_4K_METALNESS.*"))))
    im = bpy.data.images.load(path)
    im.scale(SAMPLE, SAMPLE)
    px = im.pixels[:]
    bpy.data.images.remove(im)
    return px


def loose_parts(bm):
    seen, parts = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            x = stack.pop()
            comp.append(x)
            for e in x.edges:
                for y in e.link_faces:
                    if y.index not in seen:
                        seen.add(y.index)
                        stack.append(y)
        parts.append(comp)
    return parts


def classify(piece, info, zmax):
    r, g, b = info["rgb"]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if info["metal"] > 0.5:
        if r - b > 0.2:
            return "metal_brass"                       # gold
        if piece == "table" and info["min"][2] > 0.95 * zmax:
            return "wood_walnut"                       # the top disc
        return "metal_black"
    if info["max"][2] < 0.05:
        return "metal_black"                           # plinth strips, glides
    if piece == "armchair":
        return "leather_tan"
    if piece == "sofa":
        return "PILLOW" if lum < 0.22 else "fabric_sofa"
    return "metal_black"


def prepare(piece, folder, yaw, ratio, out_coll):
    blend = next(iter(glob.glob(os.path.join(folder, "*_Blender_Cycles.blend"))))
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.meshes = list(src.meshes)
    me = next(m for m in dst.meshes if m is not None and len(m.polygons))
    col, met = load_map(folder, "COL"), load_map(folder, "METALNESS")
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    uv = bm.loops.layers.uv.active
    zmax = max(v.co.z for v in bm.verts)
    groups = {}
    report = []
    for comp in loose_parts(bm):
        vs = {v for f in comp for v in f.verts}
        mn = Vector([min(v.co[i] for v in vs) for i in range(3)])
        mx = Vector([max(v.co[i] for v in vs) for i in range(3)])
        if max(mx - mn) < MIN_PART:
            continue
        rgb, m, k = [0.0, 0.0, 0.0], 0.0, 0
        for f in comp[:: max(1, len(comp) // 400)]:
            u, v = sum((l[uv].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
            i = (int((v % 1) * SAMPLE) * SAMPLE + int((u % 1) * SAMPLE)) * 4
            rgb = [rgb[j] + col[i + j] for j in range(3)]
            m += met[i]
            k += 1
        info = {"rgb": [c / k for c in rgb], "metal": m / k, "min": mn, "max": mx}
        cls = classify(piece, info, zmax)
        if cls == "PILLOW":
            info["cy"] = (mn.y + mx.y) / 2
        groups.setdefault(cls, []).append((comp, info))
        report.append((cls, len(comp), [round(c, 2) for c in info["rgb"]], round(info["metal"], 2)))
    # pillows: the middle one (by position along the sofa) in ochre, the outer two cream
    if "PILLOW" in groups:
        pil = sorted(groups.pop("PILLOW"), key=lambda p: p[1]["cy"])
        mid = len(pil) // 2
        for i, p in enumerate(pil):
            groups.setdefault("fabric_ochre" if i == mid else "fabric_cushion", []).append(p)

    # footprint centre on the floor -> origin; then yaw the front onto -Y
    allv = [v.co for v in bm.verts]
    cx = (min(v.x for v in allv) + max(v.x for v in allv)) / 2
    cy = (min(v.y for v in allv) + max(v.y for v in allv)) / 2
    z0 = min(v.z for v in allv)
    xf = Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation((-cx, -cy, -z0))
    objs = []
    for cls, items in sorted(groups.items()):
        keep = {f.index for comp, _ in items for f in comp}
        b2 = bm.copy()
        b2.faces.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[f for f in b2.faces if f.index not in keep], context="FACES")
        bmesh.ops.delete(b2, geom=[v for v in b2.verts if not v.link_faces], context="VERTS")
        b2.transform(xf)
        m2 = bpy.data.meshes.new(f"kit_{piece}_{cls}")
        b2.to_mesh(m2)
        b2.free()
        while m2.uv_layers:
            m2.uv_layers.remove(m2.uv_layers[0])
        mat = bpy.data.materials.get(cls) or bpy.data.materials.new(cls)
        m2.materials.append(mat)
        ob = bpy.data.objects.new(f"kit_{piece}__{cls}", m2)
        out_coll.objects.link(ob)
        bpy.context.view_layer.objects.active = ob
        if cls not in KEEP_FULL:
            md = ob.modifiers.new("decimate", "DECIMATE")
            md.ratio = ratio
            md.use_collapse_triangulate = False
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier=md.name)
        for p in m2.polygons:
            p.use_smooth = True
        m2.set_sharp_from_angle(angle=SMOOTH_ANGLE)
        objs.append(ob)
    bm.free()
    for m in list(dst.meshes):
        if m is not None and m.users == 0:
            bpy.data.meshes.remove(m)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    print(f"{piece}: {len(objs)} objects, {tris} tris")
    for r in sorted(report):
        print("   ", r)
    for o in objs:
        bb = [Vector(c) for c in o.bound_box]
        print("    ", o.name, "size", tuple(round(max(c[i] for c in bb) - min(c[i] for c in bb), 3) for i in range(3)))
    return objs


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    src, out = argv[0], argv[1]
    scene = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for name, (folder, yaw, ratio) in PIECES.items():
        c = bpy.data.collections.new(f"KIT_{name}")
        scene.collection.children.link(c)
        prepare(name, os.path.join(src, folder), yaw, ratio, c)
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "room_furniture_kit.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print("saved", path, os.path.getsize(path))


main()
