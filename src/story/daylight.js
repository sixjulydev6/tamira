import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import layout from '../../art/data/city-layout.json';
import { FRAME_CENTRE, FRAME_W } from './city.js';
import { smooth, lerp } from './timeline.js';

const DEG = Math.PI / 180;

/** The editable city asset: Z-up metres, shared with the wireframe and Blender manifest. */
export function buildDaylightCity(renderer) {
  const scene = new THREE.Scene();
  const materials = [], geometries = new Set();
  const material = (color, roughness = 0.46) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, transparent: true });
    materials.push(m); return m;
  };
  const m = {
    white: material('#e5e5e1'), grey: material('#b4b4b7'), grey2: material('#dfe0df'),
    taupe: material('#c8bdb5'), orange: material('#e85c2d', 0.38), top: material('#f3a27c', 0.42),
    roof: material('#4a4954', 0.45), pane: material('#a9aaaf', 0.4), warm: material('#c99083', 0.4),
    orangePane: material('#f6a97f', 0.42), ground: material('#e8e9e7', 0.72), road: material('#c9cacd', 0.62),
    tree: material('#e4e2de', 0.56), car: material('#eeeae5', 0.4), darkCar: material('#55555c', 0.42),
  };
  const own = g => { geometries.add(g); return g; };
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const mesh = (g, mat, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, mat); o.position.set(x, y, z);
    o.castShadow = true; o.receiveShadow = true; scene.add(o); return o;
  };
  const rounded = (w, d, h, r, mat, x, y, z) => mesh(own(new RoundedBoxGeometry(w, d, h, 3, r)), mat, x, y, z);
  const windows = [], warmWindows = [], crownWindows = [];
  function windowAt(list, x, y, z, angle, width = 2.5, height = 2.7) {
    list.push({ x, y, z, angle, width, height });
  }
  for (const b of layout.buildings) {
    const [w, d, h] = b.size, [x, y] = b.centre;
    rounded(w, d, h, b.bevel, m[b.style] || m.white, x, y, h / 2).name = b.id;
    if (b.darkRoof) rounded(w - 0.4, d - 0.4, 0.5, 0.2, m.roof, x, y, h + 0.1);
    if (!b.windows) continue;
    const list = b.windows === 'warm' ? warmWindows : windows;
    for (let z = 4.5; z < h - 3.5; z += 4.6) {
      const nx = Math.max(1, Math.floor((w - 3) / 4.6));
      const ny = Math.max(1, Math.floor((d - 3) / 4.6));
      for (let i = 0; i < nx; i++) windowAt(list, x + (i - (nx - 1) / 2) * 4.6, y - d / 2 - 0.09, z, 0);
      for (let i = 0; i < ny; i++) windowAt(list, x + w / 2 + 0.09, y + (i - (ny - 1) / 2) * 4.6, z, Math.PI / 2);
    }
  }

  // A single watertight crown extrusion, with the six original V notches and central opening.
  const outer = [], inner = [];
  const polar = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  for (let k = 0; k < 6; k++) {
    const a = (-45 + 60 * k) * DEG, ca = Math.cos(a), sa = Math.sin(a);
    const rot = (u, v) => new THREE.Vector2(u * ca - v * sa, u * sa + v * ca);
    outer.push(polar(17, a - Math.PI / 6), rot(31, -8.5), rot(24.5, 0), rot(31, 8.5));
    inner.push(polar(11 / Math.cos(Math.PI / 6), a - Math.PI / 6));
  }
  const shape = new THREE.Shape(outer); shape.closePath();
  const hole = new THREE.Path(inner.reverse()); hole.closePath(); shape.holes.push(hole);
  const crown = mesh(own(new THREE.ExtrudeGeometry(shape, {
    depth: 130.8, steps: 1, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3,
  })), [m.top, m.orange], 0, 0, 0.6);
  crown.name = 'TamiraCrown';
  rounded(25, 25, 118, 0.6, m.orange, 0, 0, 59).rotation.z = -Math.PI / 4;
  for (const poly of layout.crown.armPolys) {
    for (const [i, j, start, along] of [[1, 2, 8, 0.5], [2, 3, 8, 0.5], [0, 1, 11.5, 0.62], [3, 4, 11.5, 0.62]]) {
      const a = new THREE.Vector2(...poly[i]), b = new THREE.Vector2(...poly[j]);
      const u = b.clone().sub(a).normalize(), mid = a.clone().lerp(b, along);
      const n = new THREE.Vector2(u.y, -u.x); if (n.dot(mid) < 0) n.negate();
      for (let z = start; z < 126; z += 7) windowAt(crownWindows, mid.x + n.x * 0.84, mid.y + n.y * 0.84, z, Math.atan2(u.y, u.x), 2.6, 2.9);
    }
  }
  const dummy = new THREE.Object3D();
  function instances(list, mat) {
    if (!list.length) return;
    const o = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z); dummy.rotation.set(0, 0, w.angle); dummy.scale.set(w.width, 0.2, w.height);
      dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix);
    });
    o.receiveShadow = true; o.computeBoundingSphere(); scene.add(o); return o;
  }
  instances(windows, m.pane); instances(warmWindows, m.warm); instances(crownWindows, m.orangePane);

  const ground = mesh(own(new THREE.PlaneGeometry(2400, 2400)), m.ground, 0, 0, -0.15);
  ground.castShadow = false;
  // Fade the far empty ground into the HTML sky, preserving transparent pixels above the skyline.
  m.ground.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xy;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= 1.0 - smoothstep(420.0, 740.0, length(vGround));\n#include <opaque_fragment>');
  };
  m.ground.customProgramCacheKey = () => 'tamira-ground-fade';
  for (const r of layout.roads) {
    const o = mesh(boxGeo, m.road, r.centre[0], r.centre[1], 0.025);
    o.scale.set(r.size[0], r.size[1], 0.08); o.castShadow = false;
  }
  const sphere = own(new THREE.SphereGeometry(1, 14, 10));
  const trunkGeo = own(new THREE.CylinderGeometry(0.32, 0.38, 4.5, 7).rotateX(Math.PI / 2));
  for (const t of layout.trees) {
    mesh(trunkGeo, m.tree, ...t.at, 2.1);
    mesh(sphere, m.tree, ...t.at, 5.5).scale.set(t.r, t.r, t.r);
  }

  // Two lanes per road. Cars wrap beyond the road ends, rather than jumping through a junction.
  const cars = [], carGeo = own(new RoundedBoxGeometry(2.1, 4.8, 1.45, 2, 0.35));
  const cabinGeo = own(new RoundedBoxGeometry(1.7, 2.4, 0.85, 2, 0.3));
  for (const [ri, road] of layout.roads.entries()) for (const lane of [-1, 1]) for (let i = 0; i < 3; i++) {
    const car = new THREE.Group(); car.name = `Traffic-${ri}-${lane}-${i}`;
    const body = new THREE.Mesh(carGeo, (i + ri) % 3 ? m.car : m.darkCar); body.position.z = 1;
    const cabin = new THREE.Mesh(cabinGeo, m.roof); cabin.position.z = 1.95;
    car.add(body, cabin); scene.add(car);
    car.rotation.z = (road.along === 'X' ? -Math.PI / 2 : 0) + (lane < 0 ? Math.PI : 0);
    cars.push({ object: car, road, lane, offset: (i + (ri % 3) / 3) / 3 });
  }

  const ambient = new THREE.HemisphereLight('#f0f2f6', '#a69a8f', 1.0); ambient.up.set(0, 0, 1); ambient.position.set(0, 0, 300); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff4e6', 3.7); sun.position.set(-280, -420, 300);
  sun.castShadow = true; const shadowSize = window.matchMedia('(max-width: 700px)').matches ? 2048 : 4096;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -440, right: 440, top: 440, bottom: -440, near: 1, far: 1500 });
  sun.shadow.normalBias = 0.4; sun.shadow.bias = -0.00015; sun.shadow.radius = 2;
  scene.add(sun);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;

  const camera = new THREE.PerspectiveCamera(); camera.up.set(0, 0, 1);
  const target = new THREE.Vector3(), direction = new THREE.Vector3();
  let opacity = 1;
  function setOpacity(a) {
    if (a === opacity) return; opacity = a;
    for (const mat of materials) mat.opacity = a;
  }
  function placeCamera(r, frame, width, height) {
    const e = r * r * r * (r * (r * 6 - 15) + 10);
    const startD = Math.hypot(430, 43), startW = 36 * startD / 50;
    const az = lerp(-90, -45, e) * DEG, el = lerp(Math.atan2(-43, 430), 38 * DEG, e);
    const D = Math.exp(lerp(Math.log(startD), Math.log((FRAME_W / 2) / Math.tan(0.25 * DEG)), smooth(0.2, 1, r)));
    const frameW = Math.exp(lerp(Math.log(startW), Math.log(FRAME_W), e));
    target.set(0, 0, 78).lerp(FRAME_CENTRE, e);
    direction.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
    camera.position.copy(target).addScaledVector(direction, D); camera.lookAt(target);
    // Reproduce the full 16:9 composition first, then crop it to the viewport. On phones the
    // opening is a smaller skyline anchored to the bottom, with a continuous zoom into the rise.
    const initialScale = Math.min(1, width * 2.1 / frame.w);
    const scale = lerp(initialScale, 1, smooth(0.05, 0.6, r));
    const fw = frame.w * scale, fh = frame.h * scale;
    const fx = (width - fw) / 2, fy = lerp(height - fh, frame.y, smooth(0.05, 0.6, r));
    camera.aspect = fw / fh;
    camera.fov = 2 * Math.atan(frameW / (2 * D * camera.aspect)) / DEG;
    camera.near = Math.max(0.5, D - 1800); camera.far = D + 2200;
    camera.setViewOffset(fw, fh, -fx, -fy - 0.125 * fw * (1 - e), width, height);
    camera.updateProjectionMatrix();
  }
  function traffic(time) {
    for (const c of cars) {
      const { road, lane } = c, length = road.along === 'X' ? road.size[0] : road.size[1];
      const distance = ((c.offset + time * 9 / length) % 1) * (length + 14) - (length + 14) / 2;
      c.object.position.set(road.centre[0] + (road.along === 'X' ? distance * lane : lane * 2.6), road.centre[1] + (road.along === 'Y' ? distance * lane : -lane * 2.6), 0);
    }
  }
  function dispose() {
    geometries.forEach(g => g.dispose()); materials.forEach(mat => mat.dispose()); sun.shadow.map?.dispose();
    scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
  }
  return { scene, camera, placeCamera, setOpacity, traffic, dispose, stats: { buildings: layout.buildings.length + 1, cars: cars.length, windows: windows.length + warmWindows.length + crownWindows.length } };
}
