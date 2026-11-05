import * as THREE from 'three'
import { S, live, look } from './state.js'
import { ceilY, SINGLE, RISER } from './layout.js'
import { ENTER } from './building.js'
import { WIRE_U } from './wiring.js'

const D2R = Math.PI / 180
const smooth = THREE.MathUtils.smoothstep
const lerp = THREE.MathUtils.lerp
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const ease = t => t * t * (3 - 2 * t)

// establishing shots: target, azimuth (deg, 0 = +Z, 90 = +X), elevation, distance, fov, lens shift.
// pt / pd / poy: portrait target, distance and vertical lens shift (phones frame the tower, not the skyline)
const KEYS = [
  { t: [40, 166, 4], az: 94, el: 0.6, d: 700, fov: 28, ox: 0.22, pt: [72, 112, 18], pd: 600, poy: 0.17 }, // 01 day, the reference composition
  { t: [46, 128, 8], az: 80, el: 3, d: 610, fov: 30, ox: 0.18, pt: [72, 112, 18], pd: 560, poy: 0.08 },   // 01 dusk
  { t: [40, 92, 0], az: 63, el: 14, d: 600, fov: 33, ox: 0.15, pt: [52, 96, 10], pd: 640 },               // 02 the scan
  { t: [70, 6, 30], az: 36, el: 30, d: 450, fov: 36, ox: 0.12, pt: [72, 10, 30], pd: 640 }                 // 03 the network
]

const yc = ceilY(SINGLE.floor)
const [RX, RZ] = RISER
// 04: climb the tower alongside the wire as it is drawn up the riser to the room
// close enough that the room fills the frame, low enough to look in under its ceiling
const ROOM_VIEW = { pos: [96.5, yc - 1.95, 58.5], tgt: [84.5, yc - 0.95, 38.5] }
const CLIMB_POS = [[172, 58, 130], [128, 100, 98], ROOM_VIEW.pos]
const CLIMB_TGT = [[RX, 22, RZ], [RX, 86, RZ], ROOM_VIEW.tgt]

// 05: into the room through its open corner, along the ceiling, under the wire to its far side
const CLOSE = 0.34 // final distance from the wire's axis: it fills most of the frame
const FOLLOW_POS = [
  ROOM_VIEW.pos, [94.6, yc - 1.1, 46.4], [88.6, yc - 0.85, 40.6],
  [88.4, yc - 0.85, 37.7], [85.95, yc - 0.42, 36.5], [ENTER[0] - CLOSE, ENTER[1] - 0.02, ENTER[2]]
].map(p => new THREE.Vector3(...p))
const FOLLOW_TGT = [
  ROOM_VIEW.tgt, [82, yc - 0.3, 33.6], [80.6, yc, RZ + 0.2],
  [86.5, yc, 33.4], [86.5, yc, 35.1], [ENTER[0], ENTER[1], ENTER[2]]
].map(p => new THREE.Vector3(...p))
const followPos = new THREE.CatmullRomCurve3(FOLLOW_POS, false, 'centripetal')
const followTgt = new THREE.CatmullRomCurve3(FOLLOW_TGT, false, 'centripetal')

function spherical(k, out) {
  const a = k.az * D2R, e = k.el * D2R
  return out.set(k.t[0] + Math.sin(a) * Math.cos(e) * k.d, k.t[1] + Math.sin(e) * k.d, k.t[2] + Math.cos(a) * Math.cos(e) * k.d)
}

export function createRig(camera, size) {
  const tmp = buildOnce(() => ({
    key: { t: [0, 0, 0], az: 0, el: 0, d: 0, fov: 30, ox: 0 },
    pos: new THREE.Vector3(), tgt: new THREE.Vector3(), p2: new THREE.Vector3(), t2: new THREE.Vector3(),
    sPos: new THREE.Vector3(), sTgt: new THREE.Vector3(), first: true, fov: 30, ox: 0, oy: 0,
    climb: null, climbPortrait: null
  }), [])

  const update = (t, dt) => {
    live.t = t
    live.dt = dt
    const aspect = size.width / size.height
    live.aspect = aspect
    const portrait = aspect < 1
    const reduced = live.reduced
    const breathe = reduced ? 0 : 1

    // pointer & touch look-around, eased
    const kp = 1 - Math.exp(-dt * 2.5)
    look.sx += (look.x - look.sx) * kp
    look.sy += (look.y - look.sy) * kp
    if (!live.dragging) { look.dx *= Math.exp(-dt * 0.8); look.dy *= Math.exp(-dt * 0.8) }

    /* ---------- establishing shots */
    const c = THREE.MathUtils.clamp(S.cam, 0, KEYS.length - 1)
    const i = Math.min(KEYS.length - 2, Math.floor(c))
    const f = eio(c - i)
    const A = KEYS[i], B = KEYS[i + 1], k = tmp.key
    const At = portrait && A.pt ? A.pt : A.t, Bt = portrait && B.pt ? B.pt : B.t
    for (let j = 0; j < 3; j++) k.t[j] = lerp(At[j], Bt[j], f)
    k.az = lerp(A.az, B.az, f); k.el = lerp(A.el, B.el, f)
    k.d = lerp(portrait && A.pd ? A.pd : A.d, portrait && B.pd ? B.pd : B.d, f)
    k.fov = lerp(A.fov, B.fov, f); k.ox = lerp(A.ox, B.ox, f)
    if (!portrait && aspect < 1.3) k.d *= 1.15 // tablets: keep the subject's margins
    k.az += (look.sx * 1.8 + look.dx) + Math.sin(t * 0.11) * 0.35 * breathe
    k.el += (look.sy * 1.0 + look.dy) + Math.sin(t * 0.07) * 0.2 * breathe
    spherical(k, tmp.pos)
    tmp.tgt.set(k.t[0], k.t[1], k.t[2])
    let fov = k.fov * (portrait ? 1.3 : 1)
    // portrait lens shift: positive drops the scene below the type, negative lifts it above the copy
    const poy = lerp(A.poy ?? -0.05, B.poy ?? -0.05, f)
    let ox = portrait ? 0 : k.ox, oy = portrait ? poy : 0

    /* ---------- 04: climb the tower with the wire */
    if (!tmp.climb || tmp.climbPortrait !== portrait) {
      // the climb starts exactly where the network shot ends
      const K3 = { ...KEYS[3], t: portrait ? KEYS[3].pt : KEYS[3].t, d: portrait ? KEYS[3].pd : KEYS[3].d }
      const start = spherical(K3, new THREE.Vector3())
      const stretch = portrait ? 1.25 : 1
      const pos = [start, ...CLIMB_POS.map((p, n) => {
        const v = new THREE.Vector3(...p)
        if (n < CLIMB_POS.length - 1) v.sub(new THREE.Vector3(RX, v.y, RZ)).multiplyScalar(stretch).add(new THREE.Vector3(RX, v.y, RZ))
        return v
      })]
      if (portrait) pos[pos.length - 1].sub(new THREE.Vector3(...ROOM_VIEW.tgt)).multiplyScalar(2.1).add(new THREE.Vector3(...ROOM_VIEW.tgt))
      tmp.climb = {
        pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'),
        tgt: new THREE.CatmullRomCurve3([new THREE.Vector3(...K3.t), ...CLIMB_TGT.map(p => new THREE.Vector3(...p))], false, 'centripetal')
      }
      tmp.climbPortrait = portrait
    }
    if (S.climb > 0) {
      const u = eio(S.climb)
      tmp.climb.pos.getPoint(u, tmp.p2)
      tmp.climb.tgt.getPoint(u, tmp.t2)
      tmp.pos.copy(tmp.p2)
      tmp.tgt.copy(tmp.t2)
      tmp.pos.x += look.sx * 3 * (1 - u * 0.6); tmp.pos.y += look.sy * 2
      fov = lerp(fov, portrait ? 50 : 38, smooth(S.climb, 0, 0.4))
      ox = lerp(ox, portrait ? 0 : 0.14, smooth(S.climb, 0, 0.3))
      oy = lerp(oy, portrait ? -0.06 : 0, smooth(S.climb, 0, 0.3))
    }

    /* ---------- 05: ride the wire into the room */
    if (S.follow > 0) {
      const u = ease(S.follow)
      followPos.getPoint(u, tmp.p2)
      followTgt.getPoint(u, tmp.t2)
      if (portrait && u < 0.25) {
        // phones started the climb further back; ease into the shared path
        const back = (1 - u / 0.25) * 1.1
        tmp.p2.sub(tmp.t2).multiplyScalar(1 + back).add(tmp.t2)
      }
      tmp.pos.copy(tmp.p2)
      tmp.tgt.copy(tmp.t2)
      const close = smooth(S.follow, 0.4, 1)
      fov = lerp(portrait ? 50 : 38, portrait ? 52 : 42, close)
      ox = lerp(portrait ? 0 : 0.14, 0, smooth(S.follow, 0, 0.35)); oy = lerp(portrait ? -0.06 : 0, 0, smooth(S.follow, 0, 0.35))
      const sway = (1 - close) * 0.5
      tmp.pos.x += look.sx * sway; tmp.pos.y += look.sy * sway * 0.6
      WIRE_U.uHead.value.copy(tmp.t2)
      WIRE_U.uHeadOn.value = smooth(S.follow, 0, 0.1)
    } else {
      WIRE_U.uHeadOn.value = 0
    }

    /* ---------- 06: orbit the cable as it comes apart */
    if (S.enter > 0) {
      const e = ease(S.enter), x = eio(S.explode)
      // orbit from the wire's side toward its cut end: the stepped layers open to the right
      const phi = lerp(180, 128, x) * D2R, el = lerp(0, 16, x) * D2R
      const dist = lerp(CLOSE, portrait ? 1.6 : 1.2, smooth(S.explode, 0, 1))
      tmp.t2.set(ENTER[0], ENTER[1], ENTER[2] - 0.2 * x)
      tmp.p2.set(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)).multiplyScalar(dist).add(tmp.t2)
      tmp.p2.x += look.sx * 0.04 * x; tmp.p2.y += look.sy * 0.03 * x
      tmp.pos.lerp(tmp.p2, e)
      tmp.tgt.lerp(tmp.t2, e)
      fov = lerp(fov, portrait ? 48 : 34, e)
      ox = lerp(ox, portrait ? 0 : 0.12, smooth(S.explode, 0.2, 0.8))
      oy = lerp(oy, portrait ? 0.17 : 0.24, smooth(S.explode, 0.2, 0.8))
    }

    // critically damped follow so keyboard jumps and flicks stay smooth
    const kd = tmp.first ? 1 : 1 - Math.exp(-dt * (reduced ? 14 : 7))
    tmp.first = false
    tmp.sPos.lerp(tmp.pos, kd)
    tmp.sTgt.lerp(tmp.tgt, kd)
    tmp.fov += (fov - tmp.fov) * kd
    tmp.ox += (ox - tmp.ox) * kd
    tmp.oy += (oy - tmp.oy) * kd

    camera.position.copy(tmp.sPos)
    camera.lookAt(tmp.sTgt)
    const dist = tmp.sPos.distanceTo(tmp.sTgt)
    camera.near = THREE.MathUtils.clamp(dist * 0.006, 0.004, 2)
    camera.far = 2400
    camera.fov = tmp.fov
    const W = size.width, H = size.height
    camera.setViewOffset(W, H, -tmp.ox * W, -tmp.oy * H, W, H)
    camera.updateProjectionMatrix()
  };
  return {update}
}

function buildOnce(fn){return fn();}
