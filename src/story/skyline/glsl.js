// Shared GLSL. Every surface of the city uses the same dissolve / cutaway rules so the
// solid city, its x-ray ghost and its outlines always agree on what is visible.

export const NOISE = /* glsl */ `
float tHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tHash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float tNoise3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(tHash13(i), tHash13(i + vec3(1,0,0)), f.x), mix(tHash13(i + vec3(0,1,0)), tHash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tHash13(i + vec3(0,0,1)), tHash13(i + vec3(1,0,1)), f.x), mix(tHash13(i + vec3(0,1,1)), tHash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

export const XRAY_UNIFORMS = /* glsl */ `
uniform float uXray;
uniform float uHeroSolid;
uniform vec3 uHeroMin;
uniform vec3 uHeroMax;
uniform float uCut;
uniform vec3 uCutMin;
uniform vec3 uCutMax;
uniform float uFloorY0;
uniform float uFloorH;
uniform float uFloors;
`

// fd > 0 → still solid; fd < 0 → dissolved into x-ray. scan = glow band at the front.
// cutEdge > 0 → removed by the cutaway; cutGlow = seam glow.
export const XRAY_FUNCS = /* glsl */ `
bool tInside(vec3 p, vec3 a, vec3 b){ return all(greaterThan(p, a)) && all(lessThan(p, b)); }
float tXrayAmount(vec3 p){
  bool hero = tInside(p, uHeroMin, uHeroMax);
  return uXray * (hero ? 1. - uHeroSolid : 1.);
}
float tFront(vec3 p, float xr){
  float n = tNoise3(p * vec3(.05, .02, .05));
  float front = mix(-40., 250., xr);
  return p.y + (n - .5) * 14. - front;
}
float tCut(vec3 p){
  if (uCut <= 0. || !tInside(p, uCutMin, uCutMax)) return -1.;
  float fi = floor((p.y - uFloorY0) / uFloorH);
  float k = uCut * (uFloors + 10.) - (uFloors - fi);
  float s = max((uCutMax.x - p.x) / (uCutMax.x - uCutMin.x), (uCutMax.z - p.z) / (uCutMax.z - uCutMin.z));
  return k - s * 1.6;
}
`
