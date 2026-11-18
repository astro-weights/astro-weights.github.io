import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

export default defineConfig({
  base: '/',
  plugins: [react()],
  define: { __AW_VERSION__: JSON.stringify(version) },
  build: { outDir: 'dist', emptyOutDir: true },
})
