// Camera stops and spline sampling ported from wirecable-showcase, commit 9d1eb33.
import * as THREE from 'three';
export function originalFinalePath(roomShot, fx, fz) {
const SHOTS = [
  // The three boxes lying in a row, each with its coil on top, under the title
  { u: 0, pos: [0, -9.2, 37.5], at: [0, -12.3, -6], p: { pos: [0, -8.4, 27.5], at: [0, -11.4, -6] } },
  // Drifting back a touch and left with the coils as they lift off and glide away
  { u: 0.17, pos: [-0.8, -9.3, 36.5], at: [-1.6, -12.0, -6.5], p: { pos: [-0.6, -8.8, 28], at: [-1.0, -11.3, -6.5] } },
  { u: 0.32, pos: [-1.8, -9.4, 32], at: [-3.4, -11.6, -5.5], p: { pos: [-3.0, -9.2, 29], at: [-4.0, -11.3, -5.5] } },
  // The coils arrive close together, almost one, their three wires streaming right as a bundle
  { u: 0.46, pos: [-1.0, -9.6, 26], at: [-3.6, -10.8, -4.5], p: { pos: [-3.0, -9.4, 27], at: [-3.8, -10.6, -6] } },
  // Panning right with the wires; the coils leave the frame on the left as they fade
  { u: 0.6, pos: [1.6, -9.4, 20], at: [0.6, -10.2, -1.5], p: { pos: [2.0, -9.4, 21], at: [1.6, -10.2, -2] } },
  // Closing on the red tip
  { u: 0.75, pos: [4.2, -8.6, 12.5], at: [3.2, -9.6, 0.2], p: { pos: [3.8, -8.6, 15], at: [3.4, -9.6, 0.2] } },
  // Close three-quarter shot of the stripped end, from the front right and a little above
  { u: 1, pos: [5.85, -8.26, 5.1], at: [4.48, -9.06, 0.62], p: { pos: [6.04, -8.31, 5.32], at: [4.6, -9.15, 0.62] } },
  // Easing back and left along the wire
  { u: 1.5, pos: [4.9, -7.9, 5.4], at: [3.9, -9.3, 0.7], p: { pos: [5.0, -7.7, 5.6], at: [3.9, -9.3, 0.7] } },
  // Side view of the cutaway, a little above, the stripped end at the right of frame
  { u: 2, pos: [3.5, -7.85, 5.2], at: [3.45, -9.05, 0.74], p: { pos: [3.25, -7.95, 4.81], at: [3.2, -9.0, 0.74] } },
  // Pulling back and right as the copper heads into the conduit
  { u: 2.5, pos: [8.6, -8.4, 10.5], at: [6.9, -8.4, 0.4], p: { pos: [8.0, -8.3, 10.2], at: [7.0, -8.0, 0.4] } },
  // The whole elbow from the front right, the wire in along the bottom and out the top.
  // Framed before the title comes in, then a slow push in while it reads.
  { u: 2.8, pos: [16.3, -8.5, 19.7], at: [8.0, -6.5, 0.3], p: { pos: [12.2, -7.7, 10.9], at: [8.1, -6.6, 0.3] } },
  { u: 3, pos: [14.2, -8.3, 18.2], at: [8.0, -6.5, 0.3], p: { pos: [11.0, -7.55, 9.9], at: [8.1, -6.6, 0.3] } },
  // Up with the red tip as it rises into the first reel, then the reel turning as black feeds off it,
  // then down along black as it drapes onto the heater
  { u: 3.18, pos: [13.9, -5.6, 16.0], at: [9.2, -3.7, 0.2], p: { pos: [10.9, -6.0, 17.5], at: [8.8, -3.7, 0.2] } },
  { u: 3.3, pos: [14.6, -5.3, 14.6], at: [10.4, -3.8, 0.2], p: { pos: [11.0, -5.4, 17.5], at: [9.4, -3.4, 0.2] } },
  { u: 3.45, pos: [15.4, -4.3, 12.6], at: [11.9, -5.3, -0.3], p: { pos: [13.0, -5.0, 14.5], at: [11.4, -5.4, -0.3] } },
  // The black wire across the heater bar, from the front left and above. Settled before the title,
  // then a slow push in while the gauge climbs.
  { u: 3.62, pos: [12.1, -4.85, 7.25], at: [16.3, -7.4, -1.0], p: { pos: [13.15, -4.85, 6.5], at: [16.2, -7.25, -1.0] } },
  { u: 3.8, pos: [12.0, -4.88, 6.98], at: [16.3, -7.4, -1.0], p: { pos: [13.2, -4.9, 6.2], at: [16.2, -7.25, -1.0] } },
  { u: 4, pos: [12.2, -5.0, 6.6], at: [16.3, -7.4, -1.0], p: { pos: [13.35, -5.0, 5.9], at: [16.2, -7.25, -1.0] } },
  // On along black into the top of the second reel, the reel turning as green feeds off it, then down
  // along green to the flame stage, settled before the burner comes in
  { u: 4.2, pos: [26.6, -5.6, 10.0], at: [23.5, -8.4, -0.8], p: { pos: [24.8, -6.0, 14.5], at: [23.8, -8.6, -0.8] } },
  { u: 4.32, pos: [27.0, -7.6, 9.0], at: [25.6, -9.9, -0.9], p: { pos: [26.6, -8.2, 11.5], at: [25.8, -10.0, -0.9] } },
  { u: 4.45, pos: [26.8, -9.7, 7.4], at: [30.2, -10.85, -1.0], p: { pos: [27.6, -9.9, 6.3], at: [30.1, -10.75, -1.0] } },
  { u: 4.8, pos: [27.4, -10.0, 6.4], at: [30.15, -10.8, -1.0], p: { pos: [27.9, -10.05, 5.75], at: [30.1, -10.75, -1.0] } },
  { u: 5, pos: [27.5, -10.05, 6.1], at: [30.15, -10.8, -1.0], p: { pos: [28.0, -10.1, 5.6], at: [30.1, -10.75, -1.0] } },
  // Smoke: back a little, level with the wire, the wisp rising up the middle of the frame
  { u: 5.5, pos: [27.7, -10.45, 7.1], at: [30.25, -10.5, -1.1], p: { pos: [28.45, -10.5, 6.1], at: [30.15, -10.4, -1.05] } },
  { u: 5.8, pos: [27.75, -10.5, 6.85], at: [30.25, -10.55, -1.0], p: { pos: [28.55, -10.55, 5.85], at: [30.15, -10.35, -1.0] } },
  { u: 6, pos: [27.8, -10.5, 6.6], at: [30.25, -10.55, -1.0], p: { pos: [28.6, -10.55, 5.6], at: [30.15, -10.35, -1.0] } },
  // Finale. Pulling back and away to the right, then behind a section of wall, where the wires come up
  // into the switch box; in close for the three clicks; round the side; and the front, light on.
  { u: 6.18, pos: [33, -9.5, 18], at: [40, -11.5, -1], p: { pos: [33, -9.5, 18], at: [40, -11.5, -1] } },
  { u: 6.32, pos: [fx(-6), -13, fz(-30)], at: [fx(0), -12.5, fz(-3)], p: { pos: [fx(-5), -13.5, fz(-30)], at: [fx(0), -12.8, fz(-3)] } },
  // In close while the three wires slide up and click home
  { u: 6.6, pos: [fx(-3.5), -11.8, fz(-16)], at: [fx(0), -11.2, fz(-2.9)], p: { pos: [fx(-3), -12, fz(-13)], at: [fx(0), -11.3, fz(-2.9)] } },
  // Then a slow arc out and round the wall, from behind to the front
  { u: 6.7, pos: [fx(-12), -10.5, fz(-20)], at: [fx(0), -10.8, fz(-2.5)], p: { pos: [fx(-11), -10.8, fz(-20)], at: [fx(0), -10.9, fz(-2.5)] } },
  { u: 6.78, pos: [fx(-29), -9.5, fz(-11)], at: [fx(0), -10.4, fz(-2)], p: { pos: [fx(-29), -9.6, fz(-12)], at: [fx(0), -10.4, fz(-2)] } },
  { u: 6.85, pos: [fx(-34), -8.8, fz(5)], at: [fx(0.3), -10, fz(-1)], p: { pos: [fx(-35), -8.9, fz(4)], at: [fx(0.3), -10, fz(-1)] } },
  // The front, from the side the room's camera sees the board from (see roomShot); from here the
  // camera blends into the room camera's own view
  roomShot(6.92)
];
  const curve = pick => new THREE.CatmullRomCurve3(SHOTS.map(s => new THREE.Vector3(...pick(s))), false, 'centripetal');
  return {
    pos: curve(s=>s.pos), at:curve(s=>s.at), posP:curve(s=>s.p.pos), atP:curve(s=>s.p.at),
    fraction(u) {
      if (u <= SHOTS[0].u) return 0;
      for(let i=0;i<SHOTS.length-1;i++) if(u<=SHOTS[i+1].u) return (i+(u-SHOTS[i].u)/(SHOTS[i+1].u-SHOTS[i].u))/(SHOTS.length-1);
      return 1;
    }
  };
}
