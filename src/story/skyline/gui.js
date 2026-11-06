import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { PAL, setPal } from './atmosphere.js'

// Development lighting panel for the skyline opener. Loaded only with ?gui (index.js),
// so production pays nothing. lil-gui is the maintained dat.gui successor that three ships.
// Edits apply live, persist in localStorage, and "Copy settings" puts a JSON snapshot on the
// clipboard (and the console) so the chosen values can be baked into TUNE / atmosphere.js PAL.
const STORE = 'tamira.skyline.gui'
const KEY_NAMES = { 'Day (hero)': 0, 'Sunset': 1, 'Blue hour': 2, 'Night': 3 }
const PAL_COLORS = { zenith: 'Sky zenith', mid: 'Sky mid', horizon: 'Sky horizon', glow: 'Night glow', sun: 'Sun colour', hemiSky: 'Hemi sky', hemiGround: 'Hemi ground', fog: 'Fog colour' }
const PAL_NUMS = { sunI: ['Sun intensity', 0, 12, .05], hemiI: ['Hemi intensity', 0, 4, .01], fogD: ['Fog density', 0, .003, .00001] }

export function createSkylineGui({ tune, tones, cityMaterials, markShadows }) {
  const defaults = snapshot()
  restore(JSON.parse(localStorage.getItem(STORE) || 'null'))

  const gui = new GUI({ title: 'Skyline lighting (?gui)', width: 300 })
  Object.assign(gui.domElement.style, { top: '110px', right: '16px', maxHeight: 'calc(100vh - 130px)', zIndex: 10000 })
  gui.domElement.setAttribute('data-lenis-prevent', '') // let the panel scroll instead of the story
  gui.onChange(() => { markShadows(); localStorage.setItem(STORE, JSON.stringify(snapshot())) })

  const r = gui.addFolder('Renderer')
  r.add(tune, 'toneMapping', tones).name('Tone mapping')
  r.add(tune, 'exposure', 0, 3, .01).name('Exposure')

  const sun = gui.addFolder('Sun (key light)')
  sun.add(tune, 'sunAz', 0, 360, 1).name('Azimuth °')
  sun.add(tune, 'sunElev', 1, 80, .5).name('Elevation ° (day)')
  sun.add(tune, 'shadows').name('Cast shadows')
  sun.add(tune, 'shadowBias', -.005, .005, .0001).name('Shadow bias')
  sun.add(tune, 'shadowNormalBias', 0, 3, .01).name('Shadow normal bias')

  const fill = gui.addFolder('Fill light (new)')
  fill.add(tune.fill, 'on').name('Enabled')
  fill.addColor(tune.fill, 'color').name('Colour')
  fill.add(tune.fill, 'intensity', 0, 5, .01).name('Intensity')
  fill.add(tune.fill, 'az', 0, 360, 1).name('Azimuth °')
  fill.add(tune.fill, 'elev', 1, 89, .5).name('Elevation °')

  // Time-of-day palette: one key edited at a time; the story blends between keys as it scrolls.
  const pal = gui.addFolder('Sky, sun, hemisphere, fog (palette)')
  const edit = { key: 0 }
  const proxy = {}
  for (const k of [...Object.keys(PAL_COLORS), ...Object.keys(PAL_NUMS)])
    Object.defineProperty(proxy, k, { get: () => PAL[k][edit.key], set: v => setPal(k, edit.key, v) })
  const palCtrls = []
  pal.add(edit, 'key', KEY_NAMES).name('Editing key').onChange(() => palCtrls.forEach(c => c.updateDisplay()))
  for (const [k, label] of Object.entries(PAL_COLORS)) palCtrls.push(pal.addColor(proxy, k).name(label))
  for (const [k, [label, min, max, step]] of Object.entries(PAL_NUMS)) palCtrls.push(pal.add(proxy, k, min, max, step).name(label))

  const env = gui.addFolder('Environment (HDRI reflections)')
  env.add(tune, 'envGain', 0, 4, .01).name('Intensity ×')
  env.add(tune, 'envRotate', -180, 180, 1).name('Extra rotation °')

  const bloom = gui.addFolder('Bloom')
  bloom.add(tune.bloom, 'on').name('Enabled')
  bloom.add(tune.bloom, 'strength', 0, 3, .01).name('Strength')
  bloom.add(tune.bloom, 'radius', 0, 1.5, .01).name('Radius')
  bloom.add(tune.bloom, 'threshold', 0, 2, .01).name('Threshold')

  const dof = gui.addFolder('Depth of field / haze blur')
  dof.add(tune.dof, 'on').name('Enabled')
  dof.add(tune.dof, 'strength', 0, 2, .01).name('Strength')
  dof.add(tune.dof, 'focus', -300, 300, 1).name('Focus offset (m)')
  dof.add(tune.dof, 'range', 100, 3000, 10).name('Falloff range (m)')
  dof.add(tune.dof, 'maxPx', 0, 24, .5).name('Max blur px')
  dof.add(tune.dof, 'nearK', 0, 1, .01).name('Foreground blur')
  dof.add(tune.dof, 'sky', 0, 1, .01).name('Sky blur')

  const ao = gui.addFolder('Ambient occlusion (GTAO)')
  ao.add(tune.ao, 'on').name('Enabled')
  ao.add(tune.ao, 'intensity', 0, 2, .01).name('Intensity')
  ao.add(tune.ao, 'radius', .5, 30, .1).name('Radius (m)')
  ao.add(tune.ao, 'thickness', .5, 30, .1).name('Thickness (m)')
  ao.add(tune.ao, 'distanceExponent', .5, 4, .05).name('Distance exponent')
  ao.add(tune.ao, 'falloff', 0, 1, .01).name('Falloff')
  ao.add(tune.ao, 'scale', .2, 3, .01).name('Scale')
  ao.add(tune.ao, 'view', ['Default', 'AO', 'Denoise', 'Normal', 'Depth', 'Diffuse']).name('Debug view')

  const haze = gui.addFolder('Horizon haze')
  haze.add(tune.haze, 'near', 200, 3000, 10).name('Starts at (m)')
  haze.add(tune.haze, 'far', 300, 5000, 10).name('Full at (m)')

  const mats = gui.addFolder('City materials').close()
  for (const [name, list] of groupMaterials()) {
    const m = list[0], f = mats.addFolder(`${name}${list.length > 1 ? ` ×${list.length}` : ''}`).close()
    const p = matProxy(list)
    f.addColor(p, 'color').name('Colour / tint')
    f.add(p, 'roughness', 0, 1, .01).name('Roughness')
    f.add(p, 'metalness', 0, 1, .01).name('Metalness')
    f.add(p, 'env', 0, 4, .01).name('Env intensity')
    if (m.normalMap) f.add(p, 'normal', 0, 3, .01).name('Normal strength')
  }

  const tools = gui.addFolder('Settings')
  tools.add({ copy() {
    const json = JSON.stringify(snapshot(), null, 2)
    console.log('[skyline gui] settings\n' + json)
    navigator.clipboard?.writeText(json).catch(() => {})
  } }, 'copy').name('Copy settings JSON')
  tools.add({ reset() {
    localStorage.removeItem(STORE); restore(defaults); gui.controllersRecursive().forEach(c => c.updateDisplay()); markShadows()
  } }, 'reset').name('Reset to shipped defaults')

  return gui

  function groupMaterials() {
    const g = new Map()
    for (const m of cityMaterials) { const n = m.name || 'filler'; if (!g.has(n)) g.set(n, []); g.get(n).push(m) }
    return [...g].sort(([a], [b]) => a.localeCompare(b))
  }
  function matProxy(list) {
    const m = list[0]
    return {
      get color() { return '#' + m.color.getHexString() }, set color(v) { list.forEach(x => x.color.set(v)) },
      get roughness() { return m.roughness }, set roughness(v) { list.forEach(x => { x.roughness = v }) },
      get metalness() { return m.metalness }, set metalness(v) { list.forEach(x => { x.metalness = v }) },
      get env() { return m.userData.env }, set env(v) { list.forEach(x => { x.userData.env = v }) },
      get normal() { return m.normalScale.x }, set normal(v) { list.forEach(x => x.normalScale.setScalar(v)) },
    }
  }
  function snapshot() {
    const materials = {}
    for (const [name, [m]] of groupMaterials())
      materials[name] = { color: '#' + m.color.getHexString(), roughness: m.roughness, metalness: m.metalness, env: m.userData.env, normal: m.normalScale.x }
    const palette = {}
    for (const k of [...Object.keys(PAL_COLORS), ...Object.keys(PAL_NUMS)]) palette[k] = [...PAL[k]]
    return { tune: structuredClone(tune), palette, materials }
  }
  function restore(s) {
    if (!s) return
    for (const [k, v] of Object.entries(s.tune || {})) {
      if (v && typeof v === 'object' && tune[k]) Object.assign(tune[k], v)
      else if (k in tune) tune[k] = v
    }
    for (const [k, arr] of Object.entries(s.palette || {})) if (PAL[k]) arr.forEach((v, i) => setPal(k, i, v))
    const groups = new Map(groupMaterials())
    for (const [name, v] of Object.entries(s.materials || {})) {
      const list = groups.get(name); if (!list) continue
      const p = matProxy(list)
      for (const k of ['color', 'roughness', 'metalness', 'env', 'normal']) if (v[k] != null) p[k] = v[k]
    }
  }
}
