// The live GLB room for the story (?room=glb). Same interface and timing as createRoom() in room.js:
// it loads near the end of smoke, fades in over the matched board (6.99–7.06), pulls back through the
// image version's exact camera window (ROOM_BEATS.pull), and brings up each lighting group over its
// ROOM_BEATS step. Three.js and the GLB load only when needed, so first paint is unaffected.
import { finaleU, ROOM_BEATS } from './finale-timing.js';
import { local, smooth, clamp01 } from './timeline.js';
import { frameFor } from './original/roomview.js';

export function createLiveRoom(element) {
  const canvas = element.querySelector('canvas');
  let mod = null, renderer = null, camera = null, room = null, post = null;
  let loading = false, ready = false, failed = false, alive = true, lastU = 6.06, lastKey = '', loadMs = 0;

  function ensure() {
    if (loading || ready || failed) return;
    loading = true; const t0 = performance.now();
    Promise.all([import('./room-glb.js'), import('three')]).then(async ([m, THREE]) => {
      if (!alive) return;
      mod = m;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      m.configureRenderer(renderer);
      camera = new THREE.PerspectiveCamera(55, 1, 0.03, 60);
      room = await m.loadGlbRoom(renderer);
      if (!alive) { room.dispose(); renderer.dispose(); return; }
      post = m.createRoomComposer(renderer, room.scene, camera);
      renderer.compile(room.scene, camera);                         // no shader stall on the first visible frame
      ready = true; loading = false; loadMs = Math.round(performance.now() - t0);
    }).catch((err) => { failed = true; loading = false; console.warn('GLB room failed to load', err); });
  }

  function render(u) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const sized = canvas.width === Math.round(w * renderer.getPixelRatio()) && canvas.height === Math.round(h * renderer.getPixelRatio());
    if (!sized) { renderer.setSize(w, h, false); post.setSize(w, h); lastKey = ''; }
    const t = clamp01((u - ROOM_BEATS.pull[0]) / (ROOM_BEATS.pull[1] - ROOM_BEATS.pull[0]));
    const levels = ROOM_BEATS.steps.map(([a, b]) => smooth(a, b, u));
    const key = `${t.toFixed(4)}|${w}x${h}|${levels.map((v) => v.toFixed(3)).join(',')}`;
    if (key === lastKey) return;                                    // nothing moved: keep the last frame
    lastKey = key;
    room.setLevels(levels);
    mod.placeRoomCamera(camera, w / h, t);
    post.render();
  }

  function update(p) {
    if (!alive) return;
    const u = finaleU(p); lastU = u;
    if (local(p, 'smoke') > 0.25 || local(p, 'finale') > 0) ensure();
    if (ready && u > 6.85) render(u);
    // Never cover the matched live board with an empty canvas while the room is still loading.
    const opacity = ready ? smooth(6.99, 7.06, u) : 0;
    element.style.opacity = String(opacity*(1-smooth(0,.07,local(p,'outro'))));
    element.style.visibility = opacity > 0 && local(p, 'outro') < .07 ? 'visible' : 'hidden';
    element.style.setProperty('--room-end','0'); // no fade to black: the outro crossfades from the lit room to the city (user direction)
    element.dataset.frame = frameFor(innerWidth / Math.max(1, innerHeight));
    element.dataset.mode = 'glb';
  }

  return {
    update,
    diagnostics: () => ({ mode: 'glb', ready, loading, failed, loadMs, u: lastU, painted: ready,
                          calls: renderer?.info.render.calls, triangles: renderer?.info.render.triangles }),
    dispose() {
      alive = false; post?.dispose(); room?.dispose(); renderer?.dispose();
      element.style.opacity = '0'; element.style.visibility = 'hidden';
    },
  };
}
