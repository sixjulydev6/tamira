import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

// Progressive aerial depth of field for the establishing shots. Blur is a continuous function
// of distance from the focal tower: zero at the tower, easing in gently behind it and growing
// all the way to the horizon, with a milder falloff in front. No thresholds, so there is no
// line where blur "starts". Gather blur on a golden-angle disc; each sample is weighted by its
// own blur relative to the centre's, so the sharp tower never bleeds into the soft background.
const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear, uFar, uFocus, uRange, uNearK, uMaxPx, uStrength, uSky;
varying vec2 vUv;
float coc(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  if (d >= .99999) return uSky;
  float z = -perspectiveDepthToViewZ(d, uNear, uFar);
  // even ramp from the focus: the park and district soften front-to-back into the far city,
  // one continuous layer rather than sharp foreground against a blurred backdrop
  float far = pow(clamp((z - uFocus) / uRange, 0., 1.), .85);
  float near = clamp((uFocus - z) / (uFocus * .75), 0., 1.);
  return max(far, near * near * uNearK);
}
void main(){
  vec4 base = texture2D(tDiffuse, vUv);
  float c0 = coc(vUv) * uStrength;
  if (c0 < .003) { gl_FragColor = base; return; }
  vec3 sum = base.rgb; float wsum = 1.;
  const int N = 24;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + .5) / float(N));
    float a = float(i) * 2.39996;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uMaxPx * c0 * uTexel;
    float w = clamp(coc(uv) * uStrength / c0, 0., 1.);
    sum += texture2D(tDiffuse, uv).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, base.a);
}
`

export class DepthBlurPass extends Pass {
  constructor(camera) {
    super()
    this.camera = camera
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() },
        uNear: { value: 1 }, uFar: { value: 2400 }, uFocus: { value: 700 }, uRange: { value: 1500 }, uNearK: { value: .45 },
        uMaxPx: { value: 8 }, uStrength: { value: 1 }, uSky: { value: .6 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: FRAG, depthTest: false, depthWrite: false
    })
    this.quad = new FullScreenQuad(this.material)
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms
    u.tDiffuse.value = readBuffer.texture
    u.tDepth.value = readBuffer.depthTexture
    u.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height)
    u.uNear.value = this.camera.near; u.uFar.value = this.camera.far
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }
  dispose() { this.material.dispose(); this.quad.dispose() }
}
