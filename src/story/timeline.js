/* ------------------------------------------------------------------
   The whole homepage is one scroll-driven story. Each segment gets a share
   of the scroll measured in screens (one screen = one viewport height), so
   moments with copy can hold longer than the moves between them.
   ------------------------------------------------------------------ */

export const SEGMENTS = [
  { id: "day",     screens: 0.35 }, // street level: the crown tower rising into the headline, held: a short beat before anything moves
  { id: "rise",    screens: 1.6 },  // supplied skyline: daylight → dusk
  { id: "wireOn",  screens: 1.2 },  // architectural scan and LiDAR reveal
  { id: "extend",  screens: 1.4 },  // underground network grows from the substation
  { id: "run",     screens: 2.2 },  // follow one feeder up the tower; room builds and lights
  { id: "approach", screens: 2.0 }, // through the room's open corner, along its ceiling wire
  { id: "bundle",  screens: 3.0 }, // sheath/bedding open; red, blue and green cores are exposed
  { id: "drain",   screens: 2.6 },  // red pulls out of the assembly; camera follows into the product view
  { id: "wireIn",  screens: 0.9 },  // hand-over to the product wire (identical framing), glow cools
  { id: "copper",  screens: 1.5 },
  { id: "strands", screens: 1.7 },
  { id: "flex",    screens: 1.7 },
  { id: "heat",    screens: 1.9 },
  { id: "flame",   screens: 1.7 },
  { id: "smoke",   screens: 1.3 },
  { id: "finale",  screens: 4.0 }, // single cable connection and original camera arc to the front
  { id: "room",    screens: 3.0 }, // original room pullback, five lighting steps, fade to close
  { id: "outro",   screens: 3.0 }, // back out of the tower room to the hero tower at sunset; the contact section rises over it
];

export const TOTAL_SCREENS = SEGMENTS.reduce((sum, s) => sum + s.screens, 0);

const STARTS = (() => {
  let acc = 0;
  return Object.fromEntries(SEGMENTS.map((s) => { const start = acc; acc += s.screens; return [s.id, start / TOTAL_SCREENS]; }));
})();
const SPANS = Object.fromEntries(SEGMENTS.map((s) => [s.id, s.screens / TOTAL_SCREENS]));

/** 0–1 progress through one segment, given overall story progress p (0–1). */
export const local = (p, id) => clamp01((p - STARTS[id]) / SPANS[id]);

/** overall progress for a point t (0–1) inside segment id */
export const progressOf = (id, t) => STARTS[id] + SPANS[id] * t;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0 → 1 between edge0 and edge1, eased (same curve as GLSL smoothstep). */
export const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
/** in over [a, b], hold, out over [c, d]: the visibility window used for copy. */
export const windowed = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));
