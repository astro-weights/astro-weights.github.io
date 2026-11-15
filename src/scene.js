// Lazy chunk: one THREE.Points cloud, three star layouts (drift / burn / correction) as vertex attributes.
// Scroll time t (0..2) is a single uniform; the vertex shader blends the layouts. One draw call, one context.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from 'three'
import { ANCHOR, GAL, GOLD_BURN, GOLD_CLEAN, GOLD_DRIFT, armTheta, driftPoint, driftR, driftTheta, shear, xform } from './layout.js'

const TAU = Math.PI * 2
const GOLD_AT = GOLD_CLEAN
const BURN = 14 // stars that shift near the astronaut; index 0 turns gold

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build() {
  const N = GAL.STARS
  const rng = mulberry32(4)
  const g = () => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng()) }
  const p0 = new Float32Array(N * 3), p1 = new Float32Array(N * 3), p2 = new Float32Array(N * 3)
  const misc = new Float32Array(N * 4), gold = new Float32Array(N)
  let i = 0
  const put = (a, [x, y, z]) => { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z }
  const star = (clean, drift, size, bright, delay) => {
    put(p2, clean); put(p0, drift); put(p1, drift)
    misc[i * 4] = size; misc[i * 4 + 1] = bright; misc[i * 4 + 2] = rng(); misc[i * 4 + 3] = delay
  }

  // The burn: a handful of stars next to the astronaut. They nudge apart in chapter 2, settle on the arm in chapter 3.
  for (let j = 0; j < BURN; j++, i++) {
    const r = GAL.ANCHOR_R + (j ? g() * 0.02 : (g(), 0))
    const th = armTheta(0, r)
    // gold star settles exactly on the arm; its companions settle a clear 0.05..0.12 away so the gold stays a clean disc
    const ga = rng() * TAU, gd = 0.05 + 0.07 * rng()
    const clean = j === 0
      ? [GOLD_CLEAN[0], GOLD_CLEAN[1], 0]
      : [GOLD_AT[0] + gd * Math.cos(ga), GOLD_AT[1] + gd * Math.sin(ga), g() * 0.01]
    const dp = j === 0 ? [ANCHOR[0] + 0.012, ANCHOR[1] - 0.01] : driftPoint(0, r)
    const drift = j === 0 ? [GOLD_DRIFT[0], GOLD_DRIFT[1], 0] : [dp[0] + g() * 0.025, dp[1] + g() * 0.025, g() * 0.02]
    star(clean, drift, j === 0 ? 15 : 3.6, 1, r)
    const dx = drift[0] - ANCHOR[0], dy = drift[1] - ANCHOR[1], n = Math.hypot(dx, dy) || 1
    const push = 0.055 + 0.05 * rng()
    if (j === 0) put(p1, [GOLD_BURN[0], GOLD_BURN[1], 0])
    else {
      let bx = drift[0] + (dx / n) * push - (dy / n) * 0.02, by = drift[1] + (dy / n) * push + (dx / n) * 0.02
      // keep the gold disc clean: nudge any companion that lands on it
      const gx = bx - GOLD_BURN[0], gy = by - GOLD_BURN[1], gd2 = Math.hypot(gx, gy) || 1
      if (gd2 < 0.06) { bx = GOLD_BURN[0] + (gx / gd2) * 0.06; by = GOLD_BURN[1] + (gy / gd2) * 0.06 }
      put(p1, [bx, by, drift[2]])
    }
    gold[i] = j === 0 ? 1 : 0.5
  }
  // Arms
  for (let n = 0; n < 4600; n++, i++) {
    const k = n % 3, r = 0.07 + 0.93 * Math.pow(rng(), 0.85), th = armTheta(k, r)
    const sc = 0.022 + 0.045 * r
    const cz = g() * 0.035 * (1 - 0.5 * r)
    const clean = [r * Math.cos(th) + g() * sc, r * Math.sin(th) + g() * sc, cz]
    const rd = driftR(r, th), td = driftTheta(k, r), sd = 0.05 + 0.085 * r
    let [dx, dy] = shear(rd * Math.cos(td) + g() * sd, rd * Math.sin(td) + g() * sd)
    if (rng() < 0.1) { const a = rng() * TAU, m = 0.1 + 0.25 * rng(); dx += Math.cos(a) * m; dy += Math.sin(a) * m }
    star(clean, [dx, dy, cz * 1.8], 1.7 + Math.pow(rng(), 3) * 2.8, 0.55 + 0.45 * rng(), r)
  }
  // Bulge
  for (let n = 0; n < 900; n++, i++) {
    const x = g() * 0.07, y = g() * 0.07, z = g() * 0.06
    star([x, y, z], [x + g() * 0.02, y + g() * 0.02, z], 1.4 + Math.pow(rng(), 3) * 2, 0.6 + 0.4 * rng(), 0.1)
  }
  // Disc between the arms
  for (let n = 0; n < 600; n++, i++) {
    const r = Math.sqrt(rng()) * 0.95, a = rng() * TAU, x = r * Math.cos(a), y = r * Math.sin(a), z = g() * 0.03
    const [sx, sy] = shear(x + g() * 0.05, y + g() * 0.05)
    star([x, y, z], [sx, sy, z], 1.4 + Math.pow(rng(), 3) * 1.8, 0.4 + 0.35 * rng(), r)
  }
  // Far halo: fills the frame behind the copy, same in every layout
  for (; i < N; i++) {
    const r = 0.9 + 1.7 * Math.sqrt(rng()), a = rng() * TAU, x = r * Math.cos(a), y = r * Math.sin(a), z = g() * 0.25
    star([x, y, z], [x, y, z], 1.3 + Math.pow(rng(), 2) * 1.8, 0.35 + 0.4 * rng(), 1)
  }
  return { p0, p1, p2, misc, gold }
}

const VERT = /* glsl */ `
attribute vec3 aP1; attribute vec3 aP2; attribute vec4 aMisc; attribute float aGold;
uniform float uT, uTime, uTw, uPx, uZ, uDef;
varying vec3 vCol; varying float vA, vG;
void main() {
  float a = smoothstep(0.0, 1.0, clamp(uT, 0.0, 1.0));
  float b = smoothstep(0.0, 1.0, clamp((uT - 1.0) * 1.5 - aMisc.w * 0.5, 0.0, 1.0));
  vec3 p = mix(mix(position, aP1, a), aP2, b);
  float tw = 1.0 - 0.28 * uTw * (0.5 + 0.5 * sin(uTime * (0.7 + aMisc.z * 1.9) + aMisc.z * 60.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = smoothstep(0.55, 0.95, uT);
  float g = step(0.9, aGold) * on;
  float hi = step(0.4, aGold) * (1.0 - step(0.9, aGold)) * on;
  // defocus (phones, copy on screen): bigger and fainter points, the cheap bokeh look; the same energy per star, so the dense core does not blow out
  float bl = 1.0 + 2.0 * uDef;
  gl_PointSize = max(1.8, aMisc.x * uPx * (uZ / -mv.z)) * (1.0 + 0.35 * hi) * (1.0 + 1.2 * g) * mix(bl, 1.0 + uDef, g);
  vec3 cool = vec3(0.92, 0.94, 1.0), violet = vec3(0.66, 0.51, 1.0), gold = vec3(1.0, 0.655, 0.043);
  vec3 c = mix(violet, cool, smoothstep(0.15, 0.85, fract(aMisc.z * 7.3)));
  vCol = mix(mix(c, cool, hi), gold, g);
  vG = g;
  vA = mix(aMisc.y * tw, 1.0, g) * mix(1.0, 1.5 / (bl * bl), uDef * (1.0 - 0.6 * g));
}`
const FRAG = /* glsl */ `
varying vec3 vCol; varying float vA, vG;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = mix(pow(1.0 - d, 1.0), smoothstep(1.0, 0.7, d), vG) * vA;
  gl_FragColor = vec4(vCol, a);
}`

// host: element that receives the live canvas; null for stills (canvas stays off-DOM).
export function mountScene(host, { reduced, onFail }) {
  let renderer
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' })
    if (!renderer.getContext()) throw new Error('no webgl')
  } catch (e) { onFail(); return null }
  const gl = renderer.domElement
  let disposed = false
  gl.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (!disposed) onFail() })
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const cam = new PerspectiveCamera(GAL.fov, 1, 0.1, 50)
  cam.position.z = GAL.Z
  const group = new Group()
  scene.add(group)
  const d = build()
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(d.p0, 3))
  geo.setAttribute('aP1', new BufferAttribute(d.p1, 3))
  geo.setAttribute('aP2', new BufferAttribute(d.p2, 3))
  geo.setAttribute('aMisc', new BufferAttribute(d.misc, 4))
  geo.setAttribute('aGold', new BufferAttribute(d.gold, 1))
  geo.boundingSphere = null
  const mat = new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    uniforms: { uT: { value: 0 }, uTime: { value: 1 }, uTw: { value: reduced ? 0 : 1 }, uDef: { value: 0 }, uPx: { value: 1 }, uZ: { value: GAL.Z } },
  })
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  group.add(pts)
  if (host) host.appendChild(gl)

  let W = 0, H = 0
  function setView(w, h) {
    if (w === W && h === H) return
    W = w; H = h
    const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    cam.aspect = w / h
    cam.updateProjectionMatrix()
    const x = xform(w, h)
    group.position.set(x.gx, x.gy, 0)
    group.scale.setScalar(x.s)
    group.rotation.x = x.tilt
    mat.uniforms.uPx.value = dpr * Math.min(1.25, Math.max(0.7, x.L.rad / 330))
  }
  function render(t, time, def = 0) {
    mat.uniforms.uDef.value = def
    mat.uniforms.uT.value = t
    mat.uniforms.uTime.value = time
    renderer.render(scene, cam)
  }
  // One still frame as a plain 2D canvas (reduced motion: three of these replace the scrubbed scene).
  function still(t, w, h) {
    setView(w, h)
    render(t, 1)
    const c = document.createElement('canvas')
    c.width = gl.width; c.height = gl.height
    c.getContext('2d').drawImage(gl, 0, 0)
    return c
  }
  function dispose() {
    disposed = true
    geo.dispose(); mat.dispose(); renderer.dispose(); renderer.forceContextLoss()
    gl.remove()
  }
  return { setView, render, still, dispose }
}
