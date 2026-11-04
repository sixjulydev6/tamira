// Surfaces for the finale's wall, drawn once on canvases from seeded noise, so there are no image
// files to load and every visit looks the same. Three looks:
//   front: a painted wall, an even colour with the faint stipple a roller leaves
//   back:  sand-faced cement plaster, rougher and more uneven, the side nobody is meant to see
//   cut:   the wall's cross-section where the sample is cut and the box is set in: plaster on both
//          faces, a cement core with sand and grit through it, and the paint as a thin line on the front
// Each face gets a colour map that spans the whole face (large, soft unevenness that never repeats)
// and a small repeating bump tile for the fine grain that catches the light.

import * as THREE from 'three';

// Small seeded generator (mulberry32)
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Tiling value noise, 0..1 as grey, built by the canvas itself: each octave is a small grid of random
// greys, stretched smooth over the tile (the pattern wraps, so the tile does too) and averaged in at a
// weight that halves (by `gain`) each time the grid doubles. Native drawing, so it costs next to nothing.
function noiseCanvas(S, cells, octaves, r, gain = 0.5) {
  const c = canvas(S, S), g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = Math.min(S, cells << o);
    const grid = canvas(n, n), gg = grid.getContext('2d');
    const img = gg.createImageData(n, n), d = img.data;
    for (let i = 0; i < n * n; i++) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = (r() * 256) | 0;
      d[i * 4 + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
    // A running weighted average: this octave's share of everything so far
    total += amp;
    g.globalAlpha = amp / total;
    const pat = g.createPattern(grid, 'repeat');
    pat.setTransform(new DOMMatrix().scale(S / n));
    g.fillStyle = pat;
    g.fillRect(0, 0, S, S);
    amp *= gain;
  }
  g.globalAlpha = 1;
  return c;
}

// Specks of sand and grit, wrapping round the tile's edges so it still tiles
function specks(g, size, count, r, { rMin, rMax, colours, wrapY = true }) {
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = rMin + (rMax - rMin) * r() * r();
    g.fillStyle = colours[(r() * colours.length) | 0];
    for (const dx of [-size, 0, size]) {
      for (const dy of wrapY ? [-size, 0, size] : [0]) {
        const px = x + dx, py = y + dy;
        if (px < -rad || px > size + rad || py < -rad || py > size + rad) continue;
        g.beginPath();
        g.ellipse(px, py, rad, rad * (0.6 + 0.4 * r()), r() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

// A texture from a canvas, set up by `setup` and then sent to the GPU now rather than mid-scroll
function texture(c, renderer, colour, setup) {
  const t = new THREE.CanvasTexture(c);
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  setup(t);
  renderer.initTexture(t);
  return t;
}

// Noise shared by every surface, worked out once per size: a fine grain that every bump tile and
// every sand overlay is cut from, and small soft patches that get stretched smooth
const shared = new Map();
const once = (key, make) => { if (!shared.has(key)) shared.set(key, make()); return shared.get(key); };
const grainCanvas = (S) => once('grain' + S, () => noiseCanvas(S, Math.round(32 * S / 512), 3, seeded(7), 0.55));
const patchCanvas = (seed) => once('patch' + seed, () => noiseCanvas(128, 3, 4, seeded(seed), 0.55));

// Lay the shared grain over a canvas, at `scale` of its own size, blended soft-light
function overlayGrain(g, W, H, S, scale, alpha) {
  const pat = g.createPattern(grainCanvas(S), 'repeat');
  pat.setTransform(new DOMMatrix().scale(scale));
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = alpha;
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// One smooth periodic line of noise, 0..1, for edges that wander
function wander(n, cells, r) {
  const g = Array.from({ length: cells }, r), out = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    const f = (x * cells) / n, i = f | 0, t = f - i, s = t * t * (3 - 2 * t);
    out[x] = g[i % cells] + (g[(i + 1) % cells] - g[i % cells]) * s;
  }
  return out;
}

// The colour map for a whole face: soft patches stretched over it, under a finer grain.
// strength: how uneven the face is. Values sit at or just under 1 so the material colour sets the tone.
function faceMap(renderer, { w, h, strength, grain, seed, lite }) {
  const W = lite ? 512 : 1024, H = Math.round(W * h / w), S = lite ? 256 : 512;
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = strength;
  g.drawImage(patchCanvas(seed), 0, 0, W, H);
  overlayGrain(g, W, H, S, (W / 1024) * (512 / S) * 0.5, grain);
  // Face UVs are in wall units, centred on the wall: stretch the map over the whole face
  return texture(c, renderer, true, (t) => {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / w, 1 / h);
    t.offset.set(0.5, 0.5);
  });
}

// A repeating bump tile cut from the shared grain, with grit specks if `sand` is set.
// units: how many UV units one tile spans (a bigger tile means a coarser grain).
export function bumpTile(renderer, { sand = 0, seed = 1, lite, units }) {
  const S = lite ? 256 : 512;
  let c = grainCanvas(S);
  if (sand) {
    const own = canvas(S, S), g = own.getContext('2d');
    g.drawImage(c, 0, 0);
    const k = S / 512;
    specks(g, S, Math.round(sand * k * k), seeded(seed), { rMin: 0.6 * k, rMax: 2.6 * k, colours: ['#e0e0e0', '#f0f0f0', '#202020', '#3a3a3a'] });
    c = own;
  }
  return texture(c, renderer, false, (t) => t.repeat.set(1 / units, 1 / units));
}

// The cross-section: rows run front to back through the wall's depth (top row is the back face,
// bottom row the front), columns run along the cut and repeat every `units` wall units.
function cutMaps(renderer, { depth, units, seed, lite }) {
  const r = seeded(seed);
  const S = lite ? 256 : 512;
  const px = S / depth; // pixels per wall unit, through the depth
  const col = canvas(S, S), cg = col.getContext('2d');
  const bump = canvas(S, S), bg = bump.getContext('2d');
  // The layer edges wander a little, as hand-laid plaster does
  const wobBack = wander(S, 7, r), wobFront = wander(S, 9, r);
  const backSkin = (x) => 0.42 * px + (wobBack[x] - 0.5) * 0.2 * px;
  const frontSkin = (x) => (depth - 0.36) * px + (wobFront[x] - 0.5) * 0.16 * px;
  const paint = Math.max(1, Math.round(0.05 * px));
  // Base layers, one column at a time
  for (let x = 0; x < S; x++) {
    const b = backSkin(x), f = frontSkin(x);
    cg.fillStyle = '#7a756e'; cg.fillRect(x, 0, 1, b);           // back plaster
    cg.fillStyle = '#69655f'; cg.fillRect(x, b, 1, f - b);       // cement core
    cg.fillStyle = '#86817a'; cg.fillRect(x, f, 1, S - f);       // front plaster and putty
    cg.fillStyle = '#9b968f'; cg.fillRect(x, S - paint, 1, paint); // paint
    bg.fillStyle = '#7a7a7a'; bg.fillRect(x, 0, 1, b);
    bg.fillStyle = '#6a6a6a'; bg.fillRect(x, b, 1, f - b);
    bg.fillStyle = '#808080'; bg.fillRect(x, f, 1, S - f);
  }
  // Soft unevenness through everything, then a fine sand grain
  cg.imageSmoothingEnabled = true;
  cg.imageSmoothingQuality = 'high';
  cg.globalCompositeOperation = 'soft-light';
  cg.globalAlpha = 0.35;
  cg.drawImage(patchCanvas(seed), 0, 0, S, S);
  cg.globalAlpha = 1;
  cg.globalCompositeOperation = 'source-over';
  overlayGrain(cg, S, S, S, 0.25, 0.2);
  overlayGrain(bg, S, S, S, 0.5, 0.9);
  // Sand and grit in the core: the same specks in colour and in relief
  const k = S / 512;
  const seedSpecks = Math.floor(r() * 1e9);
  const core = (g, colours) => {
    g.save();
    g.beginPath();
    g.moveTo(0, backSkin(0));
    for (let x = 0; x < S; x += 4) g.lineTo(x, backSkin(x));
    g.lineTo(S, backSkin(0));
    g.lineTo(S, frontSkin(0));
    for (let x = S - 4; x >= 0; x -= 4) g.lineTo(x, frontSkin(x));
    g.closePath();
    g.clip();
    specks(g, S, Math.round(2000 * k * k), seeded(seedSpecks), { rMin: 0.6 * k, rMax: 3.4 * k, colours, wrapY: false });
    g.restore();
  };
  // Mostly grains a shade either side of the cement, the odd lighter chip of stone
  core(cg, ['#5d5953', '#605c56', '#56524d', '#726d66', '#77726b', '#5a5651', '#837e76']);
  core(bg, ['#8c8c8c', '#969696', '#a0a0a0', '#505050', '#5a5a5a', '#929292', '#a8a8a8']);
  // Side UVs: u runs along the cut in wall units; v runs from 1 at the back face to 1 - depth at the
  // front. Map that span onto the canvas exactly once.
  const setup = (t) => {
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / units, 1 / depth);
    t.offset.set(0, (depth - 1) / depth);
  };
  return { map: texture(col, renderer, true, setup), bumpMap: texture(bump, renderer, false, setup) };
}

// The three wall materials, ready for the extruded slab: [back face, front face, cut faces]
export function wallMaterials(renderer, { w, h, d, lite }) {
  const back = new THREE.MeshStandardMaterial({
    color: '#827d76', roughness: 0.95, metalness: 0,
    map: faceMap(renderer, { w, h, strength: 0.24, grain: 0.6, seed: 11, lite }),
    bumpMap: bumpTile(renderer, { sand: 2600, seed: 12, lite, units: 2 }),
    bumpScale: 1.8
  });
  const front = new THREE.MeshStandardMaterial({
    color: '#7c7770', roughness: 0.9, metalness: 0,
    map: faceMap(renderer, { w, h, strength: 0.07, grain: 0.3, seed: 21, lite }),
    bumpMap: bumpTile(renderer, { lite, units: 2.9 }),
    bumpScale: 0.5
  });
  const cut = cutMaps(renderer, { depth: d, units: 6, seed: 31, lite });
  const side = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0, map: cut.map, bumpMap: cut.bumpMap, bumpScale: 1.4 });
  const textures = [back.map, back.bumpMap, front.map, front.bumpMap, cut.map, cut.bumpMap];
  return { back, front, side, textures };
}
