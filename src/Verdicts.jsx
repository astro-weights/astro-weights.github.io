// /results/: one row per gate run. Each `verdict` object is a library verdict.json as written
// (astro_weights.eval.verdict.Verdict, schema_version 1); `name` and `base` sit beside it because
// verdict.json does not name the edit. `gate` is gate.json as written (`astro-weights gate --json`);
// a screened-out run has only `gate`. vite.config.js checks records at build.
// ponytail: only gate.outcome and counts shown; its margins and arms wait on a user call.
import data from './results.json'

// cap_hit (verdict.json, optional): share of records cut at max_new_tokens, per split; test when scored, else confirm.
const pc = (x) => (x * 100).toFixed(1) + '%'
const capRow = (v) => { const s = v.cap_hit?.test ?? v.cap_hit?.confirm; return s && 'base' in s && 'edit' in s ? `base ${pc(s.base)} · edit ${pc(s.edit)} (${v.cap_hit.test ? 'test' : 'confirm'})` : null }

// The gate ships in 0.3. Until that tag is on PyPI (__AW_VERSION__ = newest release tag), say so and link the dev docs.
export const GATE_RELEASED = !/^0\.[0-2]\./.test(__AW_VERSION__)
const DOCS_VERDICTS = `https://astro-weights.dev/docs/${GATE_RELEASED ? '' : 'dev/'}explanation/gate-verdicts/`
export const isResults = () => location.pathname.startsWith('/results')

export function Verdicts() {
  const runs = data.runs
  const outcome = (r) => r.verdict?.verdict ?? r.gate.outcome
  const count = (v) => runs.filter((r) => outcome(r) === v).length
  return (
    <main className="hub">
      <div className="wrap adp">
        <h1 className="adp-h1">Gate results</h1>
        {!runs.length ? <p className="res-ph">No gate runs published yet.</p> : (<>
        <dl className="res-sum">
          {['confirmed', 'screened out', 'not significant', 'regressed'].map((v) => (
            <div key={v}><dt>{v}</dt><dd>{count(v)}</dd></div>
          ))}
        </dl>
        <ul className="res-list">
          {runs.map((r) => { const { name, base, verdict: v, gate: g } = r; return (
            <li key={name} className="res-card">
              <h2>{name}</h2>
              <span className={'res-v res-v--' + outcome(r).replace(' ', '-')}>{outcome(r)}</span>
              {!v ? (
                <dl className="res-facts">
                  <div><dt>Base</dt><dd>{base}</dd></div>
                  <div><dt>Candidates</dt><dd>{g.candidates_tried}</dd></div>
                  <div><dt>Confirm queries</dt><dd>{g.confirm_queries}</dd></div>
                </dl>
              ) : (<>
              <dl className="res-facts">
                <div><dt>Base</dt><dd>{base}</dd></div>
                <div><dt>Backend</dt><dd>{v.backend} {v.build}</dd></div>
                <div><dt>Candidates</dt><dd>{v.candidates_tried}</dd></div>
                <div><dt>Confirm queries</dt><dd>{v.confirm_queries}</dd></div>
                <div><dt>Infra errors</dt><dd>{v.infra_errors}</dd></div>
                {capRow(v) && <div><dt>Cap-hit{v.max_new_tokens != null ? ` at ${v.max_new_tokens}` : ''}</dt><dd>{capRow(v)}</dd></div>}
              </dl>
              <details className="res-rec">
                <summary>Record</summary>
                <dl>
                  <div><dt>config_hash</dt><dd>{v.config_hash}</dd></div>
                  <div><dt>split_manifest_sha256</dt><dd>{v.split_manifest_sha256}</dd></div>
                  {Object.entries(v.footprint).map(([k, x]) => <div key={k}><dt>footprint.{k}</dt><dd>{x}</dd></div>)}
                </dl>
              </details>
              </>)}
            </li>
          )})}
        </ul>
        </>)}
        <p className="adp-note">Every verdict other than confirmed means: keep the original weights. <a href={DOCS_VERDICTS}>How the gate decides</a></p>
      </div>
    </main>
  )
}
