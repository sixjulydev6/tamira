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

// Horizon fade: distant geometry dissolves into the sky dome's own colour for its view
// direction (same terms as atmosphere.js SKY_FRAG, without clouds or stars), so the city and
// ground have no hard edge against the sky.
export const HORIZON = /* glsl */ `
uniform vec3 uSkyZen; uniform vec3 uSkyMid; uniform vec3 uSkyHor; uniform vec3 uSkySun; uniform vec3 uSkySunDir; uniform vec3 uSkyGlow;
uniform float uSkyNight; uniform float uSkyXray; uniform float uSkyDim; uniform float uHzNear; uniform float uHzFar;
vec3 tSky(vec3 d){
  float h = d.y, hh = 1. - clamp(h, 0., 1.);
  vec3 col = mix(uSkyZen, uSkyMid, smoothstep(0., 1., pow(hh, 2.2)));
  col = mix(col, uSkyHor, pow(hh, 14.));
  float side = pow(max(dot(normalize(d.xz + 1e-5), normalize(uSkySunDir.xz + 1e-5)), 0.), 2.);
  col = mix(col, uSkyHor, side * pow(hh, 3.) * .3 * (1. - uSkyNight));
  col = mix(col, uSkyHor * .8, smoothstep(0., -.12, h));
  float sd = max(dot(d, uSkySunDir), 0.);
  col += uSkySun * (pow(sd, 14.) * .32 + pow(sd, 3.) * .14) * (1. - uSkyNight);
  col += uSkyGlow * exp(-max(h, 0.) * 7.) * uSkyNight;
  col = mix(col, vec3(.008, .013, .03) + col * .08, uSkyXray * .92);
  return col * (1. - uSkyDim);
}
vec3 tHorizon(vec3 c, vec3 w){
  vec3 d = w - cameraPosition;
  return mix(c, tSky(normalize(d)), smoothstep(uHzNear, uHzFar, length(d)));
}
`
