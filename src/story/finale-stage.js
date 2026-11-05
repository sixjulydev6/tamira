import * as THREE from 'three';
import { FINALE, createFinale, finaleMatrix, finaleRail } from './original/finale.js';
import { ROOM_VIEW, frameFor, tanRect, windowAt } from './original/roomview.js';
import { smooth, lerp } from './timeline.js';
import { Wire } from './wire.js';
import { originalFinalePath } from './original/camera-path.js';

export { finaleU } from './finale-timing.js';
const beat = (u,a,b) => smooth(a,b,u);
const dot3 = (a,b) => a.reduce((sum,v,i) => sum + v*b[i],0);
const M = finaleMatrix(), Q = new THREE.Quaternion().setFromRotationMatrix(M);
const BOARD = new THREE.Vector3(0,0,FINALE.plate.d).applyMatrix4(M);
function roomCamera(g) {
  const B=g.board,C=g.cam;
  const toG = v => new THREE.Vector3(dot3(v,B.right),dot3(v,B.up),dot3(v,B.normal));
  const position = toG(C.pos.map((v,i)=>v-B.pos[i])).multiplyScalar(FINALE.perMetre);
  const basis = new THREE.Matrix4().makeBasis(toG(C.right).applyQuaternion(Q),toG(C.up).applyQuaternion(Q),toG(C.back).applyQuaternion(Q));
  return { local:position, pos:position.clone().applyMatrix4(M), q:new THREE.Quaternion().setFromRotationMatrix(basis) };
}
const RC={d:roomCamera(ROOM_VIEW.d),p:roomCamera(ROOM_VIEW.p)};
const fx=x=>FINALE.origin.x-x, fz=z=>FINALE.origin.z-z;
const toWorld=v=>[fx(v.x),FINALE.origin.y+v.y,fz(v.z)];
const board=BOARD.toArray();
const lastShot=f=>({u:6.92,pos:toWorld(RC[f].local.clone().setLength(34).add(new THREE.Vector3(0,0,FINALE.plate.d))),at:board});
const path = originalFinalePath(u=>({...lastShot('d'),u,p:lastShot('p')}),fx,fz);

export function createFinaleStage(renderer, scene, wire) {
  const camera=new THREE.PerspectiveCamera(28,1,.1,2000);
  const lite=window.matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600;
  const set=createFinale(renderer,lite);scene.add(set.group);set.group.visible=false;
  const rail=id=>{const c=new THREE.CatmullRomCurve3(finaleRail(id).map(v=>v.applyMatrix4(M)),false,'centripetal');return {curve:c,length:c.getLength()};};
  const {curve,length}=rail('red');
  // The neutral and earth: two fresh lengths that slide up the back of the wall into N and E after the
  // red product wire seats in L, with the source's colours, sheen and timing (script.js finBlack/finGreen).
  // Same cable model and scale as the red one; hidden until they start to move.
  const extras=[
    {id:'black',seat:[6.46,6.58],click:[6.58,6.61],wire:new Wire({color:'#161719',capColor:'#2a2b2e',ink:'rgba(214,214,214,0.42)',envMapIntensity:.5})},
    {id:'green',seat:[6.54,6.66],click:[6.66,6.69],wire:new Wire({color:'#1a6633',capColor:'#2b7a45',ink:'rgba(226,245,229,0.55)',envMapIntensity:.65})},
  ].map(e=>({...e,...rail(e.id)}));
  for(const e of extras){e.wire.group.visible=false;scene.add(e.wire.group);}
  const SCALE=.16;
  function poseExtra(e,seat){
    e.wire.group.visible=seat>.0005;
    if(!e.wire.group.visible)return;
    const tip=e.length-(1-seat)*26,tail=tip-30;
    e.wire.group.scale.setScalar(SCALE);
    e.wire.setPath(Array.from({length:55},(_,i)=>e.curve.getPointAt(THREE.MathUtils.clamp(lerp(tail,tip,i/54)/e.length,0,1)).divideScalar(SCALE)));
    Object.assign(e.wire.params,{head:1,strip:FINALE.copper/SCALE,fan:0,glow:0,char:0,cut:0,heat:0});
    e.wire.update();
  }
  // compile their materials now (the stage is built during smoke), so N and E don't stall as they appear
  for(const e of extras)poseExtra(e,1);
  renderer.compile(scene,camera);
  for(const e of extras)e.wire.group.visible=false;
  let blend=0;
  function poseWire(u,startPoints){
    blend=beat(u,6.06,6.32);
    const scale=lerp(1,SCALE,blend),seat=1-Math.pow(1-beat(u,6.38,6.5),3);
    const tip=length-(1-seat)*26,tail=tip-30;
    const start=new THREE.CatmullRomCurve3(startPoints,false,'centripetal');
    wire.group.scale.setScalar(scale);wire.group.visible=true;
    wire.setPath(Array.from({length:55},(_,i)=>{
      const t=i/54;
      return start.getPointAt(t).lerp(curve.getPointAt(THREE.MathUtils.clamp(lerp(tail,tip,t)/length,0,1)),blend).divideScalar(scale);
    }));
    Object.assign(wire.params,{head:1,strip:lerp(3.4,FINALE.copper,blend)/scale,fan:lerp(.65,0,blend),glow:0,char:1-blend,cut:0,heat:0});
    wire.update();
  }
  const inv=new THREE.Matrix4(),one=new THREE.Vector3(1,1,1),look=new THREE.Vector3();
  function boardIn(pos,q,w){
    inv.compose(pos,q,one).invert();const p=BOARD.clone().applyMatrix4(inv),depth=-p.z,tx=p.x/depth,ty=p.y/depth;
    return {tx,ty,depth,qx:(tx-w.l)/(w.r-w.l),qy:(w.t-ty)/(w.t-w.b),span:(w.r-w.l)*depth};
  }
  // Port of the source handoff: interpolate board screen position and projected span, not FOV alone.
  function handoff(h,aspect){
    if(h<=0)return;
    const f=frameFor(aspect),g=ROOM_VIEW[f],R=RC[f],wm=tanRect(g,windowAt(g,0,aspect));
    const top=Math.tan(camera.fov*Math.PI/360),v=camera.view;
    let left=-top*aspect,wd=2*top*aspect,tp=top,ht=2*top;
    if(v?.enabled){left+=v.offsetX*wd/v.fullWidth;tp-=v.offsetY*ht/v.fullHeight;wd*=v.width/v.fullWidth;ht*=v.height/v.fullHeight;}
    const ws={l:left,r:left+wd,t:tp,b:tp-ht};
    const S=boardIn(camera.position,camera.quaternion,ws),T=boardIn(R.pos,R.q,wm);
    const dir=camera.position.clone().sub(BOARD).normalize().lerp(R.pos.clone().sub(BOARD).normalize(),h).normalize();
    const distance=Math.exp(lerp(Math.log(camera.position.distanceTo(BOARD)),Math.log(R.pos.distanceTo(BOARD)),h));
    camera.position.copy(BOARD).addScaledVector(dir,distance);camera.quaternion.slerp(R.q,h);camera.updateMatrixWorld();
    const qx=lerp(S.qx,T.qx,h),qy=lerp(S.qy,T.qy,h),span=Math.exp(lerp(Math.log(S.span),Math.log(T.span),h));
    const N=boardIn(camera.position,camera.quaternion,ws),w=span/N.depth,hh=w/aspect,L=N.tx-qx*w,topEdge=N.ty+qy*hh;
    const near=Math.max(.1,N.depth*.2),far=Math.max(200,N.depth*4);
    camera.projectionMatrix.makePerspective(L*near,(L+w)*near,topEdge*near,(topEdge-hh)*near,near,far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  let lastSize = { width: 1, height: 1 };
  function update(u,width,height,startCamera,startPoints){
    lastSize = { width, height };
    const aspect=width/height,portrait=Math.round((1-smooth(.7,1.25,aspect))*1000)/1000;
    camera.aspect=aspect;camera.near=.1;camera.far=200;
    camera.fov=aspect>=16/9?26:2*Math.atan(Math.tan(26*Math.PI/360)*Math.pow((16/9)/aspect,.72))*180/Math.PI;
    camera.setViewOffset(width,height,0,-height*(.06+.02*portrait),width,height);camera.updateProjectionMatrix();
    const t=path.fraction(u);
    path.pos.getPoint(t,camera.position);path.at.getPoint(t,look);
    camera.position.lerp(path.posP.getPoint(t),portrait);look.lerp(path.atP.getPoint(t),portrait);camera.lookAt(look);
    // Only bridge from our smoke framing into the source shot. From 6.32
    // onward the original three-wire camera path runs unchanged.
    const move=beat(u,6.06,6.32);
    camera.position.lerp(startCamera.position,1-move);
    camera.quaternion.slerp(startCamera.quaternion,1-move);
    camera.fov=lerp(startCamera.fov,camera.fov,move);
    camera.setViewOffset(width,height,0,-height*(.06+.02*portrait)*move,width,height);
    camera.updateProjectionMatrix();
    handoff(beat(u,6.9,6.985),aspect);
    set.update({fade:1,clicks:{red:beat(u,6.5,6.53),black:beat(u,...extras[0].click),green:beat(u,...extras[1].click)}},camera);
    poseWire(u,startPoints);
    for(const e of extras)poseExtra(e,1-Math.pow(1-beat(u,...e.seat),3));
    return {scene,camera};
  }
  function dispose(){ scene.remove(set.group);set.dispose();for(const e of extras)scene.remove(e.wire.group); }
  function hide(){set.group.visible=false;wire.group.scale.setScalar(1);for(const e of extras)e.wire.group.visible=false;}
  return {update,hide,dispose,diagnostics(){
    const {width,height}=lastSize,point=BOARD.clone().project(camera);
    const g=ROOM_VIEW[frameFor(width/height)],win=windowAt(g,0,width/height);
    const actual=[(point.x*.5+.5)*width,(-point.y*.5+.5)*height];
    const expected=[(g.board.centre[0]-win.x0)/win.w*width,(g.board.centre[1]-win.y0)/win.h*height];
    return {boardVisible:set.group.visible,connectionWires:1+extras.filter(e=>e.wire.group.visible).length,wireId:wire.group.uuid,blend,boardActual:actual,boardExpected:expected,boardErrorPx:Math.hypot(actual[0]-expected[0],actual[1]-expected[1])};
  }};
}
