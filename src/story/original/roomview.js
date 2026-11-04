// The room at the end is one still frame per screen shape ('d' wide, 'p' tall), rendered offline from a
// fixed camera. The pull-back is a zoom out of that frame: a window on it, starting close on the switch
// board and opening out to the final framing. The page draws the window from a stack of levels (the
// whole frame, then smaller regions at higher resolution), and the 3D camera ends its move by looking
// through exactly the same window, so the 3D board and the board in the room line up.
//
// Coordinates are fractions of the frame, x right and y down. room.json comes from the render plan
// (scratchpad realroom/plan/plan.py), which uses the same path to decide what to render.

import ROOM_VIEW from '../room.json';

export { ROOM_VIEW };

// Same split as the page's picture sources: tall screens get the tall frame
export const frameFor = (aspect) => (aspect <= 0.8 ? 'p' : 'd');

// The final framing for a screen shape: the frame's final region, cropped to the screen's shape
function finalFor(g, a) {
  const [W, H] = g.size, [x0, y0, x1, y1] = g.final;
  const fw = x1 - x0, fh = y1 - y0, fa = (fw * W) / (fh * H);
  const pw = a >= fa ? fw : (fh * H * a) / W;
  const ph = a >= fa ? (fw * W) / (a * H) : fh;
  return { x0: x0 + (fw - pw) / 2, y0: y0 + (fh - ph) / 2, w: pw, h: ph };
}

// The window at t (0 close on the board, 1 the final framing) for a screen of shape a. Its size opens
// out at a steady rate; the board starts at qs on screen and moves to where the final framing has it,
// late in the move, and the window never leaves the frame.
export function windowAt(g, t, a) {
  const [W, H] = g.size;
  const [bx0, , bx1] = g.board.box;
  const [cx, cy] = g.board.centre;
  const f = finalFor(g, a);
  const ws = (bx1 - bx0) / g.fb;
  const w = ws * Math.pow(f.w / ws, t);
  const h = (w * W) / (a * H);
  const qfx = (cx - f.x0) / f.w, qfy = (cy - f.y0) / f.h;
  const m = t * t * t;
  const qx = g.qs[0] + (qfx - g.qs[0]) * m, qy = g.qs[1] + (qfy - g.qs[1]) * m;
  const x0 = Math.min(Math.max(cx - qx * w, 0), 1 - w);
  const y0 = Math.min(Math.max(cy - qy * h, 0), 1 - h);
  return { x0, y0, w, h };
}

// The window as a camera frustum: tangents of its edges, from the room camera's own axis
export function tanRect(g, win) {
  const [tx0, tx1, ty0, ty1] = g.tan;
  return {
    l: tx0 + win.x0 * (tx1 - tx0),
    r: tx0 + (win.x0 + win.w) * (tx1 - tx0),
    t: ty1 - win.y0 * (ty1 - ty0),
    b: ty1 - (win.y0 + win.h) * (ty1 - ty0)
  };
}
