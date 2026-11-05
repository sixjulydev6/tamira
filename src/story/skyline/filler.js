import * as THREE from 'three'
import { patchCityMaterial } from './cityMaterial.js'
import { rng } from './layout.js'

// A hazy outer city beyond the modelled district so the skyline sits inside a metropolis
// rather than on an empty plane. Facades are storey bands drawn in the shader (no atlas
// patches); nothing is placed in the opening sightline, and nothing is taller than the tower.
export function createFiller(envMap, count = 300) {
  const mesh = buildOnce(() => {
    const r = rng(7)
    const geo = new THREE.BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0)
    const lowCount = Math.round(count * 0.55)
    const total = count + lowCount
    const mat = patchCityMaterial(new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, envMap, envMapIntensity: 0.35 }), { filler: true })
    const mesh = new THREE.InstancedMesh(geo, mat, total)
    const m = new THREE.Matrix4(), c = new THREE.Color()
    let i = 0, guard = 0
    // low-rise blocks in front of the skyline: urban texture the camera looks over, never through
    for (let gx = 262; gx < 700 && i < lowCount; gx += 58) {
      for (let gz = -520; gz < 520 && i < lowCount; gz += 54) {
        if (r() < 0.22) continue
        const w = 22 + r() * 22, d = 20 + r() * 20, h = 5 + r() * 10 * (r() < 0.15 ? 2 : 1)
        m.compose(new THREE.Vector3(gx + r() * 8, 0, gz + r() * 8), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, c.setHSL(0.08, 0.07, 0.36 + r() * 0.14))
        i++
      }
    }
    while (i < total && guard++ < total * 40) {
      const ang = r() * Math.PI * 2
      const dist = 380 + Math.pow(r(), 0.75) * 1050
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist
      if (Math.abs(x) < 262 && z > -312 && z < 772) continue // modelled district + front-left park
      if (x > -400 && x < 262 && z > 240 && z < 1150) continue // the park and its first groves stay open
      if (x > 60 && Math.abs(z) < 720) continue // nothing between the camera and the skyline
      const far = (dist - 380) / 1050
      let h = (16 + r() * 62) * (1 - far * 0.45)
      // beyond the park the city rises gradually: low blocks among the trees, taller with distance
      if (z > 240 && z < 1150 && x < 262) h *= 0.2 + 0.8 * THREE.MathUtils.smoothstep(-x, 400, 1250)
      const w = 20 + r() * 28, d = 20 + r() * 28
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
      mesh.setMatrixAt(i, m)
      c.setHSL(0.07 + r() * 0.5, 0.05, 0.38 + r() * 0.16)
      mesh.setColorAt(i, c)
      i++
    }
    mesh.count = i
    mesh.receiveShadow = true
    // the x-ray state shows only the wired district: the outer city dissolves with no outlines
    // (user direction 2026-11-05; the solid blocks are already discarded by the x-ray shader)
    return mesh
  }, [count, envMap])

  const group=new THREE.Group();group.add(mesh);return group;
}
function buildOnce(fn){return fn();}
