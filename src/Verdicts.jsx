// /results/: one row per gate run. Each `verdict` object is a library verdict.json as written
// (astro_weights.eval.verdict.Verdict, schema_version 1); `name` and `base` sit beside it because
// verdict.json does not name the edit. vite.config.js checks every record against the schema at build.
// The record carries no accuracy or token numbers; the page shows only what it holds.
import data from './results.json'

const DOCS_VERDICTS = 'https://astro-weights.dev/docs/explanation/gate-verdicts/'
export const isResults = () => location.pathname.startsWith('/results')

export function Verdicts() {
  const runs = data.runs
  const count = (v) => runs.filter((r) => r.verdict.verdict === v).length
  return (
    <main className="hub">
      <div className="wrap adp">
        <h1 className="adp-h1">Gate results</h1>
        {data.placeholder && <p className="res-ph" role="note">PLACEHOLDER DATA: example runs, not real results.</p>}
        <dl className="res-sum">
          {['confirmed', 'not significant', 'regressed'].map((v) => (
            <div key={v}><dt>{v}</dt><dd>{count(v)}</dd></div>
          ))}
        </dl>
        <ul className="res-list">
          {runs.map(({ name, base, verdict: v }) => (
            <li key={name} className="res-card">
              <h2>{name}</h2>
              <span className={'res-v res-v--' + v.verdict.replace(' ', '-')}>{v.verdict}</span>
              <dl className="res-facts">
                <div><dt>Base</dt><dd>{base}</dd></div>
                <div><dt>Backend</dt><dd>{v.backend} {v.build}</dd></div>
                <div><dt>Candidates</dt><dd>{v.candidates_tried}</dd></div>
                <div><dt>Confirm queries</dt><dd>{v.confirm_queries}</dd></div>
                <div><dt>Infra errors</dt><dd>{v.infra_errors}</dd></div>
              </dl>
              <details className="res-rec">
                <summary>Record</summary>
                <dl>
                  <div><dt>config_hash</dt><dd>{v.config_hash}</dd></div>
                  <div><dt>split_manifest_sha256</dt><dd>{v.split_manifest_sha256}</dd></div>
                  {Object.entries(v.footprint).map(([k, x]) => <div key={k}><dt>footprint.{k}</dt><dd>{x}</dd></div>)}
                </dl>
              </details>
            </li>
          ))}
        </ul>
        <p className="adp-note">Every verdict other than confirmed means: keep the original weights. <a href={DOCS_VERDICTS}>How the gate decides</a></p>
      </div>
    </main>
  )
}
