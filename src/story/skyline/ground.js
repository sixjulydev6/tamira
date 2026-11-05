import * as THREE from 'three'
import { S } from './state.js'
import { CITY_U } from './cityMaterial.js'
import { HORIZON } from './glsl.js'

const smooth = THREE.MathUtils.smoothstep

export function createGround(gl) {
  const groundU = buildOnce(() => ({ uXray: { value: 0 }, uNight: CITY_U.uNight, uTime: CITY_U.uTime,
    ...Object.fromEntries(Object.entries(CITY_U).filter(([k]) => k.startsWith('uSky') || k.startsWith('uHz'))) }), [])

  const ground = buildOnce(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#4a4c47', roughness: 0.96, metalness: 0, transparent: true })
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, groundU)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 gW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n gW = (modelMatrix * vec4(transformed, 1.)).xyz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 gW; uniform float uXray; uniform float uNight;
          ${HORIZON}
          float g_h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          float g_n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(g_h(i), g_h(i+vec2(1,0)), f.x), mix(g_h(i+vec2(0,1)), g_h(i+vec2(1,1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float g_patch = g_n(gW.xz * .012) * .6 + g_n(gW.xz * .06) * .4;
          vec3 g_park = vec3(.17, .24, .13);
          vec3 g_paved = vec3(.3, .31, .3);
          diffuseColor.rgb = mix(g_paved, g_park, smoothstep(.42, .72, g_patch));
          // streets, kept quiet so they read as texture, not graphics
          vec2 g_r = abs(fract(gW.xz / 120. + .5) - .5) * 120.;
          float g_st = 1. - smoothstep(5., 7.5, min(g_r.x, g_r.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.2, .21, .22), g_st * .5);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1., .62, .3) * g_st * uNight * .05 * (.6 + .4 * g_n(gW.xz * .2));`)
        .replace('#include <fog_fragment>', '#include <fog_fragment>\n gl_FragColor.rgb = tHorizon(gl_FragColor.rgb, gW);')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a *= 1. - uXray;')
    }
    return m
  }, [groundU])

  // x-ray blueprint grid on the ground plane
  const gridMat = buildOnce(() => new THREE.ShaderMaterial({
    uniforms: { uX: { value: 0 }, uTime: CITY_U.uTime, uDim: CITY_U.uDim },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform float uX; uniform float uTime; uniform float uDim; varying vec3 vW;
      void main(){
        // a quiet survey grid of dots, the way a scanner sees open ground
        vec2 c = fract(vW.xz / 9. + .5) - .5;
        float dotA = smoothstep(.055, .0, length(c));
        vec2 m = abs(fract(vW.xz / 108. + .5) - .5) * 108.;
        float major = smoothstep(.45, .0, min(m.x, m.y)) * .35;
        float r = length(vW.xz - vec2(60., 10.));
        float fade = exp(-r / 420.);
        float wave = .6 + .4 * smoothstep(.0, 1., sin(r * .02 - uTime * .9));
        vec3 col = vec3(.55, .7, 1.) * (dotA * .55 * wave + major * .25) * fade;
        gl_FragColor = vec4(col * uX * (1. - uDim * .7), 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }), [])

  const update = () => {
    groundU.uXray.value = smooth(S.xray, 0.0, 0.45)
    gridMat.uniforms.uX.value = smooth(S.xray, 0.2, 0.8)
  };
  const group=new THREE.Group();
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(3600,3600),ground);plane.rotation.x=-Math.PI/2;plane.position.y=-.05;plane.renderOrder=1;
  const grid=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),gridMat);grid.rotation.x=-Math.PI/2;grid.position.y=.05;grid.renderOrder=2;
  group.add(plane,grid);return {group,update};
}
function buildOnce(fn){return fn();}
