import { useEffect, useRef, useState } from 'react'
import logo from '/shared/logo.svg'
import { initStory } from './story.js'

const DOCS = 'https://astro-weights.dev/docs/'
const GITHUB = 'https://github.com/astro-weights/astro-weights'
const PYPI = 'https://pypi.org/project/astro-weights/'
const CHANGELOG = 'https://github.com/astro-weights/astro-weights/blob/main/CHANGELOG.md'
const LAYER = 'model.layers.1.mlp.down_proj'

const AREAS = [
  ['Edit core', 'Build low-rank edits, save and load them as PEFT LoRA adapters, apply them to transformers models, remove them again. Base weights are never modified.'],
  ['Export', 'llama.cpp GGUF adapter and a model card.'],
  ['Directions', 'Difference-of-means directions with a split-half gate.'],
  ['Eval', 'A runner with graders, and paired eval statistics: base vs edit on the same items.'],
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
                <a className="btn btn--ghost" href={GITHUB}>GitHub</a>
              </div>
              <div className="enter" style={{ '--d': '320ms' }}><CopyInstall /></div>
            </div>
            <aside className="note enter" style={{ '--d': '460ms' }}>
              <h2><Head>Drift</Head></h2>
              <p>A model drifts off course: too wordy, stuck in a loop.</p>
            </aside>
          </div>
        </section>

        <section className="chapter chapter--burn" id="burn" aria-labelledby="h-burn">
          <Backdrop className="frame" />
          <div className="chapter__in">
            <div className="copy-col">
              <h2 id="h-burn"><Head>Burn</Head></h2>
              <p className="big">astro-weights makes a small burn on the weights.</p>
            </div>
          </div>
        </section>

        <section className="chapter chapter--fix" id="correction" aria-labelledby="h-fix">
          <Backdrop className="frame" />
          <div className="chapter__in">
            <div className="copy-col">
              <h2 id="h-fix"><Head>Correction</Head></h2>
              <p className="big">astro-weights hands you the correction as a LoRA adapter.</p>
              <CopyInstall />
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

// Today + Quick look + Why LoRA in one dense section (compact round): head line, areas row, code beside the Why LoRA card.
function More() {
  return (
    <section className="sec more" id="today" aria-labelledby="h-today">
      <div className="wrap more__in">
        <div className="more__head">
          <h2 id="h-today">What it does today</h2>
          <p className="ver">0.1.0</p>
          <p className="cli"><span>CLI</span> <code>astro-weights inspect &lt;adapter&gt;</code></p>
        </div>
        <ul className="areas">
          {AREAS.map(([name, text]) => (
            <li key={name}>
              <h3>{name}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <section className="quick" id="quick" aria-labelledby="h-quick">
          <h2 id="h-quick">Quick look</h2>
          <pre className="code" tabIndex={0} aria-label="Quick look: Python example"><code><Code /></code></pre>
        </section>
        <section className="whycard" id="why" aria-labelledby="h-why">
          <h2 id="h-why">Why LoRA</h2>
          <div className="why">
            <p>Every serving stack already loads it: transformers, PEFT, vLLM, llama.cpp.</p>
            <p>No custom runtime.</p>
            <p>Drop the adapter to get the base model back.</p>
          </div>
        </section>
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
          <a className="word" href="#drift">astro-weights</a>
        </div>
        <nav aria-label="Footer">
          <a href={DOCS}>Docs</a>
          <a href={GITHUB}>GitHub</a>
          <a href={PYPI}>PyPI</a>
          <a href={CHANGELOG}>Changelog</a>
        </nav>
        <p className="foot__status">Pre-alpha. 0.1.0 on PyPI. API changes without notice until 1.0.</p>
        <p className="foot__legal">Apache-2.0. Logo based on Noto Emoji, Copyright Google LLC, Apache-2.0. <a href="#__consent">Cookie settings</a> · <a href="/privacy/">Privacy</a></p>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <header className="top">
        <a className="word" href="#drift">astro-weights</a>
        <nav aria-label="Main">
          <a className="nav-x" href={DOCS}>Docs</a>
          <a href={GITHUB}>GitHub</a>
          <a className="nav-x" href={PYPI}>PyPI</a>
        </nav>
      </header>
      <main>
      <Story />
      <More />
      </main>
      <Footer />
      <Consent />
    </>
  )
}
