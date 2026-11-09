import * as THREE from "three";

/* ------------------------------------------------------------------
   Single-core house wire: a red HR-FR-LSH jacket around 30 copper strands.
   The wire follows a path (CatmullRom through a few control points). Geometry
   is a straight tube bent onto the path on the CPU each time the scroll moves,
   so the path can morph (enter, bend, wave) without baked animation.
   Units: jacket radius = 1.
   ------------------------------------------------------------------ */

const R_JACKET = 1.0;
const R_CORE = 0.8;
const R_STRAND = 0.115;
const SAMPLES = 420;           // arc-length samples of the path
const JACKET_SEG = 260, JACKET_RAD = 36;
const STRAND_SEG = 150, STRAND_RAD = 10;   // round strands, not faceted bands
const TEXT_REPEAT = 13;        // world units per repeat of the printed legend

// 30 strands in concentric layers: 1 + 6 + 11 + 12
const STRAND_LAYOUT = (() => {
  const out = [[0, 0]];
  for (const [r, n, phase] of [[0.26, 6, 0], [0.5, 11, 0.3], [0.71, 12, 0.1]])
    for (let i = 0; i < n; i++) { const a = phase + (i / n) * Math.PI * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
})();
// Drawn copper is never perfectly uniform: each strand gets its own gauge (±6%) and tone (bright to
// slightly oxidised), so the bundle reads as many round wires instead of one striped surface.
const STRAND_LOOK = STRAND_LAYOUT.map((_, s) => {
  const h = (k) => { const x = Math.sin((s + 1) * 91.7 + k * 17.3) * 43758.5453; return x - Math.floor(x); };
  return { r: R_STRAND * (0.94 + h(1) * 0.12), tone: 0.84 + h(2) * 0.26, warm: h(3) * 0.08 };
});

export class Wire {
  constructor({ color = "#c21d19", capColor = "#d2453c", ink = "rgba(255, 232, 224, 0.62)", envMapIntensity = 0.7, detail = 1 } = {}) {
    // detail < 1: fewer rings/sides (the bundle's blue/green cores: small on screen, rebuilt every frame of the reveal)
    this.jSeg = Math.round(JACKET_SEG * detail); this.jRad = Math.max(12, Math.round(JACKET_RAD * detail));
    this.sSeg = Math.round(STRAND_SEG * detail); this.sRad = Math.max(6, Math.round(STRAND_RAD * detail));
    this.group = new THREE.Group();
    this.samples = null;
    this.length = 1;
    this.params = { head: 1, strip: 3.2, fan: 0, glow: 0, cut: 0, cutAt: 0, heat: 0, heatAt: 0, char: 0, charAt: 0, twist: 0.9 };

    this.jacketUniforms = {
      uCutA: { value: 0 }, uCutB: { value: 0 }, uCut: { value: 0 },
      uHeat: { value: 0 }, uHeatAt: { value: 0 },
      uChar: { value: 0 }, uCharAt: { value: 0 },
    };

    // jacket
    this.jacketGeo = tubeGeometry(this.jSeg, this.jRad);
    const jacketMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: legendTexture(color, ink), roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity,
      side: THREE.DoubleSide,
    });
    jacketMat.onBeforeCompile = (shader) => patchJacket(shader, this.jacketUniforms);
    this.jacket = new THREE.Mesh(this.jacketGeo, jacketMat);
    this.jacket.frustumCulled = false;
    this.group.add(this.jacket);

    // cut face of the jacket where it was stripped
    this.cap = new THREE.Mesh(new THREE.RingGeometry(R_CORE + 0.02, R_JACKET, 48, 1),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.6, side: THREE.DoubleSide }));
    this.group.add(this.cap);

    // copper
    this.strandUniforms = { uGlow: { value: 0 } };
    this.strandGeo = strandsGeometry(this.sSeg, this.sRad);
    const copper = new THREE.MeshStandardMaterial({ color: 0xd08a5a, metalness: 1, roughness: 0.26, emissive: 0x000000, vertexColors: true });
    copper.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.strandUniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform float uGlow;\nvoid main() {")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.5, 0.16) * uGlow * 2.2;   // ember glow (was cyan)");
    };
    this.strands = new THREE.Mesh(this.strandGeo, copper);
    this.strands.frustumCulled = false;
    this.group.add(this.strands);
  }

  /** points: THREE.Vector3[] control points, in order from tail to tip.
      facing: the side the printed legend should face (default +Z, toward the product camera). */
  setPath(points, facing = UP_Z) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    const pts = curve.getSpacedPoints(SAMPLES);
    this.length = curve.getLength();
    // parallel-transport frames, starting with the binormal on the facing side so the legend faces us
    const T = [], N = [], B = [];
    let b = facing.clone();
    for (let i = 0; i <= SAMPLES; i++) {
      const t = pts[Math.min(i + 1, SAMPLES)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
      const n = new THREE.Vector3().crossVectors(b, t).normalize();
      b = new THREE.Vector3().crossVectors(t, n).normalize();
      T.push(t); N.push(n); B.push(b);
    }
    this.samples = { pts, T, N, B };
  }

  /** frame at arc distance d (world units from the path start); extrapolates past both ends */
  frameAt(d, out) {
    const { pts, T, N, B } = this.samples;
    const f = (d / this.length) * SAMPLES;
    if (f <= 0) { out.p.copy(pts[0]).addScaledVector(T[0], d); out.t.copy(T[0]); out.n.copy(N[0]); out.b.copy(B[0]); return out; }
    if (f >= SAMPLES) { out.p.copy(pts[SAMPLES]).addScaledVector(T[SAMPLES], d - this.length); out.t.copy(T[SAMPLES]); out.n.copy(N[SAMPLES]); out.b.copy(B[SAMPLES]); return out; }
    const i = Math.floor(f), k = f - i;
    out.p.lerpVectors(pts[i], pts[i + 1], k);
    out.t.lerpVectors(T[i], T[i + 1], k).normalize();
    out.n.lerpVectors(N[i], N[i + 1], k).normalize();
    out.b.lerpVectors(B[i], B[i + 1], k).normalize();
    return out;
  }

  /** arc distance of the tip, and where the jacket ends */
  get headDist() { return this.params.head * this.length; }
  get jacketEnd() { return this.headDist - this.params.strip; }

  /** world position on the jacket surface (angle 90° faces the camera) */
  surfacePoint(d, angle = Math.PI / 2, radius = R_JACKET) {
    const f = this.frameAt(d, tmpFrame());
    return f.p.clone().addScaledVector(f.n, Math.cos(angle) * radius).addScaledVector(f.b, Math.sin(angle) * radius);
  }

  update() {
    if (!this.samples) return;
    const P = this.params;
    const head = this.headDist, jEnd = this.jacketEnd;
    const tail = head - (P.tailLen ?? this.length + 30);    // long enough to run off-screen behind
    const fr = tmpFrame();
    const JACKET_SEG = this.jSeg, JACKET_RAD = this.jRad, STRAND_SEG = this.sSeg, STRAND_RAD = this.sRad;

    // jacket: tail → jacket end, segments packed toward the tip where the camera gets close
    {
      const pos = this.jacketGeo.attributes.position.array, nor = this.jacketGeo.attributes.normal.array, uv = this.jacketGeo.attributes.uv.array;
      let v = 0;
      for (let i = 0; i <= JACKET_SEG; i++) {
        const d = jEnd - (jEnd - tail) * Math.pow(1 - i / JACKET_SEG, 2.2);
        this.frameAt(d, fr);
        for (let j = 0; j <= JACKET_RAD; j++) {
          const a = (j / JACKET_RAD) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          const nx = fr.n.x * c + fr.b.x * s, ny = fr.n.y * c + fr.b.y * s, nz = fr.n.z * c + fr.b.z * s;
          pos[v * 3] = fr.p.x + nx * R_JACKET; pos[v * 3 + 1] = fr.p.y + ny * R_JACKET; pos[v * 3 + 2] = fr.p.z + nz * R_JACKET;
          nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
          uv[v * 2] = (head - d) / TEXT_REPEAT; uv[v * 2 + 1] = j / JACKET_RAD;
          v++;
        }
      }
      this.jacketGeo.attributes.position.needsUpdate = true;
      this.jacketGeo.attributes.normal.needsUpdate = true;
      this.jacketGeo.attributes.uv.needsUpdate = true;
    }

    // cap at the jacket end
    this.frameAt(jEnd, fr);
    this.cap.position.copy(fr.p);
    this.cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fr.t);

    // strands: tail → tip, fanning out past the jacket
    {
      const pos = this.strandGeo.attributes.position.array, nor = this.strandGeo.attributes.normal.array;
      let v = 0;
      const coreTail = Math.max(tail, jEnd - 30);   // strands only need to exist near where they show
      for (let s = 0; s < STRAND_LAYOUT.length; s++) {
        const [ox0, oy0] = STRAND_LAYOUT[s];
        const rs = STRAND_LOOK[s].r;
        const r0 = Math.hypot(ox0, oy0), a0 = Math.atan2(oy0, ox0);
        const seed = Math.sin(s * 12.9898) * 43758.5453; const rnd = seed - Math.floor(seed);
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i <= STRAND_SEG; i++) {
          const d = coreTail + (head - coreTail) * (i / STRAND_SEG) - (s === 0 ? 0 : rnd * 0.35 * P.fan);
          this.frameAt(d, fr);
          const past = Math.max(0, (d - jEnd) / Math.max(0.01, P.strip));   // 0 inside the jacket, 1 at the tip
          const spread = 1 + P.fan * Math.pow(past, 1.5) * (1.4 + rnd * 1.2);
          // twist measured from the tip, so wires on different paths look identical at the tip
          const a = a0 + (d - head) * P.twist * 0.18 + P.fan * past * (rnd - 0.5) * 0.8;
          const ox = Math.cos(a) * r0 * R_CORE * spread, oy = Math.sin(a) * r0 * R_CORE * spread;
          cx = fr.p.x + fr.n.x * ox + fr.b.x * oy; cy = fr.p.y + fr.n.y * ox + fr.b.y * oy; cz = fr.p.z + fr.n.z * ox + fr.b.z * oy;
          for (let j = 0; j <= STRAND_RAD; j++) {
            const q = (j / STRAND_RAD) * Math.PI * 2, c = Math.cos(q), sn = Math.sin(q);
            const nx = fr.n.x * c + fr.b.x * sn, ny = fr.n.y * c + fr.b.y * sn, nz = fr.n.z * c + fr.b.z * sn;
            pos[v * 3] = cx + nx * rs; pos[v * 3 + 1] = cy + ny * rs; pos[v * 3 + 2] = cz + nz * rs;
            nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
            v++;
          }
        }
        // the cut end: a solid, slightly domed copper face (fr is still the tip frame)
        for (let j = 0; j <= STRAND_RAD; j++) {
          const q = (j / STRAND_RAD) * Math.PI * 2, c = Math.cos(q), sn = Math.sin(q);
          const nx = fr.n.x * c + fr.b.x * sn, ny = fr.n.y * c + fr.b.y * sn, nz = fr.n.z * c + fr.b.z * sn;
          pos[v * 3] = cx + nx * rs; pos[v * 3 + 1] = cy + ny * rs; pos[v * 3 + 2] = cz + nz * rs;
          nor[v * 3] = fr.t.x * 0.8 + nx * 0.6; nor[v * 3 + 1] = fr.t.y * 0.8 + ny * 0.6; nor[v * 3 + 2] = fr.t.z * 0.8 + nz * 0.6;
          v++;
        }
        pos[v * 3] = cx + fr.t.x * rs * 0.3; pos[v * 3 + 1] = cy + fr.t.y * rs * 0.3; pos[v * 3 + 2] = cz + fr.t.z * rs * 0.3;
        nor[v * 3] = fr.t.x; nor[v * 3 + 1] = fr.t.y; nor[v * 3 + 2] = fr.t.z;
        v++;
      }
      this.strandGeo.attributes.position.needsUpdate = true;
      this.strandGeo.attributes.normal.needsUpdate = true;
    }

    const U = this.jacketUniforms;
    // cutaway window, measured in legend-uv units (distance back from the tip / TEXT_REPEAT)
    U.uCut.value = P.cut;
    // cutAt / heatAt / charAt are arc distances along the path (world units)
    U.uCutA.value = (head - P.cutAt - 2.8) / TEXT_REPEAT;
    U.uCutB.value = (head - P.cutAt + 2.8) / TEXT_REPEAT;
    U.uHeat.value = P.heat; U.uHeatAt.value = (head - P.heatAt) / TEXT_REPEAT;
    U.uChar.value = P.char; U.uCharAt.value = (head - P.charAt) / TEXT_REPEAT;
    this.strandUniforms.uGlow.value = P.glow;
  }
}

const UP_Z = new THREE.Vector3(0, 0, 1);
let _frame;
function tmpFrame() {
  return (_frame ||= { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() });
}

function tubeGeometry(seg, rad) {
  const count = (seg + 1) * (rad + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);   // counter-clockwise seen from outside
    }
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity); // rebuilt every frame and never culled: no per-frame bounds walk
  return geo;
}

function strandsGeometry(STRAND_SEG, STRAND_RAD) {
  const ring = STRAND_RAD + 1, tube = (STRAND_SEG + 1) * ring, per = tube + ring + 1, n = STRAND_LAYOUT.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(per * n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(per * n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  // per-strand copper tone (static); cut faces read a touch brighter, like freshly cut metal
  const col = new Float32Array(per * n * 3);
  for (let s = 0; s < n; s++) {
    const { tone, warm } = STRAND_LOOK[s];
    for (let k = 0; k < per; k++) {
      const cut = k >= tube ? 1.12 : 1, o = (s * per + k) * 3;
      col[o] = tone * cut * (1 + warm * 0.4); col[o + 1] = tone * cut * (1 - warm * 0.5); col[o + 2] = tone * cut * (1 - warm);
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx = [];
  for (let s = 0; s < n; s++) {
    const base = s * per;
    for (let i = 0; i < STRAND_SEG; i++)
      for (let j = 0; j < STRAND_RAD; j++) {
        const a = base + i * ring + j, b = a + ring;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const r = base + tube, c = r + ring;
    for (let j = 0; j < STRAND_RAD; j++) idx.push(c, r + j, r + j + 1);
  }
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity); // rebuilt every frame and never culled: no per-frame bounds walk
  return geo;
}

/* jacket colour with the printed legend running along it; the text sits on the side facing the camera */
function legendTexture(color = "#c21d19", ink = "rgba(255, 232, 224, 0.62)") {
  const c = document.createElement("canvas");
  // proportioned like the surface it wraps: TEXT_REPEAT long by 2π·R around (≈ 2 : 1)
  c.width = 2048; c.height = Math.round(2048 * (2 * Math.PI * R_JACKET) / TEXT_REPEAT);
  const g = c.getContext("2d");
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = ink;
  g.font = "500 58px 'DM Sans', Arial, sans-serif";
  g.textBaseline = "middle";
  // uv runs tip → tail (screen-left) and around the tube downward on screen, so the legend is drawn
  // rotated 180°: it then reads left to right, upright, on the camera-facing side (v = 0.25)
  g.save(); g.translate(c.width, c.height); g.scale(-1, -1);
  const legend = "TAMIRA     1.5 SQ MM     HR-FR-LSH     1100 V     ";
  let x = 20;
  while (x < c.width) { g.fillText(legend, x, c.height / 4); x += g.measureText(legend).width; }
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

/* cutaway, heat glow and char, added to the physical material */
function patchJacket(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace("void main() {", "varying vec2 vJ;\nvoid main() {\n vJ = uv;");
  shader.fragmentShader = shader.fragmentShader
    .replace("void main() {", /* glsl */ `
      uniform float uCutA, uCutB, uCut, uHeat, uHeatAt, uChar, uCharAt;
      varying vec2 vJ;
      void main() {
        // cutaway: remove the camera-facing half of the jacket inside the window
        float ang = vJ.y * 6.2831853;
        if (uCut > 0.001 && vJ.x > uCutA && vJ.x < uCutB && sin(ang) > 1.0 - 1.15 * uCut) discard;
    `)
    .replace("#include <map_fragment>", /* glsl */ `
      #include <map_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.86, 0.42, 0.38);       // inside of the jacket
      float charK = uChar * exp(-pow((vJ.x - uCharAt) * 13.0 / 1.4, 2.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.045, 0.035), clamp(charK * 1.4, 0.0, 1.0));
    `)
    .replace("#include <emissivemap_fragment>", /* glsl */ `
      #include <emissivemap_fragment>
      float hk = uHeat * exp(-pow((vJ.x - uHeatAt) * 13.0 / (2.5 + 5.0 * uHeat), 2.0));
      totalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * hk * 1.6;
    `);
}
