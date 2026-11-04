import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildCity, FRAME_CENTRE, FRAME_W, AVENUE } from "./city.js";
import { Wire } from "./wire.js";
import { buildProps } from "./props.js";
import { local, smooth, lerp, windowed, clamp01 } from "./timeline.js";

const VIDEO_W = 1920, VIDEO_H = 1080;
const DEG = Math.PI / 180;

/* path shapes in normalised screen space of the wire camera (x, y in −1…1); tail first, tip last */
const SHAPES = {
  entry:  [[-1.75, -1.5], [-1.15, -1.0], [-0.62, -0.62], [-0.12, -0.34], [0.3, -0.14], [0.62, 0.0]],
  elbow:  [[-1.75, -0.66], [-0.8, -0.6], [0.02, -0.56], [0.3, -0.4], [0.4, 0.05], [0.42, 0.64]],
  wave:   [[-1.75, -0.36], [-0.95, -0.24], [-0.32, -0.4], [0.3, -0.26], [0.95, -0.34], [1.75, -0.22]],
  finale: [[-1.75, -1.05], [-1.0, -0.72], [-0.42, -0.5], [0.04, -0.3], [0.3, -0.08], [0.44, 0.02]],
};

/* The wire in the city is the same model as the product wire, scaled up (jacket radius 2.2 m).
   Where its tip stops on the avenue: */
const CITY_SCALE = 2.2;
const HEAD_Y = AVENUE.tipY;
const EXT_TARGET = new THREE.Vector3(205, 10, 0);   // centre of the pulled-back view
const EXT_FRAME_W = 780;                             // metres across the pulled-back view

export function createStory({ canvas, wireCanvas, stage, media }) {
  const makeRenderer = (el) => {
    const r = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: false, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  };
  // two canvases: the city (with bloom) and the product wire; main.js crossfades them at the hand-over
  const renderer = makeRenderer(canvas);
  const wireRenderer = makeRenderer(wireCanvas);
  wireRenderer.toneMapping = THREE.NeutralToneMapping;

  /* ---------------------------------------------------------------- city */
  const shared = {
    uBg: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2() }, uStage: { value: new THREE.Vector4() },
    uMaskMix: { value: 1 }, uMaskMode: { value: 0 }, uDrain: { value: 0 }, uDrainNdc: { value: new THREE.Vector2(-1.02, -1.0) },
    uFade: { value: 1 }, uReveal: { value: 0 }, uExtend: { value: 0 }, uFlow: { value: 0 }, uHead: { value: -1e4 }, uPower: { value: -1e4 },
    uDpr: { value: 1 },
    uLine: { value: new THREE.Color("#e8582a") }, uLineHot: { value: new THREE.Color("#ffc69c") },   // crown orange, peach
  };
  const cityScene = new THREE.Scene();
  const city = buildCity(shared);
  cityScene.add(city.group);
  const cityCam = new THREE.PerspectiveCamera(1, VIDEO_W / VIDEO_H, 10, 100000);
  cityCam.up.set(0, 0, 1);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cityScene, cityCam));
  // threshold keeps the dark page and the hulls out of the glow; only the lines and lamps bloom
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.4, 0.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* The city wire, drawn after the bloom so it stays a crisp product. Its world is the city's
     (Z up, metres). Lights and reflections are the product scene's, rotated by the same mapping
     M used for the hand-over (product x → city +Y, product y → city +Z, product z → city +X),
     so at the hand-over both renders are the same picture. */
  const cityWireScene = new THREE.Scene();
  cityWireScene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  cityWireScene.environmentIntensity = 0.85;
  cityWireScene.environmentRotation.setFromRotationMatrix(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  { const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(12, -6, 10); cityWireScene.add(k);
    const r = new THREE.DirectionalLight(0xdfe6ff, 1.1); r.position.set(-6, 8, -4); cityWireScene.add(r); }
  const cityWire = new Wire();
  cityWire.group.scale.setScalar(CITY_SCALE);
  cityWireScene.add(cityWire.group);
  const FACING_X = new THREE.Vector3(1, 0, 0);

  /* ---------------------------------------------------------------- product wire world */
  const wireScene = new THREE.Scene();
  wireScene.environment = new THREE.PMREMGenerator(wireRenderer).fromScene(new RoomEnvironment(), 0.04).texture;
  wireScene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 10, 12); wireScene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 1.1); rim.position.set(8, -4, -6); wireScene.add(rim);
  const wire = new Wire();
  wireScene.add(wire.group);
  const props = buildProps();
  wireScene.add(props.group);
  const wireCam = new THREE.PerspectiveCamera(28, 1, 0.5, 600);

  /* ---------------------------------------------------------------- layout */
  let W = 1, H = 1, frame = { x: 0, y: 0, w: 1, h: 1 }, halfW = 13, halfH = 7.5, d0 = 30, portrait = false;
  const shapeWorld = {};
  const toWorld = ([nx, ny]) => {
    const y = portrait ? ny * 0.5 - 0.32 : ny;     // keep the wire below the copy on tall screens
    return new THREE.Vector3(nx * halfW, y * halfH, 0);
  };
  /** M: product-wire world → city world */
  const toCity = (v) => {
    const tip = shapeWorld.entry[5];
    return new THREE.Vector3(AVENUE.x + v.z * CITY_SCALE, HEAD_Y + (v.x - tip.x) * CITY_SCALE, (v.y + halfH + 1) * CITY_SCALE);
  };
  let cityPathLifted = [], cityPathFlat = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    wireRenderer.setSize(W, H, false);
    composer.setSize(W, H);
    shared.uRes.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    shared.uDpr.value = renderer.getPixelRatio();      // edge strips are sized in CSS px

    // where the day render actually sits: object-fit: cover inside the stage, at its object-position
    const s = stage.getBoundingClientRect();
    const [opx, opy] = getComputedStyle(media).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const k = Math.max(s.width / VIDEO_W, s.height / VIDEO_H);
    const dw = VIDEO_W * k, dh = VIDEO_H * k;
    frame = { x: s.left - r.left + (s.width - dw) * opx, y: s.top - r.top + (s.height - dh) * opy, w: dw, h: dh };
    const pr = renderer.getPixelRatio();
    shared.uStage.value.set((s.left - r.left) * pr, (s.top - r.top) * pr, s.width * pr, s.height * pr);
    shared.uMaskMode.value = window.matchMedia("(max-width: 860px)").matches ? 1 : 0;

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

    // the city wire's path: straight along the avenue, and the same path with its tip lifted into
    // exactly the product wire's opening shape (mapped by M)
    const R = CITY_SCALE;
    const lifted = shapeWorld.entry.slice(1).map(toCity);
    const lead = [HEAD_Y - 1700, HEAD_Y - 900, HEAD_Y - 160].map((y) => new THREE.Vector3(AVENUE.x, y, R));
    cityPathLifted = [...lead, ...lifted];
    cityPathFlat = cityPathLifted.map((v) => new THREE.Vector3(AVENUE.x, v.y, R));
  }

  /* ---------------------------------------------------------------- city camera
     Poses are { target, el, az, D, hfov, vb }. The first reproduces the Blender ortho camera
     (a 0.5° lens from 46 km is orthographic to well under a pixel) mapped onto the video's
     on-screen frame (vb = 0). vb = 1 is full bleed. */
  const toCam = (el, az) => new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
  const isoD = (frameW) => (frameW / 2) / Math.tan(0.25 * DEG);
  const lerpPose = (a, b, t) => ({
    target: a.target.clone().lerp(b.target, t),
    el: lerp(a.el, b.el, t), az: lerp(a.az, b.az, t),
    D: Math.exp(lerp(Math.log(a.D), Math.log(b.D), t)),
    hfov: Math.exp(lerp(Math.log(a.hfov), Math.log(b.hfov), t)),
    vb: lerp(a.vb, b.vb, t),
  });

  /** 0–1 progress of the push-in: 0.6 by the end of "approach" (the close diagonal frame, tip still
      on the street), 1 shortly before the drain ends */
  const approachK = (p) => smooth(0, 1, 0.6 * local(p, "approach") + 0.4 * smooth(0, 0.85, local(p, "drain")));

  function cityPose(p) {
    const L = (id) => local(p, id);
    const handoff = { target: FRAME_CENTRE.clone(), el: 38, az: -45, D: isoD(FRAME_W), hfov: 0.5, vb: 0 };
    const wide = { target: EXT_TARGET.clone().add(new THREE.Vector3(0, 70 * smooth(0, 1, L("run")), 0)), el: 38, az: -45, D: isoD(EXT_FRAME_W), hfov: 0.5, vb: 1 };
    // the product camera, mapped into the city by M: the hand-over frame
    const handTarget = toCity(new THREE.Vector3(0, 0, 0));
    const hand = { target: handTarget, el: 0, az: 0, D: d0 * CITY_SCALE, hfov: 2 * Math.atan(Math.tan(14 * DEG) * (W / H)) / DEG, vb: 1 };

    let pose = lerpPose(handoff, wide, smooth(0, 1, L("extend")));
    // one continuous push-in, wide diagonal → close side view of the tip. The wire already runs
    // lower-left → upper-right in the wide view, so the camera only eases 45° round and levels off;
    // it never goes behind the wire. ~70% of the move happens in "approach" (ending on the close
    // diagonal frame); the rest settles during the drain while the city goes away.
    const k = approachK(p);
    const move = lerpPose(pose, hand, k);
    // angle and lens lag the distance a little, so the city reads as a view first and flattens late
    move.el = lerp(pose.el, hand.el, smooth(0.15, 1, k));
    move.az = lerp(pose.az, hand.az, smooth(0.1, 1, k));
    return move;
  }

  function placeCityCam(pose) {
    const el = pose.el * DEG, az = pose.az * DEG, hfov = pose.hfov * DEG;
    cityCam.position.copy(pose.target).addScaledVector(toCam(el, az), pose.D);
    cityCam.lookAt(pose.target);
    cityCam.near = Math.max(0.5, pose.D - 2500); cityCam.far = pose.D + 4000;
    // blend the view window from "video frame inside the stage" to "whole canvas"
    const fb = pose.vb;
    const fullW = lerp(frame.w, W, fb), fullH = lerp(frame.h, H, fb);
    const aspect = fullW / fullH;
    cityCam.aspect = aspect;
    cityCam.fov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) / DEG;
    cityCam.setViewOffset(fullW, fullH, lerp(-frame.x, 0, fb), lerp(-frame.y, 0, fb), W, H);
    cityCam.updateProjectionMatrix();
    // the day image is full screen with no CSS mask (the frame opens fully before "wireOn"),
    // so the shaders' copy of that mask stays off
    shared.uMaskMix.value = 0;
  }

  /* the city wire: runs along the avenue, then lifts its tip into the product shape */
  function cityWireState(p) {
    // the tip lifts into the product shape over the second half of the push-in
    const lift = smooth(0.6, 1, approachK(p));    // lifts only once the city is going
    const pts = cityPathFlat.map((v, i) => v.clone().lerp(cityPathLifted[i], lift).divideScalar(CITY_SCALE));
    cityWire.setPath(pts, FACING_X);
    const P = cityWire.params;
    // tip travels from off-screen (900 m back) to HEAD_Y along the straight avenue
    const back = (1 - smooth(0.04, 0.92, local(p, "run"))) * 900 / CITY_SCALE;
    P.head = Math.max(0.02, (cityWire.length - back) / cityWire.length);
    P.tailLen = 340;
    P.strip = 3.4; P.fan = 0.45; P.glow = 1; P.cut = 0; P.heat = 0; P.char = 0;
    cityWire.update();
    const tip = cityWire.frameAt(cityWire.headDist, { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() }).p;
    return tip.multiplyScalar(CITY_SCALE);
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
    const toFinale = smooth(0.0, 0.45, L("finale"));
    if (toFinale > 0) pts = mixShape("wave", "finale", toFinale);
    else if (toWave > 0) pts = mixShape("elbow", "wave", toWave);
    else if (toElbow > 0) pts = mixShape("entry", "elbow", toElbow);
    wire.setPath(pts);

    // the wire is already in place: it arrived through the city
    P.head = 1;
    P.glow = lerp(1, 0.25, smooth(0.2, 1, L("wireIn"))) * (1 - smooth(0, 0.5, L("copper")));
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

    const plateIn = smooth(0.2, 0.55, L("finale"));
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
    blendTo(poses.wide, smooth(0, 0.45, L("finale")));
    wireCam.position.copy(camPos);
    wireCam.lookAt(camLook);
  }

  /* label anchors in screen px, for the strands chapter */
  const project = (v) => { const q = v.clone().project(wireCam); return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H, z: q.z }; };

  function update(p, { bg }) {
    const bgCol = new THREE.Color(bg);          // already in linear working space (ColorManagement)
    shared.uBg.value.copy(bgCol);
    renderer.setClearColor(bgCol);
    wireRenderer.setClearColor(bgCol);

    const wireOn = local(p, "wireOn"), drain = local(p, "drain"), wireIn = local(p, "wireIn");
    const showCity = wireOn > 0 && wireIn < 0.5;
    const showWire = wireIn > 0;
    const out = { anchors: null };

    if (showCity) {
      placeCityCam(cityPose(p));
      const showCityWire = local(p, "run") > 0;
      const tip = showCityWire ? cityWireState(p) : null;

      shared.uReveal.value = smooth(0, 0.85, wireOn);
      shared.uExtend.value = smooth(0, 0.85, local(p, "extend"));
      shared.uHead.value = tip ? tip.y : -1e4;
      // power front: exactly at the tip while the wire runs (nothing ever lights ahead of it); once
      // the wire has stopped, it keeps spreading so the rest of the city is lit by street level
      shared.uPower.value = tip ? tip.y + 900 * smooth(0, 0.8, local(p, "approach")) : -1e4;
      // the network drains into the wire's tip; it is gone before the page lightens
      if (tip) { const q = tip.clone().project(cityCam); shared.uDrainNdc.value.set(q.x, q.y); }
      // fast: the city is gone in the first quarter of the drain, as the page lightens
      shared.uDrain.value = smooth(0.0, 0.25, drain);
      shared.uFlow.value = drain * 24;
      shared.uFade.value = 1 - smooth(0.16, 0.28, drain);
      // glow only once the page is dark (no glow on the light day page), off again for the drain
      bloom.strength = 0.75 * smooth(0.35, 0.6, wireOn) * (1 - smooth(0.05, 0.25, drain));
      renderer.toneMapping = THREE.NoToneMapping;
      composer.render();

      if (showCityWire) {
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(cityWireScene, cityCam);
        renderer.autoClear = true;
      }
    }
    if (showWire) {
      wireState(p);
      wireRenderer.render(wireScene, wireCam);
      const jEnd = wire.jacketEnd;
      out.anchors = {
        strands: project(wire.surfacePoint(wire.params.cutAt + 0.8, Math.PI / 2, 0.55)),
        jacket: project(wire.surfacePoint(wire.params.cutAt - 4.6, Math.PI * 0.62, 1.0)),
        rating: project(wire.surfacePoint(jEnd - 12, Math.PI / 2, 1.0)),
      };
    }
    return out;
  }

  // compile everything up front so the first visible frame never stalls
  resize();
  renderer.compile(cityScene, cityCam);
  cityWire.setPath(cityPathFlat.map((v) => v.clone().divideScalar(CITY_SCALE)), FACING_X); cityWire.update();
  renderer.compile(cityWireScene, cityCam);
  wire.setPath(shapeWorld.entry); wire.update();
  wireRenderer.compile(wireScene, wireCam);

  return { update, resize };
}
