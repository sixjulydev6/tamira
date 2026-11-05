import * as THREE from 'three'
import { NOISE, XRAY_UNIFORMS, XRAY_FUNCS } from './glsl.js'
import { HERO, CUT, FLOOR } from './layout.js'

// one set of uniform objects shared by every city material (solid, ghost, outlines, filler)
export const CITY_U = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uLit: { value: 0 },
  uDim: { value: 0 },
  uXray: { value: 0 },
  uHeroSolid: { value: 0 },
  uHeroMin: { value: new THREE.Vector3(...HERO.min) },
  uHeroMax: { value: new THREE.Vector3(...HERO.max) },
  uCut: { value: 0 },
  uCutMin: { value: new THREE.Vector3(...CUT.min) },
  uCutMax: { value: new THREE.Vector3(...CUT.max) },
  uFloorY0: { value: FLOOR.y0 },
  uFloorH: { value: FLOOR.h },
  uFloors: { value: FLOOR.n },
  uGhost: { value: 0 },
  uEdge: { value: 0 }
}

// Night, read from the model's own facades: rooms light up behind the texture's glass panes,
// the focal tower's frame catches warm architectural light, and the glass holds the twilight sky.
const NIGHT = /* glsl */ `
{
  vec3 n_s = pow(max(diffuseColor.rgb, vec3(0.)), vec3(1. / 2.2));
  float n_l = dot(n_s, vec3(.299, .587, .114));
  float n_glass = smoothstep(.0, .08, n_s.b - n_s.r) * (1. - smoothstep(.55, .75, n_l));
  float n_green = smoothstep(.02, .08, n_s.g - max(n_s.r, n_s.b));
  vec3 n_n = normalize(vWN);
  float n_vert = 1. - smoothstep(.3, .6, abs(n_n.y));
  vec2 n_t = normalize(vec2(-n_n.z, n_n.x) + vec2(1e-4));
  float n_u = dot(vW.xz, n_t);
  // individual window panes on a world grid, switched on room by room
  vec2 n_pane = vec2(n_u / 2.1, (vW.y - .6) / 3.5);
  vec2 n_pf = fract(n_pane);
  float n_win = smoothstep(.06, .14, n_pf.x) * smoothstep(.94, .86, n_pf.x) * smoothstep(.1, .2, n_pf.y) * smoothstep(.92, .84, n_pf.y);
  vec2 n_room = floor(vec2(n_u / 6.3, (vW.y - .6) / 3.5));
  vec2 n_key = n_room + floor(n_n.xz * 2. + .5) * 57.3;
  float n_id = tHash12(n_key);
  float n_on = step(n_id, uLit);
  n_on = max(n_on, (1. - smoothstep(5., 9., vW.y)) * step(.3, n_id) * step(.01, uLit));
  float n_tog = tHash12(n_key + 9.1);
  n_on *= step(.04, fract(n_tog * 7.3 + uTime * .01 * (.4 + n_tog)));
  vec3 n_warm = mix(vec3(1., .58, .26), vec3(1., .76, .5), tHash12(n_key + 2.7));
  n_warm = mix(n_warm, vec3(.8, .87, 1.), step(.93, tHash12(n_key + 5.3)));
  float n_pid = tHash12(floor(n_pane) + 1.3);
  float n_k = (.3 + .7 * tHash12(n_key + 4.4)) * (.55 + .45 * n_pid) * step(.22, n_pid);
  float n_lit = max(n_glass, .35) * n_win;
  totalEmissiveRadiance += n_warm * n_lit * n_on * n_vert * (1. - n_green) * n_k * uNight * .95;
  // warm architectural light washing up the focal tower's frame
  float n_hero = tInside(vW, uHeroMin, uHeroMax) ? 1. : 0.;
  float n_frame = (1. - n_glass) * smoothstep(.45, .66, n_l) * n_vert * (1. - n_green);
  totalEmissiveRadiance += vec3(1., .68, .38) * n_frame * n_hero * uNight * (.22 + .28 * smoothstep(40., 200., vW.y));
  // the twilight sky held in the glass
  float n_fr = pow(1. - abs(dot(n_n, normalize(cameraPosition - vW))), 3.);
  float n_sky = .55 + .45 * smoothstep(0., 160., vW.y);
  totalEmissiveRadiance += vec3(.07, .13, .32) * max(n_glass, .25) * n_vert * (.35 + n_fr * 1.6) * n_sky * uNight * .55;
}
`

// filler buildings borrow facade patches from the city's own texture atlas
const FILLER_UV = /* glsl */ `
#if defined(USE_INSTANCING) && defined(USE_MAP)
{
  vec3 f_o = instanceMatrix[3].xyz;
  vec3 f_s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  float f_h = fract(sin(dot(f_o.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vec2 f_base = vec2(.1 + fract(f_h * 7.13) * .7, .2 + fract(f_h * 3.71) * .55);
  float f_w = abs(normal.x) > .5 ? f_s.z : f_s.x;
  vMapUv = f_base + uv * vec2(f_w, f_s.y) / 520.;
  if (abs(normal.y) > .5) vMapUv = f_base + uv * .01;
}
#endif
`

export function patchCityMaterial(material, { filler = false } = {}) {
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, CITY_U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <uv_vertex>', filler ? `#include <uv_vertex>\n${FILLER_UV}` : '#include <uv_vertex>')
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 tW4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          tW4 = instanceMatrix * tW4;
        #endif
        tW4 = modelMatrix * tW4;
        vW = tW4.xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW;
        varying vec3 vWN;
        uniform float uNight;
        uniform float uTime;
        uniform float uLit;
        uniform float uDim;
        ${XRAY_UNIFORMS}
        ${NOISE}
        ${XRAY_FUNCS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float tXr = tXrayAmount(vW);
        float tFd = tFront(vW, tXr);
        if (tXr > 0.0001 && tFd < 0.) discard;
        float tScan = (tXr > 0.0001 && tXr < .9999) ? exp(-tFd * tFd / 6.) : 0.;
        float tCe = tCut(vW);
        if (tCe > 0.) discard;
        float tCg = (uCut > 0. && uCut < 1.) ? exp(-tCe * tCe * 30.) : 0.;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${NIGHT}
        totalEmissiveRadiance += vec3(.7, .86, 1.) * tScan * 1.3 + vec3(1., .5, .2) * tCg * 2.4;`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1. - uDim;\n#include <fog_fragment>')
  }
  material.customProgramCacheKey = () => (filler ? 'temira-filler' : 'temira-city')
  return material
}

const LINE_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
// thin, even, cool-white outlines: visible only where the city has dissolved
const EDGE_FRAG = /* glsl */ `
uniform float uEdge;
uniform float uDim;
uniform float uTime;
uniform float uFar;
varying vec3 vW;
${XRAY_UNIFORMS}
${NOISE}
${XRAY_FUNCS}
void main(){
  float xr = tXrayAmount(vW);
  if (xr <= 0.0001) discard;
  float fd = tFront(vW, xr);
  if (fd > 0.) discard;
  if (tCut(vW) > 0.) discard;
  float d = length(cameraPosition - vW);
  float near = exp(fd / 8.);
  float fade = smoothstep(6., 50., d) * (1. - smoothstep(uFar * .55, uFar, d) * .85);
  vec3 col = vec3(.74, .85, 1.) * (.42 + near * 1.4);
  gl_FragColor = vec4(col * uEdge * fade * (1. - uDim * .88), 1.);
}
`
export function makeEdgeMaterial(far = 900) {
  return new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: EDGE_FRAG, uniforms: { ...CITY_U, uFar: { value: far } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })
}

// sparse twinkling points on every surface, like a LiDAR scan
const PTS_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPR;
varying vec3 vW;
varying float vA;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  float tw = pow(.5 + .5 * sin(uTime * (.5 + aSeed * 1.6) + aSeed * 61.), 8.);
  vA = .22 + .78 * tw;
  gl_PointSize = (1.1 + tw * 1.9) * uPR * clamp(260. / -mv.z, .6, 1.6);
}
`
const PTS_FRAG = /* glsl */ `
uniform float uEdge;
uniform float uDim;
varying vec3 vW;
varying float vA;
${XRAY_UNIFORMS}
${NOISE}
${XRAY_FUNCS}
void main(){
  float xr = tXrayAmount(vW);
  if (xr <= 0.0001) discard;
  float fd = tFront(vW, xr);
  if (fd > 0.) discard;
  if (tCut(vW) > 0.) discard;
  float r = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .1, r);
  float fade = smoothstep(4., 30., length(cameraPosition - vW));
  gl_FragColor = vec4(vec3(.78, .9, 1.) * a * vA * uEdge * fade * (1. - uDim * .9), 1.);
}
`
export function makePointMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, uniforms: { ...CITY_U, uPR: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })
}
