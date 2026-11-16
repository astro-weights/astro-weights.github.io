# astro-weights.github.io

Source of https://astro-weights.dev/: the landing page at `/`, the library docs at `/docs/` and the blog at `/blog/`.

- Landing page: this repo (Vite, React, three.js). `npm ci && npm run dev`.
- Docs: built from [astro-weights/astro-weights](https://github.com/astro-weights/astro-weights) (`docs/`, Zensical). The Pages workflow checks that repo out into `lib/` and builds it into `/docs/`. Docs changes go live on the next run: daily, on a push here, or by running the workflow by hand.
- Blog: built from the same repo (`docs/blog/`, own config `zensical.blog.toml`) into `/blog/`. Skipped until that config exists.
- Root files: build writes `sitemap.xml` (landing, docs, blog URLs) and `robots.txt`. `llms.txt` lives in `public/`. Build fails if one is missing.
- Full build: `git clone https://github.com/astro-weights/astro-weights lib && sh scripts/build-site.sh` writes `_site/`, including redirect stubs for docs URLs that used to live at the root.

Apache-2.0. Logo: see `shared/LOGO-LICENSE.md`.
