#!/usr/bin/env bash
set -e

npm run build

git add -f dist/
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')"

git subtree split --prefix dist -b gh-pages-tmp
git push origin gh-pages-tmp:gh-pages --force
git branch -D gh-pages-tmp

git rm -r --cached dist/
git commit -m "chore: remove dist from master"
git push origin master

echo ""
echo "Deployed to https://rangisutton.github.io/table_soccer/"
