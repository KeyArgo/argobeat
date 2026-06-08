#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIST=/tmp/argobeat-staging-dist

echo "Building..."
pnpm --filter argobeat-web build

echo "Preparing dist (audio excluded — served from R2)..."
rm -rf "$STAGING_DIST"
cp -r "$REPO_ROOT/apps/web/dist" "$STAGING_DIST"
rm -rf "$STAGING_DIST/audio"

echo "Deploying to argobeat-staging project..."
wrangler pages deploy "$STAGING_DIST" \
  --project-name argobeat-staging \
  --branch staging \
  --commit-dirty=true \
  --commit-message "staging: $(git -C "$REPO_ROOT" log -1 --pretty=%s)"

echo ""
echo "Live at: https://argobeat-staging.pages.dev"
echo "Also at: https://staging.beat.argobox.com"
