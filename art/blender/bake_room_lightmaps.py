"""Bake the room's lightmaps in Cycles, one per lighting group, onto the GLB's own meshes and UVs.

  set TAMIRA_GPU=1
  blender.exe -b --factory-startup <out>/web.blend --python bake_room_lightmaps.py -- <out> <size> <samples>

web.blend comes from export_room_glb.py ... lm (same session as room.glb). Writes <out>/lm/lm-<g>.hdr:
  g = 0  the dusk sky alone, direct + indirect (the page has no sky light of its own)
  g = 1…5  each light group alone, indirect only (downlights, pendant, sconces, arc lamp, TV-unit strip);
           the page draws direct light live with shadow maps, and adds these weighted by each group's level.
Diffuse passes without colour: the page multiplies by its own albedo (and by π, three.js's irradiance
convention). Plants, rockers, glass, sheers and glowing parts aren't baked.
"""
import bpy, json, math, os, sys, time

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; SIZE = int(argv[1]) if len(argv) > 1 else 2048; SAMPLES = int(argv[2]) if len(argv) > 2 else 1024
os.makedirs(os.path.join(OUT, 'lm'), exist_ok=True)
sc = bpy.context.scene

def log(*a): print('[bake]', *a, flush=True)

# device
sc.render.engine = 'CYCLES'
pr = bpy.context.preferences.addons['cycles'].preferences
if os.environ.get('TAMIRA_GPU') == '1':
    for kind in ('OPTIX', 'CUDA'):
        try:
            pr.compute_device_type = kind; pr.get_devices()
            if any(d.type == kind for d in pr.devices):
                for d in pr.devices: d.use = d.type == kind
                sc.cycles.device = 'GPU'; log('device', kind); break
        except Exception as e: log('device', kind, e)
c = sc.cycles
c.samples = SAMPLES; c.use_adaptive_sampling = False; c.use_denoising = False
c.max_bounces = 10; c.diffuse_bounces = 6; c.glossy_bounces = 2; c.transmission_bounces = 8; c.transparent_max_bounces = 16
c.sample_clamp_indirect = 6.0; c.use_light_tree = True

meta = json.load(open(os.path.join(OUT, 'room-lights.json')))
BAKE = [sc.objects[n] for n in meta['baked'] if n in sc.objects]
GROUP = lambda n: 1 if n.startswith('downlight') else 2 if n.startswith('pendant') else 3 if n.startswith('sconce') else 4 if n.startswith('arc') else 5 if n.startswith('led') else 0
lights = [o for o in sc.objects if o.type == 'LIGHT']
EMIT = {'downlight_lens': 1, 'pendant_diffuser': 2, 'sconce_glass': 3, 'arc_diffuser': 4, 'led_strip': 5}
emit = {}
for name, g in EMIT.items():
    m = bpy.data.materials.get(name)
    if m:
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); emit[name] = (b, g, b.inputs['Emission Strength'].default_value)
bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND'); SKY = bg.inputs['Strength'].default_value

# one shared float atlas, the active (unconnected) image node in every baked material
img = bpy.data.images.new('lightmap', SIZE, SIZE, float_buffer=True, alpha=False)
mats = {m for o in BAKE for m in o.data.materials if m}
for m in mats:
    m.use_nodes = True
    n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; n.name = n.label = 'lightmap_target'
    m.node_tree.nodes.active = n
for o in BAKE: o.data.uv_layers.active = o.data.uv_layers['lm']
bpy.ops.object.select_all(action='DESELECT')
for o in BAKE: o.select_set(True)
bpy.context.view_layer.objects.active = BAKE[0]
log(len(BAKE), 'meshes,', len(mats), 'materials,', SIZE, 'px,', SAMPLES, 'samples')

bk = sc.render.bake
bk.margin = 12; bk.margin_type = 'EXTEND'; bk.use_clear = True; bk.target = 'IMAGE_TEXTURES'
stats = {}
for g in range(6):
    for o in lights: o.hide_render = GROUP(o.name) != g or g == 0
    for name, (b, gg, k) in emit.items(): b.inputs['Emission Strength'].default_value = k if gg == g else 0.0
    bg.inputs['Strength'].default_value = SKY if g == 0 else 0.0
    passes = {'DIRECT', 'INDIRECT'} if g == 0 else {'INDIRECT'}
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=12, use_clear=True)
    path = os.path.join(OUT, 'lm', f'lm-{g}.hdr')
    img.filepath_raw = path; img.file_format = 'HDR'; img.save()
    px = list(img.pixels[0:4 * SIZE * 64:4])                                 # a quick level check on one strip
    stats[g] = dict(seconds=round(time.time() - t, 1), bytes=os.path.getsize(path))
    log('group', g, stats[g], 'sample max %.3f' % max(px))
json.dump(dict(size=SIZE, samples=SAMPLES, groups=stats, passes={'0': 'direct+indirect (sky)', '1-5': 'indirect'}),
          open(os.path.join(OUT, 'lm', 'bake.json'), 'w'), indent=1)
log('done')
