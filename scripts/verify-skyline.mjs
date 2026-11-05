import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const { Browser } = await import(pathToFileURL(process.env.TASTE_CDP_MODULE || join(homedir(), '.codex/skills/taste-skill/scripts/lib/cdp.mjs')));
const out='.taste-skill/skyline';mkdirSync(out,{recursive:true});
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await Browser.launch(),results=[];
try {
  for(const [width,height] of [[1440,900],[390,844]]) {
    const page=await browser.newPage({width,height});
    await page.goto('http://localhost:5180',{timeoutMs:60000,settleMs:2200});
    for(let n=0;n<100;n++) {
      if(await page.eval(()=>window.__tamira?.diagnostics().skyline?.loaded))break;
      await wait(150);
    }
    assert(await page.eval(()=>window.__tamira?.diagnostics().skyline?.loaded),'Skyline failed to load');
    const samples=[];let redWireId,otherCores,startTip;
    for(const [segment,t] of [['day',0],['rise',.75],['wireOn',.9],['extend',.95],['run',.65],['run',.98],['approach',.5],['approach',.98],['bundle',.2],['bundle',.5],['bundle',.8],['bundle',1],['drain',.02],['drain',.18],['drain',.35],['drain',.55],['drain',.8],['drain',1],['wireIn',.5],['copper',.55],['strands',.6],['flex',.6],['heat',.6],['flame',.5],['smoke',.5],['finale',.53],['room',.55],['bundle',.8],['approach',.5],['day',0]]) {
      await page.eval(([s,t])=>window.__tamira.seek(s,t),[segment,t]);await wait(180);
      const d=await page.eval(()=>window.__tamira.diagnostics());
      assert(d.skyline.loaded&&!d.skyline.error,`Skyline error at ${segment}`);
      assert(d.skyline.camera.every(Number.isFinite),`Invalid camera at ${segment}`);
      if(segment==='extend')assert(d.skyline.state.network>.9,'Network did not draw');
      if(segment==='run'&&t>.95)assert(d.skyline.roomVisible&&d.skyline.state.room>.9,'Tower room did not appear');
      if(segment==='approach')assert(d.skyline.state.follow>0,'Ceiling wire follow did not start');
      if(segment==='bundle') {
        assert(d.skyline.assembly.cores===3,'Three-core reveal is missing a core');
        redWireId??=d.skyline.assembly.redWireId;
        assert(redWireId===d.skyline.assembly.redWireId,'Red wire replaced in bundle');
        if(t===1){otherCores=JSON.stringify(d.skyline.assembly.otherCores);startTip=d.skyline.assembly.actualRedTip;}
        if(t===.8){
          const boxes=await page.eval(()=>[...document.querySelectorAll('.label--bundle .label__tag')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
          assert(boxes.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=innerWidthSafe(width)&&r.y+r.h<=height),'Bundle label clipped');
          for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Bundle labels overlap');}
        }
      }
      if(segment==='drain') {
        assert(redWireId===d.skyline.assembly.redWireId,'Extraction replaced the red wire');
        assert(otherCores===JSON.stringify(d.skyline.assembly.otherCores),'Blue or green moved during red extraction');
        if(t===.35)assert(Math.hypot(...d.skyline.assembly.actualRedTip.map((v,i)=>v-startTip[i]))>.1,'Red core did not pull out');
      }
      if(segment==='finale')assert(d.finale.boardVisible&&d.finale.connectionWires===3,'Finale regressed');
      assert(!await page.eval(()=>document.documentElement.scrollWidth>innerWidth),'Horizontal overflow');
      await page.screenshot({path:`${out}/${width}-${segment}-${t}.png`,format:'png'});
      samples.push({segment,t,state:d.skyline.state});
    }
    // UI styles remain the host site's, not the source prototype's.
    const fonts=await page.eval(()=>({heading:getComputedStyle(document.querySelector('.hero__title')).fontFamily,body:getComputedStyle(document.body).fontFamily}));
    assert(fonts.heading.includes('Geist')&&fonts.body.includes('Instrument'),'Host typography changed');
    if(process.env.CAPTURE_SKYLINE_POSTERS==='1') {
      await page.eval(()=>{const style=document.createElement('style');style.textContent='.site-header,.hero__copy,.story__copy,.story__labels,.gauge{visibility:hidden!important}.story__stage{clip-path:none!important}';document.head.append(style);});
      await page.screenshot({path:`${out}/poster-${width}.png`,format:'png'});
    }
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(300);
    assert(await page.eval(()=>document.querySelector('.story').classList.contains('is-static')),'Reduced motion fallback failed');
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await wait(2200);
    assert(await page.eval(()=>window.__tamira?.diagnostics().skyline?.loaded),'Scene did not rebuild after reduced motion');
    assert(!page.consoleErrors.length,page.consoleErrors.join('\n'));
    results.push({width,height,fonts,samples,exceptions:page.consoleErrors});await page.close();
  }
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(r=>({width:r.width,height:r.height,frames:r.samples.length,fonts:r.fonts,exceptions:r.exceptions})),null,2));
} finally {await browser.close();}
function innerWidthSafe(width){return width+.1;}
