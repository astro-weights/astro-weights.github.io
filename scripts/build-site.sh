#!/bin/sh
# Build the Pages artifact: landing page at /, library docs at /docs/, redirect stubs for old root docs URLs.
# Output: _site/. Needs uv and npm on PATH, and the library repo checked out at $LIB (default: lib).
set -eu

cd "$(dirname "$0")/.."

# Fall back to Homebrew's node when the caller's PATH lacks npm (CI has it via setup-node).
command -v npm >/dev/null 2>&1 || PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

DOMAIN=https://astro-weights.dev

LIB=${LIB:-lib}
rm -rf _site dist

# 1. docs -> $LIB/site/
(cd "$LIB" && uv run --only-group docs zensical build --strict --clean)

# 2. landing -> dist/
npm ci && npx vite build

# 3. assemble
mkdir _site
cp -R dist/. _site/
mkdir _site/docs
cp -R "$LIB/site/." _site/docs/

# 4. redirect stubs: every docs page that used to live at the root, except the docs home.
#    Never overwrite a landing file.
(cd "$LIB/site" && find . -name index.html ! -path ./index.html | sed 's|^\./||; s|/index\.html$||' | sort) |
while IFS= read -r page; do
  [ -e "_site/$page/index.html" ] && continue
  mkdir -p "_site/$page"
  cat > "_site/$page/index.html" <<STUB
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved to /docs/$page/</title>
<meta http-equiv="refresh" content="0; url=/docs/$page/">
<link rel="canonical" href="$DOMAIN/docs/$page/">
<meta name="robots" content="noindex">
</head>
<body>
<p>This page moved to <a href="/docs/$page/">$DOMAIN/docs/$page/</a>.</p>
</body>
</html>
STUB
done

# 5. root 404 (GitHub Pages serves only the root 404.html)
cat > _site/404.html <<NOTFOUND
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | astro-weights</title>
<meta name="robots" content="noindex">
<style>
body { margin: 0; min-height: 100vh; display: grid; place-content: center; padding: 16px; background: #0D1117; color: #F2F4F8; font: 1.0625rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: #A882FF; }
</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>Try the <a href="/">home page</a> or the <a href="/docs/">docs</a>.</p>
</main>
</body>
</html>
NOTFOUND

echo "built _site/"
