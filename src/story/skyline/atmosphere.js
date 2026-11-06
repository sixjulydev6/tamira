import * as THREE from 'three'
import { S, live } from './state.js'

const smooth = THREE.MathUtils.smoothstep
const DUSK = 0.55

// time-of-day palette: golden hour → sunset → blue hour → night
const KEYS = [0, 0.38, 0.7, 1]
const PAL = {
  // soft, clean daylight blue (white type must read on it) → sunset → blue hour → twilight night
  zenith: ['#4a8ce2', '#2f4f93', '#13285c', '#0b1a3e'],
  mid: ['#7fb3ec', '#8c8fbc', '#22417f', '#173170'],
  horizon: ['#cfe3f6', '#eaa57c', '#3d5b97', '#2c4682'],
  sun: ['#fff0da', '#ff9a58', '#ff6a3a', '#ff6a3a'],
  sunI: [4.6, 2.2, 0.15, 0],
  hemiSky: ['#b8d3ff', '#7a86b8', '#33508f', '#2c4580'],
  hemiGround: ['#6f6656', '#4f3f33', '#141826', '#0b0e18'],
  hemiI: [1.54, 0.55, 0.34, 0.28],
  fog: ['#d3e3f1', '#a38d97', '#1f2f57', '#15254d'],
  fogD: [0.00022, 0.00042, 0.0006, 0.00062], // day back to light haze (2026-11-06 ?gui settings): the far blocks now have real facades
  glow: ['#000000', '#000000', '#2f2b4a', '#3a2f4c']
}
const cols = {}
for (const k in PAL) if (typeof PAL[k][0] === 'string') cols[k] = PAL[k].map(c => new THREE.Color(c))
function sample(key, n, out) {
  let i = 0
  while (i < KEYS.length - 2 && n > KEYS[i + 1]) i++
  const f = smooth(n, KEYS[i], KEYS[i + 1])
  if (out) return out.copy(cols[key][i]).lerp(cols[key][i + 1], f)
  return THREE.MathUtils.lerp(PAL[key][i], PAL[key][i + 1], f)
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  gl_Position = p.xyww;
}
`
const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform vec3 uGlow;
uniform float uNight; uniform float uTime; uniform float uXray; uniform float uDim;
varying vec3 vDir;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float hh = 1. - clamp(h, 0., 1.);
  vec3 col = mix(uZenith, uMid, smoothstep(0., 1., pow(hh, 2.2)));
  col = mix(col, uHorizon, pow(hh, 14.));
  // warmer, brighter sky on the sun's side
  float side = pow(max(dot(normalize(d.xz), normalize(uSunDir.xz)), 0.), 2.);
  col = mix(col, uHorizon, side * pow(1. - clamp(h, 0., 1.), 3.) * .3 * (1. - uNight));
  col = mix(col, uHorizon * .8, smoothstep(0., -.12, h));
  float sd = max(dot(d, uSunDir), 0.);
  float day = 1. - uNight;
  col += uSunCol * (pow(sd, 1400.) * 22. + pow(sd, 14.) * .32 + pow(sd, 3.) * .14) * day;
  // drifting clouds
  if (h > 0.) {
    vec2 p = d.xz / (h + .14) * 1.6 + vec2(uTime * .0045, uTime * .0018);
    float c = fbm(p);
    float cov = smoothstep(.56, .82, c) * smoothstep(0., .22, h);
    float lit = pow(sd, 4.);
    vec3 cDay = mix(vec3(1., .96, .92), uSunCol * 1.15, .35 + lit * .4);
    vec3 cNight = mix(vec3(.11, .15, .28), uGlow * 1.4, .35);
    col = mix(col, mix(cDay, cNight, smoothstep(.45, .9, uNight)) * (.78 + .22 * c), cov * mix(.7, .55, uNight));
  }
  // stars
  vec3 sp = d * 520.;
  float st = h21(floor(sp.xz + floor(sp.y) * 17.));
  float star = step(.9978, st) * smoothstep(.62, .0, length(fract(sp.xz) - .5)) * (.5 + .5 * sin(uTime * (1. + st * 3.) + st * 50.));
  col += vec3(.9, .95, 1.) * star * smoothstep(.55, 1., uNight) * smoothstep(.1, .4, h) * .7;
  // light pollution above the skyline
  col += uGlow * exp(-max(h, 0.) * 7.) * uNight;
  // the scanner's view: the sky falls away to near-black
  col = mix(col, vec3(.008, .013, .03) + col * .08, uXray * .92);
  gl_FragColor = vec4(col * (1. - uDim), 1.);
}
`


// Live palette edits (?gui): keep the cached Color objects in step with PAL.
function setPal(key, i, v) {
  PAL[key][i] = v
  if (cols[key]) cols[key][i].set(v)
}

export { SKY_VERT, SKY_FRAG, sample, DUSK, PAL, KEYS, setPal };
