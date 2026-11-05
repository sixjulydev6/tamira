"""Park tree kit: asset/tree/tree.blend (BlenderKit "A tree": ash-type, 1.9 M tris) -> one web-weight tree.

Headless, deterministic:
    Blender -b asset/tree/tree.blend --python art/blender/skyline/prepare_tree.py -- <out_dir>

What it keeps from the source, and how:
  * bark: the source trunk + branches and their bark texture (tree_bark_39 colour/normal). Both bark
    materials share that image; the Mapping node is baked into the UVs, so a plain repeat map works in
    three.js. Decimated to ~BARK_TRIS.
  * leaves: the source has ~311 k compound-leaf cards (4 verts each) and 1.17 M twig tris. Those are
    rendered (albedo only: the source leaf colour chain, emission shader, transparent film) into a 2-variant
    foliage-cluster atlas, then the canopy is rebuilt as crossed cluster cards at the source leaf density
    (one per occupied VOXEL cell), with normals bent out from the canopy centre so the cards shade as a
    rounded crown.
  * scale: TARGET_H metres tall at instance scale 1, origin at the trunk base, Blender Z up.

Writes <out_dir>/tree_kit.blend (object "tree_ash", materials leaf_ash (slot 0) / bark_ash (slot 1), flat
colours, no image nodes: build_skyline.py adds images only for look-dev) and <out_dir>/tex/:
leaf_COL.png (RGBA atlas), bark_COL.jpg, bark_NRM.jpg.
"""
import bpy, bmesh, math, os, random, sys
import numpy as np
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "//tree_kit"
TARGET_H = 9.5        # m at instance scale 1 (the old round_lo crown top was ~7.4 m)
VOXEL = 1.7           # m, source scale: one cluster card pair per occupied cell
MIN_CARDS = 40        # source leaf cards a cell needs to get a cluster
CARD = 3.0            # m, cluster card edge at source scale
BARK_TRIS = {"Tree Bark.006": 260, "Tree Bark.008": 100}
MIN_LIMB = 3.2        # m, source scale: shorter loose branch parts are dropped before decimation
ATLAS = 512           # px per variant; atlas is 2 x 1
SEED = 7

os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)
src = bpy.data.objects["tree.001"]
me = src.data
mat_index = {m.name: i for i, m in enumerate(me.materials)}
L_IDX, S_IDX = mat_index["1-1"], mat_index["stick"]
co = np.empty(len(me.vertices) * 3, np.float32)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
mw = np.array(src.matrix_world)
co = co @ mw[:3, :3].T + mw[:3, 3]

# ------------------------------------------------------------------ leaf cards: centres
pm = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get("material_index", pm)
ls = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get("loop_start", ls)
lv = np.empty(len(me.loops), np.int32)
me.loops.foreach_get("vertex_index", lv)
# every leaf vertex index once; cards are 4 consecutive vertices (asserted), centre = block mean
mask = np.zeros(len(co), bool)
lt = np.empty(len(me.polygons), np.int32)
me.polygons.foreach_get("loop_total", lt)
sel = np.repeat(pm == L_IDX, lt)
mask[lv[sel]] = True
lid = np.nonzero(mask)[0]
assert len(lid) % 4 == 0 and np.all(np.diff(lid.reshape(-1, 4), axis=1) == 1), "leaf cards are not 4-vertex blocks"
cards = co[lid].reshape(-1, 4, 3).mean(1)
print("leaf cards", len(cards))

# ------------------------------------------------------------------ canopy cells
centre = cards.mean(0)
key = np.floor(cards / VOXEL).astype(np.int64)
uniq, inv, counts = np.unique(key, axis=0, return_inverse=True, return_counts=True)
inv = inv.ravel()
cells = []
for k in np.nonzero(counts >= MIN_CARDS)[0]:
    cells.append((cards[inv == k].mean(0), counts[k]))
print("cluster cells", len(cells), "of", len(uniq))

# ------------------------------------------------------------------ foliage atlas (2 variants)
scene = bpy.context.scene
for o in list(scene.objects):
    o.hide_render = True
leaf_mat = me.materials[L_IDX]
nt = leaf_mat.node_tree
rer = next(n for n in nt.nodes if n.type == "HUE_SAT")          # processed leaf colour (curves -> HSV)
tex_a = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and n.image.name == "1-1.png")
out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
em = nt.nodes.new("ShaderNodeEmission")
tp = nt.nodes.new("ShaderNodeBsdfTransparent")
mx = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(rer.outputs["Color"], em.inputs["Color"])
nt.links.new(tex_a.outputs["Alpha"], mx.inputs["Fac"])
nt.links.new(tp.outputs[0], mx.inputs[1])
nt.links.new(em.outputs[0], mx.inputs[2])
nt.links.new(mx.outputs[0], out.inputs["Surface"])
stick_mat = me.materials[S_IDX]
snt = stick_mat.node_tree
sout = next(n for n in snt.nodes if n.type == "OUTPUT_MATERIAL")
sem = snt.nodes.new("ShaderNodeEmission")
sem.inputs["Color"].default_value = (0.072, 0.018, 0.005, 1)
snt.links.new(sem.outputs[0], sout.inputs["Surface"])

scene.render.engine = "BLENDER_EEVEE"
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = ATLAS
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
try:
    scene.eevee.taa_render_samples = 64
except AttributeError:
    pass
scene.world = None

R = 1.15
dense = sorted(cells, key=lambda c: -c[1])
# medium-density samples: the densest cells render as a solid disc that reads as a blob on a card
picks = [dense[len(dense) // 5][0], dense[len(dense) // 2][0]]
variants = []
for vi, p in enumerate(picks):
    # a chunk of the real canopy (leaves + twigs) inside a sphere around p
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(Matrix(mw.tolist()))
    pv = Vector(p.tolist())
    kill = [f for f in bm.faces if f.material_index not in (L_IDX, S_IDX) or (f.calc_center_median() - pv).length > R]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    chunk_me = bpy.data.meshes.new(f"chunk{vi}")
    bm.to_mesh(chunk_me)
    bm.free()
    for m in me.materials:
        chunk_me.materials.append(m)
    chunk = bpy.data.objects.new(f"chunk{vi}", chunk_me)
    scene.collection.objects.link(chunk)
    cam_d = bpy.data.cameras.new("bake")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = 2 * R
    cam = bpy.data.objects.new("bake", cam_d)
    scene.collection.objects.link(cam)
    view = (pv - Vector(centre.tolist()))
    view.z *= 0.3
    view = view.normalized() if view.length > 1e-3 else Vector((1, 0, 0))
    cam.location = pv + view * 6
    cam.rotation_euler = (-view).to_track_quat("-Z", "Z").to_euler()
    scene.camera = cam
    path = os.path.join(OUT, "tex", f"_variant{vi}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    variants.append(path)
    chunk.hide_render = True
    print("variant", vi, len(chunk_me.polygons), "faces")

atlas = bpy.data.images.new("leaf_atlas", ATLAS * 2, ATLAS, alpha=True)
px = np.zeros((ATLAS, ATLAS * 2, 4), np.float32)
for vi, path in enumerate(variants):
    im = bpy.data.images.load(path)
    a = np.empty(ATLAS * ATLAS * 4, np.float32)
    im.pixels.foreach_get(a)
    a = a.reshape(ATLAS, ATLAS, 4)
    # bleed colour into transparent texels so mip levels don't darken the cut edges
    rgb, al = a[..., :3], a[..., 3:4]
    mean = (rgb * al).sum((0, 1)) / max(al.sum(), 1e-6)
    a[..., :3] = np.where(al > 0.02, rgb / np.maximum(al, 1e-3), mean)
    a[..., :3] = np.clip(a[..., :3], 0, 1)
    px[:, vi * ATLAS:(vi + 1) * ATLAS] = a
    os.remove(path)
atlas.pixels.foreach_set(px.ravel())
atlas.filepath_raw = os.path.join(OUT, "tex", "leaf_COL.png")
atlas.file_format = "PNG"
atlas.save()

# ------------------------------------------------------------------ bark: bake Mapping into UVs, decimate
bark_mat = me.materials[mat_index["Tree Bark.006"]]
bnt = bark_mat.node_tree
mapping = next((n for n in bnt.nodes if n.type == "MAPPING"), None)
for name, img in (("tree_bark_39_color.jpg", "bark_COL.jpg"), ("tree_bark_39_normal.jpg", "bark_NRM.jpg")):
    im = bpy.data.images[name]
    im.scale(512, 512)
    im.filepath_raw = os.path.join(OUT, "tex", img)
    im.file_format = "JPEG"
    scene.render.image_settings.quality = 85
    im.save()

bark_objs = []
for name, tris in BARK_TRIS.items():
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(Matrix(mw.tolist()))
    idx = mat_index[name]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != idx], context="FACES")
    # keep the main limbs: loose parts at least MIN_LIMB m long (twigs sit inside the cluster cards)
    bm.verts.ensure_lookup_table()
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, part = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            part.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        parts.append(part)
    drop = []
    for part in parts:
        lo = Vector((min(p.co.x for p in part), min(p.co.y for p in part), min(p.co.z for p in part)))
        hi = Vector((max(p.co.x for p in part), max(p.co.y for p in part), max(p.co.z for p in part)))
        if (hi - lo).length < MIN_LIMB:
            drop.extend(part)
    print(name, len(parts), "parts,", len(parts) - sum(1 for p in parts if p[0] in set(drop)), "kept")
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    if mapping is not None:
        loc = Vector(mapping.inputs["Location"].default_value)
        rot = mapping.inputs["Rotation"].default_value
        scl = Vector(mapping.inputs["Scale"].default_value)
        M = Matrix.Translation(loc) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal((*scl, 1))
        uvl = bm.loops.layers.uv.active
        for f in bm.faces:
            for lp in f.loops:
                u, v = lp[uvl].uv
                q = M @ Vector((u, v, 0))
                lp[uvl].uv = (q.x, q.y)
    m2 = bpy.data.meshes.new(f"bark_{idx}")
    bm.to_mesh(m2)
    bm.free()
    o = bpy.data.objects.new(f"bark_{idx}", m2)
    scene.collection.objects.link(o)
    n0 = sum(len(p.vertices) - 2 for p in m2.polygons)
    d = o.modifiers.new("dec", "DECIMATE")
    d.ratio = min(1.0, tris / max(n0, 1))
    d.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    dec = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = dec
    print(name, n0, "->", sum(len(p.vertices) - 2 for p in dec.polygons), "tris")
    bark_objs.append(o)

# ------------------------------------------------------------------ assemble tree_ash
s = TARGET_H / (co[:, 2].max() - co[:, 2].min())
bt = bark_objs[-1].data   # main trunk: centre its base on the origin
zs = [v.co.z for v in bt.vertices]
zmin = min(zs)
low = [v.co for v in bt.vertices if v.co.z < zmin + 0.5]
trunk_xy = Vector((sum(c.x for c in low) / len(low), sum(c.y for c in low) / len(low), zmin))

bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UVMap")
rnd = random.Random(SEED)
C = Vector(centre.tolist())
normals = []
for p, n in cells:
    pv = Vector(p.tolist())
    size = CARD * (0.8 + 0.35 * min(1.0, math.sqrt(n / dense[0][1])))
    yaw = rnd.uniform(0, math.pi)
    variant = rnd.randrange(2)
    flip = rnd.random() < 0.5
    for k in range(2):
        a = yaw + k * math.pi / 2
        t = Vector((math.cos(a), math.sin(a), 0)) * size / 2
        up = Vector((rnd.uniform(-.15, .15), rnd.uniform(-.15, .15), 1)).normalized() * size / 2
        corners = [pv - t - up, pv + t - up, pv + t + up, pv - t + up]
        vs = [bm.verts.new(c) for c in corners]
        f = bm.faces.new(vs)
        f.material_index = 0
        u0 = variant * 0.5
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        for lp, (u, v) in zip(f.loops, uvs):
            u = 1 - u if flip else u
            lp[uvl].uv = (u0 + u * 0.5, v)
        for c in corners:
            nrm = (c - C)
            nrm.z *= 0.8
            normals.append(nrm.normalized() * 0.75 + Vector((0, 0, 0.25)))
n_leaf_faces = len(bm.faces)
for o in bark_objs:
    o.data.uv_layers.active.name = "UVMap"
    tmp = bmesh.new()
    tmp.from_mesh(o.data)
    tm = bpy.data.meshes.new("tmp")
    for f in tmp.faces:
        f.material_index = 1
    tmp.to_mesh(tm)
    tmp.free()
    bm.from_mesh(tm)
    bpy.data.meshes.remove(tm)
bm.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation(-trunk_xy))
out_me = bpy.data.meshes.new("tree_ash")
bm.to_mesh(out_me)
bm.free()

# custom normals: leaf cards bent out from the crown, bark keeps its own shading
out_me.polygons.foreach_set("use_smooth", [True] * len(out_me.polygons))
loop_n = []
li = 0
for p in out_me.polygons:
    for _ in p.loop_indices:
        if p.index < n_leaf_faces:
            loop_n.append(normals[li].normalized())
            li += 1
        else:
            loop_n.append(None)
out_me.update()
base_n = [Vector(out_me.loops[i].normal) for i in range(len(out_me.loops))]
out_me.normals_split_custom_set([tuple(n) if n is not None else tuple(base_n[i]) for i, n in enumerate(loop_n)])


def flat(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


out_me.materials.append(flat("leaf_ash", (0.075, 0.12, 0.035), 0.75))
out_me.materials.append(flat("bark_ash", (0.09, 0.07, 0.055), 0.9))
tree = bpy.data.objects.new("tree_ash", out_me)

# keep only the kit in the saved file
kit = bpy.data.scenes.new("tree_kit")
kit.collection.objects.link(tree)
for sc in list(bpy.data.scenes):
    if sc != kit:
        bpy.data.scenes.remove(sc)
for o in list(bpy.data.objects):
    if o != tree:
        bpy.data.objects.remove(o)
for im in list(bpy.data.images):
    bpy.data.images.remove(im)
bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
tri = sum(len(p.vertices) - 2 for p in out_me.polygons)
print(f"tree_ash: {tri} tris ({n_leaf_faces} leaf cards), height {TARGET_H} m, scale {s:.3f}")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "tree_kit.blend"), compress=True)
print("saved", os.path.join(OUT, "tree_kit.blend"))
