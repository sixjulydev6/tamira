"""Denoise baked HDR lightmaps with Blender's OIDN (compositor Denoise node), keeping them HDR.

  Blender -b --factory-startup --python denoise_lightmaps.py -- <out_dir> <lm-0.hdr> …

Writes <out_dir>/<name>.hdr. Empty atlas texels stay black; the bake's 12 px margins keep the filter
from mixing neighbouring islands at their edges.
"""
import bpy, os, sys
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, FILES = argv[0], argv[1:]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'HDR'
# Blender 5: the compositor is a node group assigned to the scene
tree = bpy.data.node_groups.new('denoise', 'CompositorNodeTree')
if hasattr(sc, 'compositing_node_group'): sc.compositing_node_group = tree
else: sc.use_nodes = True; tree = sc.node_tree
for n in list(tree.nodes): tree.nodes.remove(n)
img = tree.nodes.new('CompositorNodeImage'); dn = tree.nodes.new('CompositorNodeDenoise')
try: dn.prefilter = 'ACCURATE'
except Exception: pass
for k in ('use_hdr',):
    if hasattr(dn, k): setattr(dn, k, True)
if 'HDR' in dn.inputs: dn.inputs['HDR'].default_value = True
try:
    out = tree.nodes.new('NodeGroupOutput'); tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    tree.links.new(dn.outputs[0], out.inputs[0])
except Exception:
    out = tree.nodes.new('CompositorNodeComposite'); tree.links.new(dn.outputs[0], out.inputs[0])
tree.links.new(img.outputs['Image'], dn.inputs['Image'])
sc.render.use_compositing = True
for f in FILES:
    im = bpy.data.images.load(f); img.image = im
    sc.render.resolution_x, sc.render.resolution_y = im.size; sc.render.resolution_percentage = 100
    sc.render.filepath = os.path.join(OUT, os.path.basename(f))
    bpy.ops.render.render(write_still=True)
    print('[denoise]', os.path.basename(f), im.size[0], flush=True)
