#!/usr/bin/env python3
"""
dependabot_to_patch.py — convert a Dependabot PR head into a fork `.patch` file.

Forks using the revert-then-repatch strategy keep changes to upstream-owned
files inside `.github/patches/*.patch`. Dependabot PRs edit real files
(manifests, lockfiles, workflow YAML), so merging them directly is silently
reverted by the next upstream sync. This script turns the PR diff into the
artefacts the sync workflow expects:

  1. A `.github/patches/NNN-dependabot-<slug>.patch` file holding every change
     the PR makes to files that already exist in the base tree.
  2. Any files newly created by the PR materialised in the worktree, to be
     committed directly (new files never need reverting).
  3. Optionally, missing PATCHED_FILES entries appended to the sync workflow
     env block (pass --update-patched-files).

The caller stays responsible for `git apply` of the produced patch, reviewing,
committing and pushing — this script only produces artefacts and prints a JSON
summary on stdout:

  {"status": "created"|"already-applied"|"conflict"|"empty",
   "patch": ".github/patches/0NN-dependabot-....patch",
   "patched_files": [...], "new_files": [...],
   "added_to_patched_files": [...]}

Exit codes: 0 artefact produced or nothing to do, 1 usage/runtime error,
2 the generated patch does not apply cleanly to the base tree.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout


def git_ok(*args: str) -> bool:
    return subprocess.run(["git", *args], capture_output=True).returncode == 0


def slugify(text: str, maxlen: int = 48) -> str:
    slug = re.sub(r"^dependabot[/:_-]*", "", text.strip(), flags=re.I)
    slug = re.sub(r"[^A-Za-z0-9]+", "-", slug).strip("-").lower()
    return slug[:maxlen].rstrip("-") or "deps"


def next_number(patch_dir: Path) -> int:
    nums = []
    for p in patch_dir.glob("*.patch"):
        m = re.match(r"(\d+)", p.name)
        if m:
            nums.append(int(m.group(1)))
    return max(nums, default=0) + 1


def patched_files_block(path: Path):
    """Return (entries, lines, insert_index, entry_indent) for the PATCHED_FILES block."""
    lines = path.read_text().splitlines(keepends=True)
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)PATCHED_FILES:\s*\|", line)
        if not m:
            continue
        key_indent = len(m.group(1))
        entries, last, entry_indent = [], i, None
        j = i + 1
        while j < len(lines):
            lj = lines[j]
            if lj.strip() == "":
                j += 1
                continue
            indent = len(lj) - len(lj.lstrip())
            if indent <= key_indent:
                break
            if entry_indent is None:
                entry_indent = indent
            entries.append(lj.strip())
            last = j
            j += 1
        return set(entries), lines, last + 1, " " * (entry_indent or key_indent + 2)
    return set(), lines, None, "    "


def add_to_patched_files(path: Path, files: list[str]) -> list[str]:
    if not path.exists():
        return []
    entries, lines, insert_at, indent = patched_files_block(path)
    if insert_at is None:
        return []
    missing = [f for f in files if f not in entries]
    for k, f in enumerate(missing):
        lines.insert(insert_at + k, f"{indent}{f}\n")
    if missing:
        path.write_text("".join(lines))
    return missing


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pr-ref", required=True, help="git ref/SHA of the Dependabot PR head")
    ap.add_argument("--pr-branch", required=True, help="PR head branch name (used for the patch slug)")
    ap.add_argument("--base", default="dev.patch", help="base ref to diff against")
    ap.add_argument("--patch-dir", default=".github/patches")
    ap.add_argument("--patched-files-source", default=".github/workflows/sync-upstream-and-fix.yml",
                    help="workflow YAML holding the PATCHED_FILES env block")
    ap.add_argument("--update-patched-files", action="store_true",
                    help="append upstream-owned files missing from PATCHED_FILES")
    ap.add_argument("--upstream-ref", default="upstream/main",
                    help="upstream ref used to decide PATCHED_FILES additions")
    args = ap.parse_args()

    merge_base = git("merge-base", args.base, args.pr_ref).strip()
    name_status = git("diff", "--name-status", merge_base, args.pr_ref).splitlines()

    # Only upstream-owned files go into the patch (they must be reverted before
    # merging). Files the fork owns — whether added or modified by the PR — are
    # materialised and committed directly. Fall back to the merge base when
    # upstream is not fetched — a dependabot PR only touches upstream files.
    upstream_ref = args.upstream_ref if git_ok("rev-parse", "--verify", args.upstream_ref) else merge_base

    patched, new_files, deleted_files = [], [], []
    for line in name_status:
        if not line.strip():
            continue
        parts = line.split("\t")
        status, path = parts[0], parts[-1]
        if git_ok("cat-file", "-e", f"{upstream_ref}:{path}"):
            patched.append(path)
        elif status.startswith("D"):
            deleted_files.append(path)
        else:
            new_files.append(path)

    upstream_owned = patched

    if not patched and not new_files and not deleted_files:
        print(json.dumps({"status": "empty", "patch": None, "patched_files": [],
                          "new_files": [], "added_to_patched_files": []}))
        return 0

    summary = {"status": "created", "patch": None, "patched_files": patched,
               "new_files": new_files, "added_to_patched_files": []}

    if patched:
        patch_dir = Path(args.patch_dir)
        patch_dir.mkdir(parents=True, exist_ok=True)
        patch_path = patch_dir / f"{next_number(patch_dir):03d}-dependabot-{slugify(args.pr_branch)}.patch"
        diff_text = git("diff", merge_base, args.pr_ref, "--", *patched)
        patch_path.write_text(diff_text if diff_text.endswith("\n") else diff_text + "\n")
        # Same order as apply_patches.sh: a reverse-appliable diff is already
        # present; a forward-appliable diff is new; otherwise it conflicts.
        if git_ok("apply", "--reverse", "--check", str(patch_path)):
            patch_path.unlink(missing_ok=True)
            summary = {"status": "already-applied", "patch": None,
                       "patched_files": patched, "new_files": [],
                       "added_to_patched_files": []}
        elif git_ok("apply", "--check", str(patch_path)):
            summary["patch"] = str(patch_path)
        else:
            patch_path.unlink(missing_ok=True)
            print(json.dumps({"status": "conflict", "patch": None,
                              "patched_files": patched, "new_files": new_files,
                              "added_to_patched_files": []}))
            return 2

    # Materialise fork-owned files from the PR head and remove fork-owned
    # deletions so the caller can commit them directly.
    for f in new_files:
        git("checkout", args.pr_ref, "--", f)
    for f in deleted_files:
        git("rm", "-q", "--ignore-unmatch", f)

    if args.update_patched_files and upstream_owned:
        summary["added_to_patched_files"] = add_to_patched_files(
            Path(args.patched_files_source), upstream_owned)

    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
