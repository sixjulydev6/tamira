// The one highlighted room inside the focal tower, and the citywide network that feeds it.
// Everything here is plain data; the components turn it into meshes and swept tubes.
import { FLOOR, XM, ZM, RISER, UG, SUBSTATION, TRUNK_X, TRUNK_Z, BUILDINGS, SINGLE, floorBase, ceilY, rng } from './layout.js'

const FH = FLOOR.h
const hex = h => {
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
}

// the corner room on the followed wire's floor
export const ROOM = { x0: XM, x1: 90.4, z0: ZM, z1: 47.4, floor: SINGLE.floor }
ROOM.yb = floorBase(ROOM.floor)
ROOM.yt = ROOM.yb + FH
// the ceiling light the wire powers, and a pendant over the dining table
export const ROOM_LIGHTS = [[84.5, ceilY(ROOM.floor) - 0.35, 39.2], [82.0, ROOM.yb + 2.35, 35.8]]

/* ------------------------------------------------------------------ the room */
export function buildRoom() {
  const r = rng(2024)
  const boxes = [], glows = [], curtains = []
  const box = (cx, cy, cz, sx, sy, sz, c) => boxes.push([cx, cy, cz, sx, sy, sz, ...hex(c)])
  const glow = (cx, cy, cz, sx, sy, sz, c, k = 1) => glows.push([cx, cy, cz, sx, sy, sz, ...hex(c).map(v => v * k)])
  const { x0, x1, z0, z1, yb } = ROOM
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0
  const wallH = FH - 0.3, wy = yb + wallH / 2, ycl = yb + FH - 0.3

  // structure: floor slab, oak floor, ceiling, slab edges on the open faces
  box(cx, yb - 0.15, cz, w, 0.3, d, '#8f8d88')
  box(cx, yb + 0.02, cz, w - 0.2, 0.04, d - 0.2, '#a9845f')
  box(cx, ycl + 0.15, cz, w, 0.3, d, '#d9d4cc')
  box(x1 - 0.07, yb - 0.15, cz, 0.14, 0.34, d, '#8a8e94')
  box(cx, yb - 0.15, z1 - 0.07, w, 0.34, 0.14, '#8a8e94')
  box(x1 - 0.07, ycl + 0.15, cz, 0.14, 0.34, d, '#8a8e94')
  box(cx, ycl + 0.15, z1 - 0.07, w, 0.34, 0.14, '#8a8e94')
  // the two inner walls (partitions), with a door and a lintel
  box(x0 - 0.1, wy, cz, 0.2, wallH, d, '#ece6dc')
  box((x0 + 80.0) / 2, wy, z0 - 0.1, 80.0 - x0, wallH, 0.2, '#e6e0d6')
  box((81.1 + x1) / 2, wy, z0 - 0.1, x1 - 81.1, wallH, 0.2, '#e6e0d6')
  box(80.55, yb + 2.2 + (wallH - 2.2) / 2, z0 - 0.1, 1.1, wallH - 2.2, 0.2, '#e6e0d6')
  box(80.55, yb + 1.05, z0 - 0.02, 1.0, 2.1, 0.05, '#2d2c30')
  // curtain-wall mullions on the open faces
  for (let z = z0 + 0.05; z <= z1; z += 2.7) box(x1 - 0.05, wy, z, 0.07, wallH, 0.09, '#757b84')
  for (let x = x0 + 0.05; x <= x1; x += 2.7) box(x, wy, z1 - 0.05, 0.09, wallH, 0.07, '#757b84')
  // riser chase in the inner corner, where the wire comes up through the slab
  box(RISER[0] - 0.16, wy, RISER[1] + 0.12, 0.08, wallH, 0.55, '#80858d')

  // living area by the corner windows
  box(85.6, yb + 0.03, 42.6, 5.2, 0.02, 4.4, '#8b806f')
  box(85.6, yb + 0.22, 45.6, 3.4, 0.44, 1.0, '#3e4958')
  box(85.6, yb + 0.62, 46.15, 3.4, 0.5, 0.24, '#3e4958')
  box(83.8, yb + 0.36, 45.6, 0.22, 0.6, 1.0, '#3a4452')
  box(87.4, yb + 0.36, 45.6, 0.22, 0.6, 1.0, '#3a4452')
  box(87.0, yb + 0.22, 44.3, 1.0, 0.44, 1.6, '#3e4958')
  for (const [ox, oz] of [[-0.9, 0], [-0.1, 0]]) box(84.9 + ox * 1.1, yb + 0.58, 45.95 + oz, 0.5, 0.36, 0.14, '#d9cdb8')
  box(85.6, yb + 0.2, 42.7, 1.4, 0.36, 0.8, '#2d2723')
  box(85.6, yb + 0.4, 42.7, 1.44, 0.04, 0.84, '#b8a389')
  box(84.3, yb + 0.32, 40.4, 0.85, 0.64, 0.85, '#8b6a4f')
  box(86.9, yb + 0.32, 40.4, 0.85, 0.64, 0.85, '#8b6a4f')
  box(88.2, yb + 0.8, 46.4, 0.05, 1.6, 0.05, '#1e1e20')
  glow(88.2, yb + 1.64, 46.4, 0.42, 0.34, 0.42, '#ffcb8a', 3.2)
  // dining by the inner corner
  box(82.0, yb + 0.74, 35.8, 2.2, 0.06, 1.1, '#6d4f38')
  box(82.0, yb + 0.37, 35.8, 0.22, 0.72, 0.22, '#3a2c22')
  for (const [ox, oz] of [[-0.75, -0.8], [0, -0.8], [0.75, -0.8], [-0.75, 0.8], [0, 0.8], [0.75, 0.8]]) {
    box(82.0 + ox, yb + 0.24, 35.8 + oz, 0.44, 0.48, 0.44, '#2f3034')
    box(82.0 + ox, yb + 0.68, 35.8 + oz + Math.sign(oz) * 0.2, 0.44, 0.5, 0.06, '#2f3034')
  }
  box(82.0, yb + 2.9, 35.8, 0.02, 0.9, 0.02, '#1e1e20')
  glow(82.0, yb + 2.35, 35.8, 0.56, 0.16, 0.56, '#ffc98a', 3.4)
  // sideboard, art and shelves on the inner walls
  box(x0 + 0.25, yb + 0.42, 39.5, 0.46, 0.84, 2.8, '#3a2f28')
  box(x0 + 0.02, yb + 1.85, 39.5, 0.04, 1.0, 1.5, '#c46f4a')
  box(x0 + 0.02, yb + 1.7, 44.4, 0.04, 0.8, 0.8, '#2f5d6b')
  box(84.6, yb + 1.15, z0 + 0.2, 2.6, 2.3, 0.36, '#5e4a3b')
  for (let i = 0; i < 4; i++) box(84.6, yb + 0.45 + i * 0.55, z0 + 0.22, 2.4, 0.04, 0.32, '#4c3c30')
  for (let i = 0; i < 14; i++) box(83.5 + r() * 2.2, yb + 0.62 + Math.floor(r() * 4) * 0.55, z0 + 0.24, 0.06 + r() * 0.08, 0.26 + r() * 0.12, 0.24, ['#b94a3a', '#e3d2b0', '#2d4a6a', '#3c3c3c', '#c9a14a'][Math.floor(r() * 5)])
  // plants
  box(89.7, yb + 0.25, 32.3, 0.5, 0.5, 0.5, '#c9bba5')
  box(89.7, yb + 1.0, 32.3, 0.95, 1.1, 0.95, '#3f6b3c')
  box(83.3, yb + 0.22, 46.6, 0.42, 0.44, 0.42, '#c9bba5')
  box(83.3, yb + 0.85, 46.6, 0.7, 0.85, 0.7, '#4a7a45')
  // the light this wire feeds
  glow(ROOM_LIGHTS[0][0], ycl - 0.03, ROOM_LIGHTS[0][2], 1.1, 0.04, 1.1, '#ffe2bd', 6)
  glow(88.0, ycl - 0.03, 36.0, 1.6, 0.04, 0.5, '#ffe2bd', 3.5)

  // curtains gathered at the bays; the bays the camera flies through stay open
  for (const z of [33.4, 36.1, 40.2]) curtains.push([x1 - 0.32, yb + 0.12, z, Math.PI / 2, 0.55, FH - 0.62, r()])
  for (const x of [80.3, 83.0, 85.7]) curtains.push([x, yb + 0.12, z1 - 0.32, 0, 0.55, FH - 0.62, r()])

  return { boxes, glows, curtains }
}

/* ------------------------------------------------------------------ wiring */
// run: { pts: [[x,y,z]…], r, kind (1 network, 2 the followed wire), s0, round }
const len3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])

// the followed wire is drawn a touch thicker so it reads as the hero at every distance
export const SINGLE_R = 0.085

export function buildWiring() {
  const runs = []
  const add = (pts, r, kind, s0, round) => runs.push({ pts, r, kind, s0, round })
  const NET_R = 0.32, ROUND_NET = 2.2
  const [sx, , sz] = SUBSTATION

  // network: main trunk from the substation, then north–south feeders
  add([[sx, UG, sz], [sx, UG, TRUNK_Z], [-170, UG, TRUNK_Z]], NET_R * 1.3, 1, 0, ROUND_NET)
  const trunkS = x => sx - x
  for (const x of TRUNK_X) {
    add([[x, UG, TRUNK_Z], [x, UG, -215]], NET_R, 1, trunkS(x), ROUND_NET)
    add([[x, UG, TRUNK_Z], [x, UG, 215]], NET_R, 1, trunkS(x), ROUND_NET)
  }
  const nearestTrunk = bx => TRUNK_X.reduce((a, b) => (Math.abs(b - bx) < Math.abs(a - bx) ? b : a))
  const r = rng(99)
  // junctions: where power arrives at each building (they flash as the network connects)
  const nodes = [{ p: [sx, UG, sz], s: 0, k: 2 }]
  for (const x of TRUNK_X) nodes.push({ p: [x, UG, TRUNK_Z], s: trunkS(x), k: 0 })
  for (const [x0, x1, z0, z1, h] of BUILDINGS) {
    const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, tx = nearestTrunk(bx)
    const s0 = trunkS(tx) + Math.abs(TRUNK_Z - bz)
    const top = h * 0.88
    add([[tx, UG, bz], [bx, UG, bz], [bx, top, bz]], NET_R * 0.55, 1, s0, ROUND_NET)
    const sR = s0 + Math.abs(bx - tx)
    nodes.push({ p: [bx, 0.6, bz], s: sR, k: 1 })
    const w = Math.min(x1 - x0, z1 - z0) * 0.36
    for (let y = 12; y < top - 4; y += 10.5) {
      const ax = r() < 0.5
      const sgn = r() < 0.5 ? -1 : 1
      add([[bx, y, bz], ax ? [bx + sgn * w, y, bz] : [bx, y, bz + sgn * w]], NET_R * 0.3, 1, sR + (y - UG), 0)
    }
  }

  // the focal tower's service tap
  const [rx, rz] = RISER
  const tapS = trunkS(122) + Math.abs(TRUNK_Z - rz)
  add([[122, UG, rz], [rx, UG, rz]], NET_R * 0.8, 1, tapS, 0)
  const riserS0 = tapS + Math.abs(122 - rx)
  nodes.push({ p: [rx, 0.6, rz], s: riserS0, k: 3 })

  // the single wire: substation → feeder → tap → up the riser → across the ceiling → the room's light
  const yS = ceilY(SINGLE.floor)
  const single = [[sx, UG, sz], [sx, UG, TRUNK_Z], [122, UG, TRUNK_Z], [122, UG, rz], [rx, UG, rz], [rx, yS, rz], [SINGLE.feedX, yS, rz], [SINGLE.feedX, yS, 39.2], [84.5, yS, 39.2]]
  add(single, SINGLE_R, 2, 0, 0.3)
  // arc-length landmarks along it (the draw-on and the camera are timed against these)
  const marks = { riserBase: riserS0, room: riserS0 + (yS - UG) }
  let total = 0
  for (let i = 1; i < single.length; i++) total += len3(single[i - 1], single[i])
  marks.end = total
  return { runs, nodes, single, marks }
}

export const ENTER = [SINGLE.feedX, ceilY(SINGLE.floor), SINGLE.enterZ]
