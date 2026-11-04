/* ------------------------------------------------------------------
   The whole homepage is one scroll-driven story. Each segment gets a share
   of the scroll measured in screens (one screen = one viewport height), so
   moments with copy can hold longer than the moves between them.
   ------------------------------------------------------------------ */

export const SEGMENTS = [
  { id: "day",     screens: 0.35 }, // street level: the crown tower rising into the headline, held: a short beat before anything moves
  { id: "rise",    screens: 1.6 },  // the copy lifts away; the camera rises from street level to the isometric view (rendered frames)
  { id: "wireOn",  screens: 1.2 },  // day → wireframe: orange lines draw on over the render's edges, page white → warm night
  { id: "extend",  screens: 1.4 },  // camera pulls back; more city grows in around a street-lit avenue
  { id: "run",     screens: 2.2 },  // the wire runs along the avenue; street lights switch on as its tip passes
  { id: "approach", screens: 1.4 }, // push-in from the diagonal city view until the wire is a close diagonal across the frame
  { id: "drain",   screens: 1.0 },  // from that frame the city drains away fast and the page turns lavender while the camera settles
  { id: "wireIn",  screens: 0.9 },  // hand-over to the product wire (identical framing), glow cools
  { id: "copper",  screens: 1.5 },
  { id: "strands", screens: 1.7 },
  { id: "flex",    screens: 1.7 },
  { id: "heat",    screens: 1.9 },
  { id: "flame",   screens: 1.7 },
  { id: "smoke",   screens: 1.3 },
  { id: "finale",  screens: 4.0 }, // single cable connection and original camera arc to the front
  { id: "room",    screens: 3.0 }, // original room pullback, five lighting steps, fade to close
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

/** The segment p currently sits in. */
export const segmentAt = (p) => {
  for (let i = SEGMENTS.length - 1; i >= 0; i--) if (p >= STARTS[SEGMENTS[i].id]) return SEGMENTS[i].id;
  return SEGMENTS[0].id;
};

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0 → 1 between edge0 and edge1, eased (same curve as GLSL smoothstep). */
export const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
/** in over [a, b], hold, out over [c, d]: the visibility window used for copy. */
export const windowed = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));
