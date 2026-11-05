import * as THREE from 'three'

// Reads the city texture at low resolution so edges and points can skip foliage.
export function textureSampler(image, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(image, 0, 0, size, size)
  const data = g.getImageData(0, 0, size, size).data
  return (u, v) => {
    const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)))
    const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)))
    const i = (y * size + x) * 4
    return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]
  }
}
const isFoliage = ([r, g, b]) => g > r * 1.08 && g > b * 1.02 && g - Math.min(r, b) > 0.05

// Architectural outlines only: creases sharper than `angle`, open borders, no slivers, no trees.
export function extractEdges(geometry, sample, { angle = 32, minLen = 0.9 } = {}) {
  const pos = geometry.attributes.position, uv = geometry.attributes.uv, idx = geometry.index
  const weld = new Map(), wid = []
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`
    if (!weld.has(k)) weld.set(k, weld.size)
    wid.push(weld.get(k))
  }
  const edges = new Map()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  const tri = idx ? idx.count / 3 : pos.count / 3
  for (let t = 0; t < tri; t++) {
    const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic)
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a))
    const area = n.length() / 2
    if (area < 1e-6) continue
    n.normalize()
    const verts = [ia, ib, ic]
    for (let k = 0; k < 3; k++) {
      const p = verts[k], q = verts[(k + 1) % 3]
      const wp = wid[p], wq = wid[q]
      const key = wp < wq ? `${wp}_${wq}` : `${wq}_${wp}`
      let ed = edges.get(key)
      if (!ed) {
        ed = { p, q, normals: [], u: (uv.getX(p) + uv.getX(q)) / 2, v: (uv.getY(p) + uv.getY(q)) / 2 }
        edges.set(key, ed)
      }
      ed.normals.push(n.clone())
    }
  }
  const cos = Math.cos((angle * Math.PI) / 180)
  const out = []
  for (const ed of edges.values()) {
    a.fromBufferAttribute(pos, ed.p); b.fromBufferAttribute(pos, ed.q)
    if (a.distanceTo(b) < minLen) continue
    const keep = ed.normals.length === 1 || (ed.normals.length >= 2 && ed.normals[0].dot(ed.normals[1]) < cos)
    if (!keep) continue
    if (isFoliage(sample(ed.u, ed.v))) continue
    out.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return g
}

// A LiDAR-like point cloud spread over the surfaces (area-weighted), foliage excluded.
export function samplePoints(geometry, sample, count = 24000, seed = 3) {
  let s = seed
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
  const pos = geometry.attributes.position, uv = geometry.attributes.uv, idx = geometry.index
  const tri = idx ? idx.count / 3 : pos.count / 3
  const areas = new Float32Array(tri)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  let total = 0
  for (let t = 0; t < tri; t++) {
    const ia = idx.getX(t * 3), ib = idx.getX(t * 3 + 1), ic = idx.getX(t * 3 + 2)
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic)
    total += areas[t] = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2
  }
  const cdf = new Float32Array(tri)
  let acc = 0
  for (let t = 0; t < tri; t++) { acc += areas[t] / total; cdf[t] = acc }
  const P = [], S = []
  let guard = 0
  while (P.length / 3 < count && guard++ < count * 4) {
    const r = rnd()
    let lo = 0, hi = tri - 1
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m }
    const t = lo
    const ia = idx.getX(t * 3), ib = idx.getX(t * 3 + 1), ic = idx.getX(t * 3 + 2)
    let u = rnd(), v = rnd()
    if (u + v > 1) { u = 1 - u; v = 1 - v }
    const w = 1 - u - v
    const tu = uv.getX(ia) * w + uv.getX(ib) * u + uv.getX(ic) * v
    const tv = uv.getY(ia) * w + uv.getY(ib) * u + uv.getY(ic) * v
    if (isFoliage(sample(tu, tv))) continue
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic)
    P.push(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v)
    S.push(rnd())
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(S, 1))
  return g
}

// 12 edges per filler box, baked to world space.
export function boxEdges(instanced) {
  const m = new THREE.Matrix4(), v = new THREE.Vector3()
  const corners = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]]
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
  const out = []
  for (let i = 0; i < instanced.count; i++) {
    instanced.getMatrixAt(i, m)
    const w = corners.map(cn => v.set(...cn).applyMatrix4(m).toArray())
    for (const [p, q] of E) out.push(...w[p], ...w[q])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return g
}
