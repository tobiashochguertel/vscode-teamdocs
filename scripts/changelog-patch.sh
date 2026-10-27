#!/usr/bin/env bash
# Regenerate CHANGELOG.md's Unreleased section and capture it as a .patch file
# on dev.patch — one-shot changelog update for a patched file.
#
# Flow: feature branch -> git-cliff regen -> fork-genpatch -> apply -> commit.
set -euo pipefail

PATCH_DIR=".github/patches"
BRANCH="feature/changelog-$(date +%Y%m%d-%H%M%S)"

git checkout -qb "$BRANCH" dev.patch
scripts/update-changelog.sh
git add CHANGELOG.md
if git diff --cached --quiet; then
    echo "No changelog changes — nothing to do."
    git checkout -q dev.patch && git branch -D "$BRANCH"
    exit 0
fi
git -c user.name="$(git config user.name || echo 'changelog-bot')" \
    -c user.email="$(git config user.email || echo 'bot@local')" \
    commit -qm "docs: regenerate Unreleased changelog with git-cliff"

LAST=$(ls "$PATCH_DIR" | grep -oE '^[0-9]+' | sort -n | tail -1)
NNN=$(printf "%03d" $((10#$LAST + 1)))
PATCH="$PATCH_DIR/${NNN}-changelog.patch"
fork-genpatch generate --branch "$BRANCH" --output "$PATCH"
git checkout -q dev.patch
git apply --check "$PATCH" && git apply "$PATCH"
git add CHANGELOG.md "$PATCH"
git -c user.name="$(git config user.name || echo 'changelog-bot')" \
    -c user.email="$(git config user.email || echo 'bot@local')" \
    commit -qm "docs: regenerate changelog via patch $NNN"
git branch -D "$BRANCH"
echo "Done — committed patch $PATCH on dev.patch"
