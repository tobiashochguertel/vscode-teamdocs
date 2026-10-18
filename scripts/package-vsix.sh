#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Build the extension and package it as teamdocs-<version>.vsix
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
node esbuild.js --production
npx --yes @vscode/vsce package --no-dependencies --out "teamdocs-${VERSION}.vsix"
echo "Built teamdocs-${VERSION}.vsix"
