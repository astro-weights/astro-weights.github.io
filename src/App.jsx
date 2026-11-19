import { useEffect, useId, useRef, useState } from 'react'
import logo from '/shared/logo.svg'
import { initStory } from './story.js'
import Counter from './rb/Counter.jsx'
import DecryptedText from './rb/DecryptedText.jsx'
import { AdaptersBlock, Hub, isHub } from './Adapters.jsx'

const DOCS = 'https://astro-weights.dev/docs/'
const GITHUB = 'https://github.com/astro-weights/astro-weights'
const PYPI = 'https://pypi.org/project/astro-weights/'
const CHANGELOG = 'https://github.com/astro-weights/astro-weights/blob/main/CHANGELOG.md'
const BLOG = 'https://astro-weights.dev/blog/'

// Results: carousel of two slides (27B, 9B), each headline + streaming demo. Pair = MATH-500 item math500-289 from the 27B run in the headline (full 500, greedy,
// cap 4096, commit e4bca76), picked by Research's fixed rule (both correct, short problem, cut nearest median of all 500;
// vault Brand/Landing claim wording 0.1, "Mock 4 item pair"). Answer texts verbatim in
// src/demo9.json, loaded by dynamic import near view (kept out of the first-paint bundle). Problem, counts and outcomes inline:
// they are the end state for reduced motion, screen readers and before the data loads. Runs while in view; Pause / Play / Replay.
const tok = (v) => v.toLocaleString('en-US')
const CAP = 4096 // token cap of the run
const TPS = 100 // tokens per second, same for both columns: base (1,138 tokens) runs about 11 s
// Problem shown without LaTeX markup, same math. Source text: "Let $a,$ $b,$ $c,$ $d$ be positive real numbers.  Find the
// minimum value of \[(a + b + c + d) \left( \frac{1}{a} + \frac{1}{b} + \frac{1}{c} + \frac{1}{d} \right).\]"
const PROBLEM = 'Let a, b, c, d be positive real numbers. Find the minimum value of (a + b + c + d)(1/a + 1/b + 1/c + 1/d).'
const DEMO = [['Base model', 'base', 1138, 'Finished in 1,138 tokens, correct'], ['With adapter', 'edit', 800, 'Finished in 800 tokens, correct']]
// Slides: 27B (headline run) and 9B. 9B pair = MATH-500 item math500-120 from an earlier Qwen3.5-9B run, picked for a large
// saving, NOT typical; nothing on the slide says so (user order 2026-11-17, risk accepted). 9B line = claims sheet C6 (held-out,
// n=244), without C6's CI or the C9 GSM8K loss (user order). Wording: vault Brand/Landing claim wording 0.1, "Carousel 9B slide".
// Order + set = user order 2026-11-17. BigCodeBench pair = Research "largest cut among problems both solved" (BigCodeBench/595, typical
// cut 9%); user ordered the bars, source note and "largest cut" caption off the slide, so nothing on it says the pair is not typical.
const SLIDES = [
  {
    tab: '9B · MATH-500',
    lead: <>9B adapter: about <mark>10%</mark> fewer tokens on <span className="nb">held-out</span> <span className="nb">MATH-500</span> (n=244).</>,
    problem: 'Let f(x) be an odd function, and let g(x) be an even function. Is f(f(g(f(g(f(x)))))) even, odd, or neither?\n\nEnter "odd", "even", or "neither".',
    tps: CAP / 20, load: () => import('./demo9b.json'),
    cols: [['Base model', 'base', 4096, 'Hit the cap with no final answer'], ['With adapter', 'edit', 606, 'Finished in 606 tokens, correct']],
  },
  { tab: '27B · MATH-500', lead: <>27B adapter: answer length about <mark>−30%</mark> on <span className="nb">MATH-500</span>. No accuracy change detected.</>, problem: PROBLEM, tps: TPS, load: () => import('./demo9.json'), cols: DEMO },
  {
    tab: '27B · BigCodeBench',
    lead: <>27B adapter on BigCodeBench: about <mark>−15%</mark> tokens. No accuracy change detected.</>,
    problem: "Please provide a self-contained Python script that solves the following problem in a markdown code block:\nGenerates 'n' random integer numbers such that their sum equals 'total', sorts these numbers, and determines the position where a new random number can be inserted to maintain the sorted order. The function uses a retry mechanism to ensure the generated numbers sum up to 'total'.\nThe function should output with:\n    tuple: A tuple containing the sorted numbers as an array and the insertion position for a new number.\nYou should write self-contained code starting with:\n```\nimport random\nimport bisect\nfrom array import array\ndef task_func(n=10, total=100):\n```",
    tps: TPS * 1, load: () => import('./demoBcbMax.json'), limit: 2048,
    cols: [['Base model', 'base', 723, 'Finished in 723 tokens, tests pass'], ['With adapter', 'edit', 442, 'Finished in 442 tokens, tests pass']],
  },
]

// One slide's demo: runs only while on screen (stops and resets when its slide leaves).
function Pair({ s, onDone }) {
  const root = useRef(null)
  const [data, setData] = useState(null)
  const [on, setOn] = useState(false)
  const [ms, setMs] = useState(null) // null = rest (end state)
  const [run, setRun] = useState(false)
  const [open, setOpen] = useState(false) // phone only: answer panels collapsed behind a toggle (CSS hides the toggle on desktop)
  const uid = useId()
  const total = (s.cols[0][2] / s.tps) * 1000
  useEffect(() => {
    // vertical margin only: a slide waiting off to the side does not load its text
    const load = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load.disconnect(); s.load().then((m) => setData(m.default)).catch(() => {}) } }, { rootMargin: '600px 0px' })
    const view = new IntersectionObserver(([e]) => setOn(e.intersectionRatio >= 0.35), { threshold: 0.35 })
    load.observe(root.current); view.observe(root.current)
    return () => { load.disconnect(); view.disconnect() }
  }, [s])
  useEffect(() => {
    if (!on) { setRun(false); setMs(null) } else if (data && !reducedNow()) { setMs(0); setRun(true) }
  }, [on, data])
  useEffect(() => {
    if (!run) return
    const id = setInterval(() => setMs((m) => (m + 50 < total ? m + 50 : null)), 50)
    return () => clearInterval(id)
  }, [run, total])
  useEffect(() => { if (ms == null && run) { setRun(false); onDone?.() } }, [ms]) // run still true here = it reached the end by itself
  const play = () => { if (ms == null) setMs(0); setRun(true) }
  return (
    <div className={'demo' + (open ? ' demo--open' : '')} ref={root}>
      <div className="demo__problem">
        <p className="demo__label">Same problem</p>
        <blockquote>{s.problem}</blockquote>
      </div>
      <div className="demo__cols">
        {s.cols.map(([who, key, end, outcome], i) => {
          const n = ms == null ? end : Math.min(end, Math.floor((ms / 1000) * s.tps))
          const text = data ? data[key] : ''
          return (
            <div className={'demo__col' + (i ? ' demo__col--edit' : '')} key={key}>
              <p className="demo__who">{who}</p>
              <i className="demo__bar"><i style={{ '--w': n / (s.limit || CAP) }} /></i>
              <p className="demo__count demo__count--big"><b>{tok(n)}</b><span>tokens of {tok(s.limit || CAP)} cap</span></p>
              <div className="demo__ans" id={uid + key}>
                <p className="demo__plabel">{who}</p>
                <div className="demo__panel" data-rest={ms == null || !run || undefined} tabIndex={0} role="group" aria-label={who + ' answer'}><pre>{text.slice(0, Math.floor((n * text.length) / end))}</pre></div>
              </div>
              <p className="demo__end" style={{ visibility: n === end ? 'visible' : 'hidden' }}>{outcome}</p>
            </div>
          )
        })}
      </div>
      <div className="demo__foot">
        <button type="button" className="demo__btn" onClick={run ? () => setRun(false) : play}>{run ? 'Pause' : ms == null ? 'Replay' : 'Play'}</button>
        <button type="button" className="demo__tog" aria-expanded={open} aria-controls={s.cols.map(([, k]) => uid + k).join(' ')} onClick={() => setOpen(!open)}>{open ? 'Hide answers' : 'Show answers'}</button>
      </div>
    </div>
  )
}

const Face = ({ s, onDone }) => (
  <>
    <p className="results__lead">{s.lead}</p>
    <Pair s={s} onDone={onDone} />
  </>
)

// Native scroll-snap track, no auto-advance; controls above, track takes the height of the slide on screen.
function Carousel() {
  const track = useRef(null)
  const [i, setI] = useState(0)
  const n = SLIDES.length
  // auto-advance: next slide a few seconds after the demo ends (or after a read of a bars slide); only while on screen,
  // never under reduced motion, and off for good once the visitor touches, clicks, keys or focuses anything in the carousel
  const root = useRef(null)
  const [auto, setAuto] = useState(() => !reducedNow())
  const [seen, setSeen] = useState(false)
  const [done, setDone] = useState(-1)
  useEffect(() => { const io = new IntersectionObserver(([e]) => setSeen(e.intersectionRatio >= 0.35), { threshold: 0.35 }); io.observe(root.current); return () => io.disconnect() }, [])
  useEffect(() => {
    if (!auto || !seen || n < 2) return
    const pair = !!SLIDES[i].cols
    if (pair && done !== i) return
    const id = setTimeout(() => { setDone(-1); go((i + 1) % n) }, pair ? 4000 : 9000)
    return () => clearTimeout(id)
  }, [auto, seen, i, done])
  const stop = () => setAuto(false)
  const onScroll = () => { const t = track.current, max = t.scrollWidth - t.clientWidth; setI(max > 0 ? Math.round((t.scrollLeft / max) * (n - 1)) : 0) }
  const go = (k) => track.current.scrollTo({ left: track.current.children[k].offsetLeft, behavior: reducedNow() ? 'auto' : 'smooth' })
  // track takes the height of the slide on screen, so a short card leaves no blank tail (not when both cards show side by side)
  useEffect(() => {
    const fit = () => { const t = track.current; t.style.height = getComputedStyle(t).display === 'flex' ? t.children[i].offsetHeight + 'px' : '' }
    fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit)
    const ro = new ResizeObserver(fit); ro.observe(track.current.children[i]) // answers toggle, text wrap, font load
    return () => { removeEventListener('resize', fit); ro.disconnect() }
  }, [i])
  const name = (k) => `Slide ${k + 1} of ${n}: ${SLIDES[k].tab}`
  return (
    <div className="car" ref={root} onPointerDown={stop} onKeyDown={stop} onWheel={(e) => Math.abs(e.deltaX) > Math.abs(e.deltaY) && stop()} role="group" aria-roledescription="carousel" aria-label="Highlighted results">
      <div className="car__nav">
        {SLIDES.map((s, k) => <button type="button" className="car__tab" key={s.tab} aria-label={name(k)} aria-current={k === i || undefined} onClick={() => go(k)}>{s.tab}</button>)}
        <p className="car__at sr" aria-live={auto ? 'off' : 'polite'}>{i + 1} of {n}</p>
      </div>
      <div className="car__track" ref={track} onScroll={onScroll}>
        {SLIDES.map((s, k) => <article className="car__slide" key={s.tab} role="group" aria-roledescription="slide" aria-label={name(k)}><Face s={s} onDone={() => setDone(k)} /></article>)}
      </div>
    </div>
  )
}

function Results() {
  return (
    <section className="sec results" id="results" aria-labelledby="h-results">
      <div className="wrap">
        <h2 id="h-results"><Head>Results</Head></h2>
        <Carousel />
      </div>
    </section>
  )
}
const LAYER = 'model.layers.1.mlp.down_proj'

const AREAS = [
  ['Edit core', 'Build low-rank edits, save and load them as PEFT LoRA adapters, apply them to transformers models, remove them again. Base weights are never modified.'],
  ['Export', 'llama.cpp GGUF adapter, a merged GGUF from a base GGUF, and a model card.'],
  ['Directions', 'Difference-of-means directions with a split-half gate.'],
  ['Eval', 'A runner with graders, and paired eval statistics: base vs edit on the same items.'],
  ['Agent', <>An MCP server gives an agent a sandboxed numpy kernel and forward passes on base or edited weights, inside a budget. <code>astro-weights run CONFIG.toml</code> drives a whole run and exports the adapter.</>],
]

const CODE = `import numpy as np
from astro_weights.edits import Edit, masked_rank1
from astro_weights.export import save_peft

W0 = np.random.default_rng(0).standard_normal((16, 48), dtype=np.float32)
u = np.eye(16, dtype=np.float32)[0]
mask = np.ones(48, dtype=np.float32)
delta = masked_rank1("model.layers.1.mlp.down_proj", W0, u, mask, alpha=0.5)
save_peft(Edit(deltas=(delta,), base_model="org/name"), "my-edit")`

// Consent banner (Legal spec 2026-11-16): Accept and Reject alike, no close button, nothing loads before Accept.
// Same storage as the docs and blog theme: {"analytics": true} on Accept, {} on Reject. Footer "Cookie settings" reopens it.
const CONSENT = '/.__consent'
const readConsent = () => { try { return JSON.parse(localStorage.getItem(CONSENT)) } catch { return null } }

function Consent() {
  const [open, setOpen] = useState(() => readConsent() == null)
  useEffect(() => {
    const onHash = () => { if (location.hash === '#__consent') setOpen(true) }
    onHash()
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  if (!open) return null
  const choose = (yes) => {
    const before = readConsent()?.analytics
    try { localStorage.setItem(CONSENT, JSON.stringify(yes ? { analytics: true } : {})) } catch { /* storage blocked: ask again next visit */ }
    if (location.hash === '#__consent') history.replaceState(null, '', location.pathname + location.search)
    if (before && !yes) return location.reload() // withdrawn: reload so the tag already on this page is gone
    if (yes) window.awAnalytics?.()
    setOpen(false)
  }
  return (
    <section className="consent" aria-labelledby="h-consent">
      <h2 id="h-consent">Cookies on astro-weights.dev</h2>
      <p>We'd like to use Google Analytics, loaded through Google Tag Manager, to count page views and see which pages help people. It sets cookies and sends details of your visit to Google. Nothing loads unless you accept. <a href="/privacy/">Privacy</a></p>
      <div className="consent__btns">
        <button type="button" className="btn btn--primary" onClick={() => choose(true)}>Accept</button>
        <button type="button" className="btn btn--primary" onClick={() => choose(false)}>Reject</button>
      </div>
    </section>
  )
}

const reducedNow = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function Code() {
  const re = /("[^"]*")|\b(import|from|as)\b|\b(\d+(?:\.\d+)?)\b/g
  return CODE.split('\n').map((line, i) => {
    const out = []
    let at = 0, m
    re.lastIndex = 0
    while ((m = re.exec(line))) {
      if (m.index > at) out.push(line.slice(at, m.index))
      out.push(<span key={m.index} className={m[1] ? 'tk-s' : m[2] ? 'tk-k' : 'tk-n'}>{m[0]}</span>)
      at = m.index + m[0].length
    }
    out.push(line.slice(at))
    return <span key={i} className={'ln' + (line.startsWith('delta') ? ' ln--hl' : '')}>{out}{'\n'}</span>
  })
}

function CopyInstall() {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText('pip install astro-weights') } catch { /* clipboard unavailable: the text stays selectable */ }
    setDone(true)
    setTimeout(() => setDone(false), 1800)
  }
  return (
    <div className="install">
      <code>pip install astro-weights</code>
      <button type="button" className="copy" onClick={copy} aria-label="Copy install command">{done ? 'Copied' : 'Copy'}</button>
      <span className="sr" role="status">{done ? 'Install command copied' : ''}</span>
    </div>
  )
}

const Head = ({ children }) => <span className="head">{children}</span>
// Chapter word resolves once when it comes into view (React Bits DecryptedText; reduced motion shows the word as is)
const Word = ({ children }) => <Head><DecryptedText text={children} animateOn="view" sequential speed={45} characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" /></Head>

// Backdrop = poster stars + GL host + overlay (course line, astronaut, adapter tag). One in the sticky stage, one per chapter for reduced motion.
function Backdrop({ className }) {
  return (
    <div className={'bd ' + className} aria-hidden="true">
      <div className="poster" />
      <div className="gl" />
      <svg className="ov" width="100%" height="100%">
        <path className="ideal" />
        <path className="course" />
      </svg>
      <span className="gold-dot" />
      <span className="aim" />
      <div className="mark">
        <span className="mark__ring" />
        <img src={logo} width="48" height="48" alt="" />
      </div>
      <div className="label"><b>{LAYER}</b><i>rank-1</i></div>
      <div className="tag"><b>my-edit</b><i>LoRA adapter</i></div>
    </div>
  )
}

function Story() {
  const root = useRef(null)
  const [gl, setGl] = useState('wait')
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const t = q.has('t') ? Number(q.get('t')) : null // review aid: freeze story time
    return initStory(root.current, { reduced: reducedNow(), fixedT: t, onGL: setGl })
  }, [])
  return (
    <section className="story" ref={root} data-gl={gl}>
      <div className="pin">
        <Backdrop className="stage" />
        <nav className="rail" aria-label="Story">
          <a href="#drift">Drift</a>
          <a href="#burn">Burn</a>
          <a href="#correction">Correction</a>
          <span className="rail__bar" aria-hidden="true"><span className="rail__fill" /></span>
        </nav>
      </div>

      <div className="chapters">
        <section className="chapter chapter--drift" id="drift" aria-labelledby="h1">
          <Backdrop className="frame" />
          <div className="chapter__in">
            <div className="copy-col">
              <h1 id="h1" className="enter" style={{ '--d': '0ms' }}>Small course corrections for open LLMs.</h1>
              <p className="lede enter" style={{ '--d': '120ms' }}>Agent-driven weight edits. Democratizing AI for all.</p>
              <div className="actions enter" style={{ '--d': '220ms' }}>
                <a className="btn btn--primary" href={DOCS + 'tutorials/first-edit/'}>Read the docs</a>
              </div>
              <div className="enter" style={{ '--d': '320ms' }}><CopyInstall /></div>
              <div className="hero-band" aria-hidden="true" />
              {/* Readout: one hard fact on the first screen; wording from the approved 27B Results headline (DRAFT labels, Marketing) */}
<div className="readout enter" style={{ '--d': '420ms' }}>
                <p className="readout__scope">27B adapter · <span className="nb">MATH-500</span></p>
                <dl>
                  <div><dt>Answer length</dt><dd><a href="#results" aria-label="about minus 30 percent, see results">≈<Counter value={30} prefix="−" suffix="%" motionBlur={false} fontSize="1em" fontWeight={600} duration={1.1} stagger={0.12} /></a></dd></div>
                  <div><dt>Accuracy</dt><dd>No change detected</dd></div>
                  <div><dt>Ships as</dt><dd>LoRA adapter</dd></div>
                </dl>
                </div>
            </div>
            <aside className="note enter" style={{ '--d': '460ms' }}>
              <h2><Word>Drift</Word></h2>
              <p>A model drifts off course: too wordy, stuck in a loop.</p>
            </aside>
          </div>
        </section>

        <section className="chapter chapter--burn" id="burn" aria-labelledby="h-burn">
          <Backdrop className="frame" />
          <div className="chapter__in">
            <div className="copy-col">
              <h2 id="h-burn"><Word>Burn</Word></h2>
              <p className="big">astro-weights makes a small burn on the weights.</p>
            </div>
          </div>
        </section>

        <section className="chapter chapter--fix" id="correction" aria-labelledby="h-fix">
          <Backdrop className="frame" />
          <div className="chapter__in">
            <div className="copy-col">
              <h2 id="h-fix"><Word>Correction</Word></h2>
              <p className="big">astro-weights hands you the correction as a LoRA adapter.</p>
              
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}


// Real output of the Quick look code, then `astro-weights inspect my-edit` (astro-weights 0.1.2, run 2026-11-17; output unchanged in 0.2.0 per Engineering)
const INSPECT = `$ astro-weights inspect my-edit
base model: org/name
rank: 1
modules: 1
module                        out x in        |B|_F     |A|_F    |BA|_F
model.layers.1.mlp.down_proj  16x48               1      3.02      3.02
manifest: ok`

function More() {
  return (
    <section className="sec more" id="today" aria-labelledby="h-today">
      <div className="wrap">
        <h2 id="h-today">What it does today</h2>
        <ol className="steps">
          {AREAS.map(([name, text], k) => (
            <li key={name}>
              <span className="steps__n" aria-hidden="true">{String(k + 1).padStart(2, '0')}</span>
              <h3>{name}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <section className="quick" id="quick" aria-labelledby="h-quick">
          <h3 id="h-quick">Quick look</h3>
          <div className="quick__pair">
            <pre className="code" tabIndex={0} aria-label="Quick look: Python example"><code><Code /></code></pre>
            <pre className="code code--out" tabIndex={0} aria-label="Output: astro-weights inspect"><code>{INSPECT.split('\n').map((l, i) => <span key={i} className={'ln' + (i === 0 ? ' ln--cmd' : l.startsWith('model.') ? ' ln--hl' : '')}>{l}{'\n'}</span>)}</code></pre>
          </div>
          <p className="whyline"><b>Why LoRA.</b> Every serving stack already loads it: transformers, PEFT, vLLM, llama.cpp. No custom runtime. Drop the adapter to get the base model back.</p>
        </section>
      </div>
    </section>
  )
}

// Closing screen. DRAFT heading (Marketing).
function End() {
  return (
    <section className="sec end" aria-labelledby="h-end">
      <div className="poster" aria-hidden="true" />
      <div className="wrap end__in">
        <h2 id="h-end">Make the first edit.</h2>
        <CopyInstall />
        <div className="actions"><a className="btn btn--primary" href={DOCS + 'tutorials/first-edit/'}>Read the docs</a><a className="btn btn--ghost" href={GITHUB}>GitHub</a></div>
        <p className="end__status">Pre-alpha. {__AW_VERSION__} on PyPI. Apache-2.0.</p>
      </div>
    </section>
  )
}


function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot__in">
        <div className="foot__id">
          <img src={logo} width="40" height="40" alt="astro-weights astronaut logo" />
          <a className="word" href={isHub() ? '/' : '#drift'}>astro-weights</a>
          {/* Product Hunt badge, hotlinked for the live upvote count (user choice 2026-11-19). It loads from api.producthunt.com without consent; /privacy/ says so. */}
          <a className="foot__ph" href="https://www.producthunt.com/products/astro-weights?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-astro-weights" target="_blank" rel="noopener noreferrer"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1322337&theme=dark&t=1795128508475" width="250" height="54" loading="lazy" alt="astro-weights on Product Hunt" /></a>
        </div>
        <nav aria-label="Footer">
          <a href={DOCS}>Docs</a>
          <a href="/adapters/">Adapters</a>
          <a href={BLOG}>Blog</a>
          <a href={GITHUB}>GitHub</a>
          <a href={PYPI}>PyPI</a>
          <a href={CHANGELOG}>Changelog</a>
        </nav>
        <p className="foot__status">Pre-alpha. {__AW_VERSION__} on PyPI. API changes without notice until 1.0.</p>
        <p className="foot__legal">Apache-2.0. Logo based on Noto Emoji, Copyright Google LLC, Apache-2.0. <span className="nb"><a href="#__consent">Cookie settings</a> · <a href="/privacy/">Privacy</a></span></p>
      </div>
    </footer>
  )
}

export default function App() {
  const hub = isHub()
  return (
    <>
      <header className={'top' + (hub ? ' top--hub' : '')}>
        <a className="word" href={hub ? '/' : '#drift'}>astro-weights</a>
        <nav aria-label="Main">
          <a className="nav-d" href={DOCS}>Docs</a>
          <a href="/adapters/" aria-current={hub ? (location.pathname === '/adapters/' ? 'page' : 'true') : undefined}>Adapters</a>
          <a className="nav-x" href={BLOG}>Blog</a>
          <a href={GITHUB}>GitHub</a>
          <a className="nav-x" href={PYPI}>PyPI</a>
        </nav>
      </header>
      {hub ? <Hub /> : (
        <main>
          <Story />
          <Results />
          <AdaptersBlock />
          <More />
          <End />
        </main>
      )}
      <Footer />
      <Consent />
    </>
  )
}
