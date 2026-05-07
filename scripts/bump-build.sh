#!/bin/bash
set -e
FILE="$(git rev-parse --show-toplevel)/.buildnumber"
current=$(cat "$FILE" 2>/dev/null || echo "0")
next=$((current + 1))
echo -n "$next" > "$FILE"
git add "$FILE"
git commit -m "chore: build #$next [skip ci]" --no-verify
echo "Build number bumped: $current → $next"
