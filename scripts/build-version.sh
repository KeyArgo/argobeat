#!/bin/bash
# Build version generator — runs automatically during build
# Produces: v0.2.0-2026.06.07.1+7df

COMMIT=$(git rev-parse --short HEAD 2>/dev/null | cut -c1-7 || echo "dev")
DATE=$(date +%Y.%m.%d)

# Count builds for today
TODAY_COUNT=$(git log --oneline --since="midnight" 2>/dev/null | wc -l | tr -d ' ')
BUILD_NUM=${TODAY_COUNT:-1}

VERSION="v0.2.0-${DATE}.${BUILD_NUM}+${COMMIT}"

# Write version info
cat > apps/web/src/version.json << EOF
{"version":"${VERSION}","commit":"${COMMIT}","date":"${DATE}"}
EOF

echo "Build: ${VERSION}"
