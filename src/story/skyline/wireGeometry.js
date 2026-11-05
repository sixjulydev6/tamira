import * as THREE from 'three'

// Orthogonal runs get small rounded bends (cable bend radius), then are swept into tubes.
function roundPath(pts, radius) {
  const clean = []
  for (const p of pts) {
    const l = clean[clean.length - 1]
    if (!l || Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]) > 1e-4) clean.push(p)
  }
  if (radius <= 0 || clean.length < 3) return clean.map(p => new THREE.Vector3(...p))
  const out = [new THREE.Vector3(...clean[0])]
  for (let i = 1; i < clean.length - 1; i++) {
    const a = new THREE.Vector3(...clean[i - 1]), p = new THREE.Vector3(...clean[i]), b = new THREE.Vector3(...clean[i + 1])
    const d1 = p.clone().sub(a), d2 = b.clone().sub(p)
    const r = Math.min(radius, d1.length() * 0.45, d2.length() * 0.45)
    d1.normalize(); d2.normalize()
    const s = p.clone().addScaledVector(d1, -r), e = p.clone().addScaledVector(d2, r)
    const STEPS = 5
    for (let k = 0; k <= STEPS; k++) {
      const t = k / STEPS, u = 1 - t
      out.push(new THREE.Vector3(
        u * u * s.x + 2 * u * t * p.x + t * t * e.x,
        u * u * s.y + 2 * u * t * p.y + t * t * e.y,
        u * u * s.z + 2 * u * t * p.z + t * t * e.z
      ))
    }
  }
  out.push(new THREE.Vector3(...clean[clean.length - 1]))
  return out
}

export function buildWireGeometry(runs, radial = 7) {
  const pos = [], nor = [], aS = [], aK = [], idx = []
  const lpos = [], laS = [], laK = []
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), prevT = new THREE.Vector3(), q = new THREE.Quaternion()
  const tmp = new THREE.Vector3()

  for (const run of runs) {
    const P = roundPath(run.pts, run.round || 0)
    if (P.length < 2) continue
    // arc length
    const S = [run.s0]
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + P[i].distanceTo(P[i - 1]))
    // lines (far-field glow)
    for (let i = 1; i < P.length; i++) {
      lpos.push(P[i - 1].x, P[i - 1].y, P[i - 1].z, P[i].x, P[i].y, P[i].z)
      laS.push(S[i - 1], S[i]); laK.push(run.kind, run.kind)
    }
    // tube: parallel-transport frames
    const base = pos.length / 3
    for (let i = 0; i < P.length; i++) {
      if (i === 0) T.copy(P[1]).sub(P[0]).normalize()
      else if (i === P.length - 1) T.copy(P[i]).sub(P[i - 1]).normalize()
      else T.copy(P[i + 1]).sub(P[i - 1]).normalize()
      if (i === 0) {
        tmp.set(0, 1, 0)
        if (Math.abs(T.dot(tmp)) > 0.9) tmp.set(1, 0, 0)
        N.crossVectors(T, tmp).normalize()
      } else {
        q.setFromUnitVectors(prevT, T)
        N.applyQuaternion(q).normalize()
      }
      Bn.crossVectors(T, N).normalize()
      prevT.copy(T)
      for (let k = 0; k < radial; k++) {
        const th = (k / radial) * Math.PI * 2
        const cx = Math.cos(th), sy = Math.sin(th)
        const nx = N.x * cx + Bn.x * sy, ny = N.y * cx + Bn.y * sy, nz = N.z * cx + Bn.z * sy
        pos.push(P[i].x + nx * run.r, P[i].y + ny * run.r, P[i].z + nz * run.r)
        nor.push(nx, ny, nz)
        aS.push(S[i]); aK.push(run.kind)
      }
      if (i > 0) {
        const a0 = base + (i - 1) * radial, b0 = base + i * radial
        for (let k = 0; k < radial; k++) {
          const k1 = (k + 1) % radial
          idx.push(a0 + k, b0 + k, a0 + k1, a0 + k1, b0 + k, b0 + k1)
        }
      }
    }
  }
  const tube = new THREE.BufferGeometry()
  tube.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  tube.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  tube.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1))
  tube.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1))
  tube.setIndex(idx)
  tube.computeBoundingSphere()
  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3))
  lines.setAttribute('aS', new THREE.Float32BufferAttribute(laS, 1))
  lines.setAttribute('aK', new THREE.Float32BufferAttribute(laK, 1))
  lines.computeBoundingSphere()
  return { tube, lines }
}

export { roundPath }
