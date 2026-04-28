#!/usr/bin/env bash
# Clone or refresh architectural reference repos into platform/_reference/.
# These are gitignored — used for reading patterns while you write your own
# non-vendor-locked versions. NOT runtime dependencies.
#
# Run from the repo root: bash scripts/sync-references.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF_DIR="$REPO_ROOT/platform/_reference"
mkdir -p "$REF_DIR"

# repo-name|upstream-url
REPOS=(
  "aiq|https://github.com/NVIDIA-AI-Blueprints/aiq.git"
  "open_deep_research|https://github.com/langchain-ai/open_deep_research.git"
  "deepagents|https://github.com/langchain-ai/deepagents.git"
)

for entry in "${REPOS[@]}"; do
  name="${entry%%|*}"
  url="${entry##*|}"
  target="$REF_DIR/$name"
  if [ -d "$target/.git" ]; then
    echo "Refreshing $target..."
    git -C "$target" pull --ff-only || echo "  (skipping — non-fast-forward; resolve manually)"
  else
    echo "Cloning $url into $target..."
    git clone --depth 1 "$url" "$target"
  fi
done

echo
echo "Reference repos available under platform/_reference/:"
ls "$REF_DIR"
