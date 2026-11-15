# astro-weights.github.io

Source of https://astro-weights.dev/: the landing page at `/` and the library docs at `/docs/`.

- Landing page: this repo (Vite, React, three.js). `npm ci && npm run dev`.
- Docs: built from [astro-weights/astro-weights](https://github.com/astro-weights/astro-weights) (`docs/`, Zensical). The Pages workflow checks that repo out into `lib/` and builds it into `/docs/`. Docs changes go live on the next run: daily, on a push here, or by running the workflow by hand.
- Full build: `git clone https://github.com/astro-weights/astro-weights lib && sh scripts/build-site.sh` writes `_site/`, including redirect stubs for docs URLs that used to live at the root.

Apache-2.0. Logo: see `shared/LOGO-LICENSE.md`.
