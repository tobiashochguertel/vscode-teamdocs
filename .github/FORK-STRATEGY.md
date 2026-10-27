# Fork Strategy

This fork of [lucasprag/vscode-teamdocs](https://github.com/lucasprag/vscode-teamdocs) uses the
revert-then-repatch strategy so it stays mergeable with upstream while carrying fork-only changes.

## Branch model

| Branch       | Tracks                       | Purpose                                          |
| ------------ | ---------------------------- | ------------------------------------------------ |
| `main`       | Latest upstream release tag  | Stable fork release                              |
| `dev.patch`  | `upstream/main`              | Unstable — all patches applied                   |
| `feat/*`     | upstream                     | PR-ready features, clean of fork-identity edits  |
| `feature/*`  | `dev.patch`                  | Short-lived branches that produce `.patch` files |

**Always branch from `dev.patch`** for fork work; branch from upstream/`main` only for changes
intended as upstream PRs (e.g. `feat/copy-path`).

## Patches

Modified upstream files live as `.patch` files under `.github/patches/` (applied in alphabetical
order). New files are committed directly to `dev.patch` — they never need reverting.

| #   | Patch                               | Content                                                                 |
| --- | ----------------------------------- | ----------------------------------------------------------------------- |
| 001 | `001-copy-path.patch`               | Copy Path / Copy Relative Path commands + context menu + tests          |
| 002 | `002-self-publish.patch`            | Publisher `TobiasHochguertel`, fork URLs, review ID, copyright          |
| 003 | `003-version-0.4.0.patch`           | Fork version bump to 0.4.0                                              |
| 004 | `004-preview-fallback.patch`        | Preview fallback when `markdown.showPreview` is unavailable             |
| 005 | `005-version-0.4.1.patch`           | Fork version bump to 0.4.1                                              |
| 006 | `006-parallel-publish.patch`        | Split publish.yml into marketplace/Open VSX jobs + workflow_dispatch    |
| 007 | `007-dependabot-bumps.patch`        | Upstream dependabot PRs #8/#12/#13 (TypeScript 7 excluded)              |
| 008 | `008-dependabot-target-branch.patch`| `target-branch: dev.patch` in dependabot.yml                            |
| 009 | `009-readme-fork-docs.patch`        | README fork-maintenance section + review links to fork publisher        |

Modified files are listed in `PATCHED_FILES` inside
`.github/workflows/sync-upstream-and-fix.yml`. Keep it in sync when adding patches.

## Daily sync

`.github/workflows/sync-upstream-and-fix.yml` (07:00 UTC):

1. Reverts `PATCHED_FILES` to the upstream version
2. Merges upstream (fails loudly on conflicts in unpatched files)
3. Re-applies all `.patch` files, commits, pushes

## Adding a patch

```bash
git checkout dev.patch && git checkout -b feature/my-change
# ... modify upstream files, commit ...
fork-genpatch generate --branch feature/my-change \
  --output .github/patches/NNN-my-change.patch --base dev.patch --validate
git checkout dev.patch
git apply .github/patches/NNN-my-change.patch
git add -A && git commit
# add modified files to PATCHED_FILES in the sync workflow
git branch -D feature/my-change
```

## Publishing

`mise run deploy:package` builds `teamdocs-<version>.vsix` (`scripts/package-vsix.sh`).
`mise run deploy:publish` pushes it to the VS Code Marketplace and Open VSX
(`scripts/publish.py`, tokens via `VSCE_PAT`/`OVSX_PAT` env or 1Password `op`).
GitHub releases publish automatically via `.github/workflows/publish.yml`
(secrets `VSCE_PAT`, `OVSX_PAT` on this repo).
