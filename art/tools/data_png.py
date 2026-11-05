"""Lossless file transfer through images (the team-Blender link only carries pictures).

  blender -b --factory-startup --python data_png.py -- pack   <out_dir> <file> [<file> ...]
  blender -b --factory-startup --python data_png.py -- unpack <out_dir> <png> [<png> ...]    (pngs in order)

pack writes data-000.png, data-001.png, …: 8-bit RGB images (at most 1900×1900, under the MCP `look`
limit) whose bytes are a stream of records: b'TDP1', name length (u16), name, size (u64), sha256 (32 bytes),
then the file. unpack concatenates the images in order, rebuilds every file and refuses any whose sha256
doesn't match. Pixels are read and written in Blender's own buffer order on both ends.
"""
import bpy, hashlib, os, struct, sys
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
MODE, OUT, FILES = argv[0], argv[1], argv[2:]
os.makedirs(OUT, exist_ok=True)
W = 1900
CAP = W * W * 3

def pack():
    stream = bytearray()
    for f in FILES:
        data = open(f, 'rb').read(); name = os.path.basename(f).encode()
        stream += b'TDP1' + struct.pack('<H', len(name)) + name + struct.pack('<Q', len(data)) + hashlib.sha256(data).digest() + data
        print('[pack]', os.path.basename(f), len(data), hashlib.sha256(data).hexdigest()[:16], flush=True)
    stream += b'TEND'
    for i in range(0, len(stream), CAP):
        chunk = bytes(stream[i:i + CAP]); rows = max(1, -(-len(chunk) // (W * 3)))
        buf = np.zeros(W * rows * 3, np.uint8); buf[:len(chunk)] = np.frombuffer(chunk, np.uint8)
        rgba = np.ones((W * rows, 4), np.float32); rgba[:, :3] = buf.reshape(-1, 3) / 255.0
        im = bpy.data.images.new('data', W, rows, alpha=False, float_buffer=False)
        im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(rgba.ravel())
        path = os.path.join(OUT, 'data-%03d.png' % (i // CAP)); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
        print('[pack] image', os.path.basename(path), W, rows, flush=True)

def unpack():
    stream = bytearray()
    for f in FILES:
        im = bpy.data.images.load(f); im.colorspace_settings.name = 'Non-Color'
        px = np.empty(im.size[0] * im.size[1] * 4, np.float32); im.pixels.foreach_get(px)
        stream += np.rint(px.reshape(-1, 4)[:, :3] * 255).astype(np.uint8).tobytes()
    p, ok = 0, True
    while stream[p:p + 4] == b'TDP1':
        n = struct.unpack('<H', stream[p + 4:p + 6])[0]; name = stream[p + 6:p + 6 + n].decode(); p += 6 + n
        size = struct.unpack('<Q', stream[p:p + 8])[0]; sha = bytes(stream[p + 8:p + 40]); p += 40
        data = bytes(stream[p:p + size]); p += size
        good = hashlib.sha256(data).digest() == sha; ok &= good
        if good: open(os.path.join(OUT, name), 'wb').write(data)
        print('[unpack]', name, size, 'sha ok' if good else 'SHA MISMATCH', flush=True)
    print('[unpack]', 'all files verified' if ok and stream[p:p + 4] == b'TEND' else 'INCOMPLETE OR CORRUPT', flush=True)

pack() if MODE == 'pack' else unpack()
