import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createFinaleStage } from "./finale-stage.js";
import { finaleU } from "./finale-timing.js";
import { Wire } from "./wire.js";
import { createSkyline } from "./skyline/index.js";
import { buildProps } from "./props.js";
import { local, smooth, lerp, windowed, clamp01, progressOf } from "./timeline.js";

const DEG = Math.PI / 180;

/* path shapes in normalised screen space of the wire camera (x, y in −1…1); tail first, tip last */
const SHAPES = {
  entry:  [[-1.75, -1.5], [-1.15, -1.0], [-0.62, -0.62], [-0.12, -0.34], [0.3, -0.14], [0.62, 0.0]],
  elbow:  [[-1.75, -0.66], [-0.8, -0.6], [0.02, -0.56], [0.3, -0.4], [0.4, 0.05], [0.42, 0.64]],
  wave:   [[-1.75, -0.36], [-0.95, -0.24], [-0.32, -0.4], [0.3, -0.26], [0.95, -0.34], [1.75, -0.22]],
  finale: [[-1.75, -1.05], [-1.0, -0.72], [-0.42, -0.5], [0.04, -0.3], [0.3, -0.08], [0.44, 0.02]],
};

export function createStory({ canvas, wireCanvas, stage, media }) {
  const makeRenderer = (el) => {
    const r = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  };
  // two canvases: the city (with bloom) and the product wire; main.js crossfades them at the hand-over
  const renderer = makeRenderer(canvas);
  // The city canvas (establishing shots, network, bundle) is fill-rate bound: thousands of overlapping
  // alpha-tested leaf cards plus AO, depth blur and bloom. At 1.75x on Retina it alternated 60/30 fps while
  // scrolling; 1.5x holds 60 and is still well above 1x (most of the frame sits in haze and depth blur).
  // The product wire canvas keeps 1.75x; type is HTML and unaffected.
  // Render quality is set per stretch of the story (see watchFrame): the daylight city ("heavy": leaves, AO, depth
  // blur) keeps the reduced ratio above; from the underground network to the cable close-up ("light": line work,
  // the tower room, the bundle) the scene is cheap, and the reduced ratio with no anti-aliasing read as pixelated
  // there, so it renders at (near) full resolution with 4x MSAA. Phones (2.6-3x screens) get one step more.
  const PHONE = matchMedia("(pointer: coarse)").matches;
  const QUALITY = {
    heavy: { steps: PHONE ? [2, 1.75, 1.5] : [1.5, 1.25, 1], msaa: PHONE ? 4 : 0 },
    light: { steps: PHONE ? [2.5, 2.25, 2] : [2, 1.75, 1.5], msaa: 4 },
  };
  const qualityStep = { heavy: 0, light: 0 };
  let qualityMode = "heavy";
  const qualityRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY[qualityMode].steps[qualityStep[qualityMode]]);
  renderer.setPixelRatio(qualityRatio());
  const wireRenderer = makeRenderer(wireCanvas);
  wireRenderer.toneMapping = THREE.NeutralToneMapping;

  const skyline = createSkyline(renderer);
  skyline.setMSAA(QUALITY[qualityMode].msaa);
  let lastProgress = 0, lastBgColor = "#ffffff";
  const environmentTargets = [];
  function environmentFor(renderer) {
    const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    generator.dispose(); room.dispose(); environmentTargets.push(target); return target.texture;
  }

  /* ---------------------------------------------------------------- product wire world */
  const wireScene = new THREE.Scene();
  wireScene.environment = environmentFor(wireRenderer);
  wireScene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 10, 12); wireScene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 1.1); rim.position.set(8, -4, -6); wireScene.add(rim);
  const wire = new Wire();
  wireScene.add(wire.group);
  let finaleStage = null;
  const props = buildProps();
  wireScene.add(props.group);
  const wireCam = new THREE.PerspectiveCamera(28, 1, 0.5, 600);

  /* ---------------------------------------------------------------- layout */
  let W = 1, H = 1, halfW = 13, halfH = 7.5, d0 = 30, portrait = false;
  const shapeWorld = {};
  const toWorld = ([nx, ny]) => {
    const y = portrait ? ny * 0.5 - 0.32 : ny;     // keep the wire below the copy on tall screens
    return new THREE.Vector3(nx * halfW, y * halfH, 0);
  };
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    wireRenderer.setSize(W, H, false);
    skyline.resize(W, H);

    // product camera framing
    const aspect = W / H;
    portrait = aspect < 0.9;
    halfW = portrait ? 8.4 : 13.3;
    halfH = halfW / aspect;
    d0 = halfH / Math.tan(14 * DEG);
    wireCam.aspect = aspect;
    wireCam.updateProjectionMatrix();
    for (const k2 in SHAPES) shapeWorld[k2] = SHAPES[k2].map(toWorld);
    props.setConduitPath([toWorld([-0.3, -0.565]), toWorld([0.18, -0.5]), toWorld([0.37, -0.25]), toWorld([0.41, 0.22])]);

  }

  /* ---------------------------------------------------------------- product wire choreography */
  const mixShape = (a, b, t) => shapeWorld[a].map((p, i) => p.clone().lerp(shapeWorld[b][i], t));

  function wireState(p) {
    const L = (id) => local(p, id);
    const P = wire.params;
    // path
    let pts = shapeWorld.entry;
    const toElbow = smooth(0.05, 0.45, L("flex"));
    const toWave = smooth(0.0, 0.3, L("heat"));
    const toFinale = 0; // The same cable continues into the terminal in finale-stage.
    if (toFinale > 0) pts = mixShape("wave", "finale", toFinale);
    else if (toWave > 0) pts = mixShape("elbow", "wave", toWave);
    else if (toElbow > 0) pts = mixShape("entry", "elbow", toElbow);
    wire.setPath(pts);

    // the wire is already in place: it arrived through the city
    P.head = 1;
    P.glow = 0;   // the ember has cooled in the city wire before the hand-over (cityWireState)
    P.strip = 3.4;
    // strands open up for copper, gather again for the bend, and are tidy when the wire is connected
    P.fan = lerp(0.45, 1, smooth(0.1, 0.6, L("copper"))) * (1 - 0.35 * toElbow) * (1 - 0.8 * toFinale);
    P.cut = windowed(L("strands"), 0.12, 0.4, 0.82, 0.98);
    P.cutAt = wire.jacketEnd - 4.2;

    // heat travels in from the left, then cools
    const mid = wire.length * 0.5;
    P.heatAt = mid - halfW * 0.12;
    P.heat = windowed(L("heat"), 0.32, 0.72, 0.86, 1.0);
    // flame chars the jacket just right of centre
    P.charAt = mid + 3;
    P.char = smooth(0.2, 0.62, L("flame")) * (1 - smooth(0.5, 1, L("finale")));
    wire.update();

    // props
    props.conduitMat.opacity = 0.32 * windowed(L("flex"), 0.28, 0.5, 0.9, 1.0) * (1 - toWave);
    props.conduit.visible = props.conduitMat.opacity > 0.002;

    const heaterIn = windowed(L("heat"), 0.12, 0.34, 0.88, 1.0);
    props.heater.visible = heaterIn > 0.002;
    const hp = wire.surfacePoint(mid, -Math.PI / 2, 0);
    props.heater.position.set(hp.x - halfW * 0.12, hp.y - 2.4 - (1 - heaterIn) * 6, 0);
    props.heater.scale.setScalar(0.8 + 0.2 * heaterIn);
    props.slotMat.emissiveIntensity = 2.4 * smooth(0.25, 0.6, L("heat")) * heaterIn;

    const flameAmt = windowed(L("flame"), 0.1, 0.3, 0.5, 0.78);
    const cp = wire.surfacePoint(P.charAt, Math.PI / 2, 0);
    props.flame.visible = flameAmt > 0.002;
    // flame base (12% up its plane) sits on top of the jacket
    props.flame.position.set(cp.x, cp.y + 1.0 + 0.38 * 4.4, 1.2);
    props.flameMat.uniforms.uAmt.value = flameAmt;
    props.flameMat.uniforms.uPhase.value = L("flame") * 40;

    const sm = L("smoke") + 0.25 * smooth(0.55, 1, L("flame"));
    props.puffs.forEach((m, i) => {
      const t = clamp01(sm * 1.25 - i * 0.07);
      const a = Math.sin(Math.PI * clamp01(t)) * 0.26 * (1 - smooth(0.85, 1, L("smoke")));
      m.material.opacity = a;
      m.visible = a > 0.003;
      m.position.set(cp.x + Math.sin(i * 1.7 + t * 4) * (0.5 + t * 1.4), cp.y + 1 + t * 10, 0.8);
      m.scale.setScalar(1.4 + t * 4.5);
    });

    const plateIn = 0;
    props.plate.visible = plateIn > 0.002;
    const tip = toWorld(SHAPES.finale[5]);
    props.plate.position.set(tip.x + 0.4, tip.y + 0.6, 1.6 + (1 - plateIn) * 8);
    props.plate.scale.setScalar(lerp(0.6, 1, plateIn));
    props.rocker.rotation.x = lerp(0.12, -0.12, smooth(0.62, 0.7, L("finale")));
    props.led.material.color.set(smooth(0.62, 0.7, L("finale")) > 0.5 ? 0x3dd16b : 0xea3c32);

    // camera
    const base = new THREE.Vector3(0, 0, d0), look = new THREE.Vector3(0, 0, 0);
    const tipPos = wire.frameAt(wire.headDist, { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() }).p;
    const cutPos = wire.surfacePoint(P.cutAt, 0, 0);
    const poses = {
      wide: [base, look],
      copper: [tipPos.clone().add(new THREE.Vector3(-halfW * 0.55, -halfH * 0.1, d0 * 0.42)), tipPos.clone().add(new THREE.Vector3(-halfW * 0.38, 0, 0))],
      strands: [cutPos.clone().add(new THREE.Vector3(-halfW * 0.05, -halfH * 0.05, d0 * 0.46)), cutPos.clone().add(new THREE.Vector3(-halfW * 0.22, halfH * 0.1, 0))],
      flame: [cp.clone().add(new THREE.Vector3(-halfW * 0.25, halfH * 0.05, d0 * 0.62)), cp.clone().add(new THREE.Vector3(-halfW * 0.32, halfH * 0.22, 0))],
    };
    poses.smoke = [poses.flame[0].clone().add(new THREE.Vector3(0, halfH * 0.3, d0 * 0.2)), poses.flame[1].clone().add(new THREE.Vector3(0, halfH * 0.35, 0))];
    // sequential blends: each chapter eases the camera from wherever the last one left it
    const camPos = base.clone(), camLook = look.clone();
    const blendTo = ([cp2, lk], t) => { camPos.lerp(cp2, t); camLook.lerp(lk, t); };
    blendTo(poses.copper, smooth(0, 0.6, L("copper")));
    blendTo(poses.strands, smooth(0, 0.35, L("strands")));
    blendTo(poses.wide, smooth(0, 0.3, L("flex")));
    blendTo(poses.flame, smooth(0, 0.35, L("flame")));
    blendTo(poses.smoke, smooth(0, 0.5, L("smoke")));

    wireCam.position.copy(camPos);
    wireCam.lookAt(camLook);
  }

  /* label anchors in screen px, for the strands chapter */
  const project = (v) => { const q = v.clone().project(wireCam); return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H, z: q.z }; };

  function update(p, { bg }) {
    lastProgress = p; lastBgColor = bg;
    const bgCol = new THREE.Color(bg);          // already in linear working space (ColorManagement)
    renderer.setClearColor(bgCol);
    wireRenderer.setClearColor(bgCol);

    const wireIn = local(p, "wireIn");
    const showWire = wireIn > 0;
    const out = { anchors: null };
    const outro = local(p, "outro");
    if (wireIn < 0.5 || outro > 0) {
      // Draw once per frame: the ticker (tick) renders the city right after this update. Rendering here
      // as well drew the whole city twice a frame while scrolling (halving the frame rate on phones).
      skyline.update(p, bg, { points: shapeWorld.entry, d0 });
      if (!skyline.loaded) skyline.render();
      if(local(p,'bundle')>0&&local(p,'drain')===0)out.anchors=skyline.bundleAnchors();
    }
    const finale = local(p, "finale");
    if (!finaleStage && (local(p, "smoke") > .25 || finale > 0)) finaleStage = createFinaleStage(wireRenderer, wireScene, wire);
    if (outro > 0) {
      finaleStage?.hide();                       // the room covers the board until the city is back
    } else if (showWire && finale > 0) {
      // Reconstruct the smoke endpoint on every seek/resize, so reverse scrolling is identical.
      finaleStage.hide();
      wireState(progressOf('smoke',1));
      const stage = finaleStage.update(finaleU(p), W, H, wireCam, shapeWorld.wave);
      wireRenderer.toneMapping = THREE.NeutralToneMapping;
      wireRenderer.render(stage.scene, stage.camera);
    } else if (showWire) {
      finaleStage?.hide();
      wireRenderer.toneMapping = THREE.NeutralToneMapping;
      wireState(p);
      wireRenderer.render(wireScene, wireCam);
      const jEnd = wire.jacketEnd;
      out.anchors = {
        strands: project(wire.surfacePoint(wire.params.cutAt + 0.8, Math.PI / 2, 0.55)),
        jacket: project(wire.surfacePoint(wire.params.cutAt - 4.6, Math.PI * 0.62, 1.0)),
        // 12 back along the jacket; on narrow (phone) screens that falls off the left edge, so step it toward
        // the cut until the pin is on screen (never closer than 6, where the jacket's own pin sits)
        rating: (() => { let a; for (let d = 12; d >= 6; d -= 1) { a = project(wire.surfacePoint(jEnd - d, Math.PI / 2, 1.0)); if (a.x >= 28) break; } return a; })(),
      };
    }
    return out;
  }

  // compile everything up front so the first visible frame never stalls
  resize();
  wire.setPath(shapeWorld.entry); wire.update();
  wireRenderer.compile(wireScene, wireCam);

  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    const geometry = new Set(), material = new Set(), texture = new Set();
    for (const scene of [wireScene]) {
      if (scene.environment) texture.add(scene.environment);
      scene.traverse(o => {
        if (o.geometry) geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          material.add(m);
          for (const value of Object.values(m)) if (value?.isTexture) texture.add(value);
        }
        if (o.isInstancedMesh) o.dispose();
      });
    }
    geometry.forEach(g => g.dispose()); material.forEach(m => m.dispose()); texture.forEach(t => t.dispose());
    finaleStage?.dispose();
    skyline.dispose(); environmentTargets.forEach(target => target.dispose());
    renderer.dispose(); wireRenderer.dispose();
  }
  // Adaptive resolution for the city canvas. Its cost is fill rate (leaf overdraw, AO, depth blur, bloom),
  // which varies widely between GPUs. If frames keep missing the 60 fps budget (a third of the last
  // 45 over 21 ms, i.e. under a second of stutter) the current stretch steps down one level (QUALITY steps).
  // A stretch never steps back up, so it cannot oscillate; one-off spikes (a shader compile, a texture upload)
  // never reach the threshold. Heavy and light stretches keep separate steps: a slow daylight city no longer
  // pulls the cheap network/room/cable close-ups down with it.
  const lightAt = (p) => local(p, "extend") > 0 && local(p, "outro") === 0;
  let frames = 0, slowFrames = 0, pendingStep = false, stillFrames = 0, watchedProgress = -1;
  function applyQuality() {
    renderer.setPixelRatio(qualityRatio());
    skyline.setMSAA(QUALITY[qualityMode].msaa);
    resize();
    update(lastProgress, { bg: lastBgColor });   // resizing clears the canvas: redraw now, or that frame shows blank
    if (local(lastProgress, "wireIn") < .5 || local(lastProgress, "outro") > 0) skyline.render();
    frames = 0; slowFrames = 0;
  }
  function watchFrame(dt) {
    if (!skyline.loaded || dt > 0.25) return;           // not running yet, or a stalled/background frame
    // Reallocating the render targets takes a moment, so a change waits for the reader to pause:
    // a short hitch on a still frame is invisible, the same hitch mid-scroll reads as a jump.
    stillFrames = lastProgress === watchedProgress ? stillFrames + 1 : 0; watchedProgress = lastProgress;
    const want = lightAt(lastProgress) ? "light" : "heavy";
    if (want !== qualityMode || pendingStep) {
      if (stillFrames < 8) return;
      if (want !== qualityMode) { qualityMode = want; pendingStep = false; }   // a step decided in the other stretch does not carry over
      else { pendingStep = false; qualityStep[qualityMode]++; }
      applyQuality();
      return;
    }
    frames++; if (dt > 0.021) slowFrames++;
    if (frames < 45) return;
    const next = QUALITY[qualityMode].steps[qualityStep[qualityMode] + 1];
    if (slowFrames >= 15 && next && Math.min(window.devicePixelRatio || 1, next) < renderer.getPixelRatio()) pendingStep = true;
    frames = 0; slowFrames = 0;
  }

  return {
    update, resize, dispose,
    get ready() { return skyline.loaded; },
    get progress() { return skyline.progress; },
    get error() { return skyline.error; },
    tick(delta) {
      if (disposed || (local(lastProgress, "wireIn") >= .5 && local(lastProgress, "outro") === 0) || document.hidden) return;
      skyline.tick(delta);
      watchFrame(delta);
    },
    diagnostics: () => ({ pixelRatio: renderer.getPixelRatio(), quality: qualityMode, skyline: skyline.diagnostics(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, progress: lastProgress, finale: finaleStage?.diagnostics() }),
  };
}
