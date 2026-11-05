import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildRoom, ROOM, ROOM_LIGHTS } from './building.js'
import { CITY_U } from './cityMaterial.js'
import { FLOOR } from './layout.js'
import { S } from './state.js'

const smooth = THREE.MathUtils.smoothstep

// One room, lit, inside the x-ray tower. It builds up from the floor when the wire
// reaches it, then its lights come on.
export const ROOM_U = {
  uTime: CITY_U.uTime,
  uBuild: { value: 0 },
  uOn: { value: 0 },
  uDimI: { value: 0 },
  uY0: { value: ROOM.yb },
  uH: { value: FLOOR.h },
  uL1: { value: new THREE.Vector3(...ROOM_LIGHTS[0]) },
  uL2: { value: new THREE.Vector3(...ROOM_LIGHTS[1]) },
  // the corner floor lamp beside the sofa (build_room.py 88.2, 46.4; shade centre 1.62 m)
  uL3: { value: new THREE.Vector3(88.2, ROOM.yb + 1.62, 46.4) }
}

const ROOM_FRAG_TOP = /* glsl */ `
varying vec3 vIW; varying vec3 vIWN;
uniform float uBuild; uniform float uOn; uniform float uDimI; uniform float uY0; uniform float uH;
uniform vec3 uL1; uniform vec3 uL2; uniform vec3 uL3;
`
const BUILD_DISCARD = /* glsl */ `
  float r_h = vIW.y - (uY0 - .4);
  float r_front = uBuild * (uH + .9);
  if (r_h > r_front) discard;
  float r_edge = exp(-pow((r_front - r_h) / .05, 2.)) * step(.001, uBuild) * (1. - step(.999, uBuild));
`
const ROOM_LIGHT = /* glsl */ `
{
  vec3 n = normalize(vIWN);
  vec3 L1 = uL1 - vIW; float f1 = 1. / (1. + dot(L1, L1) * .07); float d1 = max(dot(n, normalize(L1)), 0.) * .75 + .25;
  vec3 L2 = uL2 - vIW; float f2 = 1. / (1. + dot(L2, L2) * .22); float d2 = max(dot(n, normalize(L2)), 0.) * .75 + .25;
  vec3 L3 = uL3 - vIW; float f3 = 1. / (1. + dot(L3, L3) * .3); float d3 = max(dot(n, normalize(L3)), 0.) * .75 + .25;
  vec3 warm = vec3(1., .77, .52);
  totalEmissiveRadiance += diffuseColor.rgb * (warm * (f1 * d1 * 2.9 + f2 * d2 * 1.5 + f3 * d3 * 1.6) * uOn + vec3(.03, .04, .07));
  totalEmissiveRadiance += vec3(1., .62, .3) * r_edge * 3.;
}
`

function patchRoom(material, curtains = false) {
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, ROOM_U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIW; varying vec3 vIWN; uniform float uTime;')
      .replace('#include <begin_vertex>', curtains ? `#include <begin_vertex>
        {
          vec3 c_o = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float c_ph = c_o.x * .37 + c_o.z * .51;
          float c_v = 1. - uv.y;
          float c_gust = .55 + .45 * sin(uTime * .21 + c_ph * .3);
          transformed.z += sin(uv.x * 22. + c_ph) * .045;
          transformed.z += sin(uTime * 1.1 + c_ph + position.y * .9) * .1 * c_v * c_gust;
          transformed.x += sin(uTime * .8 + c_ph * 1.7) * .03 * c_v * c_gust;
        }` : '#include <begin_vertex>')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 i_w = vec4(transformed, 1.);
        vec3 i_n = objectNormal;
        #ifdef USE_INSTANCING
          i_w = instanceMatrix * i_w;
          i_n = mat3(instanceMatrix) * i_n;
        #endif
        vIW = (modelMatrix * i_w).xyz;
        vIWN = normalize(mat3(modelMatrix) * i_n);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROOM_FRAG_TOP}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${BUILD_DISCARD}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${ROOM_LIGHT}`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1. - uDimI;\n#include <fog_fragment>')
  }
  material.customProgramCacheKey = () => (curtains ? 'temira-room-curtain' : 'temira-room')
  return material
}

export function createTowerRoom() {
  const group = new THREE.Group()
  const { solid, glow, curtain, glowMat, outline } = buildOnce(() => {
    const data = buildRoom()
    const box = new THREE.BoxGeometry(1, 1, 1)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color()

    const solid = new THREE.InstancedMesh(box, patchRoom(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })), data.boxes.length)
    data.boxes.forEach((b, i) => {
      solid.setMatrixAt(i, m.compose(p.set(b[0], b[1], b[2]), q.identity(), s.set(b[3], b[4], b[5])))
      solid.setColorAt(i, c.setRGB(b[6], b[7], b[8], THREE.SRGBColorSpace))
    })

    const glowMat = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false })
    const glow = new THREE.InstancedMesh(box, glowMat, data.glows.length)
    data.glows.forEach((b, i) => {
      glow.setMatrixAt(i, m.compose(p.set(b[0], b[1], b[2]), q.identity(), s.set(b[3], b[4], b[5])))
      glow.setColorAt(i, c.setRGB(b[6], b[7], b[8]))
    })

    const cg = new THREE.PlaneGeometry(1, 1, 6, 12)
    cg.translate(0, 0.5, 0)
    const curtain = new THREE.InstancedMesh(cg, patchRoom(new THREE.MeshStandardMaterial({ color: '#efe6d8', roughness: 0.95, side: THREE.DoubleSide }), true), data.curtains.length)
    data.curtains.forEach((cu, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cu[3])
      curtain.setMatrixAt(i, m.compose(p.set(cu[0], cu[1], cu[2]), q, s.set(cu[4], cu[5], 1)))
      curtain.setColorAt(i, c.setHSL(0.09, 0.25 + cu[6] * 0.2, 0.82 + cu[6] * 0.1))
    })

    // a warm outline frames the room inside the scanned tower
    const { x0, x1, z0, z1, yb, yt } = ROOM
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, yt - yb + 0.3, z1 - z0))
    edges.translate((x0 + x1) / 2, (yb + yt) / 2 - 0.15, (z0 + z1) / 2)
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#ffd9b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
    return { solid, glow, curtain, glowMat, outline }
  }, [])

  // Glow materials scale from their base colour with the lights-on fade; the box room has one.
  let glows = [{ mat: glowMat, base: new THREE.Color(1, 1, 1) }]
  let source = 'box', disposed = false
  const update = () => {
    ROOM_U.uBuild.value = smooth(S.room, 0, 0.75)
    const on = smooth(S.room, 0.65, 1)
    ROOM_U.uOn.value = on
    ROOM_U.uDimI.value = smooth(S.enter, 0.1, 0.7) * 0.25 + smooth(S.explode, 0.1, 0.6) * 0.5
    const k = on * (1 - ROOM_U.uDimI.value * 0.7)
    for (const g of glows) g.mat.color.copy(g.base).multiplyScalar(k)
    outline.material.opacity = smooth(S.room, 0.05, 0.4) * (1 - smooth(S.follow, 0.15, 0.4)) * 0.9
    group.visible = S.room > 0.001
  };
  group.add(solid,glow,curtain,outline);

  // Modelled room (art/blender/room/build_room.py -> room-v2.glb), authored in the same world frame.
  // Replaces the box room once loaded; on failure the box room stays.
  const load = url => new GLTFLoader().loadAsync(url + 'room-v2.glb').then(gltf => {
    if (disposed) { gltf.scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.() }); return }
    const made = new Map(), nextGlows = []
    const materialFor = src => {
      if (made.has(src)) return made.get(src)
      const name = src.name || 'solid'
      let m
      if (/^light_|^fabric_shade/.test(name)) {
        // emissive fittings: unlit, brightness follows the room's lights-on fade
        const strength = src.userData?.emissiveStrength ?? src.emissiveIntensity ?? 1
        m = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: THREE.DoubleSide })
        nextGlows.push({ mat: m, base: src.emissive.clone().multiplyScalar(Math.min(strength, 14) * (name.startsWith('fabric') ? 0.9 : 0.45)) })
      } else {
        m = patchRoom(new THREE.MeshStandardMaterial({ color: src.color, roughness: src.roughness, metalness: Math.min(src.metalness, 0.35), side: src.side }))
      }
      m.name = name; made.set(src, m); src.dispose(); return m
    }
    const meshes = []
    gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o) })
    if (!meshes.length) throw new Error('room-v2.glb has no meshes')
    for (const o of meshes) { o.material = materialFor(o.material); o.castShadow = o.receiveShadow = false }
    gltf.scene.updateMatrixWorld(true)
    group.remove(solid, glow, curtain)
    for (const o of [solid, glow, curtain]) { o.geometry.dispose(); o.material.dispose(); o.dispose() }
    group.add(gltf.scene)
    glows = nextGlows
    source = 'glb'
    update()
  }).catch(e => console.warn('Modelled tower room unavailable; keeping the box room', e))

  return { group, update, load, dispose() { disposed = true }, get source() { return source } };
}
function buildOnce(fn){return fn();}
