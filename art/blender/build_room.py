"""The living room at the end of the story, rebuilt with realistic materials (DECISIONS 30).

Run in a separate background Blender on the team machine (never in a shared live session):

  blender.exe -b --factory-startup --python build_room.py -- <out_dir> <mode> <samples> <jobs> [exposure]

  mode     check   build, print camera/board alignment against room.json, save room.blend
           preview render <jobs> at 50% into <out_dir>/preview
           final   render <jobs> at full size into <out_dir>/final (PNG, opaque; alpha edges are added later)
  jobs     comma list of <frame>-l<level>-<state> (d-l0-5, p-l3-0, ...), or "all" (48 frames)

The cameras, crops and board position come from src/story/room.json (embedded below, unchanged), so
the 3D switchboard hand-over keeps lining up. Layout follows the original renders; only geometry detail,
materials and lighting quality change. Lighting states are cumulative: 0 dusk only, then downlights,
pendant, sconces, arc lamp, TV-unit strip; rocker i is switched on (and its dot glows) when i < state.
Materials and models are CC0 from Poly Haven, downloaded once into <ROOT>/source/polyhaven.
"""
import bpy, bmesh, json, math, os, sys, time, urllib.request
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.getcwd(), 'room_out')
MODE = argv[1] if len(argv) > 1 else 'check'
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
JOBS = argv[3] if len(argv) > 3 else 'd-l0-5'
EXPOSURE = float(argv[4]) if len(argv) > 4 else 1.05
WARM = 3000                                   # bulb colour temperature (K)
ROOT = os.environ.get('TAMIRA_ROOT', r'C:\Users\india\Documents\tamira-reference-match')   # team machine default
CACHE = os.path.join(ROOT, 'source', 'polyhaven')
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)

# src/story/room.json, verbatim (cameras, frustum tangents, levels, board)
_RJ = r'''__ROOM_JSON__'''
if _RJ.startswith('__'):                      # running from the repo: read room.json directly
    _RJ = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'story', 'room.json')).read()
ROOM = json.loads(_RJ)

def log(*a):
    print('[room]', *a, flush=True)

# ---------------------------------------------------------------- Poly Haven (CC0)
UA = {'User-Agent': 'tamira-room-build/1.0'}
def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(path + '.part', 'wb') as f: f.write(r.read())
    os.replace(path + '.part', path); return path
def api(kind, aid):
    p = os.path.join(CACHE, aid, f'{kind}.json')
    fetch(f'https://api.polyhaven.com/{kind}/{aid}', p)
    return json.load(open(p))
def ph_texture(aid, res='2k'):
    files, info = api('files', aid), api('info', aid)
    out = {}
    for key, names in {'diff': ['Diffuse', 'diff'], 'nor': ['nor_gl'], 'rough': ['Rough', 'rough'], 'arm': ['arm']}.items():
        for n in names:
            if n in files and res in files[n]:
                u = files[n][res]['jpg']['url']; out[key] = fetch(u, os.path.join(CACHE, aid, os.path.basename(u))); break
    dims = info.get('dimensions') or [2000, 2000]
    return out, (dims[0] / 1000.0, dims[1] / 1000.0)
def ph_hdri(aid, res='2k'):
    u = api('files', aid)['hdri'][res]['hdr']['url']
    return fetch(u, os.path.join(CACHE, aid, os.path.basename(u)))
def ph_model(aid, res='1k'):
    b = api('files', aid)['blend'][res]['blend']
    d = os.path.join(CACHE, aid, res)
    path = fetch(b['url'], os.path.join(d, os.path.basename(b['url'])))
    for rel, inc in b.get('include', {}).items(): fetch(inc['url'], os.path.join(d, rel))
    with bpy.data.libraries.load(path, link=False) as (src, dst): dst.objects = list(src.objects)
    objs = [o for o in dst.objects if o is not None]
    for o in objs: bpy.context.scene.collection.objects.link(o)
    return objs

# ---------------------------------------------------------------- helpers
def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)
def kelvin(k):
    """Blackbody tint (linear RGB, max 1) for light colours; Tanner Helland's fit."""
    t = k / 100.0
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.12 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.52 * math.log(t - 10) - 305.04)
    c = [max(0, min(255, v)) / 255 for v in (r, g, b)]
    c = [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c]
    m = max(c); return tuple(v / m for v in c)
def mix_rgb(N, L, a, b_col, blend='MULTIPLY'):
    """ShaderNodeMix in colour mode; its A/B/Result names repeat per data type, so pick the RGBA ones."""
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = blend
    mx.inputs['Factor'].default_value = 1.0
    A = next(x for x in mx.inputs if x.name == 'A' and x.type == 'RGBA'); B = next(x for x in mx.inputs if x.name == 'B' and x.type == 'RGBA')
    L.new(a, A); B.default_value = b_col
    return next(x for x in mx.outputs if x.name == 'Result' and x.type == 'RGBA')
def inp(node, *names):
    for n in names:
        if n in node.inputs: return node.inputs[n]
    raise KeyError(names)

def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return m, nt, bsdf

def mat_plain(name, col, rough=0.5, metal=0.0, coat=0.0, sheen=0.0, emit=None, emit_strength=0.0):
    m, nt, b = new_mat(name)
    inp(b, 'Base Color').default_value = srgb(col) if isinstance(col, str) else col
    inp(b, 'Roughness').default_value = rough; inp(b, 'Metallic').default_value = metal
    if coat: inp(b, 'Coat Weight').default_value = coat
    if sheen: inp(b, 'Sheen Weight').default_value = sheen
    if emit:
        inp(b, 'Emission Color').default_value = emit + (1,) if len(emit) == 3 else emit
        inp(b, 'Emission Strength').default_value = emit_strength
    return m

def mat_pbr(name, aid, tint=None, tint_gain=1.0, rough_gain=1.0, rough_add=0.0, normal=1.0, sheen=0.0, scale=1.0, res='2k', keep_colour=False, flatten=0.0):
    """Poly Haven texture set on box projection in object space, at its real-world size."""
    maps, (w, h) = ph_texture(aid, res)
    m, nt, b = new_mat(name); N, L = nt.nodes, nt.links
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / (w * scale), 1 / (h * scale), 1 / (w * scale))
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    def img(path, colour):
        t = N.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=True)
        t.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
        t.projection = 'BOX'; t.projection_blend = 0.25
        L.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    if 'diff' in maps:
        d = img(maps['diff'], True); col = d.outputs['Color']
        if tint:
            if not keep_colour:          # keep only the texture's light and shade, coloured by the tint
                hs = N.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 0.0
                L.new(col, hs.inputs['Color']); col = hs.outputs['Color']
                if flatten:            # even out blotches: pull the shade toward a flat mid value
                    col = mix_rgb(N, L, col, (0.72, 0.72, 0.72, 1), blend='MIX')
                    next(x for x in col.node.inputs if x.name == 'Factor' and x.type == 'VALUE').default_value = flatten
            col = mix_rgb(N, L, col, tuple(min(1, c * tint_gain) for c in srgb(tint)[:3]) + (1,))
        L.new(col, inp(b, 'Base Color'))
    rough_src = None
    if 'rough' in maps: rough_src = img(maps['rough'], False).outputs['Color']
    elif 'arm' in maps:
        sep = N.new('ShaderNodeSeparateColor'); L.new(img(maps['arm'], False).outputs['Color'], sep.inputs['Color']); rough_src = sep.outputs['Green']
    if rough_src is not None:
        mr = N.new('ShaderNodeMath'); mr.operation = 'MULTIPLY_ADD'
        L.new(rough_src, mr.inputs[0]); mr.inputs[1].default_value = rough_gain; mr.inputs[2].default_value = rough_add
        mr.use_clamp = True; L.new(mr.outputs[0], inp(b, 'Roughness'))
    if 'nor' in maps:
        nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal
        L.new(img(maps['nor'], False).outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], inp(b, 'Normal'))
    if sheen: inp(b, 'Sheen Weight').default_value = sheen; inp(b, 'Sheen Roughness').default_value = 0.6
    return m

def link(o):
    bpy.context.scene.collection.objects.link(o); return o
def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); return link(bpy.data.objects.new(name, me))
def finish(o, mat, bevel=0.0, seg=3, smooth=True, subsurf=0):
    if mat: o.data.materials.append(mat)
    if bevel:
        bv = o.modifiers.new('Bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'
        bv.harden_normals = True
    if subsurf:
        s = o.modifiers.new('Subsurf', 'SUBSURF'); s.levels = subsurf; s.render_levels = subsurf
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o
def box(name, size, loc, mat, bevel=0.004, seg=3, rot=(0, 0, 0), subsurf=0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = mesh_obj(name, bm); o.location = loc; o.rotation_euler = rot
    return finish(o, mat, bevel, seg, smooth=bevel > 0 or subsurf > 0, subsurf=subsurf)
def cyl(name, r, h, loc, mat, verts=48, bevel=0.0, rot=(0, 0, 0), r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = mesh_obj(name, bm); o.location = loc; o.rotation_euler = rot
    return finish(o, mat, bevel, 2, smooth=True)
def lathe(name, profile, loc, mat, steps=64, solidify=0.0):
    """Revolve a (r, z) profile about Z."""
    bm = bmesh.new(); prev = None; rings = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(steps):
        A, B = rings[i], rings[(i + 1) % steps]
        for j in range(len(profile) - 1): bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    o = mesh_obj(name, bm); o.location = loc
    if solidify:
        s = o.modifiers.new('Solid', 'SOLIDIFY'); s.thickness = solidify; s.offset = 0
    return finish(o, mat, 0, smooth=True)
def tube(name, pts, r, mat):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 6
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = link(bpy.data.objects.new(name, cu)); o.data.materials.append(mat); return o

# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    pr = bpy.context.preferences.addons['cycles'].preferences
    # The team GPU is shared with Unreal Editor (100% busy), so render on the CPU unless TAMIRA_GPU=1;
    # 20 of 24 threads keep the machine responsive for its user.
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 20
    for kind in (('OPTIX', 'CUDA') if os.environ.get('TAMIRA_GPU') == '1' else ()):
        try:
            pr.compute_device_type = kind; pr.get_devices()
            gpus = [d for d in pr.devices if d.type == kind]
            if gpus:
                for d in pr.devices: d.use = d.type == kind
                sc.cycles.device = 'GPU'; log('device', kind, [d.name for d in gpus]); break
        except Exception as e: log('device', kind, e)
    c = sc.cycles
    c.samples = SAMPLES; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.01
    c.use_denoising = True
    try: c.denoiser = 'OPENIMAGEDENOISE'; c.denoising_use_gpu = True
    except Exception: pass
    c.max_bounces = 10; c.diffuse_bounces = 6; c.glossy_bounces = 4; c.transmission_bounces = 8; c.transparent_max_bounces = 16
    c.sample_clamp_indirect = 8.0; c.use_light_tree = True; c.caustics_reflective = False; c.caustics_refractive = False
    c.seed = 7
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Base Contrast'
    except Exception: pass
    sc.view_settings.exposure = EXPOSURE
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.color_depth = '8'
    sc.unit_settings.system = 'METRIC'
    return sc

# Room bounds (metres, Z up), measured from the original renders through room.json's camera
XL, XR, YB, YF, ZC = -1.9, 1.87, 4.86, -1.6, 2.75
WIN = dict(x0=-0.48, x1=0.82, z0=0.80, z1=2.30, mullion=0.17, transom=2.15)

GROUP_LIGHTS = {g: [] for g in range(1, 6)}      # light objects per lighting step
GROUP_EMIT = {g: [] for g in range(1, 6)}        # (principled, strength) per step
ROCKERS, DOTS = [], []

def emit_mat(name, group, col, strength, base='#f4efe6', rough=0.4):
    m = mat_plain(name, base, rough=rough, emit=kelvin(WARM) if col is None else col, emit_strength=0.0)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    GROUP_EMIT[group].append((b, strength)); return m

def add_light(name, kind, loc, group, watts, rot=(0, 0, 0), size=0.03, spot=None, blend=0.6, k=WARM, area=None):
    li = bpy.data.lights.new(name, kind); li.energy = watts; li.color = kelvin(k)
    if kind in ('POINT', 'SPOT'): li.shadow_soft_size = size
    if kind == 'SPOT': li.spot_size = math.radians(spot or 90); li.spot_blend = blend
    if kind == 'AREA':
        li.shape = 'RECTANGLE'; li.size, li.size_y = area
    o = link(bpy.data.objects.new(name, li)); o.location = loc; o.rotation_euler = rot
    GROUP_LIGHTS[group].append(o); return o

def build():
    M = {}
    M['wall'] = mat_pbr('wall_plaster', 'painted_plaster_wall', tint='#ddd2c4', tint_gain=1.3, rough_gain=0.6, rough_add=0.45, normal=0.12, scale=1.0, flatten=0.75)
    M['ceiling'] = mat_pbr('ceiling_plaster', 'painted_plaster_wall', tint='#e9e3da', tint_gain=1.3, rough_gain=0.4, rough_add=0.55, normal=0.1, flatten=0.8)
    M['floor'] = mat_pbr('floor_oak', 'laminate_floor_02', tint='#f4e7d6', tint_gain=1.0, keep_colour=True, rough_gain=0.8, rough_add=0.08, normal=0.8)
    M['oak'] = mat_pbr('oak_veneer', 'oak_veneer_01', tint='#f2e2cf', keep_colour=True, rough_gain=0.7, rough_add=0.1, normal=0.5, scale=0.5)
    M['linen'] = mat_pbr('sofa_linen', 'rough_linen', tint='#ebe3d6', tint_gain=1.05, rough_gain=0.3, rough_add=0.7, normal=0.9, sheen=0.35, scale=0.35)
    M['rug'] = mat_pbr('rug_wool', 'poly_wool_herringbone', tint='#e5d9c6', tint_gain=1.1, rough_gain=0.2, rough_add=0.8, normal=1.0, sheen=0.5, scale=0.5)
    M['throw'] = mat_pbr('throw_waffle', 'waffle_pique_cotton', tint='#d9cbb6', tint_gain=1.1, rough_gain=0.2, rough_add=0.75, normal=1.0, sheen=0.4, scale=0.4)
    M['skirting'] = mat_plain('skirting', '#ece6dc', rough=0.45, coat=0.1)
    M['black'] = mat_plain('black_metal', '#1d1c1b', rough=0.35, metal=0.9)
    M['bronze'] = mat_plain('bronze', '#3a3027', rough=0.32, metal=1.0)
    M['shade'] = mat_plain('pendant_shade', '#d9d0c2', rough=0.38, metal=0.0, coat=0.3)
    M['white_in'] = mat_plain('shade_inner', '#f5f2ec', rough=0.6)
    M['glaze'] = mat_plain('dark_glaze', '#3a2a22', rough=0.22, coat=0.6)
    M['tv'] = mat_plain('tv_glass', '#060607', rough=0.12, coat=0.6)
    M['tvbody'] = mat_plain('tv_body', '#1a1a1c', rough=0.4, metal=0.6)
    M['frame'] = mat_plain('window_frame', '#1f1f21', rough=0.4, metal=0.7)
    M['plate'] = mat_plain('switch_plate', '#f3f2ee', rough=0.32, coat=0.4)
    M['rocker'] = mat_plain('switch_rocker', '#f7f6f2', rough=0.28, coat=0.5)
    M['dot_off'] = mat_plain('switch_dot_off', '#3a2a20', rough=0.5)
    M['marble'] = mat_plain('lamp_base', '#d8d3cb', rough=0.18, coat=0.4)
    M['outside'] = mat_plain('outside_ground', '#141613', rough=0.95)
    # sheer curtains: mostly see-through, translucent where they fold
    m, nt, b = new_mat('sheer')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); N, Lk = nt.nodes, nt.links
    tr, tl, mx, mx2 = N.new('ShaderNodeBsdfTransparent'), N.new('ShaderNodeBsdfTranslucent'), N.new('ShaderNodeMixShader'), N.new('ShaderNodeMixShader')
    tl.inputs['Color'].default_value = srgb('#f1ece4'); inp(b, 'Base Color').default_value = srgb('#f1ece4'); inp(b, 'Roughness').default_value = 0.9
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    mx.inputs['Fac'].default_value = 0.45; Lk.new(tl.outputs[0], mx.inputs[1]); Lk.new(b.outputs[0], mx.inputs[2])
    mr = N.new('ShaderNodeMath'); mr.operation = 'MULTIPLY_ADD'; Lk.new(lw.outputs['Facing'], mr.inputs[0]); mr.inputs[1].default_value = 0.35; mr.inputs[2].default_value = 0.42
    Lk.new(mr.outputs[0], mx2.inputs['Fac']); Lk.new(tr.outputs[0], mx2.inputs[1]); Lk.new(mx.outputs[0], mx2.inputs[2])
    Lk.new(mx2.outputs[0], out.inputs['Surface']); M['sheer'] = m
    # window glass: thin, lets the dusk in without refraction shadows
    m, nt, b = new_mat('glass'); out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); N, Lk = nt.nodes, nt.links
    tr, gl, fr, mx = N.new('ShaderNodeBsdfTransparent'), N.new('ShaderNodeBsdfGlossy'), N.new('ShaderNodeFresnel'), N.new('ShaderNodeMixShader')
    gl.inputs['Roughness'].default_value = 0.02; fr.inputs['IOR'].default_value = 1.5
    Lk.new(fr.outputs[0], mx.inputs['Fac']); Lk.new(tr.outputs[0], mx.inputs[1]); Lk.new(gl.outputs[0], mx.inputs[2]); Lk.new(mx.outputs[0], out.inputs['Surface'])
    M['glass'] = m

    # --- shell: walls as slabs outside the room, so light can't leak at the corners
    T = 0.12
    box('floor', (XR - XL, YB - YF, 0.04), ((XL + XR) / 2, (YB + YF) / 2, -0.02), M['floor'], bevel=0)
    box('ceiling', (XR - XL + 2 * T, YB - YF + 2 * T, T), ((XL + XR) / 2, (YB + YF) / 2, ZC + T / 2), M['ceiling'], bevel=0)
    box('wall_left', (T, YB - YF + 2 * T, ZC), (XL - T / 2, (YB + YF) / 2, ZC / 2), M['wall'], bevel=0)
    box('wall_right', (T, YB - YF + 2 * T, ZC), (XR + T / 2, (YB + YF) / 2, ZC / 2), M['wall'], bevel=0)
    box('wall_front', (XR - XL, T, ZC), ((XL + XR) / 2, YF - T / 2, ZC / 2), M['wall'], bevel=0)
    w = WIN
    for nm, x0, x1, z0, z1 in [('back_l', XL, w['x0'], 0, ZC), ('back_r', w['x1'], XR, 0, ZC), ('back_b', w['x0'], w['x1'], 0, w['z0']), ('back_t', w['x0'], w['x1'], w['z1'], ZC)]:
        box('wall_' + nm, (x1 - x0, T, z1 - z0), ((x0 + x1) / 2, YB + T / 2, (z0 + z1) / 2), M['wall'], bevel=0)
    # reveal (the opening's sides), sill, frame, mullion, transom, glass
    for nm, sz, lc in [('rev_l', (0.02, T, w['z1'] - w['z0']), (w['x0'] + 0.01, YB + T / 2, (w['z0'] + w['z1']) / 2)),
                       ('rev_r', (0.02, T, w['z1'] - w['z0']), (w['x1'] - 0.01, YB + T / 2, (w['z0'] + w['z1']) / 2)),
                       ('rev_t', (w['x1'] - w['x0'], T, 0.02), ((w['x0'] + w['x1']) / 2, YB + T / 2, w['z1'] - 0.01))]:
        box('win_' + nm, sz, lc, M['wall'], bevel=0)
    box('win_sill', (w['x1'] - w['x0'] + 0.08, T + 0.05, 0.03), ((w['x0'] + w['x1']) / 2, YB + T / 2 - 0.02, w['z0'] - 0.015), M['skirting'], bevel=0.003)
    fy = YB + 0.06; fw = 0.045
    for nm, sz, lc in [('f_l', (fw, 0.05, w['z1'] - w['z0']), (w['x0'] + fw / 2, fy, (w['z0'] + w['z1']) / 2)),
                       ('f_r', (fw, 0.05, w['z1'] - w['z0']), (w['x1'] - fw / 2, fy, (w['z0'] + w['z1']) / 2)),
                       ('f_t', (w['x1'] - w['x0'], 0.05, fw), ((w['x0'] + w['x1']) / 2, fy, w['z1'] - fw / 2)),
                       ('f_b', (w['x1'] - w['x0'], 0.05, fw), ((w['x0'] + w['x1']) / 2, fy, w['z0'] + fw / 2)),
                       ('f_m', (0.035, 0.05, w['z1'] - w['z0']), (w['mullion'], fy, (w['z0'] + w['z1']) / 2)),
                       ('f_tr', (w['x1'] - w['x0'], 0.05, 0.035), ((w['x0'] + w['x1']) / 2, fy, w['transom']))]:
        box('win_' + nm, sz, lc, M['frame'], bevel=0.003)
    box('win_glass', (w['x1'] - w['x0'], 0.006, w['z1'] - w['z0']), ((w['x0'] + w['x1']) / 2, fy + 0.005, (w['z0'] + w['z1']) / 2), M['glass'], bevel=0)
    # skirting boards
    for nm, sz, lc in [('sk_l', (0.014, YB - YF, 0.09), (XL + 0.007, (YB + YF) / 2, 0.045)),
                       ('sk_r', (0.014, YB - YF, 0.09), (XR - 0.007, (YB + YF) / 2, 0.045)),
                       ('sk_bl', (w['x0'] - XL, 0.014, 0.09), ((XL + w['x0']) / 2, YB - 0.007, 0.045)),
                       ('sk_bb', (w['x1'] - w['x0'], 0.014, 0.09), ((w['x0'] + w['x1']) / 2, YB - 0.007, 0.045)),
                       ('sk_br', (XR - w['x1'], 0.014, 0.09), ((XR + w['x1']) / 2, YB - 0.007, 0.045))]:
        box(nm, sz, lc, M['skirting'], bevel=0.002)

    # --- outside: dusk sky, a tree, dark ground
    box('outside_ground', (40, 30, 0.1), (0, YB + 16, -0.6), M['outside'], bevel=0)
    try:
        tree = ph_model('island_tree_02', '1k'); place(tree, (0.35, YB + 7.5), 6.5, rot=0.6)
    except Exception as e: log('tree skipped', e)

    # --- curtains on a rod
    tube('curtain_rod', [Vector((-1.21, YB - 0.09, 2.53)), Vector((1.59, YB - 0.09, 2.53))], 0.011, M['black'])
    for x0, x1, seed in [(-1.15, -0.05, 1), (0.39, 1.53, 2)]: curtain(x0, x1, M['sheer'], seed)

    # --- sofa along the left wall
    sofa(M)
    # --- switch plate (the room end of the 3D board) and the artwork above it
    switch_plate(M)
    artwork(M)
    # --- coffee table, vase, bowl
    table(M)
    # --- rug
    box('rug', (1.8, 3.2, 0.012), (-0.1, 1.8, 0.006), M['rug'], bevel=0.004, seg=2)
    # --- armchair with a throw
    armchair(M)
    # --- TV, unit, decor
    tv_unit(M)
    # --- plants
    try:
        big = ph_model('potted_plant_01', '1k'); place(big, (1.5, 4.5), 1.75, rot=0.4)
        small = ph_model('potted_plant_02', '1k'); place(small, (1.66, 3.9), 0.36, z=0.6, rot=-0.7)
    except Exception as e: log('plants skipped', e)
    lights(M)
    world()

def place(objs, xy, height, z=0.0, rot=0.0):
    roots = [o for o in objs if o.parent is None]
    piv = link(bpy.data.objects.new('pivot', None))
    for o in roots: o.parent = piv
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    s = height / max(1e-6, hi.z - lo.z)
    for o in roots: o.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    piv.scale = (s, s, s); piv.rotation_euler = (0, 0, rot); piv.location = (xy[0], xy[1], z)
    return piv

def curtain(x0, x1, mat, seed):
    """A floor-length sheer: a pleated sheet hanging from the rod."""
    nx, nz = 120, 40; top, bot = 2.5, 0.02; y = YB - 0.09
    bm = bmesh.new(); grid = []
    folds = (x1 - x0) / 0.09
    for j in range(nz + 1):
        z = top + (bot - top) * j / nz; row = []
        for i in range(nx + 1):
            u = i / nx; x = x0 + (x1 - x0) * u
            amp = 0.035 + 0.015 * math.sin(seed * 3.1 + u * 7)
            dy = amp * math.sin(2 * math.pi * folds * u + seed) * (1 - 0.25 * (j / nz))
            row.append(bm.verts.new((x, y + dy, z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx): bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = mesh_obj('curtain_%d' % seed, bm); finish(o, mat, smooth=True)
    s = o.modifiers.new('Solid', 'SOLIDIFY'); s.thickness = 0.002

def sofa(M):
    x0, x1, y0, y1 = XL + 0.03, -1.0, 0.35, 3.0          # depth across x, length along y
    d = x1 - x0
    for yy in (y0 + 0.06, y1 - 0.06):
        for xx in (x0 + 0.06, x1 - 0.06): cyl('sofa_leg', 0.018, 0.1, (xx, yy, 0.05), M['oak'], verts=24, r2=0.014)
    box('sofa_base', (d, y1 - y0, 0.32), ((x0 + x1) / 2, (y0 + y1) / 2, 0.26), M['linen'], bevel=0.03, seg=4)
    arm = 0.2
    for yy in (y0 + arm / 2, y1 - arm / 2):
        box('sofa_arm', (d, arm, 0.3), ((x0 + x1) / 2, yy, 0.55), M['linen'], bevel=0.05, seg=5)
    seat0, seat1 = y0 + arm, y1 - arm; n = 3; L = (seat1 - seat0) / n
    for i in range(n):
        yc = seat0 + L * (i + 0.5)
        box('sofa_seat', (d - 0.22, L - 0.012, 0.15), (x1 - (d - 0.22) / 2, yc, 0.495), M['linen'], bevel=0.035, seg=4, subsurf=1)
        box('sofa_back', (0.2, L - 0.02, 0.42), (x0 + 0.13, yc, 0.76), M['linen'], bevel=0.05, seg=4, subsurf=1, rot=(0, math.radians(-8), 0))
    box('sofa_pillow', (0.13, 0.42, 0.4), (x0 + 0.33, y1 - 0.45, 0.76), M['linen'], bevel=0.06, seg=4, subsurf=2, rot=(0, math.radians(-14), math.radians(6)))
    box('sofa_backrest', (0.16, y1 - y0, 0.5), (x0 + 0.08, (y0 + y1) / 2, 0.62), M['linen'], bevel=0.04, seg=4)

def switch_plate(M):
    """Five-gang plate matching the 3D board (210 x 86 mm, rockers 36 mm apart)."""
    bx, by, bz = ROOM['d']['board']['pos']
    plate = box('switch_plate', (0.007, 0.21, 0.086), (bx + 0.0035, by, bz), M['plate'], bevel=0.0032, seg=4)
    for i in range(5):
        y = by + (i - 2) * 0.036
        piv = link(bpy.data.objects.new('rocker_pivot_%d' % i, None)); piv.location = (bx + 0.0088, y, bz)
        r = box('rocker_%d' % i, (0.006, 0.030, 0.044), (0, 0, 0), M['rocker'], bevel=0.0022, seg=4); r.parent = piv
        dot = cyl('rocker_dot_%d' % i, 0.0012, 0.0005, (0.0031, 0, 0.015), M['dot_off'], verts=20, rot=(0, math.radians(90), 0)); dot.parent = piv
        ROCKERS.append(piv); DOTS.append(dot)

def artwork(M):
    # the abstract print: cream ground, terracotta arch, ochre sun, blush, sage, dark leaf, a line
    W, H = 600, 760
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); img = np.zeros((H, W, 4), np.float32)
    def lin(h):
        return np.array(srgb(h)[:3], np.float32)
    img[..., :3] = lin('#efe6d6'); img[..., 3] = 1
    rng = np.random.default_rng(3)
    def paint(mask, col):
        img[mask, :3] = lin(col) * (0.96 + 0.04 * rng.random((mask.sum(), 1)))
    X, Y = xx / W, 1 - yy / H
    paint(((X - 0.36) ** 2 + (Y - 0.62) ** 2 < 0.03) & (Y > 0.62) | ((X > 0.22) & (X < 0.5) & (Y < 0.62) & (Y > 0.3)), '#b5532d')
    paint(((X - 0.6) ** 2 + (Y - 0.74) ** 2 < 0.012), '#d39a3a')
    paint(((X - 0.57) ** 2 / 0.008 + (Y - 0.56) ** 2 / 0.003 < 1), '#e2b4a0')
    paint((X > 0.42) & (X < 0.72) & (Y > 0.38) & (Y < 0.53), '#e7cfa6')
    paint(((X - 0.36) ** 2 / 0.009 + (Y - 0.3) ** 2 / 0.002 < 1), '#9aa284')
    paint((((X - 0.62) * 0.8 + (Y - 0.32)) ** 2 / 0.004 + ((X - 0.62) - (Y - 0.32) * 0.8) ** 2 / 0.03 < 1) & (X > 0.5), '#2c2320')
    t = np.arctan2(Y - 0.7, X - 0.55); ring = np.abs(np.hypot(X - 0.55, Y - 0.7) - 0.14) < 0.0025
    paint(ring & (t > 0.2) & (t < 2.6), '#3a302a')
    im = bpy.data.images.new('artwork', W, H, alpha=False, float_buffer=False); im.pixels.foreach_set(img[::-1].ravel()); im.pack()
    m, nt, b = new_mat('art_print'); t_ = nt.nodes.new('ShaderNodeTexImage'); t_.image = im
    nt.links.new(t_.outputs['Color'], inp(b, 'Base Color')); inp(b, 'Roughness').default_value = 0.75
    y0, y1, z0, z1 = 1.75, 2.34, 1.32, 2.08; yc, zc = (y0 + y1) / 2, (z0 + z1) / 2
    fw = 0.03                                     # a four-sided oak frame around the mat
    for nm, sz, lc in [('t', (0.03, y1 - y0, fw), (XL + 0.015, yc, z1 - fw / 2)), ('b', (0.03, y1 - y0, fw), (XL + 0.015, yc, z0 + fw / 2)),
                       ('l', (0.03, fw, z1 - z0), (XL + 0.015, y0 + fw / 2, zc)), ('r', (0.03, fw, z1 - z0), (XL + 0.015, y1 - fw / 2, zc))]:
        box('art_frame_' + nm, sz, lc, M['oak'], bevel=0.002)
    box('art_mat', (0.02, y1 - y0 - 0.05, z1 - z0 - 0.05), (XL + 0.01, yc, zc), mat_plain('art_mat', '#f1ece2', rough=0.85), bevel=0)
    # the print: a quad on the mat, facing into the room (+X), width along +Y, height along +Z
    pw, ph = 0.42, 0.56; xf = XL + 0.0205
    me = bpy.data.meshes.new('art_print')
    me.from_pydata([(xf, yc - pw / 2, zc + 0.01 - ph / 2), (xf, yc + pw / 2, zc + 0.01 - ph / 2), (xf, yc + pw / 2, zc + 0.01 + ph / 2), (xf, yc - pw / 2, zc + 0.01 + ph / 2)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new().data
    for li, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv[li].uv = (u, v)
    pl = link(bpy.data.objects.new('art_print', me)); pl.data.materials.append(m)

def table(M):
    cx, cy, r = -0.32, 2.6, 0.4
    cyl('table_top', r, 0.035, (cx, cy, 0.437), M['oak'], verts=96, bevel=0.006)
    for k in range(4):
        a = math.radians(45 + 90 * k); px, py = cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55
        leg = cyl('table_leg', 0.018, 0.43, (px + math.cos(a) * 0.03, py + math.sin(a) * 0.03, 0.21), M['oak'], verts=24, r2=0.024)
        leg.rotation_euler = (math.radians(-6) * math.sin(a), math.radians(6) * math.cos(a), 0)
    lathe('table_vase', [(0.0, 0), (0.05, 0.002), (0.075, 0.06), (0.07, 0.14), (0.04, 0.21), (0.028, 0.245), (0.03, 0.255), (0.024, 0.255)], (cx - 0.03, cy + 0.02, 0.455), M['glaze'])
    lathe('table_bowl', [(0.0, 0.0), (0.03, 0.002), (0.065, 0.025), (0.075, 0.045), (0.07, 0.046), (0.06, 0.03), (0.0, 0.012)], (cx + 0.2, cy - 0.12, 0.455), M['glaze'])

def armchair(M):
    x0, x1, y0, y1 = 0.24, 1.13, 3.5, 4.3
    for xx in (x0 + 0.07, x1 - 0.07):
        for yy in (y0 + 0.07, y1 - 0.07): cyl('chair_leg', 0.016, 0.16, (xx, yy, 0.08), M['oak'], verts=24, r2=0.012)
    box('chair_base', (x1 - x0, y1 - y0, 0.24), ((x0 + x1) / 2, (y0 + y1) / 2, 0.28), M['linen'], bevel=0.03, seg=4)
    for xx in (x0 + 0.08, x1 - 0.08): box('chair_arm', (0.16, y1 - y0, 0.26), (xx, (y0 + y1) / 2, 0.52), M['linen'], bevel=0.05, seg=5)
    box('chair_back', (x1 - x0, 0.18, 0.5), ((x0 + x1) / 2, y1 - 0.09, 0.65), M['linen'], bevel=0.05, seg=5)
    box('chair_seat', (x1 - x0 - 0.32, y1 - y0 - 0.2, 0.13), ((x0 + x1) / 2, (y0 + y1) / 2 - 0.08, 0.46), M['linen'], bevel=0.035, seg=4, subsurf=1)
    box('chair_cushion', (x1 - x0 - 0.36, 0.14, 0.34), ((x0 + x1) / 2, y1 - 0.24, 0.69), M['linen'], bevel=0.05, seg=4, subsurf=2, rot=(math.radians(-10), 0, 0))
    box('chair_throw', (0.3, 0.55, 0.02), (x0 + 0.12, (y0 + y1) / 2 - 0.05, 0.66), M['throw'], bevel=0.008, seg=2, subsurf=1, rot=(0, math.radians(18), 0))

def tv_unit(M):
    x0, x1, y0, y1, z0, z1 = XR - 0.42, XR, 1.5, 4.07, 0.2, 0.6
    box('tv_unit', (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), M['oak'], bevel=0.004)
    n = 4; L = (y1 - y0) / n
    for i in range(n):
        yc = y0 + L * (i + 0.5)
        if i == 2:
            box('tv_niche', (0.02, L * 0.62, 0.17), (x0 - 0.001, yc, (z0 + z1) / 2 - 0.02), M['tvbody'], bevel=0.002)
        box('tv_seam', (0.004, 0.003, z1 - z0 - 0.02), (x0 - 0.0015, y0 + L * i, (z0 + z1) / 2), M['tvbody'], bevel=0) if i else None
    strip = emit_mat('led_strip', 5, kelvin(WARM), 25.0)
    box('led_strip', (0.012, y1 - y0 - 0.06, 0.004), (x1 - 0.05, (y0 + y1) / 2, z0 - 0.003), strip, bevel=0)
    add_light('led_area', 'AREA', (x1 - 0.06, (y0 + y1) / 2, z0 - 0.01), 5, 55, area=(0.03, y1 - y0 - 0.06))   # faces down
    box('tv_body', (0.045, 1.42, 0.82), (XR - 0.03, 2.95, 1.415), M['tvbody'], bevel=0.004)
    box('tv_screen', (0.004, 1.38, 0.78), (XR - 0.054, 2.95, 1.415), M['tv'], bevel=0)
    lathe('tv_vase_a', [(0.0, 0), (0.05, 0.002), (0.085, 0.09), (0.08, 0.2), (0.045, 0.3), (0.03, 0.34), (0.034, 0.35), (0.026, 0.35)], (XR - 0.2, 3.02, z1), M['glaze'])
    lathe('tv_vase_b', [(0.0, 0), (0.045, 0.002), (0.075, 0.07), (0.07, 0.16), (0.04, 0.24), (0.03, 0.27), (0.022, 0.27)], (XR - 0.2, 3.22, z1), M['glaze'])

def lights(M):
    # 1 downlights: recessed trims and a soft beam
    trim = mat_plain('downlight_trim', '#e9e5de', rough=0.35, metal=0.3)
    lens = emit_mat('downlight_lens', 1, kelvin(WARM), 40.0)
    for x in (-1.0, 1.0):
        for y in (0.3, 2.24, 4.17):
            lathe('downlight_trim', [(0.045, 0), (0.05, -0.006), (0.04, -0.006), (0.036, 0.01)], (x, y, ZC), trim)
            cyl('downlight_lens', 0.035, 0.002, (x, y, ZC - 0.004), lens, verts=32)
            add_light('downlight', 'SPOT', (x, y, ZC - 0.012), 1, 32, size=0.035, spot=110, blend=0.9)
    # 2 pendant over the table
    cx, cy = -0.32, 2.6
    lathe('pendant_canopy', [(0.0, 0), (0.06, 0), (0.06, -0.02), (0.0, -0.02)], (cx, cy, ZC), M['shade'])
    tube('pendant_cord', [Vector((cx, cy, ZC - 0.02)), Vector((cx, cy, 2.12))], 0.002, M['black'])
    prof = [(0.02, 0.26), (0.06, 0.25), (0.16, 0.19), (0.24, 0.09), (0.275, 0.0)]
    lathe('pendant_shade', [(r, z) for r, z in prof], (cx, cy, 1.86), M['shade'], solidify=0.003)
    diff = emit_mat('pendant_diffuser', 2, kelvin(WARM), 6.0, base='#f8f4ee', rough=0.7)
    cyl('pendant_diffuser', 0.255, 0.003, (cx, cy, 1.87), diff, verts=64)
    add_light('pendant_bulb', 'POINT', (cx, cy, 1.98), 2, 45, size=0.06)
    add_light('pendant_down', 'SPOT', (cx, cy, 1.88), 2, 30, size=0.2, spot=120, blend=1.0)
    # 3 sconces: frosted cylinders washing the wall up and down
    shade = emit_mat('sconce_glass', 3, kelvin(WARM), 9.0, base='#f6f1e8', rough=0.6)
    for (x, y, z, sgn) in [(XL, 3.47, 1.67, 1), (XR, 4.34, 1.65, -1)]:
        box('sconce_plate', (0.012, 0.03, 0.09), (x + sgn * 0.006, y, z), M['black'], bevel=0.002)
        box('sconce_arm', (0.06, 0.01, 0.01), (x + sgn * 0.04, y, z), M['black'], bevel=0.002)
        cyl('sconce_shade', 0.045, 0.16, (x + sgn * 0.085, y, z), shade, verts=48)
        add_light('sconce_up', 'SPOT', (x + sgn * 0.085, y, z + 0.06), 3, 14, size=0.03, spot=75, blend=0.8, rot=(0, 0, 0))
        GROUP_LIGHTS[3][-1].rotation_euler = (math.pi, 0, 0)
        add_light('sconce_down', 'SPOT', (x + sgn * 0.085, y, z - 0.06), 3, 14, size=0.03, spot=75, blend=0.8)
        add_light('sconce_core', 'POINT', (x + sgn * 0.085, y, z), 3, 4, size=0.03)
    # 4 arc lamp behind the sofa end
    bx, by = -1.48, 3.25
    cyl('arc_base', 0.16, 0.035, (bx, by, 0.0175), M['marble'], verts=64, bevel=0.006)
    tube('arc_pole', [Vector((bx, by, 0.03)), Vector((bx + 0.02, by - 0.02, 1.4)), Vector((bx + 0.25, by - 0.08, 2.02)), Vector((-0.78, 3.02, 2.08)), Vector((-0.55, 2.97, 1.8))], 0.011, M['bronze'])
    lathe('arc_shade', [(0.02, 0.17), (0.09, 0.15), (0.16, 0.1), (0.2, 0.04), (0.21, 0.0)], (-0.55, 2.97, 1.6), mat_plain('arc_shade', '#ece8e1', rough=0.35, coat=0.3), solidify=0.003)
    arcd = emit_mat('arc_diffuser', 4, kelvin(WARM), 5.0, base='#f8f4ee', rough=0.7)
    cyl('arc_diffuser', 0.19, 0.003, (-0.55, 2.97, 1.61), arcd, verts=64)
    add_light('arc_bulb', 'POINT', (-0.55, 2.97, 1.7), 4, 30, size=0.05)
    add_light('arc_down', 'SPOT', (-0.55, 2.97, 1.62), 4, 22, size=0.15, spot=110, blend=1.0)

def world():
    w = bpy.data.worlds.new('dusk'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    try:
        env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(ph_hdri('belfast_sunset_puresky', '2k'))
        mp = nt.nodes.new('ShaderNodeMapping'); tc = nt.nodes.new('ShaderNodeTexCoord')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(200))
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    except Exception as e:
        log('hdri skipped', e); bg.inputs['Color'].default_value = (0.08, 0.06, 0.09, 1)
    bg.inputs['Strength'].default_value = 0.35

# ---------------------------------------------------------------- cameras and states
def camera_for(frame, level):
    g = ROOM[frame]; lv = g['levels'][level]
    cam = bpy.data.objects.get('room_cam')
    if cam is None:
        cam = link(bpy.data.objects.new('room_cam', bpy.data.cameras.new('room_cam'))); bpy.context.scene.camera = cam
    c = g['cam']; R = Matrix((c['right'], c['up'], c['back'])).transposed()
    cam.matrix_world = Matrix.Translation(Vector(c['pos'])) @ R.to_4x4()
    tx0, tx1, ty0, ty1 = g['tan']; x0, y0, x1, y1 = lv['region']
    l, r = tx0 + x0 * (tx1 - tx0), tx0 + x1 * (tx1 - tx0)
    t, b = ty1 - y0 * (ty1 - ty0), ty1 - y1 * (ty1 - ty0)
    sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = lv['px']; sc.render.resolution_percentage = 100
    d = cam.data; d.type = 'PERSP'; d.sensor_fit = 'HORIZONTAL'; d.sensor_width = 36.0
    d.lens = 36.0 / (r - l); d.clip_start = 0.03; d.clip_end = 60
    # with a horizontal sensor fit Blender measures shift in frame widths (BKE_camera_params_compute_viewplane)
    d.shift_x = ((l + r) / 2) / (r - l); d.shift_y = ((t + b) / 2) / (r - l)
    return cam, (l, r, t, b)

def check_alignment():
    out = {}
    for f in ('d', 'p'):
        g = ROOM[f]; bp = Vector(g['board']['pos']) + Vector(g['board']['normal']) * 0.007   # plate front face, as the 3D board
        for li, lv in enumerate(g['levels']):
            cam, _ = camera_for(f, li); bpy.context.view_layer.update()
            v = world_to_camera_view(bpy.context.scene, cam, bp)
            x0, y0, x1, y1 = lv['region']; cx, cy = g['board']['centre']
            want = ((cx - x0) / (x1 - x0), (cy - y0) / (y1 - y0))
            got = (v.x, 1 - v.y); W, H = lv['px']
            err = math.hypot((got[0] - want[0]) * W, (got[1] - want[1]) * H)
            out[f'{f}-l{li}'] = round(err, 3); log(f'{f}-l{li} board px error {err:.3f}  got {got[0]:.4f},{got[1]:.4f} want {want[0]:.4f},{want[1]:.4f}')
    return out

def set_state(s):
    for g in range(1, 6):
        on = g <= s
        for o in GROUP_LIGHTS[g]: o.hide_render = not on
        for b, k in GROUP_EMIT[g]: inp(b, 'Emission Strength').default_value = k if on else 0.0
    glow = bpy.data.materials.get('switch_dot_on') or mat_plain('switch_dot_on', '#fff3e0', rough=0.4, emit=kelvin(3000), emit_strength=12.0)
    off = bpy.data.materials['switch_dot_off']
    for i, (piv, dot) in enumerate(zip(ROCKERS, DOTS)):
        on = i < s; piv.rotation_euler = (0, math.radians(9.7 if on else -9.7), 0)
        dot.data.materials[0] = glow if on else off

def jobs():
    if JOBS == 'all': return [(f, l, s) for f in ('d', 'p') for l in range(4) for s in range(6)]
    out = []
    for j in JOBS.split(','):
        f, l, s = j.split('-'); out.append((f, int(l[1:]), int(s)))
    return out

# ---------------------------------------------------------------- main
t0 = time.time()
sc = reset(); build(); bpy.context.view_layer.update()
log('built in %.1fs; objects %d' % (time.time() - t0, len(bpy.data.objects)))
if MODE == 'check':
    json.dump(check_alignment(), open(os.path.join(OUT, 'alignment.json'), 'w'), indent=1)
    camera_for('d', 0); set_state(5)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room.blend'))
    log('saved', os.path.join(OUT, 'room.blend'))
else:
    sub = os.path.join(OUT, 'preview' if MODE == 'preview' else 'final'); os.makedirs(sub, exist_ok=True)
    errs = check_alignment()
    for f, l, s in jobs():
        name = f"{f}-l{l}-{s}"; path = os.path.join(sub, name + '.png')
        if MODE == 'final' and os.path.exists(path): log('skip', name); continue
        camera_for(f, l); set_state(s)
        if MODE == 'preview': sc.render.resolution_percentage = 50
        t1 = time.time(); sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        log('rendered %s in %.1fs' % (name, time.time() - t1))
log('done in %.1fs' % (time.time() - t0))
