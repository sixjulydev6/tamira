import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/* Props for the wire chapters. Kept procedural for now; each can be swapped for a
   Blender-made GLB later without touching the timeline. */

export function buildProps() {
  const group = new THREE.Group();

  // ---------------------------------------------------------------- conduit elbow (flex)
  const conduitMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide,
  });
  const conduit = new THREE.Mesh(new THREE.BufferGeometry(), conduitMat);
  conduit.renderOrder = 2;
  group.add(conduit);

  // ---------------------------------------------------------------- heater (heat)
  const heater = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(12, 1.8, 4.4, 4, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x24252b, roughness: 0.55, metalness: 0.2 }));
  heater.add(body);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, emissive: 0xff6a1a, emissiveIntensity: 0 });
  for (let i = 0; i < 9; i++) {
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.2, 3.2, 2, 0.08), slotMat);
    slot.position.set(-4.4 + i * 1.1, 0.92, 0);
    heater.add(slot);
  }
  heater.visible = false;
  group.add(heater);

  // ---------------------------------------------------------------- flame (flame)
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 0 }, uPhase: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAmt, uPhase; varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.12);
        float sway = sin(p.y * 7.0 + uPhase) * 0.04 * p.y;
        p.x += sway;
        float h = 0.86 * uAmt;                                   // flame height shrinks as it dies out
        float w = 0.22 * (1.0 - smoothstep(0.0, h, p.y)) * smoothstep(-0.06, 0.05, p.y) + 0.02;
        float body = smoothstep(w, w * 0.25, abs(p.x)) * step(p.y, h) * smoothstep(-0.08, 0.0, p.y);
        float core = smoothstep(w * 0.55, 0.0, abs(p.x)) * (1.0 - smoothstep(0.0, h * 0.55, p.y));
        vec3 col = mix(vec3(1.0, 0.42, 0.05), vec3(1.0, 0.86, 0.45), core);
        float a = clamp(body * (0.85 + core), 0.0, 1.0) * smoothstep(0.0, 0.08, uAmt);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4), flameMat);
  flame.renderOrder = 3;
  group.add(flame);

  // ---------------------------------------------------------------- smoke (flame → smoke)
  const smokeTex = radialTexture();
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x6f6f78, transparent: true, opacity: 0, depthWrite: false }));
    m.renderOrder = 4;
    puffs.push(m); group.add(m);
  }

  // ---------------------------------------------------------------- wall plate (finale)
  const plate = new THREE.Group();
  const plateFace = new THREE.Mesh(new RoundedBoxGeometry(8.6, 8.6, 0.9, 5, 0.5),
    new THREE.MeshPhysicalMaterial({ color: 0xf7f6f3, roughness: 0.38, clearcoat: 0.4 }));
  plate.add(plateFace);
  const rocker = new THREE.Mesh(new RoundedBoxGeometry(2.4, 4.2, 0.7, 4, 0.3),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.6 }));
  rocker.position.set(0, 0, 0.55);
  plate.add(rocker);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0xea3c32 }));
  led.position.set(0, -1.55, 0.92);
  plate.add(led);
  plate.visible = false;
  group.add(plate);

  return {
    group, conduit, conduitMat, heater, slotMat, flame, flameMat, puffs, plate, rocker, led,
    setConduitPath(points) {
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      conduit.geometry.dispose();
      conduit.geometry = new THREE.TubeGeometry(curve, 120, 1.9, 40, false);
    },
  };
}

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
