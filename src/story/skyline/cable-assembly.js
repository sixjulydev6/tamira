import * as THREE from 'three';
import { Wire } from '../wire.js';
import { smooth, lerp } from '../timeline.js';
import { ENTER } from './building.js';

export const ASSEMBLY_SCALE = .0875;
export const CORE_SCALE = ASSEMBLY_SCALE * .36;
const AXIS = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
const PIVOT = 2.6;

function sleeve(radius, from, to, open = true) {
  const geo = new THREE.CylinderGeometry(radius, radius, to - from, 72, 1, open);
  geo.rotateX(Math.PI / 2);geo.translate(0, 0, (from + to) / 2);
  return geo;
}

function jacketPrint() {
  const canvas = document.createElement('canvas');canvas.width = 2048;canvas.height = 512;
  const ctx = canvas.getContext('2d');ctx.fillStyle = '#ece9e3';ctx.fillRect(0, 0, 2048, 512);
  ctx.fillStyle = '#73736e';ctx.font = '500 32px "Instrument Sans", sans-serif';
  ctx.fillText('TAMIRA     THREE INSULATED CORES', 80, 160);
  const map = new THREE.CanvasTexture(canvas);map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;map.anisotropy = 8;
  return map;
}

/** White sheath/bedding with three independent cores. The supplied red Wire is
 * retained during extraction; no replacement red cable or full-screen cut. */
export function createCableAssembly(redWire) {
  const group = new THREE.Group();group.position.fromArray(ENTER);group.scale.setScalar(ASSEMBLY_SCALE);
  const sheath = new THREE.Group(),bedding = new THREE.Group();group.add(sheath,bedding);
  const print = jacketPrint();
  const white = new THREE.MeshPhysicalMaterial({map: print,roughness: .55,clearcoat: .35,clearcoatRoughness: .5,side: THREE.DoubleSide});
  const inside = new THREE.MeshStandardMaterial({color:'#cfcac1',roughness:.9,side:THREE.BackSide});
  const cutWhite = new THREE.MeshStandardMaterial({color:'#ded9d0',roughness:.6,side:THREE.DoubleSide});
  const bed = new THREE.MeshPhysicalMaterial({color:'#f4efe6',roughness:.65,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide});
  const outerGeo=sleeve(1,-40,0),uv=outerGeo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i)*40/13,uv.getX(i));
  sheath.add(new THREE.Mesh(outerGeo,white),new THREE.Mesh(sleeve(.86,-40,0),inside),new THREE.Mesh(new THREE.RingGeometry(.86,1,72),cutWhite));
  bedding.add(new THREE.Mesh(sleeve(.84,-40,0),bed),new THREE.Mesh(new THREE.RingGeometry(.81,.84,72),cutWhite));
  const cores=[
    {id:'red',wire:redWire,angle:Math.PI/6},
    {id:'blue',wire:new Wire({color:'#2856a8',capColor:'#3a61ac',ink:'rgba(0,0,0,0)'}),angle:5*Math.PI/6},
    {id:'green',wire:new Wire({color:'#1a6633',capColor:'#2b7a45',ink:'rgba(0,0,0,0)'}),angle:3*Math.PI/2},
  ];
  // The red stays in the same scene as the extraction wire. Blue/green are local
  // to the assembly and keep their positions when red is pulled out.
  for(const core of cores.slice(1))group.add(core.wire.group);
  const tip=new THREE.Vector3(),redTip=new THREE.Vector3();
  const fanQuaternion=new THREE.Quaternion(),axisQuaternion=new THREE.Quaternion().setFromRotationMatrix(AXIS);
  const redRotation=new THREE.Quaternion(),baseMatrix=new THREE.Matrix4(),coreMatrix=new THREE.Matrix4();
  const point=new THREE.Vector3(),redScale=new THREE.Vector3();
  let lastExplosion=-1,lastPoints=null;

  function update(explosion,points,extraction=0) {
    group.visible=true;
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
    if(extraction===0) {
      redWire.setPath(straight);
      Object.assign(redWire.params,{head:1,tailLen:21,strip:3.4*smooth(.35,.85,explosion),fan:.15*smooth(.3,.85,explosion),glow:0,heat:0,char:0,cut:0});redWire.update();
    }
    const opacity=1-smooth(.52,.85,extraction);
    group.traverse(o=>{if(o.material){if(o.material.userData.assemblyOpacity===undefined)o.material.userData.assemblyOpacity=o.material.opacity;o.material.transparent=true;o.material.opacity=o.material.userData.assemblyOpacity*opacity;}});
    group.visible=opacity>.001;
    lastExplosion=explosion;lastPoints=points;
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
