import * as THREE from 'three'
import { patchCityMaterial, makeEdgeMaterial } from './cityMaterial.js'
import { boxEdges } from './lidar.js'
import { rng } from './layout.js'

// A hazy outer city beyond the model so the skyline sits inside a metropolis rather
// than on an empty plane. Facades reuse patches of the model's own texture; nothing
// is placed in the opening sightline, and nothing is taller than the focal tower.
export function createFiller(map, count = 300) {
  const { mesh, outline } = buildOnce(() => {
    const r = rng(7)
    const geo = new THREE.BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0)
    const fmap = map.clone()
    fmap.flipY = false
    fmap.colorSpace = THREE.SRGBColorSpace
    fmap.needsUpdate = true
    const lowCount = Math.round(count * 0.55)
    const total = count + lowCount
    const mat = patchCityMaterial(new THREE.MeshStandardMaterial({ map: fmap, roughness: 0.9, metalness: 0 }), { filler: true })
    const mesh = new THREE.InstancedMesh(geo, mat, total)
    const m = new THREE.Matrix4(), c = new THREE.Color()
    let i = 0, guard = 0
    // low-rise blocks in front of the skyline: urban texture the camera looks over, never through
    for (let gx = 190; gx < 700 && i < lowCount; gx += 58) {
      for (let gz = -520; gz < 520 && i < lowCount; gz += 54) {
        if (r() < 0.22) continue
        const w = 22 + r() * 22, d = 20 + r() * 20, h = 7 + r() * 16 * (r() < 0.15 ? 2.2 : 1)
        m.compose(new THREE.Vector3(gx + r() * 8, 0, gz + r() * 8), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, c.setHSL(0.08, 0.06, 0.66 + r() * 0.2))
        i++
      }
    }
    while (i < total && guard++ < total * 40) {
      const ang = r() * Math.PI * 2
      const dist = 380 + Math.pow(r(), 0.75) * 1050
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist
      if (Math.abs(x) < 220 && Math.abs(z) < 260) continue
      if (x > 60 && Math.abs(z) < 720) continue // nothing between the camera and the skyline
      const far = (dist - 380) / 1050
      const h = (24 + r() * 86) * (1 - far * 0.5)
      const w = 20 + r() * 28, d = 20 + r() * 28
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
      mesh.setMatrixAt(i, m)
      c.setHSL(0.58, 0.05, 0.62 + r() * 0.18)
      mesh.setColorAt(i, c)
      i++
    }
    mesh.count = i
    mesh.receiveShadow = true
    // in the x-ray state the outer city is just its outlines, fading with distance
    const outline = new THREE.LineSegments(boxEdges(mesh), makeEdgeMaterial(1300))
    outline.renderOrder = 3
    outline.frustumCulled = false
    return { mesh, outline }
  }, [count, map])

  const group=new THREE.Group();group.add(mesh,outline);return group;
}
function buildOnce(fn){return fn();}
