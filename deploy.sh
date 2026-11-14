#!/usr/bin/env bash
# Publish the website to Cloudflare Pages (project ogden-850).
#   CLOUDFLARE_API_TOKEN=... ./deploy.sh
# Only the website files are uploaded; functions/ (the /api/tts endpoint) is
# picked up from the repository root. Needs Node.js 22+.
set -euo pipefail
cd "$(dirname "$0")"
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
cp index.html sw.js manifest.json favicon.png "$OUT/"
cp -r icons "$OUT/"
npx -y wrangler@4 pages deploy "$OUT" --project-name ogden-850 --branch main --commit-dirty=true
