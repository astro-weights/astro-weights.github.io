// Pretrained adapters: landing block (tabs, token change, run snippet) and the /adapters/ hub.
// Data: src/adapters.json, copied from each adapter's public Hugging Face card. Add an adapter there; vite.config.js
// writes its page at /adapters/<slug>/. Minimal text by user order 2026-11-18: name, number, command, links.
import { useId, useRef, useState } from 'react'
import data from './adapters.json'

const ADAPTERS = data.adapters
const page = (a) => `/adapters/${a.slug}/`
const HF = (repo) => 'https://huggingface.co/' + repo
const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%'
const pp = (v) => (v > 0 ? '+' : v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + ' pp'
const ci = (e) => (e.ci ? `[${pp(e.ci[0]).replace(' pp', '')}, ${pp(e.ci[1]).replace(' pp', '')}]` : e.se != null ? `SE ${e.se}` : '')

export const isHub = () => location.pathname.startsWith('/adapters')

// roving tabindex shared by both tablists: arrows, Home, End move focus and selection; nothing auto-advances
function useTabKeys(n, i, setI) {
  const refs = useRef([])
  const onKeyDown = (e) => {
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault(); setI(to); refs.current[to]?.focus()
  }
  return [(el, k) => (refs.current[k] = el), onKeyDown]
}

function Code({ a }) {
  const id = useId()
  const [i, setI] = useState(0)
  const [done, setDone] = useState(false)
  const [ref, onKeyDown] = useTabKeys(a.use.length, i, setI)
  const copy = async () => {
    try { await navigator.clipboard.writeText(a.use[i].code) } catch { /* clipboard unavailable: the text stays selectable */ }
    setDone(true); setTimeout(() => setDone(false), 1800)
  }
  return (
    <div className="adp-code">
      <div className="adp-code__bar">
        <div role="tablist" aria-label="Load with" onKeyDown={onKeyDown}>
          {a.use.map((x, k) => (
            <button key={x.label} type="button" role="tab" id={`${id}t${k}`} aria-selected={k === i} aria-controls={`${id}p`} tabIndex={k === i ? 0 : -1} ref={(el) => ref(el, k)} onClick={() => setI(k)}>{x.label}</button>
          ))}
        </div>
        <button type="button" className="copy" onClick={copy} aria-label={`Copy ${a.use[i].label} command`}>{done ? 'Copied' : 'Copy'}</button>
      </div>
      <div role="tabpanel" id={`${id}p`} aria-labelledby={`${id}t${i}`}>
        <pre className="code" tabIndex={0}><code>{a.use[i].code}</code></pre>
      </div>
      <span className="sr" role="status">{done ? 'Command copied' : ''}</span>
    </div>
  )
}

function Panel({ a, hub }) {
  const h = a.headline
  const Name = hub ? 'h2' : 'p'
  return (
    <div className="adp-pw">
      <Name className="adp-pname">{a.name}</Name>
      <div className="adp-panel">
        <dl className="adp-stats">
          <dt>Token change</dt>
          <dd><b>{pct(h.tokens)}</b><span>{h.bench}, n {h.n}</span></dd>
        </dl>
        <div className="adp-get">
          <Code key={a.slug} a={a} />
          <p className="adp-links">
            <a href={HF(a.repo)}>View on Hugging Face</a>
            {!hub && <a href={page(a)}>Full evals and details</a>}
          </p>
        </div>
      </div>
    </div>
  )
}

// Landing: first 4 adapters as tabs (no scrolling strip), the rest on the hub
export function AdaptersBlock() {
  const id = useId()
  const shown = ADAPTERS.slice(0, 4)
  const [i, setI] = useState(0)
  const [ref, onKeyDown] = useTabKeys(shown.length, i, setI)
  return (
    <section className="sec adp-sec" id="adapters" aria-labelledby="h-adp">
      <div className="wrap adp">
        <h2 id="h-adp" className="adp-label">Pretrained adapters</h2>
        {/* DRAFT claim line (Marketing) */}
        <p className="adp-lead">Pick an adapter, <mark>copy the command</mark>.</p>
        <div className="adp-tabrow">
          <div role="tablist" aria-label="Adapters" className="adp-tabs" onKeyDown={onKeyDown}>
            {shown.map((a, k) => (
              <button key={a.slug} type="button" role="tab" id={`${id}t${k}`} aria-selected={k === i} aria-controls={`${id}p`} tabIndex={k === i ? 0 : -1} ref={(el) => ref(el, k)} onClick={() => setI(k)}>{a.name}</button>
            ))}
          </div>
          <a className="adp-all" href="/adapters/">Browse all adapters</a>
        </div>
        <div role="tabpanel" id={`${id}p`} aria-labelledby={`${id}t${i}`}><Panel a={shown[i]} /></div>
      </div>
    </section>
  )
}

const Table = ({ a }) => (
  <div className="adp-tablewrap" role="region" aria-label={`${a.name} evaluations, scrolls sideways`} tabIndex={0}>
    <table className="adp-table">
      <caption className="sr">Paired evaluations against the unedited base model</caption>
      <thead><tr><th scope="col">Benchmark</th><th scope="col">Mode</th><th scope="col">n</th><th scope="col">Accuracy change</th><th scope="col">95% interval (or SE)</th><th scope="col">Token change</th></tr></thead>
      <tbody>
        {a.evals.map((e) => (
          <tr key={e.mode + e.bench}>
            <th scope="row">{e.bench}</th><td>{e.mode}</td><td>{e.n}</td><td>{pp(e.acc)}</td><td>{ci(e)}</td><td>{pct(e.tokens)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// /adapters/ shows the first adapter, /adapters/<slug>/ that one. Real links, so every adapter has its own URL.
export function Hub() {
  const slug = location.pathname.split('/').filter(Boolean)[1]
  const cur = ADAPTERS.find((a) => a.slug === slug) || ADAPTERS[0]
  const groups = Object.entries(ADAPTERS.reduce((m, a) => ((m[a.family] ||= []).push(a), m), {}))
  return (
    <main className="hub">
      <div className="wrap adp">
        <h1 className="adp-h1">Pretrained adapters</h1>
        <div className="adp-hub">
          <label className="adp-pick">Adapter
            <select value={cur.slug} onChange={(e) => location.assign(`/adapters/${e.target.value}/`)}>
              {groups.map(([fam, list]) => <optgroup key={fam} label={fam}>{list.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}</optgroup>)}
            </select>
          </label>
          <nav className="adp-rail" aria-label="Adapters">
            {groups.map(([fam, list]) => (
              <section key={fam}>
                <h2>{fam}</h2>
                <ul>
                  {list.map((a) => (
                    <li key={a.slug}>
                      <a href={page(a)} aria-current={a.slug === cur.slug ? 'page' : undefined}>
                        <span className="adp-rail__name">{a.name}</span>
                        <span className="adp-rail__tok">{pct(a.headline.tokens)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="adp-main">
            <Panel a={cur} hub />
            <section className="adp-evals" aria-labelledby="h-evals">
              <h3 id="h-evals">All evals</h3>
              <Table a={cur} />
              <p className="adp-note">{cur.evalNote}</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
