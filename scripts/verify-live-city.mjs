// Browser integration checks. Uses the installed taste-skill CDP helper; no new packages.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser } = await import(pathToFileURL(process.env.TASTE_CDP_MODULE || join(homedir(), '.codex/skills/taste-skill/scripts/lib/cdp.mjs')));
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '.taste-skill/live-city'; mkdirSync(out, { recursive: true });
const browser = await Browser.launch(); const results = [];
const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ width, height });
    await page.goto('http://localhost:5180', { timeoutMs: 60000, settleMs: 2500 });
    assert(await page.eval(() => document.querySelector('.story').classList.contains('is-live-3d')), 'Live renderer did not initialize');
    const assets = await page.eval(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rise\/|hero-traffic/.test(n)));
    assert(assets.length === 0, 'Rendered sequence or video still loading');
    assert(!await page.eval(() => document.documentElement.scrollWidth > innerWidth), 'Horizontal overflow');
    await page.screenshot({ path: `${out}/${width}-day.png`, format: 'png' });
    const phases = width === 1440 ? [['rise', .5], ['rise', 1], ['wireOn', .3], ['wireOn', .95], ['run', .75], ['wireIn', .8], ['copper', .55], ['strands', .6], ['heat', .6], ['flame', .35], ['finale', .8], ['day', 0]] : [['rise', .5], ['wireOn', .95], ['heat', .6], ['day', 0]];
    for (const [segment, t] of phases) {
      await page.eval(([s,t]) => window.__tamira.seek(s,t), [segment,t]); await wait(100);
      await page.screenshot({ path: `${out}/${width}-${segment}-${t}.png`, format: 'png' });
    }
    const metrics = await page.eval(() => window.__tamira.diagnostics());
    assert(metrics.buildings === 37 && metrics.windows > 1000 && metrics.cars > 0, 'City asset missing');
    // Changing the media query must release the renderers and rebuild cleanly on resume.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await wait(300);
    assert(await page.eval(() => document.querySelector('.story').classList.contains('is-static')), 'Reduced motion did not switch to fallback');
    await page.screenshot({ path: `${out}/${width}-reduced.png`, format: 'png' });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }); await wait(2200);
    assert(await page.eval(() => document.querySelector('.story').classList.contains('is-live-3d')), 'Renderer did not recover after reduced-motion change');
    assert(page.consoleErrors.length === 0, page.consoleErrors.join('\n'));
    results.push({ width, height, metrics, exceptions: page.consoleErrors, sequenceRequests: assets });
    await page.close();
  }
  const lost = await browser.newPage({width:1440,height:900});await lost.goto('http://localhost:5180',{settleMs:2300});
  await lost.eval(() => document.querySelector('.story__canvas').dispatchEvent(new Event('webglcontextlost', { cancelable:true })));
  assert(await lost.eval(() => document.querySelector('.story').classList.contains('is-static')), 'Context-loss fallback missing');await lost.close();
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
