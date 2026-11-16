import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library version shown on the page, read from the library checkout that scripts/build-site.sh builds docs from.
// ponytail: shows "dev" when no checkout (plain `npm run dev`); version is main's, so it can lead PyPI between a release PR merge and the tag.
const LIB = process.env.LIB || 'lib'
let version = 'dev'
try { version = readFileSync(LIB + '/pyproject.toml', 'utf8').match(/^version = "(.+)"$/m)[1] } catch { /* no library checkout */ }

export default defineConfig({
  base: '/',
  plugins: [react()],
  define: { __AW_VERSION__: JSON.stringify(version) },
  build: { outDir: 'dist', emptyOutDir: true },
})
