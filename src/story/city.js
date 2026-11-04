import * as THREE from "three";

/* ------------------------------------------------------------------
   The wireframe city.
   Ported from tamira-reference-match/blender/hero_day.py (BUILDINGS, ground_at,
   the crown and the `wf` linework), so every line lands on the matching edge of the
   Cycles render. World is Blender's: Z up, metres, crown base centre at the origin.
   ------------------------------------------------------------------ */

const EL = THREE.MathUtils.degToRad(38);
const AZ = THREE.MathUtils.degToRad(-45);
export const FRAME_W = 400;                 // ortho scale: frame width in metres
const REF_W = 2000, REF_H = 1122;
const K = REF_W / FRAME_W;                  // reference px per metre
const CROWN_FY = 740 / REF_H;
const RIGHT = new THREE.Vector3(-Math.sin(AZ), Math.cos(AZ), 0);
const AWAY = new THREE.Vector3(-Math.cos(AZ), -Math.sin(AZ), 0);
export const TO_CAM = new THREE.Vector3(Math.cos(EL) * Math.cos(AZ), Math.cos(EL) * Math.sin(AZ), Math.sin(EL));

export function groundAt(px, py) {
  const fx = px / REF_W, fy = py / REF_H;
  return RIGHT.clone().multiplyScalar((fx - 0.5) * FRAME_W)
    .add(AWAY.clone().multiplyScalar(((CROWN_FY - fy) * FRAME_W * REF_H / REF_W) / Math.sin(EL)));
}
/** where the hero camera's centre ray meets the ground */
export const FRAME_CENTRE = groundAt(REF_W / 2, REF_H / 2);

// (front-corner px, front-corner bottom py, left-face px, right-face px, top-of-front-edge py, has windows)
const BUILDINGS = [
  [645, 520, 80, 65, 178, 0], [790, 650, 60, 70, 332, 1], [530, 775, 40, 210, 540, 1], [455, 782, 70, 70, 622, 1],
  [265, 645, 60, 70, 452, 1], [70, 605, 65, 60, 528, 0], [320, 330, 35, 35, 236, 0], [655, 800, 65, 70, 692, 1],
  [915, 795, 80, 85, 702, 0], [965, 1062, 85, 90, 757, 1], [1130, 977, 65, 65, 752, 1], [1115, 762, 65, 70, 702, 0],
  [830, 932, 50, 50, 806, 1], [720, 972, 80, 90, 887, 1], [295, 967, 70, 75, 872, 1], [557, 1135, 38, 38, 1032, 0],
  [1300, 762, 70, 100, 472, 1], [1290, 480, 75, 70, 152, 1], [1190, 592, 35, 40, 398, 0], [1410, 618, 60, 60, 302, 1],
  [1575, 362, 40, 40, 262, 0], [1520, 522, 35, 35, 427, 0], [1545, 172, 65, 70, 122, 0], [1785, 192, 30, 30, 97, 0],
  [1855, 572, 40, 45, 507, 0], [1490, 762, 70, 70, 572, 1], [1390, 822, 70, 70, 662, 1], [1480, 892, 75, 75, 802, 1],
  [1720, 812, 65, 70, 737, 0], [1880, 1022, 75, 70, 747, 0], [1650, 1190, 105, 120, 862, 1], [1835, 1062, 45, 45, 947, 0],
  [1478, 1027, 38, 38, 917, 0], [1325, 962, 55, 55, 912, 1], [1255, 922, 55, 55, 787, 1], [585, 40, 70, 75, 0, 0],
];
const ACCENT = new Set(["790,650", "1300,762", "1410,618", "1490,762"]);
const ROAD_SEGS = [[[-60, 830], [300, 668]], [[300, 668], [585, 885]], [[585, 885], [900, 745]], [[585, 885], [760, 1180]],
  [[1690, 545], [2080, 720]], [[1690, 545], [2050, 360]], [[300, 0], [840, 262]], [[1130, 135], [1420, -10]],
  [[1050, 985], [1480, 1100]]];
const ROAD_W = 11;
const CROWN_H = 132, CROWN_R = 31;

/* deterministic random, so the city is the same on every load */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* line families: brightness multiplier (the shader colours them) */
const FAM = { grid: 0.42, grid2: 0.62, contour: 1.0, crown: 1.6, crownGrid: 0.7, gminor: 0.16, gmajor: 1.15, gbranch: 0.55,
  extContour: 0.5, extGrid: 0.17, avenue: 1.25, pole: 0.5 };

/* The avenue the wire runs along: world Y at x = 228 m. It is the widest strip in front of the
   original city with no buildings, and on screen it runs lower-left → upper-right (like the train
   in the client's reference). */
export const AVENUE = { x: 228, half: 7, lampOffset: 10.5, lampStep: 36, lampZ: 7.2, from: -1100, to: 1100,
  tipY: 120 };   // where the wire's tip stops; the camera pushes in toward it from the near side

export function buildCity(shared) {
  const pos = [], bright = [], extA = [];
  let curExt = 0;                       // 1 = part of the extended city (grows in during "extend")
  const seg = (fam, ...pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      pos.push(...pts[i], ...pts[i + 1]);
      bright.push(FAM[fam], FAM[fam]);
      extA.push(curExt, curExt);
    }
  };
  const hulls = [];

  // crown: six notched arms
  const crownPolys = [];
  for (let k = 0; k < 6; k++) {
    const a = THREE.MathUtils.degToRad(-45 + 60 * k), ca = Math.cos(a), sa = Math.sin(a);
    const rot = (u, v) => [u * ca - v * sa, u * sa + v * ca];
    const armW = 17, rIn = 11, notch = 6.5, o = 0.12;
    const poly = [rot(rIn, -armW / 2 - o), rot(CROWN_R + o, -armW / 2 - o), rot(CROWN_R - notch + o, 0), rot(CROWN_R + o, armW / 2 + o), rot(rIn, armW / 2 + o)];
    crownPolys.push(poly);
    for (const p of poly.slice(1, 4)) seg("crown", [p[0], p[1], 0.2], [p[0], p[1], CROWN_H + o]);
    seg("crown", ...poly.map((p) => [p[0], p[1], CROWN_H + o]));
    for (let z = 7; z < CROWN_H - 2; z += 7) seg("crownGrid", ...poly.map((p) => [p[0], p[1], z]));
  }

  // buildings: contour edges, floor rings, a column grid on the important ones
  BUILDINGS.forEach(([px, py, lw, rw, ty, win], idx) => {
    const corner = groundAt(px, py);
    const dx = lw / (K * 0.7071), dy = rw / (K * 0.7071);
    const h = Math.max(5, (py - ty) / K / Math.cos(EL));
    const cx = corner.x - dx / 2, cy = corner.y + dy / 2;
    hulls.push({ cx, cy, dx, dy, h });
    const o = 0.12;
    const x0 = cx - dx / 2 - o, x1 = cx + dx / 2 + o, y0 = cy - dy / 2 - o, y1 = cy + dy / 2 + o, zt = h + o;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) seg("contour", [x, y, 0.2], [x, y, zt]);
    seg("contour", [x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt], [x0, y0, zt]);
    const fam = rng(idx * 97 + 13)() < 0.3 ? "grid2" : "grid";
    const important = (win && h > 45) || ACCENT.has(`${px},${py}`);
    const pitch = important ? 4.6 : h > 18 ? 13.8 : 1e9;
    for (let z = 4.5; z < h - 1.5; z += pitch) seg(fam, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]);
    if (important) {
      for (const [ax, ay, bx, by, span] of [[x0, y0, x1, y0, dx], [x1, y0, x1, y1, dy]]) {
        const n = Math.max(1, Math.floor(span / 4.6));
        for (let i = 1; i < n; i++) {
          const t = i / n;
          seg(fam, [ax + (bx - ax) * t, ay + (by - ay) * t, 0.2], [ax + (bx - ax) * t, ay + (by - ay) * t, h]);
        }
      }
    }
  });

  // ground: minor grid, street edges, circuit branches
  for (let v = -480; v <= 480; v += 8) {
    seg("gminor", [v, -480, 0.05], [v, 480, 0.05]);
    seg("gminor", [-480, v, 0.05], [480, v, 0.05]);
  }
  const roads = [];
  for (const [aPx, bPx] of ROAD_SEGS) {
    const a = groundAt(...aPx), b = groundAt(...bPx);
    const dv = b.clone().sub(a);
    const along = Math.abs(dv.x) > Math.abs(dv.y) ? "X" : "Y";
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const Lh = ((along === "X" ? Math.abs(dv.x) : Math.abs(dv.y)) + ROAD_W) / 2;
    for (const side of [-1, 1]) {
      const off = (side * ROAD_W) / 2;
      if (along === "X") seg("gmajor", [mid.x - Lh, mid.y + off, 0.08], [mid.x + Lh, mid.y + off, 0.08]);
      else seg("gmajor", [mid.x + off, mid.y - Lh, 0.08], [mid.x + off, mid.y + Lh, 0.08]);
    }
    roads.push({ mid, along, Lh });
  }
  const rg = rng(99);
  for (let i = 0; i < 90; i++) {
    const { mid, along, Lh } = roads[Math.floor(rg() * roads.length)];
    const t = (rg() * 2 - 1) * Lh, side = rg() < 0.5 ? -1 : 1;
    const l1 = 6 + rg() * 20, l2 = (5 + rg() * 17) * (rg() < 0.5 ? -1 : 1);
    let p0, p1, p2;
    if (along === "X") { p0 = [mid.x + t, mid.y + (side * ROAD_W) / 2]; p1 = [p0[0], p0[1] + side * l1]; p2 = [p1[0] + l2, p1[1]]; }
    else { p0 = [mid.x + (side * ROAD_W) / 2, mid.y + t]; p1 = [p0[0] + side * l1, p0[1]]; p2 = [p1[0], p1[1] + l2]; }
    seg("gbranch", [...p0, 0.07], [...p1, 0.07], [...p2, 0.07]);
  }

  /* ---------------------------------------------------------------- extended city
     Blocks grown around the original layout as the camera pulls back. Deterministic, kept off
     the avenue, and low just in front of it (camera side) so nothing hides the wire. */
  curExt = 1;
  const extHulls = [];
  const re = rng(4242);
  const CELL = 40;
  for (let gx = -760; gx <= 760; gx += CELL) {
    for (let gy = -760; gy <= 760; gy += CELL) {
      const inOriginal = gx > -280 && gx < 205 && gy > -190 && gy < 280;
      // keep clear: the avenue itself, and the patch on its near side the camera crosses on the
      // final push-in toward the tip (the wire is drawn on top, so nothing may stand in front of it)
      const approachPath = gx > AVENUE.x && gx < AVENUE.x + 260 && gy > AVENUE.tipY - 380 && gy < AVENUE.tipY + 140;
      if (inOriginal || approachPath || Math.abs(gx - AVENUE.x) < 38 || re() > 0.56) continue;
      const dx = 12 + re() * 20, dy = 12 + re() * 20;
      const cx = gx + (re() - 0.5) * (CELL - dx - 4), cy = gy + (re() - 0.5) * (CELL - dy - 4);
      let h = 8 + Math.pow(re(), 1.8) * 78;
      if (cx > AVENUE.x && cx < AVENUE.x + 170) h = Math.min(h, 10 + re() * 6);  // keep the near side low
      extHulls.push({ cx, cy, dx, dy, h });
      const o = 0.12, x0 = cx - dx / 2 - o, x1 = cx + dx / 2 + o, y0 = cy - dy / 2 - o, y1 = cy + dy / 2 + o, zt = h + o;
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) seg("extContour", [x, y, 0.2], [x, y, zt]);
      seg("extContour", [x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt], [x0, y0, zt]);
      const pitch = re() < 0.35 ? 4.6 : 9.2;
      for (let z = 4.5; z < h - 1.5; z += pitch) seg("extGrid", [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]);
    }
  }
  // the avenue: two kerb lines and a ground grid that reaches the new blocks
  for (const side of [-1, 1]) seg("avenue", [AVENUE.x + side * AVENUE.half, AVENUE.from, 0.09], [AVENUE.x + side * AVENUE.half, AVENUE.to, 0.09]);
  for (let v = -1000; v <= 1000; v += 8) {
    if (Math.abs(v) <= 480) continue;
    seg("gminor", [v, -1000, 0.05], [v, 1000, 0.05]);
    seg("gminor", [-1000, v, 0.05], [1000, v, 0.05]);
  }
  for (let v = -480; v <= 480; v += 8) {        // extend the original grid lines out to the new edge
    seg("gminor", [v, 480, 0.05], [v, 1000, 0.05]); seg("gminor", [v, -1000, 0.05], [v, -480, 0.05]);
    seg("gminor", [480, v, 0.05], [1000, v, 0.05]); seg("gminor", [-1000, v, 0.05], [-480, v, 0.05]);
  }
  // street lights on both sides: pole + arm reaching over the avenue
  const lamps = [];
  for (let y = AVENUE.from; y <= AVENUE.to; y += AVENUE.lampStep) {
    for (const side of [-1, 1]) {
      const px = AVENUE.x + side * AVENUE.lampOffset, hx = AVENUE.x + side * (AVENUE.lampOffset - 2.6);
      seg("pole", [px, y, 0.1], [px, y, AVENUE.lampZ + 0.4], [hx, y, AVENUE.lampZ + 0.4]);
      lamps.push([hx, y, AVENUE.lampZ]);
    }
  }
  curExt = 0;

  const group = new THREE.Group();

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  lineGeo.setAttribute("bright", new THREE.Float32BufferAttribute(bright, 1));
  lineGeo.setAttribute("ext", new THREE.Float32BufferAttribute(extA, 1));
  const lines = new THREE.LineSegments(lineGeo, lineMaterial(shared));
  lines.frustumCulled = false;
  group.add(lines);

  // dark hulls so lines behind buildings are hidden, like the Blender wireframe pass
  const hullMat = surfaceMaterial(shared, 0.012);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  for (const b of hulls) {
    const m = new THREE.Mesh(boxGeo, hullMat);
    m.position.set(b.cx, b.cy, 0); m.scale.set(b.dx, b.dy, b.h);
    group.add(m);
  }
  for (const poly of crownPolys) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: CROWN_H, bevelEnabled: false }), hullMat));
  }
  const core = new THREE.Mesh(new THREE.BoxGeometry(25, 25, CROWN_H - 14).translate(0, 0, (CROWN_H - 14) / 2), hullMat);
  core.rotation.z = THREE.MathUtils.degToRad(-45);
  group.add(core);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), surfaceMaterial(shared, 0));
  group.add(ground);

  // full-screen backdrop in the page colour, drawn first: the sky then goes through exactly the
  // same colour pipeline as the hulls and ground, so nothing ever shows as a silhouette
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }",
    fragmentShader: "uniform vec3 uBg; void main(){ gl_FragColor = vec4(uBg, 1.0); }",
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  group.add(backdrop);

  // extended hulls: one instanced draw, growing with the lines
  const extMesh = new THREE.InstancedMesh(boxGeo, extHullMaterial(shared), extHulls.length);
  const mtx = new THREE.Matrix4();
  extHulls.forEach((b, i) => extMesh.setMatrixAt(i, mtx.compose(new THREE.Vector3(b.cx, b.cy, 0), new THREE.Quaternion(), new THREE.Vector3(b.dx, b.dy, b.h))));
  extMesh.frustumCulled = false;
  group.add(extMesh);

  // street-light glow (billboards) and the pool of light each throws on the street
  group.add(lampMesh(shared, lamps, false), lampMesh(shared, lamps, true));

  return { group, lines };
}

/* warm street lights: switch on as the wire's tip passes them (uHead = tip's world Y) */
function lampMesh(shared, lamps, pool) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.attributes.position);
  geo.setAttribute("uv", base.attributes.uv);
  geo.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(lamps.flat()), 3));
  geo.instanceCount = lamps.length;
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...shared, uPool: { value: pool ? 1 : 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      uniform float uPool;
      varying vec2 vUv; varying float vY; varying vec2 vNdc;
      void main() {
        vUv = uv; vY = aCenter.y;
        vec4 clip;
        if (uPool > 0.5) {               // flat on the street, centred under the lamp head
          vec3 w = vec3(aCenter.xy, 0.12) + vec3(position.xy * 15.0, 0.0);
          clip = projectionMatrix * viewMatrix * vec4(w, 1.0);
        } else {                         // camera-facing glow around the lamp head
          vec4 mv = viewMatrix * vec4(aCenter, 1.0);
          mv.xy += position.xy * 4.2;
          clip = projectionMatrix * mv;
        }
        vNdc = clip.xy / clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHead, uExtend, uDrain, uFade, uPool;
      uniform vec2 uDrainNdc, uRes;
      varying vec2 vUv; varying float vY; varying vec2 vNdc;
      void main() {
        // switches on the moment the tip reaches it, never before
        float lit = smoothstep(vY, vY + 8.0, uHead);
        float flash = 1.0 + 1.4 * exp(-max(0.0, uHead - vY) / 9.0) * lit;     // a brief bright switch-on
        float r = length(vUv - 0.5) * 2.0;
        float shape = uPool > 0.5 ? exp(-r * r * 3.2) * 0.22 : (exp(-r * r * 14.0) * 0.9 + exp(-r * r * 3.0) * 0.16);
        vec2 dd = (vNdc - uDrainNdc) * vec2(uRes.x / uRes.y, 1.0);
        float alive = smoothstep(mix(4.2, -0.05, uDrain) - 0.02, mix(4.2, -0.05, uDrain) - 0.35, length(dd));
        float a = shape * lit * flash * alive * uFade * smoothstep(0.6, 1.0, uExtend);
        gl_FragColor = vec4(vec3(1.0, 0.74, 0.38) * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = pool ? 1 : 3;
  return mesh;
}

/* extended-city hulls: same flat colour as the others; height follows the lines as they grow */
function extHullMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: /* glsl */ `
      uniform float uExtend;
      varying vec2 vNdc;
      varying vec3 vWorld;
      varying vec3 vNrm;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        w.z = min(w.z, max(0.01, uExtend * 150.0 - 6.0));
        vWorld = w.xyz;
        vNrm = normal;
        vec4 clip = projectionMatrix * viewMatrix * w;
        vNdc = clip.xy / clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      void main() {
        float alive = smoothstep(drainRadius() - 0.02, drainRadius() - 0.5, drainDist());
        vec3 col = uBg + vec3(0.25, 0.55, 1.0) * 0.012 * alive;
        col += litFacade(vWorld, vNrm) * alive;
        gl_FragColor = vec4(mix(uBg, col, stageMask() * uFade), 1.0);
      }`,
    toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

/* ------------------------------------------------------------------ shaders
   Shared uniforms (see scene.js):
   uReveal  0–1  lines grow up from street level
   uDrain   0–1  everything retreats into the drain point (bottom-left of the screen)
   uFlow    scroll-driven phase for light travelling toward the drain point
   uMask*   the same fade the CSS mask gives the city video, so the hand-off is exact
   uBg      page colour, used wherever the mask hides the city
   ------------------------------------------------------------------ */

const COMMON = /* glsl */ `
  uniform vec3 uBg;
  uniform vec2 uRes;
  uniform vec4 uStage;      // stage rect in canvas px: x, y (from top), w, h
  uniform float uMaskMix;   // 1 = apply the video's mask, 0 = full bleed
  uniform float uMaskMode;  // 0 = desktop (top + left + diagonal), 1 = small screens (top + bottom)
  uniform float uDrain;
  uniform vec2 uDrainNdc;
  uniform float uFade;
  uniform float uPower;     // how far the power has spread from the wire (see powerLit)
  varying vec2 vNdc;
  varying vec3 vWorld;
  varying vec3 vNrm;

  // Buildings light up as the wire's tip passes: the power front moves along the avenue with the
  // tip and spreads sideways from it, so the nearest buildings light first and the city follows.
  float powerLit(vec3 w) {
    // a building lights once the front has passed it; further from the avenue lights a little later
    float front = uPower - (w.y + 0.35 * abs(w.x - ${AVENUE.x.toFixed(1)}));
    return smoothstep(0.0, 18.0, front);
  }

  // lit windows on a vertical face; each window switches on at its own moment as lit rises
  float windowsOn(vec3 w, vec3 n, float lit) {
    if (abs(n.z) > 0.5 || w.z < 2.5 || lit <= 0.0) return 0.0;
    float u = abs(n.x) > abs(n.y) ? w.y : w.x;
    vec2 cell = vec2(u / 4.6, (w.z - 2.5) / 4.6);
    vec2 f = fract(cell), id = floor(cell);
    float win = step(0.22, f.x) * step(f.x, 0.72) * step(0.28, f.y) * step(f.y, 0.78);
    float h = fract(sin(dot(id + floor(w.xy * 0.05) * 13.0 + n.xy * 7.0, vec2(12.9898, 78.233))) * 43758.5453);
    return win * step(0.3, h) * smoothstep(h * 0.6, h * 0.6 + 0.25, lit);
  }

  float stageMask() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 n = (px - uStage.xy) / uStage.zw;           // 0–1 across the stage, y from the top
    float m;
    if (n.x < 0.0 || n.y < 0.0 || n.x > 1.0 || n.y > 1.0) m = 0.0;
    else if (uMaskMode < 0.5) {
      float top = smoothstep(0.0, 0.28, n.y);
      float left = smoothstep(0.0, 0.30, n.x);
      float diag = smoothstep(0.12, 0.48, (n.x + (1.0 - n.y)) * 0.5);
      m = top * left * diag;
    } else {
      m = smoothstep(0.0, 0.18, n.y) * (1.0 - smoothstep(0.74, 1.0, n.y));
    }
    return mix(1.0, m, uMaskMix);
  }

  // warm light from a powered facade: lit windows plus a faint glow on the wall
  vec3 litFacade(vec3 w, vec3 n) {
    if (abs(n.z) > 0.5) return vec3(0.0);
    float lit = powerLit(w);
    return vec3(1.0, 0.55, 0.2) * (windowsOn(w, n, lit) * 0.5 + lit * 0.02);
  }

  // distance from the drain point in screen space (aspect-corrected)
  float drainDist() {
    vec2 d = (vNdc - uDrainNdc) * vec2(uRes.x / uRes.y, 1.0);
    return length(d);
  }
  // radius of what's left of the network: shrinks from beyond the far corner to nothing
  float drainRadius() { return mix(4.2, -0.05, uDrain); }
`;

const VERT = /* glsl */ `
  attribute float bright;
  attribute float ext;
  varying float vBright;
  varying float vZ;
  varying float vExt;
  varying vec2 vNdc;
  varying vec3 vWorld;
  varying vec3 vNrm;
  void main() {
    vBright = bright;
    vExt = ext;
    vZ = position.z;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNdc = clip.xy / clip.w;
    gl_Position = clip;
  }
`;

function lineMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform float uReveal;
      uniform float uExtend;
      uniform float uFlow;
      uniform vec3 uLine;
      uniform vec3 uLineHot;
      varying float vBright;
      varying float vZ;
      varying float vExt;
      void main() {
        // reveal: lines climb from the street up (tallest building ~ 140 m); the extended city grows later
        float level = vExt > 0.5 ? uExtend : uReveal;
        float grow = smoothstep(vZ - 8.0, vZ + 2.0, level * 150.0 - 6.0) * (vExt > 0.5 ? smoothstep(0.0, 0.15, uExtend) : 1.0);
        float d = drainDist();
        float r = drainRadius();
        float alive = smoothstep(r - 0.02, r - 0.35, d) ;            // inside the remaining radius
        float edge = exp(-pow((d - r + 0.12) / 0.16, 2.0)) * step(0.001, uDrain) * (1.0 - uDrain * 0.4);
        // light travelling toward the corner (scroll-driven phase)
        float pulse = 0.5 + 0.5 * sin(d * 26.0 + uFlow);
        float flow = mix(1.0, 0.55 + 0.9 * pulse, smoothstep(0.0, 0.25, uDrain));
        float a = grow * (alive * flow + edge * 2.2) * vBright;
        vec3 col = mix(uLine, uLineHot, clamp(vBright - 0.9, 0.0, 1.0) + edge);
        // powered buildings (anything off the ground) turn warm and a little brighter
        float lit = vZ > 0.15 ? powerLit(vWorld) : 0.0;
        col = mix(col, vec3(1.0, 0.6, 0.26), lit * 0.75);
        a *= 1.0 + 0.15 * lit;
        // additive: write only the light, the hulls/ground underneath already hold the page colour
        gl_FragColor = vec4(col * a * stageMask() * uFade, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/* hull and ground: flat colour a touch lighter than the page, hidden by the same mask and drain */
function surfaceMaterial(shared, lift) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uLift: { value: lift } },
    vertexShader: VERT.replace("attribute float bright;", "float bright = 0.0;").replace("attribute float ext;", "float ext = 0.0;"),
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform float uLift;
      void main() {
        float alive = smoothstep(drainRadius() - 0.02, drainRadius() - 0.5, drainDist());
        vec3 col = uBg + vec3(0.25, 0.55, 1.0) * uLift * alive;
        col += litFacade(vWorld, vNrm) * alive;
        gl_FragColor = vec4(mix(uBg, col, stageMask() * uFade), 1.0);
      }
    `,
    toneMapped: false,
    polygonOffset: true,       // keep street lines (a few cm up) from fighting the ground at distance
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}
