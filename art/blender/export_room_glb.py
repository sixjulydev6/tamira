"""Export the rebuilt living room (room.blend from build_room.py) as a web GLB for a live Three.js room.

  Blender -b --factory-startup <room.blend> --python export_room_glb.py -- <out_dir> <polyhaven_cache>

Geometry uncompressed at full detail (no Draco, no decimation); images visually lossless (q95): the user's
"visually lossless" budget. The outside tree, seen only through the window, becomes a 2K Cycles-rendered
cut-out on a plane. Writes <out_dir>/room.glb, <out_dir>/tex/* (2K maps for the procedural materials) and
<out_dir>/room-lights.json. Box-projected materials get world-scale UVs (a face's dominant-axis projection,
in units of the texture's real-world size), so the page only has to repeat each texture once per unit.
Static meshes are joined per material; rockers, their dots and the imported plants stay separate.
Coordinates: glTF is Y-up; Blender (x, y, z) becomes (x, z, -y).
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, CACHE = argv[0], argv[1]
LIGHTMAP = len(argv) > 2 and argv[2] == 'lm'      # add the lightmap UV set and save web.blend for bake_room_lightmaps.py
os.makedirs(os.path.join(OUT, 'tex'), exist_ok=True)

def srgb_to_lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin_to_srgb(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)
def hexlin(h):
    h = h.lstrip('#'); return srgb_to_lin(np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32))

# The procedural (box-projected) materials of build_room.py: Poly Haven set, scale, tint, gains.
# Keep in step with build() there.
PBR = {
    'wall_plaster':    dict(aid='painted_plaster_wall', scale=1.0, tint='#ddd2c4', gain=1.3, flatten=0.75, keep=False, rg=0.6, ra=0.45),
    'ceiling_plaster': dict(aid='painted_plaster_wall', scale=1.0, tint='#e9e3da', gain=1.3, flatten=0.8, keep=False, rg=0.4, ra=0.55),
    'floor_oak':       dict(aid='laminate_floor_02', scale=1.0, tint='#f4e7d6', gain=1.0, flatten=0, keep=True, rg=0.8, ra=0.08),
    'oak_veneer':      dict(aid='oak_veneer_01', scale=0.5, tint='#f2e2cf', gain=1.0, flatten=0, keep=True, rg=0.7, ra=0.1),
    'sofa_linen':      dict(aid='rough_linen', scale=0.35, tint='#ebe3d6', gain=1.05, flatten=0, keep=False, rg=0.3, ra=0.7),
    'rug_wool':        dict(aid='poly_wool_herringbone', scale=0.5, tint='#e5d9c6', gain=1.1, flatten=0, keep=False, rg=0.2, ra=0.8),
    'throw_waffle':    dict(aid='waffle_pique_cotton', scale=0.4, tint='#d9cbb6', gain=1.1, flatten=0, keep=False, rg=0.2, ra=0.75),
}

def find(aid, kind):
    d = os.path.join(CACHE, aid)
    for f in sorted(os.listdir(d)):
        if f.endswith('.jpg') and kind in f.lower(): return os.path.join(d, f)
    return None

def load_px(path, size=2048):
    im = bpy.data.images.load(path); im.scale(size, size)
    a = np.empty(size * size * 4, np.float32); im.pixels.foreach_get(a); return a.reshape(size, size, 4)

def save_px(px, name, lossless=False):
    h, w = px.shape[:2]; im = bpy.data.images.new(name, w, h); im.pixels.foreach_set(px.ravel())
    # visually lossless (user choice): colour JPEG q95; normal/roughness WebP q95
    path = os.path.join(OUT, 'tex', name + ('.webp' if lossless else '.jpg'))
    sc = bpy.context.scene; st = sc.render.image_settings
    st.file_format = 'WEBP' if lossless else 'JPEG'; st.color_mode = 'RGB'; st.quality = 95; st.color_depth = '8' 
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    im.save_render(path, scene=sc); return os.path.basename(path)

tex_meta = {}
for name, m in PBR.items():
    info = json.load(open(os.path.join(CACHE, m['aid'], 'info.json')))
    w_m, h_m = [v / 1000.0 for v in (info.get('dimensions') or [2000, 2000])]
    diff = load_px(find(m['aid'], 'diff'))
    rgb = srgb_to_lin(diff[..., :3])
    if not m['keep']:
        g = rgb.max(axis=2, keepdims=True)                         # Hue/Saturation at 0: the HSV value
        if m['flatten']: g = g * (1 - m['flatten']) + 0.72 * m['flatten']
        rgb = g * np.minimum(1, hexlin(m['tint']) * m['gain'])
    else:
        rgb = rgb * np.minimum(1, hexlin(m['tint']) * m['gain'])
    out = diff.copy(); out[..., :3] = lin_to_srgb(rgb); out[..., 3] = 1
    files = {'map': save_px(out, name + '_col')}
    nor = find(m['aid'], 'nor_gl')
    if nor: files['normalMap'] = save_px(load_px(nor), name + '_nor', lossless=True)
    r = find(m['aid'], 'rough')
    if r:
        rp = load_px(r); v = np.clip(rp[..., :1] * m['rg'] + m['ra'], 0, 1)
        rp[..., :3] = v; files['roughnessMap'] = save_px(rp, name + '_rgh', lossless=True)
    tex_meta[name] = dict(files=files, size=[w_m * m['scale'], h_m * m['scale']])
    print('[glb] textures', name, files, flush=True)

sc = bpy.context.scene
# ---------------------------------------------------------------- scene clean-up for the web
# The tree came in three times (LOD0, LOD1, geometry-nodes copy) on top of each other. Render LOD0 alone
# under the same dusk sky, from the room side, as a transparent 2K cut-out, then swap all three for a plane.
for o in list(sc.objects):
    if o.name.startswith(('island_tree_02_LOD1', 'island_tree_02_geometry_nodes')): bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
tree = [o for o in sc.objects if o.name.startswith('island_tree_02') and o.type == 'MESH']
# the asset also carries a row of small saplings: keep only the main tree (largest bounding box)
size = lambda o: (o.matrix_world @ Vector(o.bound_box[6]) - o.matrix_world @ Vector(o.bound_box[0])).length
main = max(tree, key=size)
for o in tree:
    if o is not main: bpy.data.objects.remove(o, do_unlink=True)
tree = [main]
pts = [o.matrix_world @ Vector(c) for o in tree for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
tw, th = hi.x - lo.x, hi.z - lo.z; cx, cz = (lo.x + hi.x) / 2, (lo.z + hi.z) / 2
hidden = {o.name: o.hide_render for o in sc.objects}
for o in sc.objects: o.hide_render = o not in tree and o.type != 'CAMERA'
cam = bpy.data.objects.new('tree_cam', bpy.data.cameras.new('tree_cam')); sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(tw, th) * 1.02; cam.rotation_euler = (math.pi / 2, 0, 0)
cam.location = (cx, lo.y - 5, cz); cam.data.clip_end = 100; sc.camera = cam
r = sc.render; r.engine = 'CYCLES'; r.film_transparent = True; r.resolution_percentage = 100
r.resolution_x, r.resolution_y = (2048, max(2, round(2048 * th / tw))) if tw >= th else (max(2, round(2048 * tw / th)), 2048)
sc.cycles.samples = 128; sc.cycles.use_denoising = True
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
cutout = os.path.join(OUT, 'tex', 'tree_cutout.png'); r.filepath = cutout
bpy.ops.render.render(write_still=True)
for o in sc.objects: o.hide_render = hidden.get(o.name, o.hide_render)
for o in tree: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
me = bpy.data.meshes.new('tree_cutout'); y = (lo.y + hi.y) / 2
me.from_pydata([(lo.x, y, lo.z), (hi.x, y, lo.z), (hi.x, y, hi.z), (lo.x, y, hi.z)], [], [(0, 1, 2, 3)])
uvl = me.uv_layers.new().data
for i, uvv in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uvl[i].uv = uvv
tm = bpy.data.materials.new('tree_cutout'); me.materials.append(tm)
sc.collection.objects.link(bpy.data.objects.new('tree_cutout', me))
TREE = dict(image='tree_cutout.png', size=[tw, th])
print('[glb] tree cut-out', r.resolution_x, r.resolution_y, flush=True)

imported = lambda o: o.name.startswith(('potted_plant', 'island_tree', 'tree_cutout'))
keep_apart = lambda o: o.name.startswith(('rocker_', 'switch_')) or imported(o) or (o.parent and o.parent.name.startswith('rocker_pivot'))

# world-scale box UVs for the procedural materials
def box_uv(o, size):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify(); mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
    for f in bm.faces:
        n = (nm @ f.normal).normalized(); ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = mw @ l.vert.co
            u, v = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax]
            l[uv].uv = (u / size[0], v / size[1])
    bm.to_mesh(me); bm.free()

# apply modifiers first (bevels, subsurf, solidify) so UVs cover the final surface
deps = bpy.context.evaluated_depsgraph_get()
for o in [o for o in sc.objects if o.type == 'MESH' and not imported(o)]:
    if o.modifiers:
        ev = o.evaluated_get(deps); me = bpy.data.meshes.new_from_object(ev); o.modifiers.clear(); o.data = me
for o in sc.objects:
    if o.type == 'MESH' and o.data.materials and o.data.materials[0] and o.data.materials[0].name in tex_meta:
        if o.data.uv_layers: [o.data.uv_layers.remove(l) for l in list(o.data.uv_layers)]
        box_uv(o, tex_meta[o.data.materials[0].name]['size'])

# the page builds these materials; export them as plain PBR so the GLB still reads on its own
for mat in bpy.data.materials:
    if mat.name in tex_meta and mat.use_nodes:
        nt = mat.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        for l in list(b.inputs['Base Color'].links) + list(b.inputs['Roughness'].links) + list(b.inputs['Normal'].links): nt.links.remove(l)
        b.inputs['Base Color'].default_value = tuple(hexlin(PBR[mat.name]['tint'])) + (1,)

# join static meshes per material (fewer draw calls); everything stays in world space
groups = {}
for o in sc.objects:
    if o.type != 'MESH' or keep_apart(o) or o.parent is not None or not o.data.materials or not o.data.materials[0]: continue
    groups.setdefault(o.data.materials[0].name, []).append(o)
for mname, objs in groups.items():
    if len(objs) < 2: continue
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    objs[0].name = mname
print('[glb] joined', {k: len(v) for k, v in groups.items()}, flush=True)

# Lightmap UVs (second UV set 'lm'): every static surface packed into one shared atlas, at one texel
# density. The GLB carries them as TEXCOORD_1; bake_room_lightmaps.py bakes onto exactly these meshes
# (saved as web.blend next to the GLB), so the maps and the UVs always come from the same session.
NO_BAKE = {'sheer', 'glass', 'tree_cutout', 'outside_ground', 'downlight_lens', 'pendant_diffuser', 'sconce_glass',
           'arc_diffuser', 'led_strip', 'tv_glass', 'switch_dot_on', 'switch_dot_off', 'switch_rocker'}
bakeable = lambda o: o.type == 'MESH' and not keep_apart(o) and o.data.materials and o.data.materials[0] and o.data.materials[0].name not in NO_BAKE
BAKE = []
if LIGHTMAP:
    BAKE = sorted([o for o in sc.objects if bakeable(o)] + [o for o in sc.objects if o.name == 'switch_plate'], key=lambda o: o.name)
    for o in BAKE:
        if not o.data.uv_layers: box_uv(o, (1.0, 1.0))               # every baked mesh: UV0 = box, UV1 = lm
        lm = o.data.uv_layers.new(name='lm'); o.data.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT')
    for o in BAKE: o.select_set(True)
    bpy.context.view_layer.objects.active = BAKE[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in BAKE: o.data.uv_layers.active = o.data.uv_layers[0]
    import hashlib
    h = hashlib.sha256()
    for o in BAKE:
        a = np.empty(len(o.data.uv_layers['lm'].data) * 2, np.float32); o.data.uv_layers['lm'].data.foreach_get('uv', a); h.update(a.tobytes())
    print('[glb] lightmap UVs on', len(BAKE), 'meshes; sha', h.hexdigest()[:16], flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'web.blend'), copy=True)

# lights: positions and settings for the page (glTF punctual lights carry no light groups or areas)
GROUP = lambda n: 1 if n.startswith('downlight') else 2 if n.startswith('pendant') else 3 if n.startswith('sconce') else 4 if n.startswith('arc') else 5 if n.startswith('led') else 0
to_gl = lambda v: [v[0], v[2], -v[1]]
lights = []
for o in sc.objects:
    if o.type != 'LIGHT': continue
    L = o.data; d = o.matrix_world.to_3x3() @ Vector((0, 0, -1))
    e = dict(name=o.name, group=GROUP(o.name), type=L.type, watts=L.energy, color=list(L.color), position=to_gl(o.matrix_world.translation), direction=to_gl(d))
    if L.type == 'SPOT': e.update(angle=L.spot_size / 2, blend=L.spot_blend)
    if L.type == 'AREA': e.update(size=[L.size, L.size_y])
    if L.type in ('POINT', 'SPOT'): e['radius'] = L.shadow_soft_size
    lights.append(e)
emissive = {m.name: g for m, g in [(bpy.data.materials.get(n), g) for n, g in
            [('downlight_lens', 1), ('pendant_diffuser', 2), ('sconce_glass', 3), ('arc_diffuser', 4), ('led_strip', 5)]] if m}
json.dump(dict(lights=lights, emissive=emissive, textures=tex_meta, tree=TREE, baked=[o.name for o in BAKE],
               note='Blender (x,y,z) -> glTF (x,z,-y). Rocker pivots rotate about glTF -Z (Blender +Y).'),
          open(os.path.join(OUT, 'room-lights.json'), 'w'), indent=1)

for o in list(sc.objects):
    if o.type == 'LIGHT' or o.type == 'CAMERA': bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'room.glb'), export_format='GLB', export_apply=True, export_yup=True,
                          export_draco_mesh_compression_enable=False, export_image_format='WEBP', export_image_quality=95,
                          export_lights=False, export_cameras=False)
tris = sum(len(p.vertices) - 2 for o in sc.objects if o.type == 'MESH' for p in o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons)
print('[glb] wrote', os.path.getsize(os.path.join(OUT, 'room.glb')), 'bytes; meshes', sum(o.type == 'MESH' for o in sc.objects), 'tris', tris, flush=True)
