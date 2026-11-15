// Shared geometry for the story: where the galaxy sits on screen, where the burn happens, and the course line.
// Lives in the entry chunk (tiny, no three) so the overlay works with the canvas off or before the scene loads.

export const GAL = { fov: 38, Z: 6, SPIN: 0.55, ANCHOR_R: 0.55, STARS: 7000 }
export const MOBILE_BP = 860
const TAU = Math.PI * 2

// Galaxy shape (local units, R = 1): three arms, a clean spiral, and a drifted version of it.
export const armTheta = (k, r) => GAL.SPIN + (k * TAU) / 3 + 3.3 * r
export const driftTheta = (k, r) => armTheta(k, r) + 0.38 * Math.sin(5.2 * r + 1.7 * k) + 0.16 * Math.sin(11 * r + 2 * k)
export const driftR = (r, th) => r * (1 + 0.09 * Math.sin(3 * th + 0.9))
export const shear = (x, y) => [x + 0.05 * Math.sin(3.1 * y + 1.2), y + 0.05 * Math.sin(2.7 * x)]
export function driftPoint(k, r) {
  const th = armTheta(k, r)
  const rd = driftR(r, th), td = driftTheta(k, r)
  return shear(rd * Math.cos(td), rd * Math.sin(td))
}
export const ANCHOR = driftPoint(0, GAL.ANCHOR_R) // local position of the burn
// The gold star's three resting places (galaxy-local): drifted, nudged by the burn, settled on the clean arm.
export const GOLD_DRIFT = [ANCHOR[0] + 0.012, ANCHOR[1] - 0.01]
const gn = Math.hypot(0.012, -0.01)
export const GOLD_BURN = [GOLD_DRIFT[0] + (0.012 / gn) * 0.05 + (0.01 / gn) * 0.02, GOLD_DRIFT[1] + (-0.01 / gn) * 0.05 + (0.012 / gn) * 0.02]
export const GOLD_CLEAN = [GAL.ANCHOR_R * Math.cos(armTheta(0, GAL.ANCHOR_R)), GAL.ANCHOR_R * Math.sin(armTheta(0, GAL.ANCHOR_R))]

export function lay(w, h) {
  const m = w < MOBILE_BP
  return m
    ? { m, cx: 0.5 * w, cy: 0.33 * h, rad: Math.min(0.46 * w, 0.19 * h), tilt: -0.8 }
    : { m, cx: 0.755 * w, cy: 0.5 * h, rad: Math.min(0.225 * w, 0.58 * h), tilt: -0.95 }
}

// Group transform of the galaxy for a w x h stage (the scene uses the same numbers).
export function xform(w, h) {
  const L = lay(w, h)
  const ppu = h / 2 / (Math.tan((GAL.fov * Math.PI) / 360) * GAL.Z) // px per world unit at the galaxy plane
  return { L, ppu, s: L.rad / ppu, gx: (L.cx - w / 2) / ppu, gy: -(L.cy - h / 2) / ppu, tilt: L.tilt }
}

// Project a galaxy-local point to stage pixels (same maths as the camera + group in scene.js).
export function toScreen(w, h, x, y, z = 0) {
  const g = xform(w, h)
  const c = Math.cos(g.tilt), s = Math.sin(g.tilt)
  const X = g.gx + g.s * x
  const Y = g.gy + g.s * (y * c - z * s)
  const Zp = g.s * (y * s + z * c)
  const k = GAL.Z / (GAL.Z - Zp)
  return { x: w / 2 + X * g.ppu * k, y: h / 2 - Y * g.ppu * k }
}
export const anchorPx = (w, h) => toScreen(w, h, ANCHOR[0], ANCHOR[1])
// Screen position of the gold star at story time t (same blend as the vertex shader; its delay is ANCHOR_R).
export function goldPx(w, h, t) {
  const a = sm(clamp(t)), b = sm(clamp((t - 1) * 1.5 - GAL.ANCHOR_R * 0.5))
  const P = [GOLD_DRIFT, GOLD_BURN, GOLD_CLEAN].map((p) => toScreen(w, h, p[0], p[1]))
  const x = (P[0].x + (P[1].x - P[0].x) * a) * (1 - b) + P[2].x * b
  const y = (P[0].y + (P[1].y - P[0].y) * a) * (1 - b) + P[2].y * b
  return { x, y }
}

const sm = (x) => x * x * (3 - 2 * x)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export { sm, clamp }

// How straight the course is at story time t (0 drift, 1 burn, 2 correction).
const STRAIGHT = [0, 0.14, 1]
export function straightness(t) {
  const i = Math.min(1, Math.floor(clamp(t, 0, 2)))
  return STRAIGHT[i] + (STRAIGHT[i + 1] - STRAIGHT[i]) * sm(clamp(t - i))
}

const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k]
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])
const f1 = (n) => n.toFixed(1)

// Course line S -> A (burn point) -> E. f = 1 is the planned straight line; less bends away after A.
export function course(w, h, A, f) {
  const m = w < MOBILE_BP
  const S = m ? [-0.04 * w, 0.42 * h] : [0.6 * w, 1.08 * h]
  const a = [A.x, A.y]
  const k = (1.08 * w - S[0]) / (a[0] - S[0])
  const E = [S[0] + (a[0] - S[0]) * k, S[1] + (a[1] - S[1]) * k]
  const L1 = len(S, a), L2 = len(a, E)
  const d0 = [(E[0] - S[0]) / (L1 + L2), (E[1] - S[1]) / (L1 + L2)]
  const th = (1 - f) * 0.56
  const tA = rot(d0, th * 0.5), dE = rot(d0, th)
  const c1 = add(a, tA, -L1 * 0.5)
  const c2 = add(a, tA, L2 * 0.5)
  const Et = add(a, dE, L2)
  const P = (p) => `${f1(p[0])} ${f1(p[1])}`
  return {
    L1,
    ideal: `M${P(S)} L${P(E)}`,
    actual: `M${P(S)} Q${P(c1)} ${P(a)} Q${P(c2)} ${P(Et)}`,
    leg1(u) {
      const v = 1 - u
      return [v * v * S[0] + 2 * v * u * c1[0] + u * u * a[0], v * v * S[1] + 2 * v * u * c1[1] + u * u * a[1]]
    },
  }
}

// Where the adapter tag comes to rest, relative to the burn point.
export const handoff = (w, h, A) => {
  const m = w < MOBILE_BP
  return m ? { x: A.x - 0.04 * w, y: A.y + 0.2 * h } : { x: A.x - 0.07 * w, y: A.y + 0.2 * h }
}
