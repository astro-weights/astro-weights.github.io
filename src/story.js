// Entry-chunk driver. Reads native scroll inside the render loop (no scroll listeners, no scroll-jacking),
// turns it into story time t (0 drift, 1 burn, 2 correction), paints the HTML/SVG overlay, and feeds the lazy scene.
import { MOBILE_BP, anchorPx, clamp, course, goldPx, handoff, sm, straightness } from './layout.js'

const ease = (x) => 1 - Math.pow(1 - clamp(x), 3)
const win = (t, a, b) => sm(clamp((t - a) / (b - a)))
// Phones: how "read" the story is at t. 1 at each chapter (copy on screen, scene soft and dim), 0 between chapters (copy gone, scene sharp).
const READ_IN = 0.08, READ_OUT = 0.28
const chapterRead = (t, i) => 1 - win(Math.abs(t - i), READ_IN, READ_OUT)
const readOf = (t) => chapterRead(t, Math.round(clamp(t, 0, 2)))

function overlay(bd) {
  const q = (s) => bd.querySelector(s)
  return { bd, svg: q('.ov'), ideal: q('.ideal'), course: q('.course'), mark: q('.mark'), label: q('.label'), tag: q('.tag'), dot: q('.gold-dot'), aim: q('.aim') }
}

export function initStory(root, { reduced, fixedT, onGL }) {
  const pin = root.querySelector('.pin')
  const stage = overlay(pin.querySelector('.bd'))
  const frames = [...root.querySelectorAll('.frame')].map(overlay)
  const chapters = [...root.querySelectorAll('.chapter')]
  const cols = chapters.map((c) => c.querySelector('.copy-col'))
  const links = [...root.querySelectorAll('.rail a')]
  const fill = root.querySelector('.rail__fill')
  const geo = new Map() // overlay -> { w, h, A }
  let stops = [0, 1, 2] // scrollY at which t = 0, 1, 2
  let scene = null, visible = true, raf = 0, dead = false
  let mob = false, ts = fixedT ?? 0, last = 0, clock = 0, lastPaint = -1, lastActive = -1

  function measure() {
    // t = i when chapter i's copy sits where the hero copy sits on load (desktop: copy centre; phones: bottom of the
    // chapter content), so short chapters still show each state with its copy on screen; capped so t = 2 is reached
    // while the stage is still pinned.
    const sy = window.scrollY
    mob = window.innerWidth < MOBILE_BP
    const cc = cols.map((c, i) => {
      const r = cols[i].getBoundingClientRect()
      return r.top + sy + (mob ? r.height : r.height / 2)
    })
    const unpin = root.getBoundingClientRect().bottom + sy - pin.clientHeight
    stops = cc.map((c, i) => (i ? Math.max(i, Math.min(c - cc[0], unpin)) : 0))
    for (const ov of reduced ? frames : [stage]) {
      const w = ov.bd.clientWidth, h = ov.bd.clientHeight
      if (!w || !h) continue
      const A = anchorPx(w, h)
      geo.set(ov, { w, h, A })
    }
    lastPaint = -1
  }

  function target() {
    if (fixedT != null) return fixedT
    const s = window.scrollY
    if (s <= stops[0]) return 0
    for (let i = 0; i < 2; i++) if (s < stops[i + 1]) return i + (s - stops[i]) / Math.max(1, stops[i + 1] - stops[i])
    return 2
  }

  function paint(ov, t, watch = 1) {
    const g = geo.get(ov)
    if (!g) return
    const c = course(g.w, g.h, g.A, straightness(t))
    if (ov.ideal.dataset.k !== g.w + 'x' + g.h) { ov.ideal.setAttribute('d', c.ideal); ov.ideal.dataset.k = g.w + 'x' + g.h }
    ov.course.setAttribute('d', c.actual)
    // astronaut: flies in along the course during the burn chapter, parks at the burn point
    const uEnd = 1 - 64 / c.L1 // parks just behind the burn point so the gold star stays visible
    const f0 = g.w < MOBILE_BP ? 0.8 : 0.4 // where the astronaut waits on the first screen (phones: further in, clear of the edge)
    const p = c.leg1(uEnd * (f0 + (1 - f0) * ease((t - 0.2) / 0.75)))
    // phones: astronaut and course line sit back while the copy is being read, full in the watch state; ring, label and tag only in watch
    const dim = mob && !reduced
    ov.mark.style.opacity = dim ? (0.3 + 0.7 * watch).toFixed(3) : '1' // present from the first screen
    ov.svg.style.opacity = dim ? (0.25 + 0.75 * watch).toFixed(3) : '1'
    ov.mark.style.transform = `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,0)`
    ov.label.style.opacity = (win(t, 0.8, 1.05) * (1 - win(t, 1.45, 1.7)) * watch).toFixed(3)
    const G = goldPx(g.w, g.h, t)
    const lw = ov.label.offsetWidth || 220
    const lx = Math.max(12, Math.min(G.x + 28, g.w - 12 - lw))
    ov.label.style.transform = `translate3d(${lx.toFixed(1)}px,${(G.y + 22).toFixed(1)}px,0)`
    ov.dot.style.opacity = (win(t, 0.6, 0.95) * (dim ? 0.3 + 0.7 * watch : 1)).toFixed(3) // shown only when WebGL is off (CSS)
    ov.dot.style.transform = `translate3d(${G.x.toFixed(1)}px,${G.y.toFixed(1)}px,0)`
    // target ring: marks the star the astronaut is flying to, follows it as it shifts, lets go once the edit is handed over
    ov.aim.style.opacity = ((1 - win(t, 1.15, 1.45)) * watch).toFixed(3)
    ov.aim.style.transform = `translate3d(${G.x.toFixed(1)}px,${G.y.toFixed(1)}px,0)`
    // adapter tag: leaves the astronaut in chapter 3 and comes to rest toward the copy
    const H = handoff(g.w, g.h, g.A), e = ease((t - 1.2) / 0.7)
    const tx = g.A.x + (H.x - g.A.x) * e, ty = g.A.y + (H.y - g.A.y) * e - Math.sin(Math.PI * e) * 22
    ov.tag.style.opacity = (win(t, 1.1, 1.35) * watch).toFixed(3)
    ov.tag.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`
  }

  function paintAll(t) {
    const read = mob && !reduced ? readOf(t) : 0
    if (reduced) frames.forEach((f, i) => paint(f, i))
    else paint(stage, t, 1 - read)
    // One focus value drives both: --o is the copy's opacity, --read dims and softens the scene (phones only; CSS and scene.js apply it).
    // Phones: every chapter's copy is on screen only near its own t. Desktop: the outgoing Drift note gives way once scrolled past.
    if (!reduced) {
      chapters.forEach((c, i) => {
        const o = mob ? chapterRead(t, i) : i < 2 ? 1 - win(t, i + 0.55, i + 0.95) : 1
        c.style.setProperty('--o', o.toFixed(3)); c.classList.toggle('is-gone', o < 0.05)
      })
      pin.style.setProperty('--read', read.toFixed(3))
    }
    if (fill) fill.style.transform = `scaleX(${(t / 2).toFixed(3)})`
    const a = Math.round(t)
    if (a !== lastActive) {
      links.forEach((l, i) => (i === a ? l.setAttribute('aria-current', 'step') : l.removeAttribute('aria-current')))
      lastActive = a
    }
    lastPaint = t
  }

  function frame(now) {
    raf = 0
    if (dead || !visible || document.hidden) return
    const dt = Math.min(0.1, (now - (last || now)) / 1000)
    last = now
    clock += dt
    const tg = target()
    ts = fixedT != null ? fixedT : Math.abs(tg - ts) < 0.0004 ? tg : ts + (tg - ts) * (1 - Math.exp(-dt * 10))
    if (ts !== lastPaint) paintAll(ts)
    scene?.render(ts, clock, mob && !reduced ? readOf(ts) : 0)
    raf = requestAnimationFrame(frame)
  }
  const kick = () => { if (!raf && !dead && visible && !document.hidden && !reduced) { last = 0; raf = requestAnimationFrame(frame) } }

  // ---- lazy scene (after first paint) ----
  function loadScene() {
    if (dead) return
    import('./scene.js').then((m) => {
      if (dead) return
      const fail = () => { onGL('off'); scene?.dispose?.(); scene = null }
      if (reduced) {
        const s = m.mountScene(null, { reduced, onFail: fail })
        if (!s) return
        frames.forEach((f, i) => {
          const g = geo.get(f)
          if (!g) return
          const c = s.still(i, g.w, g.h)
          f.bd.querySelector('.gl').appendChild(c)
        })
        s.dispose()
        onGL('on')
      } else {
        scene = m.mountScene(stage.bd.querySelector('.gl'), { reduced, onFail: fail })
        if (!scene) return
        scene.setView(geo.get(stage).w, geo.get(stage).h)
        onGL('on')
        kick()
      }
    }).catch(() => onGL('off'))
  }

  const ro = new ResizeObserver(() => { measure(); if (scene && geo.get(stage)) scene.setView(geo.get(stage).w, geo.get(stage).h); paintAll(clamp(ts, 0, 2)); kick() })
  ro.observe(root); ro.observe(pin)
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick() })
  io.observe(root)
  const onVis = () => kick()
  document.addEventListener('visibilitychange', onVis)
  document.fonts?.ready.then(() => { measure(); paintAll(clamp(ts, 0, 2)) })

  measure()
  paintAll(reduced ? 0 : clamp(ts, 0, 2))
  kick()
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200))
  const id = idle(loadScene, { timeout: 1500 })

  return () => {
    dead = true
    cancelAnimationFrame(raf)
    window.cancelIdleCallback?.(id)
    ro.disconnect(); io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    scene?.dispose?.()
  }
}
