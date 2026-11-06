// World layout, measured from the cityscape GLB (scaled ×400 → metres).
// +X is the "front" of the model (the reference view); +Y is up.

export const SCALE = 400

// the focal tower: rear slab (~207 m) + front block (~175 m) facing +X
export const HERO = { min: [33, -2, -30], max: [97, 216, 52] }

// cutaway quadrant on the front block's +X/+Z corner
export const CUT = { min: [66.4, 48, 14.4], max: [94, 183, 51] }

// interior extents inside the cut quadrant
export const IN = { x0: 66.6, x1: 90.4, z0: 14.6, z1: 47.4 }
export const FLOOR = { y0: 50.4, h: 3.6, n: 34 }
export const XM = 78.6 // partition along x
export const ZM = 31.0 // partition along z
// riser runs up the corner where the two partitions meet, in full view of the cutaway
export const RISER = [79.0, 31.4]
export const UG = -6 // underground duct depth
export const SUBSTATION = [214, 0, 124]
export const TRUNK_X = [122, 30, -50, -132]
export const TRUNK_Z = 124

export const floorBase = f => FLOOR.y0 + f * FLOOR.h
export const ceilY = f => floorBase(f) + FLOOR.h - 0.42

// the single wire we follow: floor, feed line and the spot where we enter the wire
export const SINGLE = { floor: 19, feedX: 86.5, enterZ: 35.3 }

// footprints of the other buildings [x0, x1, z0, z1, height] (connected-component analysis of the mesh)
export const BUILDINGS = [
  [55, 92.5, -200, -162.5, 147.7], [40, 62.5, 45, 75, 130.4], [10, 40, -20, 52.5, 117.8], [5, 20, 112.5, 132.5, 107],
  [45, 65, -52.5, -25, 101.1], [-30, 5, 165, 200, 96.5], [70, 90, -102.5, -77.5, 92.1], [-87.5, -52.5, -47.5, -10, 90.4],
  [135, 147.5, -140, -110, 88.1], [2.5, 32.5, -165, -145, 85.4], [-47.5, -25, -77.5, -52.5, 84.2], [-55, -25, 102.5, 117.5, 84.2],
  [62.5, 92.5, 45, 77.5, 83.8], [-132.5, -105, -27.5, -12.5, 75], [-92.5, -65, -2.5, 12.5, 75], [10, 45, -60, -30, 64.4],
  [40, 70, -180, -150, 61.2], [-100, -75, 125, 150, 56.3], [120, 137.5, -147.5, -135, 52.9], [130, 155, -25, 7.5, 52.5],
  [-145, -127.5, 65, 85, 51.4], [-35, -15, -117.5, -92.5, 51.4], [10, 45, 85, 132.5, 51], [-62.5, -17.5, 0, 55, 51],
  [85, 105, -82.5, -60, 50.8], [72.5, 105, -132.5, -100, 50.8], [72.5, 85, -35, -12.5, 47.5], [90, 140, 0, 95, 44.3],
  [-155, -145, 75, 87.5, 44.1], [25, 47.5, -110, -90, 44.1], [-152.5, -127.5, -112.5, -95, 40.2], [132.5, 150, 97.5, 125, 40.2],
  [-140, -110, 47.5, 90, 20.9], [110, 152.5, -62.5, -25, 20.7], [-35, 2.5, -162.5, -132.5, 20.7], [-75, -27.5, -147.5, -100, 20.7]
]

// seeded random for deterministic layouts
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
