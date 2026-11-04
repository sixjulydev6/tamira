/* Copy for the wire chapters.
   The figures are typical for HR-FR-LSH house wire made to IS 694 (carried over from the
   Sixjuly concept). They are placeholders until Tamira confirms its own specifications. */

export const CHAPTERS = [
  {
    id: "copper",
    title: "Tamira is named after copper.",
    body: "Tāmra is the Sanskrit word for it. Our core is 99.97% pure, so power moves easily and less heat builds up in your walls.",
    proof: "Purity 99.97%. Resistance at most 13.3 ohms per km at 20°C.",
  },
  {
    id: "strands",
    title: "Thirty strands do the work together.",
    body: "No single strand carries the load on its own. A tough jacket wraps around them and holds up against heat and fire.",
    proof: "30 strands of 0.25 mm. A 0.7 mm HR-FR-LSH PVC jacket. Rated for 1100 volts.",
  },
  {
    id: "flex",
    title: "Tight corners are no problem.",
    body: "Thin strands bend more easily than one solid core, so your electrician can take it round sharp turns without it cracking.",
    proof: "Class 5 flexible conductor, IS 8130.",
  },
  {
    id: "heat",
    title: "Indian summers don’t bother it.",
    body: "Ordinary PVC wire is rated for 70°C. Tamira is rated for 85°C, so the AC can run all afternoon.",
    proof: "85°C continuous. 160°C short circuit.",
  },
  {
    id: "flame",
    title: "If it catches fire, it puts itself out.",
    body: "Air has about 21% oxygen. This jacket needs at least 29% to keep burning, so the flame dies out on its own.",
    proof: "Oxygen index at least 29%. Temperature index at least 250°C. Tested to IEC 60332-1.",
  },
  {
    id: "smoke",
    title: "It gives off less smoke, too.",
    body: "Smoke is often more dangerous than the flames themselves. Less smoke makes it easier to see your way out.",
    proof: "Smoke density at most 60%. Acid gas at most 20%.",
  },
  {
    id: "finale",
    title: "Wire it once, and forget it’s there.",
    body: "Building or rewiring? Ask your electrician for Tamira.",
  },
];

/** Callouts pinned to the wire during the strands chapter. */
export const LABELS = [
  { id: "strands", k: "Copper", v: "30 fine strands" },
  { id: "jacket", k: "Jacket", v: "Stands up to heat and fire" },
  { id: "rating", k: "Rated for", v: "1100 volts" },
];

export const GAUGE = { from: 25, to: 90, ordinary: 70, rated: 85 };
