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

// Filler blocks: real facades instead of white boxes. Each block (keyed by its instance colour) gets one of
// three facade types (ribbon windows, punched windows, glass curtain wall), its own window module, glass
// that varies window to window (sky reflection, blinds), and a glazed shopfront at street level.
const FILLER_COLOR = /* glsl */ `
#ifdef T_FILLER
{
  vec3 f_n = normalize(vWN);
  float f_vert = 1. - smoothstep(.3, .6, abs(f_n.y));
  float f_id = tHash12(diffuseColor.rg * 97.31 + diffuseColor.b * 13.7);
  vec2 f_t2 = normalize(vec2(-f_n.z, f_n.x) + vec2(1e-4));
  float f_u = dot(vW.xz, f_t2);
  float f_fb = fract(vW.y / 3.6);
  float f_mw = mix(1.5, 3.1, fract(f_id * 7.13));
  float f_fx = fract(f_u / f_mw);
  float f_ribbon = step(.3, f_fb) * step(f_fb, .88);
  float f_punch = f_ribbon * step(.2, f_fx) * step(f_fx, .8);
  float f_wall = step(.1, f_fb) * step(f_fb, .96) * step(.05, f_fx) * step(f_fx, .95);
  float f_g = f_id < .4 ? f_ribbon : f_id < .8 ? f_punch : f_wall;
  float f_shop = 1. - step(3.9, vW.y);
  f_g = mix(f_g, step(.08, fract(f_u / 4.2)) * step(.4, vW.y) * step(vW.y, 3.3), f_shop) * f_vert;
  float f_w = tHash12(floor(vec2(f_u / f_mw, vW.y / 3.6)) + f_id * 31.7);
  vec3 f_glass = mix(vec3(.035, .05, .075), vec3(.17, .21, .27), f_w * f_w);
  f_glass = mix(f_glass, vec3(.34, .33, .3), step(.9, f_w) * step(f_fb, .62));   // blinds drawn
  diffuseColor.rgb = mix(diffuseColor.rgb, f_glass, f_g * .88);
  tGlassK = f_g;
}
#endif
`

// Curtain-wall glass (vertical faces): no two panes sit perfectly flat, so each 1.2 m x 3.6 m pane gets
// its own small tilt plus a faint roller-wave ripple, and the sky reflection breaks up pane by pane.
// The pane grid matches the focal tower's mullions (1.2 m module, phase 0.775; storeys of 3.6 m).
const GLASS_PANES = /* glsl */ `
{
  vec3 g_n = normalize(vWN);
  float g_vert = 1. - smoothstep(.3, .6, abs(g_n.y));
  vec3 g_t = normalize(vec3(-g_n.z, 0., g_n.x) + vec3(1e-5));
  vec2 g_cell = vec2(floor((dot(vW, g_t) - .775) / 1.2), floor(vW.y / 3.6));
  vec2 g_key = g_cell + floor(g_n.xz * 2. + .5) * 57.3;
  float g_h1 = tHash12(g_key), g_h2 = tHash12(g_key + 3.7);
  float g_fy = fract(vW.y / 3.6);
  vec3 g_off = g_t * (g_h1 - .5) * .06 + vec3(0., 1., 0.) * ((g_h2 - .5) * .045 + sin(g_fy * 18.85) * .008);
  normal = normalize(normal + (viewMatrix * vec4(g_off * g_vert * tGlassK, 0.)).xyz);
}
`
// The focal tower's glass has no facade image: vary tint and gloss per pane, and draw blinds part-way
// down in about one pane in twenty (behind tinted glass they read only a little lighter), as an occupied
// office tower looks.
const HERO_GLASS_COLOR = /* glsl */ `
{
  vec3 h_n = normalize(vWN);
  vec3 h_t = normalize(vec3(-h_n.z, 0., h_n.x) + vec3(1e-5));
  vec2 h_key = vec2(floor((dot(vW, h_t) - .775) / 1.2), floor(vW.y / 3.6)) + floor(h_n.xz * 2. + .5) * 57.3;
  float h_a = tHash12(h_key + 11.1), h_b = tHash12(h_key + 19.4);
  diffuseColor.rgb *= .9 + .2 * h_a;
  float h_fy = fract(vW.y / 3.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.085, .085, .082), step(.94, h_b) * step(1. - .2 - .45 * h_a, h_fy) * (1. - smoothstep(.3, .6, abs(h_n.y))));
  tGlassRough = .8 + .5 * h_b;
}
`
// Facade-image surfaces are part glass, part panel: only the dark (glass) pixels of the elevation image get
// pane tilt and sky reflection; the light panels and spandrels stay matte.
const FACADE_GLASS_MASK = /* glsl */ `
#ifdef USE_MAP
  tGlassK *= 1. - smoothstep(.04, .16, tFacLum);
#endif
`
// Daylight sky reflection in glass. The day HDRI's lower half is a rooftop terrace, so on vertical glass the
// environment gives one flat slate tone. Real towers mirror the actual sky: brighter higher up the face,
// the city's darker band below the horizon, all broken up by each pane's tilt (GLASS_PANES). Coated
// glazing reflects ~16% head-on, rising to a mirror at grazing angles (Schlick).
const GLASS_SKY = /* glsl */ `
{
  vec3 r_nW = normalize((vec4(normal, 0.) * viewMatrix).xyz);
  vec3 r_v = normalize(cameraPosition - vW);
  vec3 r_d = reflect(-r_v, r_nW);
  float r_f = mix(.16, 1., pow(1. - clamp(dot(r_nW, r_v), 0., 1.), 5.));
  vec3 r_c = mix(tSky(r_d), vec3(.045, .05, .056), smoothstep(.0, -.3, r_d.y));
  float r_vert = 1. - smoothstep(.3, .6, abs(r_nW.y));
  totalEmissiveRadiance += r_c * r_f * tGlassK * r_vert * (1. - uNight) * (1. - uXray) * GLASS_SKY_K;
}
`
// Lawns: large patches of lusher and drier grass, mowing stripes, fine grain, and the slightly muted green
// real turf has from the air (fully saturated green is what makes a park read as a game board).
const LAWN_COLOR = /* glsl */ `
{
  float l_n = tNoise3(vec3(vW.xz * .03, 0.)) * .55 + tNoise3(vec3(vW.xz * .14, 3.)) * .3 + tNoise3(vec3(vW.xz * .8, 7.)) * .15;
  vec3 l_lush = vec3(.07, .13, .045), l_dry = vec3(.16, .155, .08);
  vec3 l_c = mix(l_lush, l_dry, smoothstep(.38, .72, l_n)) * (.88 + .24 * l_n);
  float l_px = length(fwidth(vW.xz));
  l_c *= .955 + .09 * smoothstep(.35, .65, fract(dot(vW.xz, vec2(.7071)) / 9.)) * (1. - smoothstep(2., 5., l_px));   // mowing stripes
  l_c *= .9 + .2 * tNoise3(vec3(vW.xz * 2.2, 5.)) * (1. - smoothstep(.15, .45, l_px));                              // grain, faded before it can shimmer
  diffuseColor.rgb = mix(vec3(dot(l_c, vec3(.3, .59, .11))), l_c, .84);
}
`
// Weathering. Real buildings are never factory-clean: rain streaks run down from sills and parapets, dirt
// and splash collect at street level, faces differ slightly in tone, and roofs are patchy membrane and
// gravel. Glass panes and foliage stay clean. High-frequency terms fade out with the pixel footprint so
// distant facades never shimmer.
const WEATHER = /* glsl */ `
#ifndef T_FILLER
{
  vec3 w_n = normalize(vWN);
  float w_vert = 1. - smoothstep(.3, .6, abs(w_n.y));
  float w_clean = max(T_LEAF, tGlassK);
  vec3 w_t = normalize(vec3(-w_n.z, 0., w_n.x) + vec3(1e-5));
  float w_u = dot(vW, w_t);
  float w_px = length(fwidth(vW));
  float w_hf = 1. - smoothstep(.35, .9, w_px);
  float w_streak = tNoise3(vec3(w_u * .9, vW.y * .04, 1.7)) * tNoise3(vec3(w_u * .22, vW.y * .011, 4.1));
  float w_base = 1. - smoothstep(0., 7., vW.y);
  float w_tone = tNoise3(vW * .012 + 2.3);
  float w_k = w_vert * (smoothstep(.22, .55, w_streak) * .17 * w_hf + w_base * .14) + (w_tone - .5) * .12;
  float w_roof = smoothstep(.8, .95, w_n.y) * step(4., vW.y);
  float w_r = tNoise3(vec3(vW.xz * .15, 9.)) * .6 + tNoise3(vec3(vW.xz * 1.7, 2.)) * .4 * w_hf;
  w_k += w_roof * (w_r - .5) * .38;
  w_k *= 1. - w_clean;
  diffuseColor.rgb *= 1. - w_k;
  tWeather = w_k;
}
#endif
`

// cls: 'glass' | 'frame' | 'leaf' | 'solid' (material class from the GLB material name prefix)
// Facade elevation on glass (build_skyline.py facade_material): the box UVs carry raw storeys from the
// band origin, folded here into the office band (repeat) or held in the shopfront band (clamp). textureGrad
// uses the unfolded coordinate, so mip selection doesn't jump at the fold seam. Roughness follows the
// image brightness: glass pixels are near black (0.06 glint), panels and blinds 0.65.
const FACADE_MAP = /* glsl */ `
#ifdef USE_MAP
{
  vec2 f_raw = vec2(vMapUv.x, 1. - vMapUv.y);                 // Blender v (glTF flips it)
  float f_v = uFacade.z > .5 ? fract(f_raw.y) : min(f_raw.y, .999);
  vec2 f_uv = vec2(f_raw.x, 1. - (f_v * uFacade.y + uFacade.x));
  vec2 f_d = vec2(1., uFacade.y);
  vec4 sampledDiffuseColor = textureGrad(map, f_uv, dFdx(f_raw) * f_d, dFdy(f_raw) * f_d);
  diffuseColor *= sampledDiffuseColor;
  tFacLum = dot(sampledDiffuseColor.rgb, vec3(.2126, .7152, .0722));
}
#endif
`

export function patchCityMaterial(material, { filler = false, cls = 'solid', facade = null } = {}) {
  material.defines = Object.assign(material.defines || {}, {
    T_GLASS: cls === 'glass' ? '1.' : '0.',
    T_FRAME: cls === 'frame' ? '1.' : '0.',
    T_LEAF: cls === 'leaf' ? '1.' : '0.'
  })
  if (filler) material.defines.T_FILLER = ''
  material.defines.GLASS_SKY_K = filler ? '.55' : '.85'
  const heroGlass = material.name === 'glass_hero', lawn = material.name === 'grass_lawn'
  // Only compile what a material uses: glass code for glass (and filler windows), weathering for opaque
  // surfaces. Leaves carry most of the overdraw (thousands of alpha-tested cards), so they get neither.
  const glassy = cls === 'glass' || filler, weathered = cls !== 'leaf' && cls !== 'glass' && !filler
  // curtain-wall mullions: anodised mid-grey aluminium, not mirror silver (which drew a bright white grid)
  if (material.name === 'metal_alu') { material.color.setRGB(.5, .51, .52); material.roughness = .5 }
  // road markings and park paths: weathered off-white, not fresh paper white
  if (material.name === 'paint_road') material.color.setRGB(.4, .39, .36)
  // facade: { v0, vspan, repeat, rough: [glass, panel] }
  const facadeU = facade && {
    uFacade: { value: new THREE.Vector3(facade.v0, facade.vspan, facade.repeat ? 1 : 0) },
    uFacRough: { value: new THREE.Vector2(...facade.rough) }
  }
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, CITY_U, facadeU || {})
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
      .replace('#include <color_fragment>', `float tGlassK = T_GLASS; float tGlassRough = 1.; float tWeather = 0.;\n#include <color_fragment>\n${FILLER_COLOR}${facade ? FACADE_GLASS_MASK : ''}${heroGlass ? HERO_GLASS_COLOR : ''}${lawn ? LAWN_COLOR : weathered ? WEATHER : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${glassy ? GLASS_PANES : ''}`)
    if (facadeU) sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFacade;\nuniform vec2 uFacRough;')
      .replace('#include <map_fragment>', `float tFacLum = 0.;\n${FACADE_MAP}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(uFacRough.x, uFacRough.y, clamp((tFacLum - .02) / .18, 0., 1.));`)
    // glass gloss: hero panes vary (tGlassRough); filler windows are glass, not plaster
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        roughnessFactor *= tGlassRough;
        roughnessFactor = clamp(roughnessFactor + tWeather * .35, 0., 1.);   // grime is matte
        #ifdef T_FILLER
          roughnessFactor = mix(roughnessFactor, .14, tGlassK);
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${cls === 'leaf' ? '' : NIGHT}
        ${glassy ? GLASS_SKY : ''}
        totalEmissiveRadiance += vec3(.7, .86, 1.) * tScan * 1.3 + vec3(1., .5, .2) * tCg * 2.4;`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1. - uDim;\n#include <fog_fragment>\ngl_FragColor.rgb = tHorizon(gl_FragColor.rgb, vW);')
  }
  material.customProgramCacheKey = () => `temira-city-${cls}${filler ? '-filler' : ''}${facade ? '-facade' : ''}${heroGlass ? '-heroglass' : ''}${lawn ? '-lawn' : ''}`
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
