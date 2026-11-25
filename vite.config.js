import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library version shown on the page = newest release tag (v*) of the library repo, i.e. what PyPI serves. main's pyproject
// is not it: releases are cut from release branches, so main can lag (0.1.3 shipped while main said 0.1.2) or lead.
// Falls back to the checkout's pyproject (offline), then "dev" (no checkout).
const LIB = process.env.LIB || 'lib'
let version = 'dev'
try { version = readFileSync(LIB + '/pyproject.toml', 'utf8').match(/^version = "(.+)"$/m)[1] } catch { /* no library checkout */ }
try {
  const tags = execFileSync('git', ['-C', LIB, 'ls-remote', '--tags', '--refs', '--sort=-v:refname', 'origin', 'v[0-9]*'], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] })
  const t = tags.match(/refs\/tags\/v(\d+\.\d+\.\d+)$/m) // first plain x.y.z, so pre-release tags are skipped
  if (t) version = t[1]
} catch { /* offline or no checkout */ }

// /adapters/ and /adapters/<slug>/: copies of the built index.html with their own title, description and canonical URL.
// The app picks the hub view from the path. One adapter in src/adapters.json = one page; no adapters = failed build.
const SITE = 'https://astro-weights.dev'
const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%'
function adapterPages() {
  return {
    name: 'adapter-pages',
    apply: 'build',
    writeBundle({ dir }) {
      const { adapters } = JSON.parse(readFileSync(new URL('./src/adapters.json', import.meta.url), 'utf8'))
      if (!adapters?.length) throw new Error('src/adapters.json lists no adapters')
      const html = readFileSync(dir + '/index.html', 'utf8')
      const write = (path, title, desc, noindex) => {
        const url = SITE + path
        const out = html
          .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*/, (_, p) => p + esc(desc))
          .replace(/(<meta property="og:title" content=")[^"]*/, (_, p) => p + esc(title))
          .replace(/(<meta property="og:description" content=")[^"]*/, (_, p) => p + esc(desc))
          .replace(/(<link rel="canonical" href=")[^"]*/, (_, p) => p + url)
          .replace(/(<meta property="og:url" content=")[^"]*/, (_, p) => p + url)
        // a reworded index.html head would otherwise ship every adapter page with the landing page's canonical URL
        if (!out.includes(`<link rel="canonical" href="${url}">`) || !out.includes(`content="${url}"`) || !out.includes(`<title>${esc(title)}</title>`)) throw new Error('adapter-pages: head tags not rewritten for ' + path)
        mkdirSync(dir + path, { recursive: true })
        writeFileSync(dir + path + 'index.html', noindex ? out.replace('</head>', '<meta name="robots" content="noindex">\n</head>') : out)
      }
      // /results/: draft 0.3 page. A run holds verdict.json (library schema v1), gate.json, or both;
      // "screened out" writes no verdict.json. noindex and out of nav + sitemap until launch (user call), entries or not.
      const res = JSON.parse(readFileSync(new URL('./src/results.json', import.meta.url), 'utf8'))
      const KEYS = ['verdict', 'backend', 'build', 'config_hash', 'split_manifest_sha256', 'candidates_tried', 'confirm_queries', 'infra_errors', 'footprint', 'schema_version', 'max_new_tokens', 'cap_hit']
      const OPTIONAL = ['schema_version', 'max_new_tokens', 'cap_hit'] // last two from library PR 195; absent in older verdicts
      const share = (x) => typeof x === 'number' && x >= 0 && x <= 1
      const capOk = (c) => c === undefined || (c && typeof c === 'object' && Object.entries(c).every(([k, s]) => ['confirm', 'test'].includes(k) && s && typeof s === 'object' && Object.values(s).every(share)))
      for (const { name, verdict: v, gate: g } of res.runs) {
        if (!v && !(['confirmed', 'screened out', 'not significant', 'regressed'].includes(g?.outcome) && Number.isInteger(g.candidates_tried) && Number.isInteger(g.confirm_queries))) throw new Error(`results.json: ${name} has no verdict and no complete gate record`)
        if (!v) continue
        const bad = Object.keys(v).filter((k) => !KEYS.includes(k)).concat(KEYS.filter((k) => !OPTIONAL.includes(k) && !(k in v)))
        if (bad.length || !['confirmed', 'not significant', 'regressed'].includes(v.verdict) || (v.schema_version ?? 1) !== 1 || !capOk(v.cap_hit) || !(v.max_new_tokens == null || Number.isInteger(v.max_new_tokens))) throw new Error(`results.json: ${name} does not match verdict.json schema v1 (${bad.join(', ') || v.verdict})`)
      }
      write('/results/', 'Gate results | astro-weights', 'Verdicts from the astro-weights 0.3 gate: one row per gated edit.', true)
      write('/adapters/', 'Ready-made LoRA adapters | astro-weights', 'Ready-made LoRA adapters for open LLMs: paired evals against the base model and the command to load each one.')
      for (const a of adapters) {
        const h = a.headline
        const tail = a.metaCaveat ? '; ' + a.metaCaveat : '' // a token claim with a known cost travels with it
        write(`/adapters/${a.slug}/`, `${a.name} | astro-weights adapters`, `${a.name}: ${pct(h.tokens)} tokens on ${h.bench}, n=${h.n}, paired against the base model${tail}. Load with ${a.use.map((u) => u.label).join(', ')}.`)
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), adapterPages()],
  define: { __AW_VERSION__: JSON.stringify(version) },
  build: { outDir: 'dist', emptyOutDir: true },
})
