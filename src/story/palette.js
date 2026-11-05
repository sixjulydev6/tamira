import { local, lerp, smooth } from "./timeline.js";

/* Page colour through the story. The canvas clears to the same colour, so the
   page and the 3D never show a seam. */
export const COLORS = {
  day: "#ffffff",
  night: "#140b07",    // wireframe night: deep warm brown (the hero's clay and crown-orange, after dark)
  lavender: "#e4e4ee", // the wire's world
  copper: "#ece5df",
  heat: "#efe5da",
  flame: "#e4e7e3",
  smoke: "#e6e6ea",
  ink: "#000000",
  inkNight: "#f3f1ee",
  inkWire: "#1b1b22",
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, "0")).join("");
};

/** Page background and ink for overall progress p. */
export function pageColors(p) {
  // day (white) straight to the wireframe's warm night as the lines draw on; no dusk stage
  const toNavy = smooth(0.12, 0.5, local(p, "wireOn"));
  let bg = mixHex(COLORS.day, COLORS.night, toNavy);
  const toLight = smooth(0.5, 0.9, local(p, "drain"));
  bg = mixHex(bg, COLORS.lavender, toLight);

  // gentle per-chapter tints on the light side
  const tint = (id, col, a = 0.15, b = 0.35, c = 0.8, d = 1) => {
    const t = local(p, id);
    bg = mixHex(bg, col, smooth(a, b, t) * (1 - smooth(c, d, t)));
  };
  tint("copper", COLORS.copper, 0, 0.3, 0.85, 1.4);
  tint("heat", COLORS.heat);
  tint("flame", COLORS.flame);
  tint("smoke", COLORS.smoke);

  // ink: black by day, flips quickly to light around mid-dusk, back to dark as the page lightens
  // ink flips quickly around the middle of the darkening so text is never grey-on-grey
  let ink = mixHex(COLORS.ink, COLORS.inkNight, smooth(0.5, 0.65, toNavy));
  ink = mixHex(ink, COLORS.inkWire, smooth(0.56, 0.72, local(p, "drain")));
  const finaleDark = smooth(.65, .94, local(p, "finale"));
  bg = mixHex(bg, "#0b0a09", finaleDark);
  ink = mixHex(ink, COLORS.inkNight, finaleDark);
  return { bg, ink, dark: finaleDark > .5 || toLight < 0.6 && toNavy > 0.5 };
}
