#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["typer>=0.15"]
# ///
# SPDX-License-Identifier: MIT
"""Publish the TeamDocs .vsix to VS Code Marketplace and Open VSX.

Tokens come from VSCE_PAT / OVSX_PAT env vars; missing values fall back to
1Password (`op read`). Run via `mise run deploy:publish`.
"""

import glob
import os
import subprocess
import sys
from pathlib import Path

import typer

REPO = Path(__file__).resolve().parent.parent

OP_VSCE = "op://Personal/4pnlct4rtei26clohihwpbcq24/API Token"
OP_OVSX = "op://Personal/mbx76cctzjkzltzdjocfyzmoaa/API Token"

app = typer.Typer(help=__doc__)


def token(env_var: str, op_ref: str) -> str | None:
    value = os.environ.get(env_var)
    if value:
        return value.strip()
    r = subprocess.run(
        ["op", "read", op_ref], capture_output=True, text=True
    )
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip()
    return None


def run(cmd: list[str], env: dict) -> int:
    print("+", " ".join(cmd[:3]), "…")
    return subprocess.call(cmd, cwd=REPO, env=env)


@app.command()
def main(vsix: str | None = None) -> None:
    """Publish the newest teamdocs-*.vsix (or VSIX given) to both markets."""
    if vsix is None:
        files = sorted(glob.glob(str(REPO / "teamdocs-*.vsix")), key=os.path.getmtime)
        if not files:
            sys.exit("No teamdocs-*.vsix found — run `mise run deploy:package` first")
        vsix = files[-1]
    vsix_path = os.path.basename(vsix)
    print(f"Publishing {vsix_path}")

    env = dict(os.environ)

    vsce = token("VSCE_PAT", OP_VSCE)
    if vsce:
        env["VSCE_PAT"] = vsce
        rc = run(
            ["npx", "--yes", "@vscode/vsce", "publish", "-i", vsix_path, "--pat", vsce],
            env,
        )
        if rc != 0:
            sys.exit(f"vsce publish failed ({rc})")
    else:
        print("! VSCE_PAT unavailable — skipped VS Code Marketplace")

    ovsx = token("OVSX_PAT", OP_OVSX)
    if ovsx:
        rc = run(
            ["npx", "--yes", "ovsx", "publish", vsix_path, "-p", ovsx],
            env,
        )
        if rc != 0:
            sys.exit(f"ovsx publish failed ({rc})")
    else:
        print("! OVSX_PAT unavailable — skipped Open VSX")


if __name__ == "__main__":
    app()
