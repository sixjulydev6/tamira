import { RoomPainter } from './original/roompaint.js';
import { ROOM_VIEW, frameFor } from './original/roomview.js';
import { finaleU, ROOM_BEATS } from './finale-timing.js';
import { local, smooth } from './timeline.js';

/** Original multiresolution room assets and lighting progression; no extra WebGL context. */
export function createRoom(element) {
  const canvas=element.querySelector('canvas');
  let painter=null,frame=null,loading=false,alive=true,lastU=6.06;
  function update(p) {
    if(!alive)return;
    const u=finaleU(p);lastU=u;
    const near=local(p,'smoke')>.25||local(p,'finale')>0;
    const f=frameFor(innerWidth/Math.max(1,innerHeight));
    if(near&&(!painter||frame!==f)) {
      painter?.dispose();frame=f;loading=true;
      painter=new RoomPainter(canvas,ROOM_VIEW[f],(name,i)=>`/room/${name}-${i}.webp`,ROOM_BEATS,f==='p'?2.5:1.25);
      const current=painter;
      current.load().then(()=>{if(alive&&painter===current)loading=false;});
    }
    if(painter&&u>6.85)painter.paint(u);
    // Do not cover the matched live board with a blank canvas while images are decoding.
    const opacity=painter?.painted?smooth(6.99,7.06,u):0;
    element.style.opacity=String(opacity);
    element.style.visibility=opacity>0?'visible':'hidden';
    element.style.setProperty('--room-end',smooth(7.74,7.94,u));
    element.dataset.frame=f;
  }
  return { update, diagnostics:()=>({frame,loading,u:lastU,painted:!!painter?.painted,stats:painter?.stats,decoded:painter?[...painter.bmps.keys()]:[]}), dispose(){alive=false;painter?.dispose();element.style.opacity='0';element.style.visibility='hidden';} };
}
