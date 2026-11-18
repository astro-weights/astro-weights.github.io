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
      const { adapters } = JSON.parse(readFileSync('src/adapters.json', 'utf8'))
      if (!adapters?.length) throw new Error('src/adapters.json lists no adapters')
      const html = readFileSync(dir + '/index.html', 'utf8')
      const write = (path, title, desc) => {
        let out = html
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
          .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
          .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
          .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}${path}`)
          .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${path}`)
        mkdirSync(dir + path, { recursive: true })
        writeFileSync(dir + path + 'index.html', out)
      }
      write('/adapters/', 'Pretrained adapters | astro-weights', 'Pretrained LoRA adapters made with astro-weights: paired evals against the base model and the command to load each one.')
      for (const a of adapters) {
        const h = a.headline
        write(`/adapters/${a.slug}/`, `${a.name} | astro-weights adapters`, `${a.name}: ${pct(h.tokens)} tokens on ${h.bench} (n ${h.n}), paired against the base model. LoRA adapter, load with ${a.use.map((u) => u.label).join(", ")}.`)
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
