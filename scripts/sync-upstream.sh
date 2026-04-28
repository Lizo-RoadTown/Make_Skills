#!/usr/bin/env bash
# Clone or refresh the upstream skill libraries into skills/_upstream/.
# These are gitignored so the repo stays focused on your own skills.
# Run from the repo root: bash scripts/sync-upstream.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/skills/_upstream/anthropics-skills"
UPSTREAM="https://github.com/anthropics/skills.git"

mkdir -p "$(dirname "$TARGET")"

if [ -d "$TARGET/.git" ]; then
  echo "Refreshing $TARGET..."
  git -C "$TARGET" pull --ff-only
else
  echo "Cloning $UPSTREAM into $TARGET..."
  git clone "$UPSTREAM" "$TARGET"
fi

echo
echo "Available upstream skills:"
ls "$TARGET/skills"
