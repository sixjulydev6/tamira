import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CITY_U, patchCityMaterial, makeEdgeMaterial, makePointMaterial } from './cityMaterial.js';
import { extractEdges, samplePoints } from './lidar.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createCableAssembly, CORE_SCALE } from './cable-assembly.js';
import { DepthBlurPass } from './depth-blur.js';

const SUN_AZ=46*Math.PI/180; // runtime sun azimuth, 0 = +Z, 90 = +X (matches update())
const HERO_C=new THREE.Vector3(64,100,10); // focal tower centre (layout.js HERO)
const DAY_ENV_GAIN=1.6; // HDRI sky radiance -> the gradient environment's level
// Image-textured city materials (build_skyline.py TEXTURED; Poliigon licence, see SKYLINE-HERO.md). Paths
// under public/skyline/tex/. Facade numbers mirror the Blender bands: office v 0.300..0.973 repeating every
// 5 storeys, shopfront v 0..0.300 held to the podium; roughness glass 0.06 / panels 0.65.
const PHONE_TREES=1500; // kit trees drawn on coarse-pointer devices (desktop draws all 3,000)
const OFFICE={v0:.30005,vspan:.6726,repeat:true,rough:[.06,.65]};
const CITY_TEX={
  brick_reclaimed:{map:'brick-reclaimed/brick_COL',normal:'brick-reclaimed/brick_NRM',rough:'brick-reclaimed/brick_ROUGH'},
  glass_blue:{map:'facade-office/facade_COL',facade:OFFICE},
  glass_grey:{map:'facade-office/facade_COL',facade:OFFICE},
  glass_warm:{map:'facade-office/facade_COL',facade:OFFICE},
  glass_store:{map:'facade-office/facade_COL',facade:{v0:0,vspan:.3,repeat:false,rough:[.06,.65]}},
  // park trees (prepare_tree.py kit from the BlenderKit "A tree"): foliage-cluster atlas as a cutout, bark colour + normal
  leaf_ash:{map:'tree-ash/leaf_COL.png',cutout:.3,tint:[.62,.72,.5]}, // low cutoff: mip levels average the alpha down, so distant crowns would thin out
  bark_ash:{map:'tree-ash/bark_COL',normal:'tree-ash/bark_NRM'},
};

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
  sun.position.set(430, 150, 400); sun.target.position.set(30,0,150); // centred on district + front-left park
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  sun.castShadow=true;
  sun.shadow.mapSize.setScalar(matchMedia('(pointer:coarse)').matches?1024:2048);
  // light-space bounds of district (x ±250, z -300..300) + park (z 300..760), heights 0..215 m
  Object.assign(sun.shadow.camera,{near:-60,far:1160,left:-640,right:485,top:345,bottom:-155});
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
  // The scene target carries a depth texture so the distance blur can read it.
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  sceneTarget.depthTexture=new THREE.DepthTexture(1,1);
  const composer=new EffectComposer(renderer,sceneTarget);
  // clone() shares the depth texture's source; give the second buffer its own to avoid a feedback loop
  composer.renderTarget2.depthTexture=new THREE.DepthTexture(1,1);
  composer.addPass(new RenderPass(scene,camera));
  const depthBlur=new DepthBlurPass(camera);composer.addPass(depthBlur);
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
  // Sky reflections for the city only (the cable bridge keeps its own RoomEnvironment).
  const cityEnvTarget=buildCityEnvironment(renderer),cityEnv=cityEnvTarget.texture;
  const cityMaterials=[],texLoader=new THREE.TextureLoader();
  let entryMeshes=[];const kitTrees=[];
  // load progress for the page loader: Vercel serves the GLB brotli-compressed with no length, so
  // fall back to the decoded size (city-v2.glb is 5,518,064 bytes)
  let progress=0;
  const ready=new GLTFLoader().loadAsync(url+'city-v2.glb',e=>{progress=Math.min(1,e.loaded/(e.lengthComputable&&e.total?e.total:5518064));})
    .then(gltf=>{
      if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});return;}
      gltf.scene.updateMatrixWorld(true);
      // Semantic material classes from the Blender kit: '<class>_<variant>' material names.
      const scanParts=[],made=new Map();
      const classOf=name=>{const k=name.split('_')[0];
        return k==='glass'?'glass':k==='leaf'||k==='bark'?'leaf':name==='frame_light'||name==='concrete_light'?'frame':'solid';};
      const materialFor=src=>{
        if(made.has(src))return made.get(src);
        const name=src.name||'solid',cls=classOf(name),glass=cls==='glass',water=name.startsWith('water');
        const m=new THREE.MeshStandardMaterial({color:src.color,roughness:glass?Math.max(.06,src.roughness):src.roughness,metalness:src.metalness,
          envMap:cityEnv,envMapIntensity:glass||water?1.15:src.metalness>.5?.8:.32,side:glass?THREE.DoubleSide:THREE.FrontSide});
        const t=CITY_TEX[name];let facade=null;
        if(t){ // image textures (Poliigon city surfaces on the box UVs from build_skyline.py; park tree kit UVs); glTF convention, so flipY off
          const tex=(f,srgb)=>{const x=texLoader.load(url+'tex/'+f+(/\.\w+$/.test(f)?'':'.jpg'));x.flipY=false;x.wrapS=x.wrapT=THREE.RepeatWrapping;x.anisotropy=8;if(srgb)x.colorSpace=THREE.SRGBColorSpace;return x;};
          m.color.set(0xffffff);if(t.tint)m.color.setRGB(...t.tint);m.map=tex(t.map,true);
          if(t.normal)m.normalMap=tex(t.normal);
          if(t.rough){m.roughnessMap=tex(t.rough);m.roughness=1;}
          if(t.cutout){m.alphaTest=t.cutout;m.side=THREE.DoubleSide;m.map.wrapS=m.map.wrapT=THREE.ClampToEdgeWrapping;}
          facade=t.facade||null;
        }
        m.name=name;m.userData.env=m.envMapIntensity;patchCityMaterial(m,{cls,facade});cityMaterials.push(m);made.set(src,m);src.dispose();return m;
      };
      // Phones draw PHONE_TREES of the 3,000 kit trees. Street, lawn and roof trees all stay; the park and
      // outer-park groves (ground level, z >= 300 or x < -250, as in build_skyline.py) are thinned evenly by a
      // position hash, so the leaf and bark primitives of one tree keep or drop together.
      const phone=matchMedia('(pointer:coarse)').matches;
      const thinTrees=im=>{
        const m=new THREE.Matrix4(),p=new THREE.Vector3(),keep=[],grove=[];
        for(let i=0;i<im.count;i++){
          im.getMatrixAt(i,m);p.setFromMatrixPosition(m.premultiply(im.matrixWorld));
          ((p.y<.5&&(p.z>=300||p.x<-250))?grove:keep).push(i);
        }
        const k=Math.max(0,Math.min(1,(PHONE_TREES-keep.length)/Math.max(1,grove.length)));
        for(const i of grove){im.getMatrixAt(i,m);p.setFromMatrixPosition(m);const h=Math.abs(Math.sin(p.x*12.9898+p.z*78.233)*43758.5453)%1;if(h<k)keep.push(i);}
        keep.sort((a,b)=>a-b);
        keep.forEach((src,dst)=>{im.getMatrixAt(src,m);im.setMatrixAt(dst,m);});
        im.count=keep.length;im.instanceMatrix.needsUpdate=true;im.boundingSphere=null;im.boundingBox=null;
      };
      const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
      if(!meshes.length)throw new Error('Supplied skyline has no mesh');
      const city=new THREE.Group();city.name='city';
      for(const o of meshes){
        const mats=(Array.isArray(o.material)?o.material:[o.material]).map(materialFor);
        o.material=Array.isArray(o.material)?mats:mats[0];
        const group=(o.name||'').split('__')[0];
        if(/lobby_glow/.test(o.name))o.visible=false; // interiors sit behind opaque glass in realtime
        const tree=o.isInstancedMesh&&mats.some(m=>/^(leaf|bark)_/.test(m.name));
        if(o.isInstancedMesh&&mats.some(m=>/_ash$/.test(m.name))){if(phone)thinTrees(o);kitTrees.push(o);}
        o.castShadow=group!=='ground'&&!(o.isInstancedMesh&&!tree);o.receiveShadow=true;
        if(group==='entry')entryMeshes.push(o);
        // scan proxy: facade skins, roofs and the hero's terrace slabs give clean silhouettes;
        // floor bands, fins, mullions, planting, ground and cars stay out of the scan
        if(!o.isInstancedMesh&&(group==='hero'||group==='city')&&/__(glass_(?!store)|roof_membrane)|^hero__concrete_light/.test(o.name)){
          const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);scanParts.push(g);
        }
      }
      city.add(...gltf.scene.children);scene.add(city);city.updateMatrixWorld(true);
      const proxy=mergeGeometries(scanParts,false);scanParts.forEach(g=>g.dispose());
      scene.add(new THREE.LineSegments(extractEdges(proxy,null,{angle:32,minLen:1.6}),makeEdgeMaterial(900)));
      const points=new THREE.Points(samplePoints(proxy,null,14000),makePointMaterial());points.frustumCulled=false;scene.add(points);
      proxy.dispose();
      const filler=createFiller(cityEnv,matchMedia('(pointer:coarse)').matches?180:360);scene.add(filler);
      filler.traverse(o=>{if(o.isInstancedMesh){o.material.userData.env=o.material.envMapIntensity;cityMaterials.push(o.material);}});
      loadDayEnvironment();
      room.load(url).then(()=>{if(!disposed)renderer.compile(scene,camera);}); // modelled room after the city, before the climb reaches it
      renderer.shadowMap.needsUpdate=true;
      loaded=true;update(lastP,lastBg,entry);renderer.compile(scene,camera);
    }).catch(e=>{error=e;console.error('Skyline opening failed',e);});

  // Day environment: ambientCG DayEnvironmentHDRI114 (CC0), 1K, sun disc clamped so the
  // directional light stays the only sun. Rotated so the panorama's sun (+X, u = 0.5) sits on
  // the runtime sun azimuth (46 deg from +Z toward +X). Lighting/reflections only: its lower
  // half is a rooftop terrace, so the visible sky stays the procedural dome.
  let dayEnvTarget=null;
  function loadDayEnvironment(){
    new RGBELoader().loadAsync(url+'day-env-1k.hdr').then(tex=>{
      if(disposed){tex.dispose();return;}
      tex.mapping=THREE.EquirectangularReflectionMapping;
      const pm=new THREE.PMREMGenerator(renderer);dayEnvTarget=pm.fromEquirectangular(tex);pm.dispose();
      // three applies the inverse of envMapRotation to the lookup, so yaw by minus the sun's angle
      const rot=-Math.atan2(Math.cos(SUN_AZ),Math.sin(SUN_AZ));
      for(const m of cityMaterials){m.envMap=dayEnvTarget.texture;m.envMapRotation.set(0,rot,0);m.userData.env*=DAY_ENV_GAIN;m.needsUpdate=true;}
      if(new URLSearchParams(location.search).get('env')==='bg'){sky.visible=false;scene.background=tex;scene.backgroundRotation.set(0,rot,0);}
      else tex.dispose();
      update(lastP,lastBg,entry);
    }).catch(e=>console.warn('Day environment unavailable; keeping gradient sky reflections',e));
  }

  function resize(w,h){size.width=w;size.height=h;camera.aspect=bridgeCamera.aspect=w/h;composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);}
  function update(p,bg,productEntry){
    lastP=p;lastBg=bg;entry=productEntry;
    const rise=local(p,'rise'),scan=local(p,'wireOn'),net=local(p,'extend'),climb=local(p,'run'),follow=local(p,'approach'),bundle=local(p,'bundle'),drain=local(p,'drain');
    S.night=smooth(0,1,rise);S.cam=rise<1?smooth(0,1,rise):scan<1?1+smooth(0,1,scan):2+smooth(0,1,net);
    S.xray=smooth(0,1,scan);S.network=smooth(0,1,net);S.climb=climb;S.room=smooth(.66,1,climb);
    S.isolate=.85*smooth(0,.35,climb)+.15*smooth(0,.2,follow);S.follow=follow;
    S.enter=smooth(0,.22,bundle);S.explode=smooth(.15,.86,bundle);
    // the assembly crossfades in over the ceiling cable at the end of the follow (same geometry),
    // then its far run parts from the cut as the reveal begins: no frame where one cable swaps for another
    S.bridge=bundle>0?1:smooth(.82,1,follow);S.part=smooth(.02,.2,bundle);
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
    // depth of field: focus a little past the tower, far city softens; establishing shots only
    const dU=depthBlur.material.uniforms,dHero=camera.position.distanceTo(HERO_C);
    dU.uFocus.value=dHero-20;dU.uRange.value=1100;dU.uMaxPx.value=8*renderer.getPixelRatio();
    dU.uStrength.value=(1-smooth(0,.25,S.xray))*(1-smooth(0,.15,climb));depthBlur.enabled=dU.uStrength.value>.001;
    for(const o of entryMeshes)o.visible=S.room<.001&&S.climb<.6;
    const envK=1-.85*smooth(.1,.8,S.night);for(const m of cityMaterials)m.envMapIntensity=m.userData.env*envK;
    const night=S.night*DUSK;
    if(night!==lastShadowNight){renderer.shadowMap.needsUpdate=true;lastShadowNight=night;}
    for(const [a,b] of [['zenith','uZenith'],['mid','uMid'],['horizon','uHorizon'],['sun','uSunCol'],['glow','uGlow']])sample(a,night,skyU[b].value);
    skyU.uNight.value=night;skyU.uXray.value=S.xray;skyU.uTime.value=elapsed;skyU.uDim.value=smooth(.1,.8,S.enter)*.85;
    const elev=THREE.MathUtils.degToRad(lerp(15,-7,smooth(0,.72,night))),az=46*Math.PI/180;
    skyU.uSunDir.value.set(Math.sin(az)*Math.cos(elev),Math.sin(elev),Math.cos(az)*Math.cos(elev));
    for(const [a,b] of [['uZenith','uSkyZen'],['uMid','uSkyMid'],['uHorizon','uSkyHor'],['uSunCol','uSkySun'],['uGlow','uSkyGlow'],['uSunDir','uSkySunDir']])CITY_U[b].value.copy(skyU[a].value);
    CITY_U.uSkyNight.value=night;CITY_U.uSkyXray.value=S.xray;CITY_U.uSkyDim.value=skyU.uDim.value;
    sky.position.copy(camera.position);sun.position.copy(skyU.uSunDir.value).multiplyScalar(600).add(sun.target.position);
    sample('sun',night,sun.color);sun.intensity=sample('sunI',night)*(1-S.xray*.8);
    sample('hemiSky',night,hemi.color);sample('hemiGround',night,hemi.groundColor);hemi.intensity=sample('hemiI',night)*(1-S.xray*.55);
    sample('fog',night,fog.color);fog.color.lerp(new THREE.Color('#03050b'),S.xray*.9);fog.density=sample('fogD',night);
    if(S.bridge>0&&productEntry){
      const pose=assembly.update(S.explode,productEntry.points,drain,S.part);
      if(drain>0)updateBridge(drain,productEntry,pose);
      else bridgeCamera.copy(camera);
    } else assembly.hide();
  }
  // Drain: the red core first slides straight out along its own channel (its tail
  // lengthens, so it stays rooted in the sheath) while the camera travels with the
  // tip and pushes in, letting the bundle leave the frame. Only then does the core
  // straighten into the product path and the camera settle on the product view.
  const PULL=.62,PUSH=.5;
  function updateBridge(t,{points,d0},pose){
    const s=CORE_SCALE,tip=points[points.length-1];
    const pull=smooth(0,.55,t),morph=smooth(.45,1,t),k=smooth(.4,1,t);
    const axis=new THREE.Vector3(1,0,0).applyQuaternion(pose.rotation);
    const slide=axis.clone().multiplyScalar(PULL*pull);
    const redTip=pose.tip.clone().add(slide);
    const q=pose.rotation.clone().slerp(new THREE.Quaternion().setFromRotationMatrix(rotation),morph);
    const origin=redTip.clone().sub(tip.clone().applyQuaternion(q).multiplyScalar(s));
    bridgeWire.group.position.copy(origin);bridgeWire.group.quaternion.copy(q);bridgeWire.group.scale.setScalar(s);
    bridgeWire.setPath(pose.straight.map((v,i)=>v.lerp(points[i],morph)));
    const productLength=new THREE.CatmullRomCurve3(points,false,'centripetal',.5).getLength();
    Object.assign(bridgeWire.params,{head:1,tailLen:lerp(21+PULL*pull/s,productLength+30,morph),strip:3.4,fan:lerp(.15,.45,morph),glow:0,cut:0,heat:0,char:0});bridgeWire.update();
    const map=v=>v.applyQuaternion(q).multiplyScalar(s).add(origin);
    const target=map(new THREE.Vector3()),end=map(new THREE.Vector3(0,0,d0));
    // follow pose: the bundle camera carried along with the slide, pushed toward the red tip
    const lookDist=camera.position.distanceTo(new THREE.Vector3(...ENTER));
    const baseLook=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(lookDist).add(camera.position);
    const followPos=camera.position.clone().add(slide).lerp(redTip,PUSH*pull);
    const followLook=baseLook.add(slide).lerp(redTip.clone().sub(axis.clone().multiplyScalar(.12)),.6*pull);
    bridgeCamera.position.copy(followPos).lerp(end,k);
    bridgeCamera.lookAt(followLook.lerp(target,k));
    bridgeCamera.fov=lerp(camera.fov,28,k);bridgeCamera.near=.001;
    if(t<1&&camera.view?.enabled){const v=camera.view;bridgeCamera.setViewOffset(v.fullWidth,v.fullHeight,v.offsetX*(1-k),v.offsetY*(1-k),v.width,v.height);}else bridgeCamera.clearViewOffset();
    bridgeCamera.updateProjectionMatrix();
  }
  function render(){
    if(!loaded)return;
    const drain=local(lastP,'drain'),bundle=local(lastP,'bundle');
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.setClearColor('#05070b',1);composer.render();
    if(S.bridge>0&&entry){
      // Fade only the room/city background, retaining a live red wire on top.
      const a=smooth(.5,.9,drain);
      renderer.autoClear=false;
      if(a>0){fadeMaterial.uniforms.uColor.value.set(lastBg);fadeMaterial.uniforms.uAlpha.value=a;renderer.render(fadeScene,fadeCamera);}
      renderer.toneMapping=THREE.NeutralToneMapping;
      if(S.bridge<1){
        // Crossfade: draw the assembly offscreen, then composite it as one layer so its
        // inner layers never show through the half-faded sheath.
        renderer.getDrawingBufferSize(bufferSize);
        if(bridgeTarget.width!==bufferSize.x||bridgeTarget.height!==bufferSize.y)bridgeTarget.setSize(bufferSize.x,bufferSize.y);
        renderer.setRenderTarget(bridgeTarget);renderer.setClearColor(0,0);renderer.clear();
        renderer.render(bridgeScene,bridgeCamera);renderer.setRenderTarget(null);
        compositeMaterial.uniforms.uAlpha.value=S.bridge;renderer.render(compositeScene,fadeCamera);
      } else {renderer.clearDepth();renderer.render(bridgeScene,bridgeCamera);}
      renderer.autoClear=true;
    }
  }
  const fadeMaterial=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color()},uAlpha:{value:0}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform vec3 uColor;uniform float uAlpha;void main(){gl_FragColor=vec4(uColor,uAlpha);#include <colorspace_fragment>\n}',transparent:true,depthTest:false,depthWrite:false});
  // Shader directives must start on their own line.
  fadeMaterial.fragmentShader=fadeMaterial.fragmentShader.replace(';#include',';\n#include');
  const fadeScene=new THREE.Scene(),fadeCamera=new THREE.Camera();fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),fadeMaterial));
  // Offscreen bridge layer for the ceiling-cable crossfade. It holds linear, premultiplied
  // colour; the composite un-premultiplies, tone maps (Neutral, as the direct bridge pass)
  // and blends it premultiplied, so at full alpha it equals drawing the bridge directly.
  const bufferSize=new THREE.Vector2();
  const bridgeTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const compositeMaterial=new THREE.ShaderMaterial({uniforms:{tMap:{value:bridgeTarget.texture},uAlpha:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:['uniform sampler2D tMap;uniform float uAlpha;varying vec2 vUv;','void main(){','vec4 c=texture2D(tMap,vUv);float a=clamp(c.a,0.,1.);','gl_FragColor=vec4(a>0.?c.rgb/a:vec3(0.),1.);','#include <tonemapping_fragment>','#include <colorspace_fragment>','gl_FragColor=vec4(gl_FragColor.rgb*a*uAlpha,a*uAlpha);','}'].join('\n'),
    depthTest:false,depthWrite:false,transparent:true,blending:THREE.CustomBlending,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor});
  const compositeScene=new THREE.Scene();compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),compositeMaterial));
  function dispose(){disposed=true;room.dispose();const geometries=new Set(),materials=new Set();
    bridgeTarget.dispose();for(const root of [scene,bridgeScene,fadeScene,compositeScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)ownedTextures.add(v);}if(o.isInstancedMesh)o.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());sun.shadow.dispose();environment.dispose();cityEnvTarget.dispose();dayEnvTarget?.dispose();composer.passes.forEach(p=>p.dispose?.());composer.dispose();for(const t of [composer.renderTarget1,composer.renderTarget2])t.depthTexture?.dispose();
  }
  return {ready,resize,update,render,dispose,get progress(){return loaded?1:progress;},bundleAnchors(){return assembly.anchors(bridgeCamera,size.width,size.height);},get loaded(){return loaded;},get error(){return error;},tick(dt){elapsed+=Math.min(dt,.05);update(lastP,lastBg,entry);render();},diagnostics(){return {loaded,error:error?.message,state:{...S},camera:camera.position.toArray(),roomVisible:room.group.visible,roomSource:room.source,entryVisible:entryMeshes.some(o=>o.visible),cityMaterials:cityMaterials.length,kitTrees:kitTrees.map(o=>o.count),dayEnvironment:!!dayEnvTarget,assembly:assembly.diagnostics(),redPosition:bridgeWire.group.position.toArray()};}};
}

// Daylight sky gradient + sun, prefiltered once. Matches atmosphere.js day keys.
function buildCityEnvironment(renderer){
  const s=new THREE.Scene(),geo=new THREE.SphereGeometry(100,48,24),col=[],c=new THREE.Color();
  const zen=new THREE.Color('#4a8ce2'),mid=new THREE.Color('#7fb3ec'),hor=new THREE.Color('#cfe3f6'),gnd=new THREE.Color('#5d5a52');
  for(let i=0;i<geo.attributes.position.count;i++){
    const y=geo.attributes.position.getY(i)/100;
    if(y<0)c.copy(hor).lerp(gnd,Math.min(1,-y*4));else if(y<.25)c.copy(hor).lerp(mid,y/.25);else c.copy(mid).lerp(zen,(y-.25)/.75);
    col.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  s.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  const el=15*Math.PI/180,az=46*Math.PI/180,sunDisc=new THREE.Mesh(new THREE.SphereGeometry(5,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(14,12.5,10.5)}));
  sunDisc.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(90);s.add(sunDisc);
  const pm=new THREE.PMREMGenerator(renderer),rt=pm.fromScene(s,0);pm.dispose();
  s.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return rt;
}
