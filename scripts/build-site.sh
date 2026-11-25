#!/bin/sh
# Build the Pages artifact: landing page at /, library docs at /docs/ (newest release tag),
# dev docs at /docs/dev/ (library main, not indexed), blog at /blog/ (library main),
# redirect stubs for old root docs URLs, and sitemap.xml + robots.txt at the root.
# Output: _site/. Needs uv, npm, python3 on PATH, and the library repo checked out at $LIB
# (default: lib) on main, with tags.
set -eu

cd "$(dirname "$0")/.."

# Fall back to Homebrew's node when the caller's PATH lacks npm (CI has it via setup-node).
command -v npm >/dev/null 2>&1 || PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

DOMAIN=https://astro-weights.dev

LIB=${LIB:-lib}
STABLE=lib-stable
rm -rf _site dist

# 0. stable tree: newest release tag, pre-releases (a/b/rc) skipped, at $STABLE/.
#    Pages come from the tag; site chrome (theme overrides, assets, config except nav) from
#    main, so consent banner, analytics and look match the rest of the site.
TAG=$(git -C "$LIB" tag -l 'v*' --sort=-v:refname | grep -vE '[0-9](a|b|rc)[0-9]+' | head -n 1)
[ -n "$TAG" ] || { echo "no release tag in $LIB" >&2; exit 1; }
echo "stable docs: $TAG"
rm -rf "$STABLE"
git -C "$LIB" worktree prune
git -C "$LIB" worktree add -q --detach "$PWD/$STABLE" "$TAG"
rm -rf "$STABLE/overrides"
cp -R "$LIB/overrides" "$STABLE/overrides"
cp -R "$LIB/docs/assets/." "$STABLE/docs/assets/"
python3 - "$LIB/zensical.toml" "$STABLE/zensical.toml" <<'PY'
import re, sys
nav = re.compile(r"^nav = \[.*?^\]$", re.S | re.M)
main, tag = (open(p).read() for p in sys.argv[1:])
assert nav.search(main) and nav.search(tag), "nav block not found"
open(sys.argv[2], "w").write(nav.sub(lambda _: nav.search(tag).group(0), main))
PY

# 1. docs -> $STABLE/site/; dev docs -> $LIB/site/ (own site_url, so links and canonicals are rooted at /docs/dev/)
(cd "$STABLE" && uv run --only-group docs zensical build --strict --clean)
sed 's|^site_url = .*|site_url = "https://astro-weights.dev/docs/dev/"|' "$LIB/zensical.toml" > "$LIB/zensical.dev.toml"
(cd "$LIB" && uv run --only-group docs zensical build -f zensical.dev.toml --strict --clean)

# 1b. blog -> $LIB/site-blog/. Own config, so its links and canonical URLs are rooted at /blog/.
#     Skipped until the library repo ships zensical.blog.toml.
BLOG=
if [ -f "$LIB/zensical.blog.toml" ]; then
  (cd "$LIB" && uv run --only-group docs zensical build -f zensical.blog.toml --strict --clean)
  BLOG=1
fi

# 2. landing -> dist/
npm ci && npx vite build

# 3. assemble
mkdir _site
cp -R dist/. _site/
mkdir _site/docs
cp -R "$STABLE/site/." _site/docs/
mkdir _site/docs/dev
cp -R "$LIB/site/." _site/docs/dev/
if [ -n "$BLOG" ]; then
  mkdir _site/blog
  cp -R "$LIB/site-blog/." _site/blog/
fi

# 4. redirect stubs: every docs page that used to live at the root, except the docs home.
#    Never overwrite a landing file.
(cd "$STABLE/site" && find . -name index.html ! -path ./index.html | sed 's|^\./||; s|/index\.html$||' | sort) |
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

# 6. crawler files at the domain root. llms.txt comes from public/ via the landing build.
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  echo "<url><loc>$DOMAIN/</loc></url>"
  (cd dist && find adapters results -name index.html | sort) | sed "s|index\.html$||; s|.*|<url><loc>$DOMAIN/&</loc></url>|"
  for map in _site/docs/sitemap.xml _site/blog/sitemap.xml; do
    [ -f "$map" ] && grep -o '<loc>[^<]*</loc>' "$map" | sed 's|.*|<url>&</url>|'
  done
  echo '</urlset>'
} > _site/sitemap.xml

cat > _site/robots.txt <<ROBOTS
User-agent: *
Allow: /
Disallow: /docs/dev/

Sitemap: $DOMAIN/sitemap.xml
ROBOTS

# 7. check: fail the build, not the live site.
for f in sitemap.xml robots.txt llms.txt; do
  [ -s "_site/$f" ] || { echo "missing _site/$f" >&2; exit 1; }
done
grep -q "<loc>$DOMAIN/adapters/</loc>" _site/sitemap.xml || { echo "sitemap.xml lacks adapter URLs" >&2; exit 1; }
grep -q "<loc>$DOMAIN/docs/</loc>" _site/sitemap.xml || { echo "sitemap.xml lacks docs URLs" >&2; exit 1; }
if [ -n "$BLOG" ]; then
  grep -q "<loc>$DOMAIN/blog/" _site/sitemap.xml || { echo "sitemap.xml lacks blog URLs" >&2; exit 1; }
fi

echo "built _site/"
