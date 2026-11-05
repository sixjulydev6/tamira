import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { Browser } = await import(pathToFileURL(process.env.TASTE_CDP_MODULE || join(homedir(), '.codex/skills/taste-skill/scripts/lib/cdp.mjs')));
const out='.taste-skill/room-finale';mkdirSync(out,{recursive:true});
const assert=(x,m)=>{if(!x)throw new Error(m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<80;i++){if(await fn())return;await wait(100);}throw Error(label);}
const browser=await Browser.launch(),results=[];
try {
  for(const [width,height,frame] of [[1440,900,'d'],[390,844,'p']]){
    const p=await browser.newPage({width,height});
    await p.goto('http://localhost:5180',{timeoutMs:60000,settleMs:2200});
    assert(await p.eval(()=>document.querySelector('.story').classList.contains('is-live-3d')),'Live scene failed');
    const early=await p.eval(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/room/')).map(r=>r.name));
    assert(early.length===0,'Room loaded before the ending');
    const states=[];
    let wireId;
    for(const t of [.001,.08,.16,.24,.30,.32,.38,.45,.53,.61,.79,.94]){
      await p.eval(t=>window.__tamira.seek('finale',t),t);await wait(160);
      const continuous=await p.eval(()=>({f:window.__tamira.diagnostics().finale,opacity:+getComputedStyle(document.querySelector('.story__canvas--wire')).opacity}));
      // red (the product wire) from the start; black and green join as they slide up (finale t 0.40 / 0.48 = source u 6.46 / 6.54)
      assert(continuous.f.connectionWires===(t<.40?1:t<.48?2:3),`Expected connection wires at ${t}: ${continuous.f.connectionWires}`);
      assert(continuous.f.boardVisible,'Switchboard hidden after frame reset');
      wireId ??= continuous.f.wireId;
      assert(continuous.f.wireId===wireId,'Cable object changed');
      assert(continuous.opacity===1,'Cable canvas fades during connection');
      await p.screenshot({path:`${out}/${frame}-connection-${t}.png`,format:'png'});
    }
    const handoff=await p.eval(()=>window.__tamira.diagnostics().finale);
    assert(handoff.boardErrorPx<2,`Switchboard handoff mismatch: ${handoff.boardErrorPx}px`);
    let last='';
    for(const [t,step] of [[.03,0],[.09,1],[.20,2],[.32,3],[.43,4],[.55,5],[.72,5]]){
      await p.eval(t=>window.__tamira.seek('room',t),t);
      await until(()=>p.eval(([f,s])=>{const r=window.__tamira.diagnostics().room;return r.frame===f&&r.painted&&r.decoded.some(k=>k.endsWith('-'+s));},[frame,step]),'Room step not decoded');
      await wait(150);
      const canvas=await p.eval(()=>document.querySelector('.room-finale canvas').toDataURL());
      const hash=createHash('sha256').update(canvas).digest('hex');assert(hash!==last,'Room progression did not change');last=hash;
      await p.screenshot({path:`${out}/${frame}-room-${step}-${t}.png`,format:'png'});
      states.push({t,step,hash});
    }
    // Seek backward from the lit room to the dark room and the still-connected board.
    await p.eval(()=>window.__tamira.seek('room',.03));await wait(500);
    assert(await p.eval(()=>+getComputedStyle(document.querySelector('.room-finale')).opacity>.99),'Room vanished on reverse');
    await p.eval(()=>window.__tamira.seek('finale',.925));await wait(200);
    assert(await p.eval(()=>getComputedStyle(document.querySelector('.room-finale')).visibility==='hidden'),'Room still covers board after reverse');
    await p.eval(()=>window.__tamira.seek('day',0));
    assert(await p.eval(()=>getComputedStyle(document.querySelector('.room-finale')).visibility==='hidden'),'Room covers hero');
    assert(!await p.eval(()=>document.documentElement.scrollWidth>innerWidth),'Overflow');
    assert(!p.consoleErrors.length,p.consoleErrors.join('\n'));
    // Reduced motion exposes the full-lit original still without a pinned room animation.
    await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(300);
    assert(await p.eval(()=>getComputedStyle(document.querySelector('.room-static')).display==='block'),'Static room missing');
    results.push({width,height,frame,handoff,states,exceptions:p.consoleErrors});await p.close();
  }
  // Changing aspect mid-room selects the source's other crop and keeps the room painted.
  const p=await browser.newPage({width:1440,height:900});await p.goto('http://localhost:5180',{timeoutMs:60000,settleMs:2200});
  await p.eval(()=>window.__tamira.seek('room',.7));await wait(800);
  await p.setViewport({width:390,height:844});await wait(400);await p.eval(()=>window.__tamira.seek('room',.7));
  await until(()=>p.eval(()=>{const r=window.__tamira.diagnostics().room;return r.frame==='p'&&r.painted;}),'Room did not recover on portrait resize');
  await p.screenshot({path:`${out}/resize-to-portrait.png`,format:'png'});await p.close();
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({width,height,handoff,states})=>({width,height,handoff,lightingChecks:states.length})),null,2));
}finally{await browser.close();}
