#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo ""
echo "  Game:        http://localhost:5173/"
echo "  Level maker: http://localhost:5173/editor.html"
echo ""

npm run dev
