import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { CITY_U, patchCityMaterial, makeEdgeMaterial, makePointMaterial } from './cityMaterial.js';
import { extractEdges, samplePoints } from './lidar.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGround } from './ground.js';
import { createFiller } from './filler.js';
import { ENTER } from './building.js';
import { createWiring } from './wiring.js';
import { createTowerRoom } from './room.js';
import { createRig, ROOM_VIEW } from './rig.js';
import { SKY_VERT, SKY_FRAG, sample, DUSK } from './atmosphere.js';
import { S } from './state.js';
import { local, smooth, lerp } from '../timeline.js';
import { Wire } from '../wire.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createCableAssembly, CORE_SCALE } from './cable-assembly.js';
import { DepthBlurPass } from './depth-blur.js';

const SUN_AZ=46*Math.PI/180; // runtime sun azimuth, 0 = +Z, 90 = +X (matches update())
// Lighting/post values the dev panel (?gui, gui.js) edits live. Defaults are the shipped look.
// 2026-11-06: day look tuned by the user in the panel (exposure, sun, fill, env, bloom), plus ambient
// occlusion and a lighter, far-only distance blur: foreground blur reads as a tilt-shift miniature.
export const TUNE={
  toneMapping:'Neutral',exposure:.91,
  sunAz:56,sunElev:40,shadows:true,shadowBias:.001,shadowNormalBias:.8,
  // fill: soft skylight bounce from the side opposite the sun, no shadows; fades out toward dusk
  fill:{on:true,color:'#c9dcff',intensity:1.6,az:241,elev:35},
  envGain:2.31,envRotate:97,
  bloom:{on:true,strength:.77,radius:.74,threshold:1.17},
  dof:{on:true,strength:1.56,focus:129,range:1100,maxPx:8,nearK:0,sky:.6},
  // screen-space ambient occlusion (GTAO), desktop only; radius in metres
  ao:{on:!matchMedia('(pointer:coarse)').matches,intensity:1,radius:25,thickness:25,distanceExponent:1.5,falloff:1,scale:2,view:'Default'},
  haze:{near:1500,far:3200},
};
// per-material corrections on top of the GLB values (by material name)
if(import.meta.env.DEV)window.__skylineTune=TUNE; // dev only: lets perf scripts toggle passes
const MAT_TUNE={asphalt_road:{roughness:.98,metalness:.12},brick_reclaimed:{metalness:.88}}; // 2026-11-06 values from the ?gui panel
const TONE={None:THREE.NoToneMapping,Linear:THREE.LinearToneMapping,Reinhard:THREE.ReinhardToneMapping,Cineon:THREE.CineonToneMapping,ACESFilmic:THREE.ACESFilmicToneMapping,AgX:THREE.AgXToneMapping,Neutral:THREE.NeutralToneMapping};
const HERO_C=new THREE.Vector3(64,100,10);
// Outro (2026-11-06, user direction): after the rendered living room, back out of the tower room to the hero
// tower. Ends on the opening composition at sunset (rise 0.45), dark enough for the contact copy over it.
const OUT_RISE=.45; // focal tower centre (layout.js HERO)
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
  leaf_ash:{map:'tree-ash/leaf_COL.webp',cutout:.3,tint:[.62,.72,.5]}, // low cutoff: mip levels average the alpha down, so distant crowns would thin out
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
  const fill = new THREE.DirectionalLight('#c9dcff', 0); fill.name='fill';
  scene.add(sun, sun.target, hemi, fill, fill.target);
  fill.target.position.copy(sun.target.position);
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
  const ao=new GTAOPass(scene,camera,1,1);ao.blendIntensity=0;
  // AO's normal pass draws everything with one MeshNormalMaterial, which would turn the cut-out leaf cards into
  // solid squares: leave those (and the sky dome and scan overlays) out of it. Runs at CSS resolution.
  const aoHide=[sky];
  {const base=ao.renderOverride.bind(ao);ao.renderOverride=(r,m,...rest)=>{
    if(m!==ao.normalMaterial)return base(r,m,...rest);
    const v=aoHide.map(o=>o.visible);aoHide.forEach(o=>{o.visible=false;});base(r,m,...rest);aoHide.forEach((o,i)=>{o.visible=v[i];});};
   // Blend the AO onto the scene image in place (no buffer swap), so the distance blur that follows still reads
   // the scene's depth from its input and never samples the depth attached to the target it draws into.
   const render=ao.render.bind(ao),OUT=GTAOPass.OUTPUT;ao.render=(r,w,read,...rest)=>{
     if(ao.output!==OUT.Default){ao.needsSwap=true;return render(r,w,read,...rest);}
     ao.needsSwap=false;ao.output=OUT.Off;render(r,w,read,...rest);ao.output=OUT.Default; // G-buffer, AO, denoise (+ a spare copy into w)
     ao.blendMaterial.uniforms.intensity.value=ao.blendIntensity;ao.blendMaterial.uniforms.tDiffuse.value=ao.pdRenderTarget.texture;
     ao.renderPass(r,ao.blendMaterial,read);};
   const setSize=ao.setSize.bind(ao);ao.setSize=(w,h)=>{const k=(TUNE.ao.res??1)/Math.max(1,renderer.getPixelRatio());setSize(Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)));};}
  composer.addPass(ao);
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
  let aoKey='',gui=null,loaded=false,disposed=false,error=null,elapsed=0,lastP=0,lastBg='#ffffff',entry=null,lastShadowNight=-1;
  const ownedTextures=new Set();
  const url=import.meta.env.BASE_URL+'skyline/';
  // Sky reflections for the city only (the cable bridge keeps its own RoomEnvironment).
  const cityEnvTarget=buildCityEnvironment(renderer),cityEnv=cityEnvTarget.texture;
  const cityMaterials=[],texLoader=new THREE.TextureLoader();
  let entryMeshes=[];const kitTrees=[];
  // load progress for the page loader: Vercel serves the GLB brotli-compressed with no length, so
  // fall back to the decoded size (city-v2.glb is 5,518,064 bytes)
  // The city GLB is meshopt-compressed with 16-bit positions (KHR_mesh_quantization; shaders read world space via modelMatrix). The sky HDRI starts
  // downloading at the same moment as the GLB instead of after it is parsed, so the two share the pipe
  // and neither waits on the other; the loader's number is the bytes of both.
  const GLB_BYTES=1211436,HDR_BYTES=421206;
  let glbFrac=0,hdrFrac=0;
  const envFile=new RGBELoader().loadAsync(url+'day-env-512.hdr',e=>{hdrFrac=Math.min(1,e.loaded/(e.lengthComputable&&e.total?e.total:HDR_BYTES));});
  envFile.catch(()=>{});
  const texCache=new Map(); // one Texture per file: the four facade glasses share facade_COL instead of decoding and uploading it four times
  const texReady=[]; // first-view surface textures: the opening waits for them so nothing pops in under the reveal
  const progressNow=()=>(glbFrac*GLB_BYTES+hdrFrac*HDR_BYTES)/(GLB_BYTES+HDR_BYTES)*.92;
  const ready=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url+'city-v2.glb',e=>{glbFrac=Math.min(1,e.loaded/(e.lengthComputable&&e.total?e.total:GLB_BYTES));})
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
          const tex=(f,srgb)=>{const file=url+'tex/'+f+(/\.\w+$/.test(f)?'':'.webp');if(texCache.has(file))return texCache.get(file);let done;texReady.push(new Promise(r=>{done=r;}));const x=texLoader.load(file,()=>done(),undefined,()=>done());texCache.set(file,x);x.flipY=false;x.wrapS=x.wrapT=THREE.RepeatWrapping;x.anisotropy=8;if(srgb)x.colorSpace=THREE.SRGBColorSpace;return x;};
          m.color.set(0xffffff);if(t.tint)m.color.setRGB(...t.tint);m.map=tex(t.map,true);
          if(t.normal)m.normalMap=tex(t.normal);
          if(t.rough){m.roughnessMap=tex(t.rough);m.roughness=1;}
          if(t.cutout){m.alphaTest=t.cutout;m.side=THREE.DoubleSide;m.map.wrapS=m.map.wrapT=THREE.ClampToEdgeWrapping;}
          facade=t.facade||null;
        }
        if(MAT_TUNE[name])Object.assign(m,MAT_TUNE[name]);
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
        if(mats.some(m=>m.alphaTest>0))aoHide.push(o);
        if(o.isInstancedMesh&&mats.some(m=>/_ash$/.test(m.name))){if(phone)thinTrees(o);kitTrees.push(o);}
        o.castShadow=group!=='ground'&&!(o.isInstancedMesh&&!tree);o.receiveShadow=true;
        if(group==='entry')entryMeshes.push(o);
        // scan proxy: facade skins, roofs and the hero's terrace slabs give clean silhouettes;
        // floor bands, fins, mullions, planting, ground and cars stay out of the scan
        if(!o.isInstancedMesh&&(group==='hero'||group==='city')&&/__(glass_(?!store)|roof_membrane)|^hero__concrete_light/.test(o.name)){
          // quantized (int16, interleaved) positions: take a float copy before baking to world space
          const g=o.geometry.clone();const P=g.attributes.position;if(!(P.array instanceof Float32Array)){const f=new Float32Array(P.count*3);for(let i=0;i<P.count;i++){f[i*3]=P.getX(i);f[i*3+1]=P.getY(i);f[i*3+2]=P.getZ(i);}g.setAttribute('position',new THREE.BufferAttribute(f,3));}g.applyMatrix4(o.matrixWorld);for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);scanParts.push(g);
        }
      }
      city.add(...gltf.scene.children);scene.add(city);city.updateMatrixWorld(true);
      const proxy=mergeGeometries(scanParts,false);scanParts.forEach(g=>g.dispose());
      const edges=new THREE.LineSegments(extractEdges(proxy,null,{angle:32,minLen:1.6}),makeEdgeMaterial(900));scene.add(edges);
      const points=new THREE.Points(samplePoints(proxy,null,14000),makePointMaterial());points.frustumCulled=false;scene.add(points);
      aoHide.push(edges,points,wiring.group);
      proxy.dispose();
      const filler=createFiller(cityEnv,matchMedia('(pointer:coarse)').matches?180:360);scene.add(filler);
      filler.traverse(o=>{if(o.isInstancedMesh){o.material.userData.env=o.material.envMapIntensity;cityMaterials.push(o.material);}});
      renderer.shadowMap.needsUpdate=true;
      // Open once the sky lighting and the first-view textures are in (bounded, so a stalled file never holds the page).
      const settled=Promise.all([envFile.then(applyDayEnvironment,()=>{}),...texReady]);
      return Promise.race([settled,new Promise(r=>setTimeout(r,12000))]).then(()=>{
        if(disposed)return;
        loaded=true;update(lastP,lastBg,entry);renderer.compile(scene,camera);
        if(new URLSearchParams(location.search).has('gui'))import('./gui.js').then(({createSkylineGui})=>{
          if(!disposed)gui=createSkylineGui({tune:TUNE,tones:Object.keys(TONE),cityMaterials,markShadows:()=>{renderer.shadowMap.needsUpdate=true;}});});
        // the modelled room only after the opening is on screen; the climb reaches it much later
        room.load(url).then(()=>{if(disposed)return;renderer.compile(scene,camera);('requestIdleCallback' in window?requestIdleCallback:setTimeout)(warmUp,{timeout:3000});});
      });
    }).catch(e=>{error=e;console.error('Skyline opening failed',e);});

  // Day environment: ambientCG DayEnvironmentHDRI114 (CC0), 1K, sun disc clamped so the
  // directional light stays the only sun. Rotated so the panorama's sun (+X, u = 0.5) sits on
  // the runtime sun azimuth (46 deg from +Z toward +X). Lighting/reflections only: its lower
  // half is a rooftop terrace, so the visible sky stays the procedural dome.
  let dayEnvTarget=null;
  function applyDayEnvironment(tex){
    {
      if(disposed){tex.dispose();return;}
      tex.mapping=THREE.EquirectangularReflectionMapping;
      const pm=new THREE.PMREMGenerator(renderer);dayEnvTarget=pm.fromEquirectangular(tex);pm.dispose();
      // three applies the inverse of envMapRotation to the lookup, so yaw by minus the sun's angle
      const rot=-Math.atan2(Math.cos(SUN_AZ),Math.sin(SUN_AZ));
      for(const m of cityMaterials){m.envMap=dayEnvTarget.texture;m.envMapRotation.set(0,rot,0);m.userData.env*=DAY_ENV_GAIN;m.needsUpdate=true;}
      if(new URLSearchParams(location.search).get('env')==='bg'){sky.visible=false;scene.background=tex;scene.backgroundRotation.set(0,rot,0);}
      else tex.dispose();
      update(lastP,lastBg,entry);
    }
  }
  envFile.catch(e=>console.warn('Day environment unavailable; keeping gradient sky reflections',e));

  // Outro camera: a zoom out along the hero shot's own line of sight, from 45 m off the facade where the
  // tower room is to the pose the rig just computed for the hero framing. Log distance with an ease-out,
  // so the camera is already backing away visibly while the living room fades and settles at the end.
  const OUT_T0=new THREE.Vector3(...ROOM_VIEW.tgt),OUT_R0=45,oB=new THREE.Vector3(),oT=new THREE.Vector3();
  function outroCamera(o){
    const pose=rig.pose;
    const k=Math.min(1,o/.85),e=1-Math.pow(1-k,2.6);
    oB.copy(camera.position).sub(pose.tgt);const r1=oB.length();oB.divideScalar(r1);
    const r=Math.exp(lerp(Math.log(OUT_R0),Math.log(r1),e)),kt=(r-OUT_R0)/Math.max(1e-6,r1-OUT_R0);
    oT.copy(OUT_T0).lerp(pose.tgt,kt);
    camera.position.copy(oB).multiplyScalar(r).add(oT);
    camera.lookAt(oT);
    camera.fov=pose.fov;
    camera.near=THREE.MathUtils.clamp(r*.006,.004,2);
    const ox=lerp(0,pose.ox,e),oy=lerp(0,pose.oy,e),W=size.width,H=size.height;
    camera.setViewOffset(W,H,-ox*W,-oy*H,W,H);camera.updateProjectionMatrix();
  }
  // Fit the sun's orthographic shadow box to the district + park in light space, so any sun
  // direction (panel or dusk descent) keeps the whole shadowed area inside it.
  const SHADOW_BOX=new THREE.Box3(new THREE.Vector3(-260,0,-310),new THREE.Vector3(260,220,770));
  const fitCam=new THREE.OrthographicCamera(),corner=new THREE.Vector3(),lastSunDir=new THREE.Vector3();
  function fitShadow(){
    if(lastSunDir.distanceToSquared(skyU.uSunDir.value)<1e-10)return;lastSunDir.copy(skyU.uSunDir.value);
    fitCam.position.copy(sun.position);fitCam.lookAt(sun.target.position);fitCam.updateMatrixWorld();
    const inv=fitCam.matrixWorldInverse,b=new THREE.Box3();
    for(let i=0;i<8;i++){corner.set(i&1?SHADOW_BOX.max.x:SHADOW_BOX.min.x,i&2?SHADOW_BOX.max.y:SHADOW_BOX.min.y,i&4?SHADOW_BOX.max.z:SHADOW_BOX.min.z).applyMatrix4(inv);b.expandByPoint(corner);}
    Object.assign(sun.shadow.camera,{left:b.min.x-5,right:b.max.x+5,bottom:b.min.y-5,top:b.max.y+5,near:-b.max.z-20,far:-b.min.z+20});
    sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;
  }
  function resize(w,h){size.width=w;size.height=h;camera.aspect=bridgeCamera.aspect=w/h;composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);if(warmed){sizeBridgeTarget();renderer.initRenderTarget(bridgeTarget);}}
  function update(p,bg,productEntry){
    lastP=p;lastBg=bg;entry=productEntry;
    let rise=local(p,'rise'),scan=local(p,'wireOn'),net=local(p,'extend'),climb=local(p,'run'),follow=local(p,'approach'),bundle=local(p,'bundle'),drain=local(p,'drain');
    // outro (user direction): the solid building only, no x-ray and no floating room. Starts at night,
    // close on the facade where the tower room is, and zooms out while the sky lifts to sunset.
    const outro=local(p,'outro');
    if(outro>0){rise=lerp(1,OUT_RISE,smooth(.1,.75,outro));scan=0;net=0;climb=0;follow=0;bundle=0;drain=0;}
    S.outro=outro;S.outroRoom=0;
    S.night=smooth(0,1,rise);
    // camera through the three establishing moves as ONE eased move (key-space 0..3): it leaves the still hero
    // gently, never stops in between (rig.js passes through each key shot on a smooth curve) and settles on the
    // network shot. Easing each move separately stopped the camera three times on the way (scroll "pauses").
    {const g=Math.min(3,rise+scan+net)/3;S.cam=3*(.5-.5*Math.cos(Math.PI*g));}
    S.xray=smooth(0,1,scan);S.network=smooth(0,1,net);S.climb=climb;S.room=smooth(.66,1,climb);
    S.isolate=.85*smooth(0,.35,climb)+.15*smooth(0,.2,follow);S.follow=follow;
    S.enter=smooth(0,.22,bundle);S.explode=smooth(.15,.86,bundle);
    // the assembly crossfades in over the ceiling cable at the end of the follow (same geometry),
    // then its far run parts from the cut as the reveal begins: no frame where one cable swaps for another
    S.bridge=bundle>0?1:smooth(.82,1,follow);S.part=smooth(.02,.2,bundle);
    // Settle the source camera's damping immediately. Story placement follows
    // progress even on direct/reverse seeks; ambient time stays separate.
    if(outro>0)S.cam=smooth(0,1,OUT_RISE);
    rig.update(elapsed,10);
    if(outro>0)outroCamera(outro);
    CITY_U.uTime.value=elapsed;CITY_U.uNight.value=S.night;CITY_U.uLit.value=smooth(.15,1,S.night)*.34+smooth(.05,.3,S.night)*.05;
    CITY_U.uXray.value=S.xray;CITY_U.uHeroSolid.value=0;CITY_U.uCut.value=0;CITY_U.uGhost.value=0;
    const recede=1-Math.max(smooth(0,.35,climb)*.55,smooth(0,.25,follow)*.85);
    CITY_U.uEdge.value=smooth(.05,.5,scan)*(.4+.6*recede)*(1-S.enter*.9)*(1-smooth(0,.55,drain));
    CITY_U.uDim.value=Math.max(S.isolate*.55,smooth(.55,1,follow)*.7,S.enter*.92);
    scene.traverse(o=>{if(o.material?.uniforms?.uPR)o.material.uniforms.uPR.value=renderer.getPixelRatio();});
    wiring.update();room.update();ground.update();
    // depth of field: focus a little past the tower, far city softens; establishing shots only
    const dU=depthBlur.material.uniforms,dHero=camera.position.distanceTo(HERO_C);
    dU.uFocus.value=dHero+TUNE.dof.focus;dU.uRange.value=TUNE.dof.range;dU.uMaxPx.value=TUNE.dof.maxPx*renderer.getPixelRatio();
    dU.uStrength.value=(TUNE.dof.on?TUNE.dof.strength:0)*(1-smooth(0,.25,S.xray))*(1-smooth(0,.15,climb));depthBlur.enabled=dU.uStrength.value>.001&&TUNE.ao.view==='Default';
    dU.uNearK.value=TUNE.dof.nearK;dU.uSky.value=TUNE.dof.sky;
    CITY_U.uHzNear.value=TUNE.haze.near;CITY_U.uHzFar.value=Math.max(TUNE.haze.far,TUNE.haze.near+1);
    {const A=TUNE.ao,k=A.on?A.intensity*(1-S.xray)*(1-S.enter):0;ao.output=GTAOPass.OUTPUT[A.view]??GTAOPass.OUTPUT.Default;ao.enabled=k>.001||A.view!=='Default';ao.blendIntensity=k;
      const key=[A.radius,A.thickness,A.distanceExponent,A.falloff,A.scale,A.samples].join();
      if(key!==aoKey){aoKey=key;ao.updateGtaoMaterial({radius:A.radius,thickness:A.thickness,distanceExponent:A.distanceExponent,distanceFallOff:A.falloff,scale:A.scale,samples:TUNE.ao.samples??12});}}
    bloom.enabled=TUNE.bloom.on;bloom.strength=TUNE.bloom.strength;bloom.radius=TUNE.bloom.radius;bloom.threshold=TUNE.bloom.threshold;
    sun.castShadow=TUNE.shadows;sun.shadow.bias=TUNE.shadowBias;sun.shadow.normalBias=TUNE.shadowNormalBias;
    for(const o of entryMeshes)o.visible=S.room<.001&&S.climb<.6;
    const envK=1-.85*smooth(.1,.8,S.night);
    const envRot=(dayEnvTarget?-Math.atan2(Math.cos(TUNE.sunAz*Math.PI/180),Math.sin(TUNE.sunAz*Math.PI/180)):0)+TUNE.envRotate*Math.PI/180;
    for(const m of cityMaterials){m.envMapIntensity=m.userData.env*envK*TUNE.envGain;m.envMapRotation.y=envRot;}
    const night=S.night*DUSK;
    if(night!==lastShadowNight){renderer.shadowMap.needsUpdate=true;lastShadowNight=night;}
    for(const [a,b] of [['zenith','uZenith'],['mid','uMid'],['horizon','uHorizon'],['sun','uSunCol'],['glow','uGlow']])sample(a,night,skyU[b].value);
    skyU.uNight.value=night;skyU.uXray.value=S.xray;skyU.uTime.value=elapsed;skyU.uDim.value=smooth(.1,.8,S.enter)*.85;
    const elev=THREE.MathUtils.degToRad(lerp(TUNE.sunElev,-7,smooth(0,.72,night))),az=TUNE.sunAz*Math.PI/180;
    skyU.uSunDir.value.set(Math.sin(az)*Math.cos(elev),Math.sin(elev),Math.cos(az)*Math.cos(elev));
    for(const [a,b] of [['uZenith','uSkyZen'],['uMid','uSkyMid'],['uHorizon','uSkyHor'],['uSunCol','uSkySun'],['uGlow','uSkyGlow'],['uSunDir','uSkySunDir']])CITY_U[b].value.copy(skyU[a].value);
    CITY_U.uSkyNight.value=night;CITY_U.uSkyXray.value=S.xray;CITY_U.uSkyDim.value=skyU.uDim.value;
    sky.position.copy(camera.position);sun.position.copy(skyU.uSunDir.value).multiplyScalar(600).add(sun.target.position);
    fitShadow();
    sample('sun',night,sun.color);sun.intensity=sample('sunI',night)*(1-S.xray*.8);
    sample('hemiSky',night,hemi.color);sample('hemiGround',night,hemi.groundColor);hemi.intensity=sample('hemiI',night)*(1-S.xray*.55);
    {const f=TUNE.fill,fa=f.az*Math.PI/180,fe=f.elev*Math.PI/180;fill.visible=f.on;fill.color.set(f.color);
      fill.intensity=f.intensity*(1-smooth(0,.7,night))*(1-S.xray*.9);
      fill.position.set(Math.sin(fa)*Math.cos(fe),Math.sin(fe),Math.cos(fa)*Math.cos(fe)).multiplyScalar(600).add(fill.target.position);}
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
    renderer.toneMapping=TONE[TUNE.toneMapping]??THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=TUNE.exposure;
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
  // Warm-up, run once while the reader is still on the opening. Everything the story will draw later is
  // prepared now instead of on the first frame it appears (where it froze the scroll and made the scene jump
  // ahead, on the first pass only): shaders for the city, the cable close-up and the crossfade/fade
  // overlays, every texture uploaded to the GPU (room, cable prints, facades), and the crossfade target
  // allocated at the canvas size.
  let warmed=false;
  function warmUp(){
    if(disposed||warmed)return;warmed=true;
    const upload=root=>root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const v of Object.values(m))if(v?.isTexture)renderer.initTexture(v);});
    // three keys a shader on where it draws (screen or offscreen target) and on the tone mapping at that
    // moment, so each scene is compiled exactly as render() later draws it
    sizeBridgeTarget();renderer.initRenderTarget(bridgeTarget);
    const prevTarget=renderer.getRenderTarget(),prevTone=renderer.toneMapping;
    renderer.setRenderTarget(composer.readBuffer);renderer.compile(scene,camera);                 // city, through the composer
    renderer.setRenderTarget(bridgeTarget);renderer.compile(bridgeScene,bridgeCamera);          // ceiling-cable crossfade layer
    renderer.setRenderTarget(null);renderer.toneMapping=TONE[TUNE.toneMapping]??THREE.ACESFilmicToneMapping;
    renderer.compile(fadeScene,fadeCamera);                                                     // background fade over the city
    renderer.toneMapping=THREE.NeutralToneMapping;
    renderer.compile(bridgeScene,bridgeCamera);renderer.compile(compositeScene,fadeCamera);    // cable close-up, crossfade composite
    renderer.setRenderTarget(prevTarget);renderer.toneMapping=prevTone;
    for(const sc of [scene,bridgeScene,fadeScene,compositeScene])upload(sc);
  }
  function sizeBridgeTarget(){renderer.getDrawingBufferSize(bufferSize);if(bridgeTarget.width!==bufferSize.x||bridgeTarget.height!==bufferSize.y)bridgeTarget.setSize(bufferSize.x,bufferSize.y);}
  const compositeScene=new THREE.Scene();compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),compositeMaterial));
  function dispose(){disposed=true;gui?.destroy();room.dispose();const geometries=new Set(),materials=new Set();
    bridgeTarget.dispose();for(const root of [scene,bridgeScene,fadeScene,compositeScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)ownedTextures.add(v);}if(o.isInstancedMesh)o.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());sun.shadow.dispose();environment.dispose();cityEnvTarget.dispose();dayEnvTarget?.dispose();composer.passes.forEach(p=>p.dispose?.());composer.dispose();for(const t of [composer.renderTarget1,composer.renderTarget2])t.depthTexture?.dispose();
  }
  return {ready,resize,update,render,dispose,get progress(){return loaded?1:progressNow();},bundleAnchors(){return assembly.anchors(bridgeCamera,size.width,size.height);},get loaded(){return loaded;},get error(){return error;},tick(dt){elapsed+=Math.min(dt,.05);update(lastP,lastBg,entry);render();},diagnostics(){return {loaded,error:error?.message,state:{...S},camera:camera.position.toArray(),roomVisible:room.group.visible,roomSource:room.source,entryVisible:entryMeshes.some(o=>o.visible),cityMaterials:cityMaterials.length,kitTrees:kitTrees.map(o=>o.count),dayEnvironment:!!dayEnvTarget,assembly:assembly.diagnostics(),redPosition:bridgeWire.group.position.toArray()};}};
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
