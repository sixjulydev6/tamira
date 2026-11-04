// Finale: a sample section of wall with a switch board set into it, five switches on one plate. From
// behind, the three wires sweep up the back of the wall into the box and seat in the terminals (red to L,
// black to N, green to E), one click each. The camera comes round to the front, where the wall turns
// out to be a whole wall, and settles on the board just as the living room at the end sees it: the room
// takes over from there, and its switches turn its lights on.
// Built in its own frame: x across the wall, y up, z out of the front face (the room side). The whole
// group is turned to face away from the earlier shots, so the camera meets the back first.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bumpTile, wallMaterials } from './surface.js';

// Scale: the board is drawn at 10 mm to the unit, so it matches the one in the room's renders exactly
// (a 210 x 86 mm plate, five switches 36 mm apart). Everything else is as elsewhere.
export const FINALE = {
  origin: new THREE.Vector3(52, -10, -2),
  rotY: Math.PI,
  wall: { w: 32, h: 12, d: 5.5 },
  box: { w: 19.6, h: 7.6, d: 5.0 },
  plate: { w: 21, h: 8.6, d: 0.7 },
  switches: 5,
  pitch: 3.6,
  // Units per metre of the room, for matching the room's camera
  perMetre: 100,
  // The switch's terminals, on the back face of its terminal block, in the group's own frame. Seen from
  // behind (where the wires go in), L is on the left: that's the group's +x side.
  ports: { red: new THREE.Vector3(1.05, -1.0, -2.9), black: new THREE.Vector3(0, -1.0, -2.9), green: new THREE.Vector3(-1.05, -1.0, -2.9) },
  copper: 1.0
};

export function finaleMatrix() {
  return new THREE.Matrix4().compose(FINALE.origin, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), FINALE.rotY), new THREE.Vector3(1, 1, 1));
}

// Each wire's rails in the group's frame: from far behind the wall, low down, rising into the open back
// of the box, then straight into its terminal. Seen from the front, the wall hides every bit of them.
// Ends where the copper tip sits once seated, a little way inside the port.
export function finaleRail(id) {
  const P = FINALE.ports[id], V = (x, y, z) => new THREE.Vector3(x, y, z);
  const fan = P.x * 0.9;
  return [
    V(P.x + fan, -16, -100), V(P.x + fan * 0.8, -10, -55), V(P.x + fan * 0.5, -6.5, -28), V(P.x + fan * 0.2, -4.2, -14),
    V(P.x, -2.6, -7.5), V(P.x, P.y - 0.4, -5.0), V(P.x, P.y, -4.0),
    V(P.x, P.y, P.z - 0.9), V(P.x, P.y, P.z + 0.6)
  ];
}

// L N E, spaced to sit over the ports on a 3.4-unit-wide strip
function labelTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfcdc7';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#4a4c50';
  g.font = '500 84px "DM Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = (1.05 / 3.4) * 1024;
  ['L', 'N', 'E'].forEach((t, i) => g.fillText(t, 512 + (i - 1) * step, 68));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

export function createFinale(renderer, lite) {
  const group = new THREE.Group();
  group.position.copy(FINALE.origin);
  group.rotation.y = FINALE.rotY;
  const { wall: W, box: B, plate: PL } = FINALE;
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // The wall: one slab with a square opening for the box, extruded from its outline so there are no
  // inner faces to show as hairlines. Painted on the front, rough cement plaster on the back, and the
  // cut through it shows the layers (see surface.js).
  const wallMats = wallMaterials(renderer, { w: W.w, h: W.h, d: W.d, lite });
  [wallMats.back, wallMats.front, wallMats.side, ...wallMats.textures].forEach(keep);
  const outline = new THREE.Shape();
  outline.moveTo(-W.w / 2, -W.h / 2); outline.lineTo(W.w / 2, -W.h / 2); outline.lineTo(W.w / 2, W.h / 2); outline.lineTo(-W.w / 2, W.h / 2); outline.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-B.w / 2, -B.h / 2); opening.lineTo(-B.w / 2, B.h / 2); opening.lineTo(B.w / 2, B.h / 2); opening.lineTo(B.w / 2, -B.h / 2); opening.closePath();
  outline.holes.push(opening);
  const wallGeo = keep(new THREE.ExtrudeGeometry(outline, { depth: W.d, bevelEnabled: false }));
  wallGeo.translate(0, 0, -W.d);
  // The extrusion's first group is both faces, back then front; the second is the cut. Split the
  // faces so each gets its own finish.
  const [lids, sides] = wallGeo.groups;
  wallGeo.clearGroups();
  wallGeo.addGroup(lids.start, lids.count / 2, 0);
  wallGeo.addGroup(lids.start + lids.count / 2, lids.count / 2, 1);
  wallGeo.addGroup(sides.start, sides.count, 2);
  group.add(new THREE.Mesh(wallGeo, [wallMats.back, wallMats.front, wallMats.side]));

  // The back box: four walls of dark moulded plastic with a fine matte grain, open at the back so its
  // inside shows from behind. Box UVs run 0 to 1 on every face; the grain repeats four times across.
  const boxGrain = keep(bumpTile(renderer, { lite, units: 0.2 }));
  const boxMat = keep(new THREE.MeshStandardMaterial({ color: '#2d2f33', roughness: 0.74, metalness: 0, bumpMap: boxGrain, bumpScale: 1.0 }));
  const t = 0.22;
  const boxWall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), boxMat); m.position.set(x, y, z); group.add(m); };
  boxWall(B.w, t, B.d, 0, B.h / 2 - t / 2, -B.d / 2);
  boxWall(B.w, t, B.d, 0, -B.h / 2 + t / 2, -B.d / 2);
  boxWall(t, B.h, B.d, B.w / 2 - t / 2, 0, -B.d / 2);
  boxWall(t, B.h, B.d, -B.w / 2 + t / 2, 0, -B.d / 2);

  // A switch module behind each switch; the middle one has the terminal block on its back
  const moduleMat = keep(new THREE.MeshStandardMaterial({ color: '#e9e8e4', roughness: 0.55 }));
  const modGeo = keep(new RoundedBoxGeometry(3.3, 5.6, 2.4, 2, 0.12));
  for (let i = 0; i < FINALE.switches; i++) {
    const modBody = new THREE.Mesh(modGeo, moduleMat);
    modBody.position.set((i - (FINALE.switches - 1) / 2) * FINALE.pitch, 0, -1.2);
    group.add(modBody);
  }
  const blockMat = keep(new THREE.MeshStandardMaterial({ color: '#cfcdc7', roughness: 0.6 }));
  const block = new THREE.Mesh(keep(new RoundedBoxGeometry(3.6, 1.6, 0.5, 2, 0.08)), blockMat);
  block.position.set(0, -1.0, -2.65);
  group.add(block);
  // L N E, printed over the ports, facing the back
  const lbl = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 0.425)), keep(new THREE.MeshStandardMaterial({ map: keep(labelTexture(renderer)), roughness: 0.6 })));
  lbl.position.set(0, -0.48, -2.9 - 0.012);
  lbl.rotation.y = Math.PI;
  group.add(lbl);
  // Ports (dark holes) and brass screws on top of each
  const portMat = keep(new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.9 }));
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 1, roughness: 0.32 }));
  const portGeo = keep(new THREE.BoxGeometry(0.62, 0.62, 0.06));
  const screwGeo = keep(new THREE.CylinderGeometry(0.24, 0.24, 0.14, lite ? 16 : 24));
  const slotGeo = keep(new THREE.BoxGeometry(0.42, 0.05, 0.06));
  const slotMat = keep(new THREE.MeshStandardMaterial({ color: '#5c4520', roughness: 0.6, metalness: 0.6 }));
  const screws = {};
  for (const id of ['red', 'black', 'green']) {
    const P = FINALE.ports[id];
    const port = new THREE.Mesh(portGeo, portMat);
    port.position.set(P.x, P.y, P.z - 0.02);
    group.add(port);
    // Screw head on the block's top face, turned by the click
    const screw = new THREE.Group();
    const head = new THREE.Mesh(screwGeo, brass);
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.y = 0.075;
    screw.add(head, slot);
    screw.position.set(P.x, -0.2 + 0.07, -2.65);
    group.add(screw);
    screws[id] = screw;
  }

  // The plate on the front face, and its five rockers, all off: the room switches them on
  const plateMat = keep(new THREE.MeshPhysicalMaterial({ color: '#f3f2ee', roughness: 0.32, clearcoat: lite ? 0 : 0.4, clearcoatRoughness: 0.3 }));
  const plate = new THREE.Mesh(keep(new RoundedBoxGeometry(PL.w, PL.h, PL.d, 4, 0.32)), plateMat);
  plate.position.set(0, 0, PL.d / 2);
  group.add(plate);
  const rockerMat = keep(new THREE.MeshPhysicalMaterial({ color: '#f7f6f2', roughness: 0.28, clearcoat: lite ? 0 : 0.5, clearcoatRoughness: 0.25 }));
  const rockerGeo = keep(new RoundedBoxGeometry(3.0, 4.4, 0.6, 4, 0.22));
  // A small dot on each, dark while it's off
  const dotMat = keep(new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.5 }));
  const dotGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16));
  for (let i = 0; i < FINALE.switches; i++) {
    const rocker = new THREE.Group();
    rocker.add(new THREE.Mesh(rockerGeo, rockerMat));
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(0, 1.5, 0.31);
    rocker.add(dot);
    // Tipped top-in: off
    rocker.rotation.x = -0.17;
    rocker.position.set((i - (FINALE.switches - 1) / 2) * FINALE.pitch, 0, PL.d + 0.18);
    group.add(rocker);
  }

  // From the front the section is part of a whole wall: the same face carries on past its edges.
  // Shown only while the camera is in front of the wall, so from behind the section stands alone.
  const outer = new THREE.Shape();
  outer.moveTo(-260, -120); outer.lineTo(260, -120); outer.lineTo(260, 120); outer.lineTo(-260, 120); outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-W.w / 2, -W.h / 2); inner.lineTo(-W.w / 2, W.h / 2); inner.lineTo(W.w / 2, W.h / 2); inner.lineTo(W.w / 2, -W.h / 2); inner.closePath();
  outer.holes.push(inner);
  // The section's own face material, so there's no seam; past the section its faint marks just stop.
  // It fades in over the first few steps the camera takes in front of the wall, rather than appearing at
  // once. Always see-through and always in the scene, so its shader is ready before it's needed; from
  // behind, its back face isn't drawn at all.
  const farMat = keep(wallMats.front.clone());
  farMat.transparent = true;
  farMat.depthWrite = false;
  farMat.opacity = 0;
  const far = new THREE.Mesh(keep(new THREE.ShapeGeometry(outer)), farMat);
  group.add(far);

  // Click pulses: a ring that flashes out from each port as its wire seats
  const ringMat = (k) => keep(new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT;
      void main() { float d = length(vUv - 0.5) * 2.0; float r = mix(0.25, 1.0, uT);
        float a = exp(-pow((d - r) * 9.0, 2.0)) * (1.0 - uT) * step(0.001, uT) * step(uT, 0.999);
        gl_FragColor = vec4(vec3(1.0) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  const rings = {};
  for (const id of ['red', 'black', 'green']) {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.8, 1.8)), ringMat(id));
    const P = FINALE.ports[id];
    m.position.set(P.x, P.y, P.z - 0.08);
    m.renderOrder = 8;
    m.frustumCulled = false;
    group.add(m);
    rings[id] = m;
  }

  const solid = [wallMats.back, wallMats.front, wallMats.side, boxMat, moduleMat, blockMat, plateMat, rockerMat, portMat, brass, slotMat, lbl.material, dotMat];
  let lastFade = -1;
  const v = new THREE.Vector3();
  return {
    group,
    fading: solid,
    // fade: the whole set in or out. clicks: {red, black, green} 0 to 1 through each click.
    update({ fade, clicks }, camera) {
      if (Math.abs(fade - lastFade) > 1e-4) {
        lastFade = fade;
        const tr = fade < 0.999;
        for (const m of solid) {
          if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
          m.opacity = fade;
          m.depthWrite = fade > 0.5;
        }
        group.visible = fade > 0.005;
      }
      // Visibility can be reset by the shared product scene between frames.
      // Restore it even when the material fade value has not changed.
      group.visible = fade > 0.005;
      if (!group.visible) return;
      for (const id of ['red', 'black', 'green']) {
        const c = clicks[id];
        rings[id].material.uniforms.uT.value = c;
        rings[id].visible = c > 0.001 && c < 0.999;
        if (rings[id].visible) rings[id].quaternion.copy(camera.quaternion).premultiply(group.quaternion.clone().invert());
        // The screw turns a quarter and settles as the wire seats
        screws[id].rotation.y = Math.min(1, c * 1.6) * Math.PI / 2;
      }
      // The rest of the wall, once the camera is on the room side of it
      v.copy(camera.position);
      group.worldToLocal(v);
      const r = Math.min(1, Math.max(0, v.z / 10));
      farMat.opacity = lastFade * r * r * (3 - 2 * r);
    },
    dispose() { disposables.forEach((d) => d.dispose()); }
  };
}
