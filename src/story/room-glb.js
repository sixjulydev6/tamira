// The living room as a live Three.js scene (public/room-3d, exported by art/blender/export_room_glb.py).
// Shared by the story (?room=glb, via room-live.js) and the dev lab page (room-lab.html).
//
// Light units follow Cycles, so the same watts give the same picture as the rendered room:
// point/spot intensity = W / 4π (same irradiance and Lambert maths), rect-area radiance = W / (π · area),
// emission strength unchanged, AgX tone mapping. Lighting is driven by five levels (0–1, one per group:
// downlights, pendant, sconces, arc lamp, TV-unit strip), so each group fades in, and its rocker flips with it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ROOM_VIEW, frameFor, tanRect, windowAt } from './original/roomview.js';

export const ROOM_EXPOSURE = 0.4;                 // stops, Neutral tone mapping; calibrated against the Cycles renders (DECISIONS 33)
const BASE = '/room-3d/';
export const toGL = ([x, y, z]) => new THREE.Vector3(x, z, -y);   // Blender Z-up → glTF Y-up

const SHEEN = new Set(['sofa_linen', 'rug_wool', 'throw_waffle']);
// unbaked parts that reflect the dusk sky (everything else gets no unoccluded image-based light)
const GLOSSY = new Set(['tv_glass', 'dark_glaze', 'black_metal', 'bronze', 'lamp_base', 'window_frame', 'pendant_shade', 'arc_shade']);
// normal-map strengths of the Cycles materials (build_room.py), so close-ups match the renders
const NORMAL = { wall_plaster: 0.12, ceiling_plaster: 0.1, floor_oak: 0.8, oak_veneer: 0.5, sofa_linen: 0.9, rug_wool: 1, throw_waffle: 1 };
const NO_SHADOW = new Set(['sheer', 'glass', 'tree_cutout', 'outside_ground', 'downlight_lens', 'pendant_diffuser', 'sconce_glass', 'arc_diffuser', 'led_strip']);
// Bounce light: live lights don't inter-reflect, so a warm fill per group stands in (Cycles-baked
// lightmaps are the planned replacement). Index 0 is the dusk base.
const BOUNCE = [0.01, 0.16, 0.06, 0.05, 0.035, 0.04];
const ROCKER_AXIS = new THREE.Vector3(0, 0, -1);  // Blender +Y, the plate's horizontal
const ROCKER_DEG = 9.7;

export function configureRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;     // keeps the 3000 K warmth that AgX here washes towards white
  renderer.toneMappingExposure = Math.pow(2, ROOM_EXPOSURE);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();
}

/** Load the room into a new scene. Resolves to { scene, setLevels, dispose }. */
export async function loadGlbRoom(renderer) {
  const scene = new THREE.Scene();
  const disposables = [];
  const tl = new THREE.TextureLoader();
  const tex = (file, srgb, repeat = true) => {
    const t = tl.load(BASE + 'tex/' + file);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    disposables.push(t); return t;
  };
  const [gltf, hdr, meta, lmMeta] = await Promise.all([
    new GLTFLoader().loadAsync(BASE + 'room.glb'),
    new RGBELoader().loadAsync(BASE + 'sky_2k.hdr'),
    fetch(BASE + 'room-lights.json').then((r) => r.json()),
    fetch(BASE + 'lm/lightmaps.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  // Cycles-baked lightmaps (bake_room_lightmaps.py): map 0 = dusk sky (direct + indirect), maps 1–5 =
  // each light group's indirect light. RGBM-encoded; summed in the shader, weighted by each group's level.
  const lm = lmMeta && await Promise.all(lmMeta.maps.map((m) => new Promise((ok, fail) => tl.load(BASE + 'lm/' + m.file, (t) => {
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 1; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    disposables.push(t); ok(t);
  }, undefined, fail))));
  const lmK = { value: new Array(6).fill(0) };                          // level × encoding range, per map
  const lmRange = lm ? lmMeta.maps.map((m) => m.range) : [];

  // dusk sky outside the window, and dim reflections from it (IBL has no occlusion: reflections only)
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr; scene.backgroundIntensity = 0.35;
  scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(200), 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(hdr).texture; pmrem.dispose();
  // The sky's light inside is baked (lightmap 0). The environment map is kept only as reflections on the
  // glossy unbaked parts (screen, ceramics, metal): as a scene environment it would also add unoccluded diffuse.
  const envRotation = new THREE.Euler().copy(scene.backgroundRotation);
  disposables.push(hdr, env);

  const emissive = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const built = new Map();
  function material(m) {
    if (built.has(m.name)) return built.get(m.name);
    let out = m;
    const t = meta.textures[m.name];
    if (t) {
      const P = SHEEN.has(m.name) ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      out = new P({ name: m.name, map: tex(t.files.map, true), normalMap: t.files.normalMap && tex(t.files.normalMap),
                    roughnessMap: t.files.roughnessMap && tex(t.files.roughnessMap), roughness: 1, metalness: 0 });
      out.normalScale.setScalar(NORMAL[m.name] ?? 1);
      if (SHEEN.has(m.name)) Object.assign(out, { sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(1, 0.97, 0.92) });
    } else if (m.name === 'sheer') {
      out = new THREE.MeshPhysicalMaterial({ name: m.name, color: new THREE.Color('#f1ece4'), roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    } else if (m.name === 'glass') {
      out = new THREE.MeshPhysicalMaterial({ name: m.name, color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, depthWrite: false });
    } else if (m.name === 'tree_cutout') {
      out = new THREE.MeshBasicMaterial({ name: m.name, map: tex(meta.tree.image, true, false), alphaTest: 0.4, side: THREE.DoubleSide,
                                          toneMapped: false, color: new THREE.Color(0.55, 0.52, 0.55) });
    }
    const g = meta.emissive[m.name];
    if (g) { out.userData.on = out.emissiveIntensity; emissive[g].push(out); }
    if (out !== m) disposables.push(out);
    built.set(m.name, out);
    return out;
  }
  const lmMaterials = new Map();
  function withLightmaps(m) {
    if (lmMaterials.has(m)) return lmMaterials.get(m);
    const out = m.clone(); out.name = m.name;
    out.lightMap = lm[0]; out.lightMapIntensity = 1;
    out.onBeforeCompile = (sh) => {
      lm.forEach((t, i) => { if (i) sh.uniforms['tamiraLm' + i] = { value: t }; });   // map 0 is the material's own lightMap
      sh.uniforms.tamiraLmK = lmK;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lightmap_pars_fragment>', '#include <lightmap_pars_fragment>\n#ifdef USE_LIGHTMAP\n' + lm.map((_, i) => (i ? `uniform sampler2D tamiraLm${i};` : '')).join('\n') +
          `\nuniform float tamiraLmK[${lm.length}];\nvec3 tamiraLightmap( vec2 uv ) {\n  vec3 s = vec3( 0.0 ); vec4 t;\n` +
          lm.map((_, i) => `  t = texture2D( ${i ? 'tamiraLm' + i : 'lightMap'}, uv ); s += t.rgb * t.a * tamiraLmK[${i}];`).join('\n') +
          `\n  return s * PI;   // Cycles diffuse passes exclude albedo/π; three's indirect diffuse is irradiance · albedo/π\n}\n#endif`)
        .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps.replace('lightMapTexel.rgb * lightMapIntensity', 'tamiraLightmap( vLightMapUv )'));
    };
    out.customProgramCacheKey = () => 'tamira-lm-' + lm.length;
    disposables.push(out); lmMaterials.set(m, out);
    return out;
  }
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = material(o.material);
    if (!(lm && o.geometry.attributes.uv1) && GLOSSY.has(o.material.name)) {
      o.material.envMap = env; o.material.envMapRotation = envRotation; o.material.envMapIntensity = o.material.name === 'tv_glass' ? 0.04 : 0.3;
    }
    if (lm && o.geometry.attributes.uv1 && !NO_SHADOW.has(o.material.name)) o.material = withLightmaps(o.material);
    o.castShadow = o.receiveShadow = !NO_SHADOW.has(o.material.name);
    disposables.push(o.geometry);
  });
  scene.add(gltf.scene);

  // rockers flip and their dots glow as each group comes on (each dot gets its own material)
  const rockers = [], dots = [];
  for (let i = 0; i < 5; i++) {
    rockers.push(gltf.scene.getObjectByName('rocker_pivot_' + i));
    const d = gltf.scene.getObjectByName('rocker_dot_' + i);
    const m = d.material.clone(); m.userData.on = d.material.emissiveIntensity || 12; d.material = m; dots.push(d);
    disposables.push(m);
  }

  // lights from the Blender scene, in Cycles-equivalent units
  const lights = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const L of meta.lights) {
    const color = new THREE.Color().setRGB(...L.color);
    let light;
    if (L.type === 'POINT') light = new THREE.PointLight(color, L.watts / (4 * Math.PI), 0, 2);
    else if (L.type === 'SPOT') {
      light = new THREE.SpotLight(color, L.watts / (4 * Math.PI), 0, L.angle, Math.min(1, L.blend), 2);
      light.target.position.copy(new THREE.Vector3(...L.position).add(new THREE.Vector3(...L.direction)));
      scene.add(light.target);
      // WebGL allows 16 textures per shader: 6 lightmaps + 3 material maps + environment leave room for
      // only a few shadow maps. With baked bounce light, the pendant and arc lamp keep live shadows.
      if (/^(pendant_down|arc_down)/.test(L.name) || (!lmMeta && /^downlight/.test(L.name))) {
        light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02; light.shadow.camera.near = 0.05; light.shadow.camera.far = 8;
      }
    } else if (L.type === 'AREA') {
      const [w, h] = L.size;
      light = new THREE.RectAreaLight(color, L.watts / (Math.PI * w * h), w, h);
      light.rotation.x = -Math.PI / 2;                                // faces down, its length along the unit
    }
    if (!light) continue;
    light.position.set(...L.position); light.name = L.name; light.userData.on = light.intensity;
    scene.add(light); lights[L.group]?.push(light);
  }
  const bounce = new THREE.HemisphereLight(new THREE.Color('#ffe2c4'), new THREE.Color('#6b5240'), BOUNCE[0]);
  const fill = lm ? 0.2 : 1;                                            // with baked bounce, keep only a trace for unbaked parts
  scene.add(bounce);

  let lastKey = '';
  // Calibration against the Cycles renders (DECISIONS 33): baked-light and live-light scales.
  // Cycles bakes diffuse light per unit albedo (π · radiance), so the sky map is used as baked × 1/π.
  // Group scales match each lighting step's brightness to the 48 renders (measured in Comet, 1440×900).
  const tune = { lm: 1 / Math.PI, lamps: 1, direct: 1, group: [0.42, 0.15, 0.17, 0.17, 0.17] };
  /** levels: five values 0–1, one per lighting group. */
  function setLevels(levels) {
    const key = levels.map((v) => v.toFixed(3)).join(',') + `|${tune.lm}|${tune.lamps}|${tune.direct}|${tune.group}`;
    if (key === lastKey) return false;
    lastKey = key;
    let b = lm ? 0 : BOUNCE[0];
    if (lm) lmK.value[0] = lmRange[0] * tune.lm;
    for (let g = 1; g <= 5; g++) {
      const k = levels[g - 1];
      for (const l of lights[g]) { l.intensity = l.userData.on * k * tune.direct * tune.group[g - 1]; l.visible = k > 0.001; }
      for (const m of emissive[g]) m.emissiveIntensity = m.userData.on * k;
      b += BOUNCE[g] * k * fill;
      if (lm) lmK.value[g] = lmRange[g] * k * tune.lm * tune.lamps * tune.group[g - 1];
      // the rocker tips over as its light comes up
      const e = k * k * (3 - 2 * k);
      rockers[g - 1].quaternion.setFromAxisAngle(ROCKER_AXIS, THREE.MathUtils.degToRad(-ROCKER_DEG + 2 * ROCKER_DEG * e));
      dots[g - 1].material.emissiveIntensity = dots[g - 1].material.userData.on * k;
    }
    bounce.intensity = b;
    return true;
  }
  setLevels([0, 0, 0, 0, 0]);

  function dispose() {
    for (const d of disposables) d?.dispose?.();
    scene.traverse((o) => { if (o.isLight && o.shadow?.map) o.shadow.map.dispose(); });
  }
  return { scene, setLevels, dispose, tune, lightmaps: !!lm };
}

/**
 * Point a camera through the image version's camera and pull-back window: room.json's camera, with the
 * frustum of windowAt(t) for this screen shape. t: 0 close on the board, 1 the final framing.
 */
export function placeRoomCamera(camera, aspect, t) {
  const g = ROOM_VIEW[frameFor(aspect)], c = g.cam;
  camera.position.copy(toGL(c.pos));
  camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(toGL(c.right), toGL(c.up), toGL(c.back)));
  camera.updateMatrixWorld();
  const win = windowAt(g, t, aspect), r = tanRect(g, win), n = camera.near;
  camera.projectionMatrix.makePerspective(r.l * n, r.r * n, r.t * n, r.b * n, n, camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return win;
}

/** Render pipeline: scene, ground-truth-style ambient occlusion (GTAO), AgX output. */
export function createRoomComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.0 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  return {
    composer, gtao,
    setSize(w, h) { composer.setSize(w, h); gtao.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); },
    render() { composer.render(); },
    dispose() { composer.passes.forEach((p) => p.dispose?.()); composer.dispose(); },
  };
}
