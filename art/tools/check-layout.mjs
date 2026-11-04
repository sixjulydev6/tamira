// Checks that the web wireframe (src/story/city.js) and the Blender hero (art/data/city-layout.json,
// written by art/blender/build_city.py) describe the same city: same frame centre, and every
// building at the same place and size. Run: node art/tools/check-layout.mjs
import { readFileSync } from "node:fs";
import { groundAt, FRAME_CENTRE, FRAME_W } from "../../src/story/city.js";

const layout = JSON.parse(readFileSync(new URL("../data/city-layout.json", import.meta.url)));
const src = readFileSync(new URL("../../src/story/city.js", import.meta.url), "utf8");

// city.js keeps BUILDINGS private; read the table rows straight from its source
const rows = [...src.slice(src.indexOf("const BUILDINGS")).split("];")[0]
  .matchAll(/\[\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*[01]\s*\]/g)]
  .map((m) => m.slice(1, 6).map(Number));

const EL = 38 * Math.PI / 180, K = 2000 / FRAME_W;
let worst = 0;
const problems = [];
for (const [px, py, lw, rw, ty] of rows) {
  const b = layout.buildings.find((x) => x.id === `B_${px}_${py}`);
  if (!b) { problems.push(`missing in manifest: B_${px}_${py}`); continue; }
  const corner = groundAt(px, py);
  const dx = lw / (K * 0.7071), dy = rw / (K * 0.7071);
  const h = Math.max(5, (py - ty) / K / Math.cos(EL));
  const web = [corner.x - dx / 2, corner.y + dy / 2, dx, dy, h];
  const bl = [...b.centre, ...b.size];
  const d = Math.max(...web.map((v, i) => Math.abs(v - bl[i])));
  worst = Math.max(worst, d);
  if (d > 0.01) problems.push(`${b.id}: off by ${d.toFixed(3)} m`);
}
if (rows.length !== layout.buildings.length) problems.push(`count: web ${rows.length}, manifest ${layout.buildings.length}`);
const t = layout.camera.target;
const dc = Math.hypot(FRAME_CENTRE.x - t[0], FRAME_CENTRE.y - t[1]);
if (dc > 0.01) problems.push(`frame centre off by ${dc.toFixed(3)} m`);
if (layout.camera.frameWidthM !== FRAME_W) problems.push(`frame width: web ${FRAME_W}, manifest ${layout.camera.frameWidthM}`);

console.log(`${rows.length} buildings compared, worst difference ${worst.toFixed(4)} m, frame centre ${dc.toFixed(4)} m`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("OK: wireframe and hero render share one layout");
