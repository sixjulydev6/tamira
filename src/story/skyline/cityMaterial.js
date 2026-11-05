import * as THREE from 'three'
import { NOISE, XRAY_UNIFORMS, XRAY_FUNCS, HORIZON } from './glsl.js'
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
  uEdge: { value: 0 },
  // sky terms mirrored from the dome each frame (index.js) for the horizon fade
  uSkyZen: { value: new THREE.Color() }, uSkyMid: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() },
  uSkySun: { value: new THREE.Color() }, uSkySunDir: { value: new THREE.Vector3(0, 1, 0) }, uSkyGlow: { value: new THREE.Color() },
  uSkyNight: { value: 0 }, uSkyXray: { value: 0 }, uSkyDim: { value: 0 }, uHzNear: { value: 1150 }, uHzFar: { value: 2300 }
}

// Night, driven by semantic material classes from the Blender kit (art/blender/skyline):
// rooms light up behind real glass panes, the focal tower's stone frame catches warm
// architectural light, and the glass holds the twilight sky. Filler blocks derive their
// glazing from a storey grid instead of an atlas.
const NIGHT = /* glsl */ `
{
  vec3 n_n = normalize(vWN);
  float n_vert = 1. - smoothstep(.3, .6, abs(n_n.y));
  float n_glass = T_GLASS;
  #ifdef T_FILLER
    float n_fb = fract(vW.y / 3.6);
    n_glass = step(.3, n_fb) * step(n_fb, .9) * n_vert;
  #endif
  float n_green = T_LEAF;
  vec2 n_t = normalize(vec2(-n_n.z, n_n.x) + vec2(1e-4));
  float n_u = dot(vW.xz, n_t);
  // individual window panes on a world grid, switched on room by room
  vec2 n_pane = vec2(n_u / 2.4, vW.y / 3.6);
  vec2 n_pf = fract(n_pane);
  float n_win = smoothstep(.04, .1, n_pf.x) * smoothstep(.96, .9, n_pf.x) * smoothstep(.06, .14, n_pf.y) * smoothstep(.98, .9, n_pf.y);
  vec2 n_room = floor(vec2(n_u / 7.2, vW.y / 3.6));
  vec2 n_key = n_room + floor(n_n.xz * 2. + .5) * 57.3;
  float n_id = tHash12(n_key);
  float n_on = step(n_id, uLit);
  n_on = max(n_on, (1. - smoothstep(5., 9., vW.y)) * step(.3, n_id) * step(.01, uLit));
  float n_tog = tHash12(n_key + 9.1);
  n_on *= step(.04, fract(n_tog * 7.3 + uTime * .01 * (.4 + n_tog)));
  vec3 n_warm = mix(vec3(1., .58, .26), vec3(1., .76, .5), tHash12(n_key + 2.7));
  n_warm = mix(n_warm, vec3(.8, .87, 1.), step(.93, tHash12(n_key + 5.3)));
  float n_pid = tHash12(floor(n_pane) + 1.3);
  float n_k = (.3 + .7 * tHash12(n_key + 4.4)) * (.85 + .15 * n_pid);
  totalEmissiveRadiance += n_warm * n_glass * n_win * n_on * n_vert * (1. - n_green) * n_k * uNight * 1.1;
  // warm architectural light washing up the focal tower's frame
  float n_hero = tInside(vW, uHeroMin, uHeroMax) ? 1. : 0.;
  float n_frame = T_FRAME * n_vert * (1. - n_green);
  totalEmissiveRadiance += vec3(1., .68, .38) * n_frame * n_hero * uNight * (.03 + .07 * smoothstep(40., 200., vW.y));
  // the twilight sky held in the glass
  float n_fr = pow(1. - abs(dot(n_n, normalize(cameraPosition - vW))), 3.);
  float n_sky = .55 + .45 * smoothstep(0., 160., vW.y);
  totalEmissiveRadiance += vec3(.07, .13, .32) * max(n_glass, .12) * n_vert * (1. - n_green) * (.35 + n_fr * 1.6) * n_sky * uNight * .55;
}
`

// filler blocks: storey bands of dark glazing between light spandrels, from world height
const FILLER_COLOR = /* glsl */ `
#ifdef T_FILLER
{
  float f_fb = fract(vW.y / 3.6);
  float f_vert = 1. - smoothstep(.3, .6, abs(normalize(vWN).y));
  float f_g = step(.3, f_fb) * step(f_fb, .9) * f_vert;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .07, .1), f_g * .75);
}
#endif
`

// cls: 'glass' | 'frame' | 'leaf' | 'solid' (material class from the GLB material name prefix)
export function patchCityMaterial(material, { filler = false, cls = 'solid' } = {}) {
  material.defines = Object.assign(material.defines || {}, {
    T_GLASS: cls === 'glass' ? '1.' : '0.',
    T_FRAME: cls === 'frame' ? '1.' : '0.',
    T_LEAF: cls === 'leaf' ? '1.' : '0.'
  })
  if (filler) material.defines.T_FILLER = ''
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, CITY_U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 tW4 = vec4(transformed, 1.0);
        vec3 tN = objectNormal;
        #ifdef USE_INSTANCING
          tW4 = instanceMatrix * tW4;
          tN = mat3(instanceMatrix) * tN;
        #endif
        tW4 = modelMatrix * tW4;
        vW = tW4.xyz;
        vWN = normalize(mat3(modelMatrix) * tN);`)
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
        ${XRAY_FUNCS}
        ${HORIZON}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float tXr = tXrayAmount(vW);
        float tFd = tFront(vW, tXr);
        if (tXr > 0.0001 && tFd < 0.) discard;
        float tScan = (tXr > 0.0001 && tXr < .9999) ? exp(-tFd * tFd / 6.) : 0.;
        float tCe = tCut(vW);
        if (tCe > 0.) discard;
        float tCg = (uCut > 0. && uCut < 1.) ? exp(-tCe * tCe * 30.) : 0.;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FILLER_COLOR}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${NIGHT}
        totalEmissiveRadiance += vec3(.7, .86, 1.) * tScan * 1.3 + vec3(1., .5, .2) * tCg * 2.4;`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1. - uDim;\n#include <fog_fragment>\ngl_FragColor.rgb = tHorizon(gl_FragColor.rgb, vW);')
  }
  material.customProgramCacheKey = () => `temira-city-${cls}${filler ? '-filler' : ''}`
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
