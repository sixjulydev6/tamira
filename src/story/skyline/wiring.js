import * as THREE from 'three'
import { buildWiring, ENTER } from './building.js'
import { buildWireGeometry } from './wireGeometry.js'
import { SUBSTATION } from './layout.js'
import { CITY_U } from './cityMaterial.js'
import { S } from './state.js'

const smooth = THREE.MathUtils.smoothstep

export const WIRE_U = {
  uTime: CITY_U.uTime,
  uNetS: { value: 0 },
  uSelS: { value: 0 },
  uIsolate: { value: 0 },
  uEnter: { value: 0 },
  uEnterMin: { value: new THREE.Vector3(ENTER[0] - 0.5, ENTER[1] - 0.5, ENTER[2] - 3.3) },
  uEnterMax: { value: new THREE.Vector3(ENTER[0] + 0.5, ENTER[1] + 0.5, 60) },
  uHead: { value: new THREE.Vector3() },
  uHeadOn: { value: 0 },
  uSelBoost: { value: 0 },
  uDimAll: { value: 0 },
  uXrayA: { value: 0.2 }
}

const VERT = /* glsl */ `
attribute float aS; attribute float aK;
varying vec3 vW; varying vec3 vN; varying float vS; varying float vK;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normal; vS = aS; vK = aK;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const COMMON = /* glsl */ `
uniform float uTime; uniform float uNetS; uniform float uSelS; uniform float uIsolate;
uniform float uEnter; uniform vec3 uEnterMin; uniform vec3 uEnterMax; uniform vec3 uHead; uniform float uHeadOn;
uniform float uDimAll; uniform float uXrayA; uniform float uSelBoost;
varying vec3 vW; varying vec3 vN; varying float vS; varying float vK;
float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float isNet(){ return step(.5, vK) * step(vK, 1.5); }
float isSel(){ return step(1.5, vK); }
// network runs grow out from the substation; the followed wire draws on separately, up to its room
float reveal(){ return isSel() > .5 ? vS - uSelS : vS - uNetS; }
float pulse(){
  float sp = isNet() > .5 ? 46. : 6.5;
  float vel = isNet() > .5 ? 30. : 4.2;
  return pow(fract((vS - uTime * vel) / sp), 16.);
}
bool entered(){ return uEnter > .12 && isSel() > .5; }
`
const TUBE_FRAG = /* glsl */ `
${COMMON}
void main(){
  float sel = isSel();
  float rev = reveal();
  if (rev > 0.) discard;
  if (entered()) discard;
  if (sel < .5 && uIsolate > 0. && wHash(gl_FragCoord.xy) < uIsolate * .86) discard;
  vec3 V = normalize(cameraPosition - vW);
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, V));
  float key = max(dot(n, normalize(vec3(.4, .8, .45))), 0.);
  vec3 sheath = sel > .5 ? vec3(.84, .82, .78) : vec3(.09, .09, .1);
  vec3 lit = sheath * (.16 + .58 * key + .26 * pow(ndv, 2.));
  float dist = length(cameraPosition - vW);
  float farGlow = smoothstep(4., 70., dist);
  float p = pulse();
  float front = exp(rev * .9);
  vec3 amber = vec3(1., .46, .16);
  vec3 col = lit * (1. - farGlow * .75) + amber * (.3 + farGlow * 1.9 + p * 3.2 + front * 5.);
  float hd = exp(-dot(vW - uHead, vW - uHead) / 6.) * uHeadOn;
  // the followed wire: a warm, bright run from afar; up close a real sheathed cable carrying a soft pulse
  if (sel > .5) col = lit * (1. - farGlow * .6) + amber * (farGlow * (2.92 + p * 2.5 + hd * .35 + front * 6.) + uSelBoost * (1.4 + p * 2.));
  else col *= 1. - uIsolate * .88;
  gl_FragColor = vec4(col * (1. - uDimAll), 1.);
}
`
const LINE_FRAG = /* glsl */ `
${COMMON}
uniform float uMode; // 0 depth-tested glow, 1 x-ray through walls
void main(){
  float sel = isSel();
  float rev = reveal();
  if (rev > 0.) discard;
  if (entered()) discard;
  float dist = length(cameraPosition - vW);
  float vis = uMode > .5 ? 1. : smoothstep(2.5, 30., dist);
  float p = pulse();
  float front = exp(rev * .9);
  vec3 amber = vec3(1., .5, .2);
  vec3 col = amber * (.55 + p * 2.2 + front * 2.6) * vis;
  col *= sel > .5 ? 1.5 + p * 2. + front * 2. : 1. - uIsolate * .82;
  col *= uMode > .5 ? uXrayA : 1.;
  gl_FragColor = vec4(col * (1. - uDimAll), 1.);
}
`

export function createWiring(gl) {
  const data = buildOnce(() => buildWiring(), [])
  const geo = buildOnce(() => buildWireGeometry(data.runs, 7), [data])

  const tubeMat = buildOnce(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: TUBE_FRAG, uniforms: WIRE_U }), [])
  // glow lines live in the opaque queue (additive, no depth write) so they draw before the tubes
  // and stay visible at distances where the tubes are thinner than a pixel
  const lineMat = buildOnce(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: LINE_FRAG, uniforms: { ...WIRE_U, uMode: { value: 0 } },
    transparent: false, depthWrite: false, blending: THREE.AdditiveBlending
  }), [])
  const xrayMat = buildOnce(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: LINE_FRAG, uniforms: { ...WIRE_U, uMode: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  }), [])

  // junction nodes: a ring flashes outward the moment power reaches each building, then stays lit
  const nodes = buildOnce(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.nodes.flatMap(n => n.p), 3))
    g.setAttribute('aS', new THREE.Float32BufferAttribute(data.nodes.map(n => n.s), 1))
    g.setAttribute('aK', new THREE.Float32BufferAttribute(data.nodes.map(n => n.k), 1))
    return g
  }, [data])
  const nodeMat = buildOnce(() => new THREE.ShaderMaterial({
    uniforms: { uNetS: WIRE_U.uNetS, uIsolate: WIRE_U.uIsolate, uTime: WIRE_U.uTime, uPR: { value: 1 }, uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aS; attribute float aK;
      uniform float uNetS; uniform float uPR; uniform float uTime;
      varying float vOn; varying float vFlash; varying float vK;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        float since = uNetS - aS;
        vOn = step(0., since);
        vFlash = vOn * exp(-max(since, 0.) / 34.);
        vK = aK;
        float base = aK > 1.5 ? 16. : 9.;
        gl_PointSize = (base + 46. * vFlash) * uPR * clamp(380. / -mv.z, .45, 1.8) * (vOn > .5 ? 1. : 0.);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn; uniform float uIsolate; uniform float uTime;
      varying float vOn; varying float vFlash; varying float vK;
      void main(){
        float d = length(gl_PointCoord - .5) * 2.;
        float ring = smoothstep(.62, .78, d) * smoothstep(1., .86, d) * vFlash;
        float core = exp(-d * d * 18.) * (.7 + .3 * sin(uTime * 2. + vK * 3.));
        float halo = exp(-d * d * 4.) * .25;
        vec3 col = vec3(1., .62, .3) * (core * 1.6 + halo) + vec3(1., .85, .7) * ring * 2.4;
        gl_FragColor = vec4(col * vOn * uOn * (1. - uIsolate * .85), 1.);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  }), [])

  // substation the citywide network grows from
  const sub = buildOnce(() => {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: '#59606a', roughness: 0.6, metalness: 0.4, emissive: '#ff7a2e', emissiveIntensity: 0 })
    const box = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); g.add(m) }
    box(0, 3, 0, 9, 6, 6); box(12, 3, 0, 9, 6, 6); box(-12, 3, 0, 9, 6, 6)
    box(0, 0.3, 0, 46, 0.6, 22)
    for (let i = -2; i <= 2; i++) box(i * 9, 7.5, 9, 0.4, 15, 0.4)
    g.position.set(...SUBSTATION)
    g.userData.mat = mat
    return g
  }, [])

  const update = () => {
    WIRE_U.uNetS.value = S.network * 920
    // the followed wire glows warmly while it is being delivered to the room, then settles into a real cable up close
    WIRE_U.uSelBoost.value = smooth(S.climb, 0, 0.2) * (1 - smooth(S.follow, 0.35, 0.8))
    // the followed wire draws on with the climb: along the feeder, up the riser, then into the room
    const c = S.climb, M = data.marks
    WIRE_U.uSelS.value = c <= 0 ? 0
      : c < 0.22 ? THREE.MathUtils.lerp(0, M.riserBase, smooth(c, 0, 0.22))
      : c < 0.8 ? THREE.MathUtils.lerp(M.riserBase, M.room, (c - 0.22) / 0.58)
      : THREE.MathUtils.lerp(M.room, M.end + 2, smooth(c, 0.8, 1))
    WIRE_U.uIsolate.value = S.isolate
    WIRE_U.uEnter.value = S.enter
    WIRE_U.uXrayA.value = 0.32 * (1 - S.enter)
    // the product takes over: the rest of the run and its neighbours fall away
    WIRE_U.uDimAll.value = smooth(S.explode, 0.02, 0.45) * 0.94
    nodeMat.uniforms.uOn.value = smooth(S.network, 0, 0.05) * (1 - S.enter)
    nodeMat.uniforms.uPR.value = gl.getPixelRatio()
    sub.userData.mat.emissiveIntensity = S.network * 0.8
    sub.visible = S.network > 0.001
    sub.scale.setScalar(Math.max(0.001, smooth(S.network, 0, 0.15)))
  };
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo.tube,tubeMat), new THREE.LineSegments(geo.lines,lineMat), new THREE.LineSegments(geo.lines,xrayMat), new THREE.Points(nodes,nodeMat),sub);
  group.children.forEach((o,i)=>{o.renderOrder=[5,4,7,8,0][i];o.frustumCulled=false;});
  return {group,update};
}
function buildOnce(fn){return fn();}
