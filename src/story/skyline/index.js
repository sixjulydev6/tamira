import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CITY_U, patchCityMaterial, makeEdgeMaterial, makePointMaterial } from './cityMaterial.js';
import { extractEdges, samplePoints, textureSampler } from './lidar.js';
import { SCALE } from './layout.js';
import { createGround } from './ground.js';
import { createFiller } from './filler.js';
import { ENTER } from './building.js';
import { createWiring } from './wiring.js';
import { createTowerRoom } from './room.js';
import { createRig } from './rig.js';
import { SKY_VERT, SKY_FRAG, sample, DUSK } from './atmosphere.js';
import { S } from './state.js';
import { local, smooth, lerp } from '../timeline.js';
import { Wire } from '../wire.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCableAssembly, CORE_SCALE } from './cable-assembly.js';

// Vanilla Three.js adaptation of the supplied temira city/room sequence. It uses
// the existing city renderer and master scroll clock, with no second UI/runtime.
export function createSkyline(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .004, 2400);
  const size = { width: 1, height: 1 };
  const rig = createRig(camera, size);
  const wiring = createWiring(renderer), room = createTowerRoom();
  scene.add(wiring.group, room.group);
  const fog = new THREE.FogExp2('#d3e3f1', .00022); scene.fog = fog;
  const sun = new THREE.DirectionalLight('#fff0da', 4.2);
  sun.position.set(430, 150, 400); sun.target.position.set(30,0,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  sun.castShadow=true;
  sun.shadow.mapSize.setScalar(matchMedia('(pointer:coarse)').matches?1024:2048);
  Object.assign(sun.shadow.camera,{near:50,far:1400,left:-260,right:260,top:260,bottom:-260});
  sun.shadow.bias=-.0003;sun.shadow.normalBias=.8;
  const hemi = new THREE.HemisphereLight('#b8d3ff','#6f6656',.78);
  scene.add(sun, sun.target, hemi);
  const skyU = Object.fromEntries(['uZenith','uMid','uHorizon','uSunCol','uGlow'].map(k=>[k,{value:new THREE.Color()}]));
  Object.assign(skyU,{uSunDir:{value:new THREE.Vector3()},uNight:{value:0},uTime:{value:0},uXray:{value:0},uDim:{value:0}});
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500,32,16), new THREE.ShaderMaterial({
    vertexShader:SKY_VERT,fragmentShader:SKY_FRAG,uniforms:skyU,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false
  }));
  sky.renderOrder=-10; sky.frustumCulled=false; scene.add(sky);
  const ground = createGround(renderer);scene.add(ground.group);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.85,.72,.92);
  composer.addPass(bloom);composer.addPass(new OutputPass());

  // The bridge wire has the same geometry/material/light rig as the product wire.
  // M rotates product +X onto the room ceiling's +Z, with +Y preserved.
  const bridgeScene=new THREE.Scene();
  const generator=new THREE.PMREMGenerator(renderer), envRoom=new RoomEnvironment();
  const environment=generator.fromScene(envRoom,.04);generator.dispose();envRoom.dispose();
  bridgeScene.environment=environment.texture;bridgeScene.environmentIntensity=.85;
  const rotation=new THREE.Matrix4().makeRotationY(-Math.PI/2);
  const lookup=new THREE.Euler().setFromRotationMatrix(rotation.clone().invert());
  bridgeScene.environmentRotation.set(-lookup.x,-lookup.y,-lookup.z,lookup.order);
  for(const [pos,power,color] of [[[-6,10,12],2.2,0xffffff],[[8,-4,-6],1.1,0xdfe6ff]]) {
    const light=new THREE.DirectionalLight(color,power);light.position.fromArray(pos).applyMatrix4(rotation);bridgeScene.add(light);
  }
  const bridgeWire=new Wire();bridgeScene.add(bridgeWire.group);
  const assembly=createCableAssembly(bridgeWire);bridgeScene.add(assembly.group);assembly.hide();
  const bridgeCamera=new THREE.PerspectiveCamera(28,1,.001,2400);
  let loaded=false,disposed=false,error=null,elapsed=0,lastP=0,lastBg='#ffffff',entry=null,lastShadowNight=-1;
  const ownedTextures=new Set();
  const url=import.meta.env.BASE_URL+'skyline/';
  const ready=Promise.all([new GLTFLoader().loadAsync(url+'city.glb'),new THREE.TextureLoader().loadAsync(url+'city-2k.jpg')])
    .then(([gltf,map])=>{
      if(disposed){map.dispose();gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return;}
      map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());ownedTextures.add(map);
      gltf.scene.updateMatrixWorld(true);let mesh;gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
      if(!mesh)throw new Error('Supplied skyline has no mesh');
      const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.scale(SCALE,SCALE,SCALE);
      const sampleTexture=textureSampler(map.image);
      const cityMesh=new THREE.Mesh(geometry,patchCityMaterial(new THREE.MeshStandardMaterial({map,roughness:.9,metalness:0})));
      cityMesh.castShadow=cityMesh.receiveShadow=true;scene.add(cityMesh);
      scene.add(new THREE.LineSegments(extractEdges(geometry,sampleTexture,{angle:32,minLen:.9}),makeEdgeMaterial(900)));
      const points=new THREE.Points(samplePoints(geometry,sampleTexture,14000),makePointMaterial());points.frustumCulled=false;scene.add(points);
      gltf.scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const v of Object.values(o.material))if(v?.isTexture)v.dispose();o.material.dispose();}});
      scene.add(createFiller(map,matchMedia('(pointer:coarse)').matches?180:360));
      renderer.shadowMap.needsUpdate=true;
      loaded=true;update(lastP,lastBg,entry);renderer.compile(scene,camera);
    }).catch(e=>{error=e;console.error('Skyline opening failed',e);});

  function resize(w,h){size.width=w;size.height=h;camera.aspect=bridgeCamera.aspect=w/h;composer.setSize(w,h);}
  function update(p,bg,productEntry){
    lastP=p;lastBg=bg;entry=productEntry;
    const rise=local(p,'rise'),scan=local(p,'wireOn'),net=local(p,'extend'),climb=local(p,'run'),follow=local(p,'approach'),bundle=local(p,'bundle'),drain=local(p,'drain');
    S.night=smooth(0,1,rise);S.cam=rise<1?smooth(0,1,rise):scan<1?1+smooth(0,1,scan):2+smooth(0,1,net);
    S.xray=smooth(0,1,scan);S.network=smooth(0,1,net);S.climb=climb;S.room=smooth(.66,1,climb);
    S.isolate=.85*smooth(0,.35,climb)+.15*smooth(0,.2,follow);S.follow=follow;
    S.enter=smooth(0,.22,bundle);S.explode=smooth(.15,.86,bundle);
    // Settle the source camera's damping immediately. Story placement follows
    // progress even on direct/reverse seeks; ambient time stays separate.
    rig.update(elapsed,10);
    CITY_U.uTime.value=elapsed;CITY_U.uNight.value=S.night;CITY_U.uLit.value=smooth(.15,1,S.night)*.34+smooth(.05,.3,S.night)*.05;
    CITY_U.uXray.value=S.xray;CITY_U.uHeroSolid.value=0;CITY_U.uCut.value=0;CITY_U.uGhost.value=0;
    const recede=1-Math.max(smooth(0,.35,climb)*.55,smooth(0,.25,follow)*.85);
    CITY_U.uEdge.value=smooth(.05,.5,scan)*(.4+.6*recede)*(1-S.enter*.9)*(1-smooth(0,.55,drain));
    CITY_U.uDim.value=Math.max(S.isolate*.55,smooth(.55,1,follow)*.7,S.enter*.92);
    scene.traverse(o=>{if(o.material?.uniforms?.uPR)o.material.uniforms.uPR.value=renderer.getPixelRatio();});
    wiring.update();room.update();ground.update();
    const night=S.night*DUSK;
    if(night!==lastShadowNight){renderer.shadowMap.needsUpdate=true;lastShadowNight=night;}
    for(const [a,b] of [['zenith','uZenith'],['mid','uMid'],['horizon','uHorizon'],['sun','uSunCol'],['glow','uGlow']])sample(a,night,skyU[b].value);
    skyU.uNight.value=night;skyU.uXray.value=S.xray;skyU.uTime.value=elapsed;skyU.uDim.value=smooth(.1,.8,S.enter)*.85;
    const elev=THREE.MathUtils.degToRad(lerp(15,-7,smooth(0,.72,night))),az=46*Math.PI/180;
    skyU.uSunDir.value.set(Math.sin(az)*Math.cos(elev),Math.sin(elev),Math.cos(az)*Math.cos(elev));
    sky.position.copy(camera.position);sun.position.copy(skyU.uSunDir.value).multiplyScalar(600).add(sun.target.position);
    sample('sun',night,sun.color);sun.intensity=sample('sunI',night)*(1-S.xray*.8);
    sample('hemiSky',night,hemi.color);sample('hemiGround',night,hemi.groundColor);hemi.intensity=sample('hemiI',night)*(1-S.xray*.55);
    sample('fog',night,fog.color);fog.color.lerp(new THREE.Color('#03050b'),S.xray*.9);fog.density=sample('fogD',night);
    if(bundle>0&&productEntry){
      const pose=assembly.update(S.explode,productEntry.points,drain);
      if(drain>0)updateBridge(drain,productEntry,pose);
      else bridgeCamera.copy(camera);
    } else assembly.hide();
  }
  function updateBridge(t,{points,d0},pose){
    const s=CORE_SCALE,tip=points[points.length-1];
    const pull=smooth(.03,.56,t),morph=smooth(.42,1,t);
    const redTip=pose.tip.clone().add(new THREE.Vector3(-.12*pull,.07*pull,.45*pull));
    const q=pose.rotation.clone().slerp(new THREE.Quaternion().setFromRotationMatrix(rotation),morph);
    const origin=redTip.clone().sub(tip.clone().applyQuaternion(q).multiplyScalar(s));
    bridgeWire.group.position.copy(origin);bridgeWire.group.quaternion.copy(q);bridgeWire.group.scale.setScalar(s);
    bridgeWire.setPath(pose.straight.map((v,i)=>v.lerp(points[i],morph)));
    const productLength=new THREE.CatmullRomCurve3(points,false,'centripetal',.5).getLength();
    Object.assign(bridgeWire.params,{head:1,tailLen:lerp(21,productLength+30,morph),strip:3.4,fan:lerp(.15,.45,morph),glow:0,cut:0,heat:0,char:0});bridgeWire.update();
    const map=v=>v.applyQuaternion(q).multiplyScalar(s).add(origin);
    const target=map(new THREE.Vector3()),end=map(new THREE.Vector3(0,0,d0));
    const k=smooth(0,1,t);
    const tracking=redTip.clone().sub(pose.tip).multiplyScalar(.85);
    bridgeCamera.position.copy(camera.position).add(tracking).lerp(end,k);
    const startLook=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(camera.position.distanceTo(new THREE.Vector3(...ENTER))).add(camera.position).add(tracking);
    bridgeCamera.lookAt(startLook.lerp(target,k));
    bridgeCamera.fov=lerp(camera.fov,28,k);bridgeCamera.near=.001;
    if(t<1&&camera.view?.enabled){const v=camera.view;bridgeCamera.setViewOffset(v.fullWidth,v.fullHeight,v.offsetX*(1-k),v.offsetY*(1-k),v.width,v.height);}else bridgeCamera.clearViewOffset();
    bridgeCamera.updateProjectionMatrix();
  }
  function render(){
    if(!loaded)return;
    const drain=local(lastP,'drain'),bundle=local(lastP,'bundle');
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.setClearColor('#05070b',1);composer.render();
    if(bundle>0&&entry){
      // Fade only the room/city background, retaining a live red wire on top.
      const a=smooth(.45,.9,drain);
      renderer.autoClear=false;
      if(a>0){fadeMaterial.uniforms.uColor.value.set(lastBg);fadeMaterial.uniforms.uAlpha.value=a;renderer.render(fadeScene,fadeCamera);}
      if(S.enter>.12){renderer.clearDepth();renderer.toneMapping=THREE.NeutralToneMapping;renderer.render(bridgeScene,bridgeCamera);}renderer.autoClear=true;
    }
  }
  const fadeMaterial=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color()},uAlpha:{value:0}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform vec3 uColor;uniform float uAlpha;void main(){gl_FragColor=vec4(uColor,uAlpha);#include <colorspace_fragment>\n}',transparent:true,depthTest:false,depthWrite:false});
  // Shader directives must start on their own line.
  fadeMaterial.fragmentShader=fadeMaterial.fragmentShader.replace(';#include',';\n#include');
  const fadeScene=new THREE.Scene(),fadeCamera=new THREE.Camera();fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),fadeMaterial));
  function dispose(){disposed=true;const geometries=new Set(),materials=new Set();
    for(const root of [scene,bridgeScene,fadeScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)ownedTextures.add(v);}if(o.isInstancedMesh)o.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());sun.shadow.dispose();environment.dispose();composer.passes.forEach(p=>p.dispose?.());composer.dispose();
  }
  return {ready,resize,update,render,dispose,bundleAnchors(){return assembly.anchors(bridgeCamera,size.width,size.height);},get loaded(){return loaded;},get error(){return error;},tick(dt){elapsed+=Math.min(dt,.05);update(lastP,lastBg,entry);render();},diagnostics(){return {loaded,error:error?.message,state:{...S},camera:camera.position.toArray(),roomVisible:room.group.visible,assembly:assembly.diagnostics(),redPosition:bridgeWire.group.position.toArray()};}};
}
