// Room lab: the live GLB room (src/story/room-glb.js, shared with the story's ?room=glb) with controls for
// lighting steps, the pull-back window, an overlay of the rendered image for comparison, and free look.
// Development page only.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { configureRenderer, loadGlbRoom, placeRoomCamera, createRoomComposer } from '../story/room-glb.js';
import { frameFor } from '../story/original/roomview.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
configureRenderer(renderer);
const camera = new THREE.PerspectiveCamera(55, 1, 0.03, 60);
const room = await loadGlbRoom(renderer);
const post = createRoomComposer(renderer, room.scene, camera);
const controls = new OrbitControls(camera, canvas);
controls.enabled = false; controls.enableDamping = true;
$('loading').remove();

const state = { step: 5, pull: 1, cmp: 0, exposure: +$('exp').value, orbit: false };
const levelsFor = (s) => [0, 1, 2, 3, 4].map((i) => (i < s ? 1 : 0));

function applyStep() {
  room.setLevels(levelsFor(state.step));
  $('ref').src = `/room/${frameFor(innerWidth / innerHeight)}-l0-${state.step}.webp`;
}
function placeCamera() {
  if (state.orbit) { camera.aspect = innerWidth / innerHeight; camera.fov = 55; camera.updateProjectionMatrix(); return; }
  const win = placeRoomCamera(camera, innerWidth / innerHeight, state.pull);
  Object.assign($('ref').style, { width: `${100 / win.w}vw`, height: `${100 / win.h}svh`, left: `${-win.x0 / win.w * 100}vw`, top: `${-win.y0 / win.h * 100}svh` });
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); post.setSize(innerWidth, innerHeight); placeCamera(); }
addEventListener('resize', resize);

const bind = (id, key, fmt, fn) => {
  const el = $(id), out = $(id + 'V');
  el.addEventListener('input', () => { state[key] = +el.value; if (out) out.textContent = fmt(state[key]); fn?.(); });
};
bind('state', 'step', String, applyStep);
bind('pull', 'pull', (v) => v.toFixed(2), placeCamera);
bind('cmp', 'cmp', (v) => v.toFixed(2), () => { $('ref').style.opacity = state.cmp; });
bind('exp', 'exposure', (v) => v.toFixed(2));
$('orbit').addEventListener('change', (e) => {
  state.orbit = e.target.checked; controls.enabled = state.orbit;
  if (state.orbit) { controls.target.set(0, 1.0, -2.6); camera.position.set(0.05, 1.45, 1.2); }
  $('ref').style.display = state.orbit ? 'none' : '';
  placeCamera();
});
$('ao').addEventListener('change', (e) => { post.gtao.enabled = e.target.checked; });
$('shadows').addEventListener('change', (e) => {
  renderer.shadowMap.enabled = e.target.checked;
  room.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
});

applyStep(); resize();
let frames = 0, last = performance.now();
renderer.setAnimationLoop(() => {
  renderer.toneMappingExposure = Math.pow(2, state.exposure);
  if (state.orbit) controls.update();
  post.render();
  frames++;
  const now = performance.now();
  if (now - last > 1000) { $('stat').textContent = `${Math.round(frames * 1000 / (now - last))} fps`; frames = 0; last = now; }
});
if (import.meta.env.DEV) window.__roomLab = { room, camera, renderer, state, applyStep, placeCamera };
