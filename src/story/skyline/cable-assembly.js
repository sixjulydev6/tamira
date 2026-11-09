import * as THREE from 'three';
import { Wire } from '../wire.js';
import { smooth, lerp } from '../timeline.js';
import { ENTER } from './building.js';
import { SINGLE } from './layout.js';

export const ASSEMBLY_SCALE = .0875;
export const CORE_SCALE = ASSEMBLY_SCALE * .36;
const AXIS = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
const PIVOT = 2.6;

function sleeve(radius, from, to, open = true) {
  const geo = new THREE.CylinderGeometry(radius, radius, to - from, 72, 1, open);
  geo.rotateX(Math.PI / 2);geo.translate(0, 0, (from + to) / 2);
  return geo;
}

// The ceiling run beyond the cut, to the light it feeds (building.js: feedX, z 39.2 → x 84.5),
// in assembly units. Same radius and print as the sheath, so before the reveal the assembly
// is the ceiling cable; at the reveal this piece parts from the cut and fades.
function farRun() {
  const L1 = (39.2 - ENTER[2]) / ASSEMBLY_SCALE, L2 = (SINGLE.feedX - 84.5) / ASSEMBLY_SCALE, R = .3 / ASSEMBLY_SCALE;
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, L1 - R)));
  path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, L1 - R), new THREE.Vector3(0, 0, L1), new THREE.Vector3(-R, 0, L1)));
  path.add(new THREE.LineCurve3(new THREE.Vector3(-R, 0, L1), new THREE.Vector3(-L2, 0, L1)));
  const STEPS = 160, RAD = 72, up = new THREE.Vector3(0, 1, 0), total = path.getLength();
  const pos = [], nor = [], uv = [], idx = [];
  const c = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS;path.getPointAt(u, c);path.getTangentAt(u, t);
    side.crossVectors(up, t).normalize();
    for (let j = 0; j <= RAD; j++) {
      // same angular parametrisation as the sheath cylinder: x = sin θ, y = −cos θ
      const th = j / RAD * Math.PI * 2;
      n.copy(side).multiplyScalar(Math.sin(th)).addScaledVector(up, -Math.cos(th));
      pos.push(c.x + n.x, c.y + n.y, c.z + n.z);nor.push(n.x, n.y, n.z);uv.push((40 + u * total) / 13, 1.375 - j / RAD);
    }
  }
  for (let i = 0; i < STEPS; i++) for (let j = 0; j < RAD; j++) {
    const a = i * (RAD + 1) + j, b = a + RAD + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// Printed legend as on a real cable: small inkjet-style marking, repeated along the run.
function jacketPrint() {
  const canvas = document.createElement('canvas');canvas.width = 2048;canvas.height = 512;
  const ctx = canvas.getContext('2d');ctx.fillStyle = '#ece9e3';ctx.fillRect(0, 0, 2048, 512);
  ctx.fillStyle = 'rgba(70, 70, 66, 0.82)';ctx.font = '500 26px "DM Sans", Arial, sans-serif';
  ctx.fillText('TAMIRA     3 CORE  1.5 SQ MM     HR-FR-LSH     1100 V', 80, 160);
  const map = new THREE.CanvasTexture(canvas);map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;map.anisotropy = 8;
  return map;
}

// Extruded PVC is not optically smooth: faint die lines run along the length and the surface has a fine
// grain. A tiny normal map gives the sheath a plastic highlight that breaks up instead of a flat gradient.
let pvcNormal = null;
function extrusionNormal() {
  if (pvcNormal) return pvcNormal;
  const W = 512, H = 128, c = document.createElement('canvas');c.width = W;c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const lines = new Float32Array(H);
  for (let y = 0; y < H; y++) lines[y] = Math.sin(y * 0.9) * 0.35 + Math.sin(y * 2.7 + 1.3) * 0.2 + (Math.random() - 0.5) * 0.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ny = (lines[(y + 1) % H] - lines[(y + H - 1) % H]) * 0.5 + (Math.random() - 0.5) * 0.12;   // across the run (v)
    const nx = (Math.random() - 0.5) * 0.06;                                                          // along the run (u)
    const o = (y * W + x) * 4;
    img.data[o] = 128 + nx * 127;img.data[o + 1] = 128 + ny * 127;img.data[o + 2] = 255;img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  pvcNormal = new THREE.CanvasTexture(c);pvcNormal.wrapS = pvcNormal.wrapT = THREE.RepeatWrapping;pvcNormal.repeat.set(4, 24);   // fine: dozens of faint lines around the sheath, never visible bands
  return pvcNormal;
}

// Cross-section of a core's copper: 30 round strands packed in the insulation's bore, with dark gaps.
let copperFace = null;
function copperFaceTexture() {
  if (copperFace) return copperFace;
  const S = 256, c = document.createElement('canvas');c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#2a170c';g.beginPath();g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);g.fill();
  const rings = [[0, 1, 0], [0.26, 6, 0], [0.5, 11, 0.3], [0.71, 12, 0.1]];
  for (const [r, n, ph] of rings) for (let i = 0; i < n; i++) {
    const a = ph + (i / n) * Math.PI * 2, x = S / 2 + Math.cos(a) * r * S * 0.47, y = S / 2 + Math.sin(a) * r * S * 0.47;
    const grad = g.createRadialGradient(x - 4, y - 4, 1, x, y, S * 0.075);
    grad.addColorStop(0, '#f6c79a');grad.addColorStop(0.55, '#c9814e');grad.addColorStop(1, '#7a4422');
    g.fillStyle = grad;g.beginPath();g.arc(x, y, S * 0.072, 0, Math.PI * 2);g.fill();
  }
  copperFace = new THREE.CanvasTexture(c);copperFace.colorSpace = THREE.SRGBColorSpace;
  return copperFace;
}

const CORE_R = .36, CORE_AT = .43, BED_R = .84;
const CORE_COLORS = { red: '#c21d19', blue: '#2856a8', green: '#1a6633' };
const CORE_ANGLES = [['red', Math.PI / 6], ['blue', 5 * Math.PI / 6], ['green', 3 * Math.PI / 2]];

// The filler's cut face: a solid disc with the three cores passing through it.
function beddingFace(mirror = 1) {
  const shape = new THREE.Shape();shape.absarc(0, 0, BED_R, 0, Math.PI * 2, false);
  for (const [, a] of CORE_ANGLES) {
    const h = new THREE.Path();h.absarc(mirror * Math.cos(a) * CORE_AT, Math.sin(a) * CORE_AT, CORE_R * 1.01, 0, Math.PI * 2, true);shape.holes.push(h);
  }
  return new THREE.ShapeGeometry(shape, 48);
}

// The far piece's cut face: sheath ring, filler and three cores (insulation ring + copper), as a real
// cable shows when it is cut through. Faces the near piece (−Z).
function crossSection(mats) {
  const face = new THREE.Group();
  face.add(new THREE.Mesh(new THREE.RingGeometry(.86, 1, 72), mats.cut));
  face.add(new THREE.Mesh(new THREE.RingGeometry(BED_R, .86, 72), mats.shadow));
  // the face is turned 180° about Y to look back at the near piece, so x is pre-mirrored to keep each
  // core in line with the same core in the near piece
  face.add(new THREE.Mesh(beddingFace(-1), mats.filler));
  for (const [id, a] of CORE_ANGLES) {
    const x = -Math.cos(a) * CORE_AT, y = Math.sin(a) * CORE_AT;
    const ins = new THREE.Mesh(new THREE.RingGeometry(CORE_R * .8, CORE_R, 48), mats.core[id]);ins.position.set(x, y, 0);
    const cu = new THREE.Mesh(new THREE.CircleGeometry(CORE_R * .8, 48), mats.copper);cu.position.set(x, y, 0);
    face.add(ins, cu);
  }
  face.rotation.y = Math.PI;face.position.z = -.002;
  return face;
}

/** White sheath/bedding with three independent cores. The supplied red Wire is
 * retained during extraction; no replacement red cable or full-screen cut. */
export function createCableAssembly(redWire) {
  const group = new THREE.Group();group.position.fromArray(ENTER);group.scale.setScalar(ASSEMBLY_SCALE);
  const sheath = new THREE.Group(),bedding = new THREE.Group();group.add(sheath,bedding);
  const print = jacketPrint();
  // PVC sheath: satin plastic with fine extrusion lines (normal map), not a flat matte tube
  const white = new THREE.MeshPhysicalMaterial({map: print,normalMap: extrusionNormal(),normalScale: new THREE.Vector2(.035, .035),
    roughness: .42,clearcoat: .5,clearcoatRoughness: .35,sheen: .25,sheenRoughness: .6,sheenColor: new THREE.Color('#ffffff'),side: THREE.DoubleSide});
  const inside = new THREE.MeshStandardMaterial({color:'#bfb9ae',roughness:.9,side:THREE.BackSide});
  // cut faces of PVC are matte and a shade darker than the moulded skin
  const cutWhite = new THREE.MeshStandardMaterial({color:'#d6d0c5',roughness:.85,side:THREE.DoubleSide});
  // inner bedding / filler: an opaque, softer extruded compound (was a transparent glass tube)
  const bed = new THREE.MeshStandardMaterial({color:'#d9d4ca',roughness:.88,normalMap: extrusionNormal(),normalScale: new THREE.Vector2(.05, .05),side:THREE.DoubleSide});
  const fillerCut = new THREE.MeshStandardMaterial({color:'#cbc5b9',roughness:.95,side:THREE.DoubleSide});
  const faceMats = {cut: cutWhite.clone(), shadow: new THREE.MeshStandardMaterial({color:'#8d877c',roughness:1,side:THREE.DoubleSide}),
    filler: fillerCut.clone(), copper: new THREE.MeshStandardMaterial({map: copperFaceTexture(),metalness: .85,roughness: .32,side:THREE.DoubleSide}),
    core: Object.fromEntries(Object.entries(CORE_COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({color: c,roughness:.55,side:THREE.DoubleSide})]))};
  const outerGeo=sleeve(1,-40,0),uv=outerGeo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i)*40/13,1.375-uv.getX(i));
  sheath.add(new THREE.Mesh(outerGeo,white),new THREE.Mesh(sleeve(.86,-40,0),inside),new THREE.Mesh(new THREE.RingGeometry(.86,1,72),cutWhite));
  const farWhite = white.clone();farWhite.side = THREE.FrontSide;
  const far = new THREE.Mesh(farRun(),farWhite);group.add(far);
  const farFace = crossSection(faceMats);far.add(farFace);
  const faceList = [];farFace.traverse(o => { if (o.material) faceList.push(o.material); });
  bedding.add(new THREE.Mesh(sleeve(BED_R,-40,0),bed),new THREE.Mesh(beddingFace(),fillerCut));
  const cores=[
    {id:'red',wire:redWire,angle:Math.PI/6},
    {id:'blue',wire:new Wire({color:'#2856a8',capColor:'#3a61ac',ink:'rgba(0,0,0,0)',detail:.5}),angle:5*Math.PI/6},
    {id:'green',wire:new Wire({color:'#1a6633',capColor:'#2b7a45',ink:'rgba(0,0,0,0)',detail:.5}),angle:3*Math.PI/2},
  ];
  // The red stays in the same scene as the extraction wire. Blue/green are local
  // to the assembly and keep their positions when red is pulled out.
  for(const core of cores.slice(1))group.add(core.wire.group);
  // update() fades every assembly material through opacity, which needs transparent=true. Set it from the
  // start (opacity 1 renders the same) so the shaders compiled ahead of time are the ones actually used;
  // flipping it on the first cable frame forced a fresh shader compile mid-scroll.
  group.traverse(o=>{if(o.material)o.material.transparent=true;});
  const tip=new THREE.Vector3(),redTip=new THREE.Vector3();
  const fanQuaternion=new THREE.Quaternion(),axisQuaternion=new THREE.Quaternion().setFromRotationMatrix(AXIS);
  const redRotation=new THREE.Quaternion(),baseMatrix=new THREE.Matrix4(),coreMatrix=new THREE.Matrix4();
  const point=new THREE.Vector3(),redScale=new THREE.Vector3();
  let lastExplosion=-1,lastPoints=null,lastExtraction=-1;

  function update(explosion,points,extraction=0,part=1) {
    group.visible=true;
    // the far run parts from the cut and fades, opening the reveal. A cut cable under tension springs: the
    // loose end kicks away and sags a little, which turns its cut face (cores, copper) toward the camera.
    const spring=part*part*(3-2*part);
    far.position.set(-.9*spring,-.55*spring,9*spring);
    far.rotation.set(.05*spring,.25*spring,0);
    const fan=.085*smooth(.3,.85,explosion);
    sheath.position.z=-3.6*smooth(0,.55,explosion);
    bedding.position.z=-2.2*smooth(.15,.7,explosion);
    tip.copy(points[points.length-1]);
    const straight=points.map((_,i)=>new THREE.Vector3(tip.x-110*(1-i/(points.length-1)),tip.y,tip.z));
    for(const core of cores) {
      const a=core.angle;
      fanQuaternion.setFromEuler(new THREE.Euler(-Math.sin(a)*fan,Math.cos(a)*fan,0));
      coreMatrix.compose(new THREE.Vector3(Math.cos(a)*.43,Math.sin(a)*.43,-PIVOT),fanQuaternion,new THREE.Vector3(1,1,1));
      coreMatrix.multiply(new THREE.Matrix4().makeTranslation(0,0,PIVOT));
      if(core.id==='red') {
        group.updateMatrixWorld(true);
        baseMatrix.multiplyMatrices(group.matrixWorld,coreMatrix);
        redTip.set(0,0,0).applyMatrix4(baseMatrix);
        baseMatrix.decompose(point,redRotation,redScale);
        redRotation.multiply(axisQuaternion);
        if(extraction===0) {
          redWire.group.quaternion.copy(redRotation);redWire.group.scale.setScalar(CORE_SCALE);
          redWire.group.position.copy(redTip).sub(tip.clone().applyQuaternion(redRotation).multiplyScalar(CORE_SCALE));
        }
      } else if(explosion!==lastExplosion||points!==lastPoints) {
        coreMatrix.decompose(core.wire.group.position,core.wire.group.quaternion,core.wire.group.scale);
        core.wire.group.quaternion.multiply(axisQuaternion);core.wire.group.scale.setScalar(.36);
        core.wire.group.position.sub(tip.clone().applyQuaternion(core.wire.group.quaternion).multiplyScalar(.36));
        core.wire.setPath(straight);
        Object.assign(core.wire.params,{head:1,tailLen:21,strip:3.4*smooth(.35,.85,explosion),fan:.15*smooth(.3,.85,explosion),glow:0,heat:0,char:0,cut:0});
        core.wire.update();
      }
    }
    // the red core's tube is rebuilt on the CPU; only when its inputs changed or it is coming back from the
    // pull-out (the bridge reshapes the same wire), not on every ambient tick
    if(extraction===0&&(explosion!==lastExplosion||points!==lastPoints||lastExtraction!==0)) {
      redWire.setPath(straight);
      Object.assign(redWire.params,{head:1,tailLen:21,strip:3.4*smooth(.35,.85,explosion),fan:.15*smooth(.3,.85,explosion),glow:0,heat:0,char:0,cut:0});redWire.update();
    }
    const opacity=1-smooth(.5,.75,extraction);
    group.traverse(o=>{if(o.material){if(o.material.userData.assemblyOpacity===undefined)o.material.userData.assemblyOpacity=o.material.opacity;o.material.transparent=true;o.material.opacity=o.material.userData.assemblyOpacity*opacity;}});
    const farFade=1-smooth(.15,1,part);
    farWhite.opacity=opacity*farFade;far.visible=farFade>.001;
    // the far piece's cut face only exists once the pieces have parted (before that it would sit inside the cable)
    farFace.visible=part>.001;for(const m of faceList){m.transparent=farFade<1;m.opacity=opacity*farFade;}
    group.visible=opacity>.001;
    lastExplosion=explosion;lastPoints=points;lastExtraction=extraction;
    return {tip:redTip.clone(),rotation:redRotation.clone(),straight};
  }

  function anchors(camera,w,h) {
    const project=p=>{const v=group.localToWorld(p).project(camera);return {x:(v.x*.5+.5)*w,y:(-v.y*.5+.5)*h,z:v.z};};
    return {
      bundleSheath:project(new THREE.Vector3(0,1,sheath.position.z-1)),
      bundleBedding:project(new THREE.Vector3(0,.84,bedding.position.z-.35)),
      bundleInsulation:project(new THREE.Vector3(-.45,.4,-1.6)),
      bundleConductor:project(new THREE.Vector3(.4,.4,-.15)),
    };
  }
  return {group,update,anchors,hide(){group.visible=false;},diagnostics(){
    redWire.group.updateMatrixWorld(true);
    const actualTip=redWire.samples?redWire.frameAt(redWire.headDist,{p:new THREE.Vector3(),t:new THREE.Vector3(),n:new THREE.Vector3(),b:new THREE.Vector3()}).p.applyMatrix4(redWire.group.matrixWorld):new THREE.Vector3();
    return {redWireId:redWire.group.uuid,cores:group.visible?3:1,redTip:redTip.toArray(),actualRedTip:actualTip.toArray(),otherCores:cores.slice(1).map(c=>({id:c.id,position:c.wire.group.position.toArray()}))};
  }};
}
