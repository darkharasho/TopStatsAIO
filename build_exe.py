#!/usr/bin/env python3
"""Build a standalone TopStatsAIO executable using PyInstaller.

This script replicates the manual build command documented in the README and
wraps it with Python for convenience.
"""
from pathlib import Path
import subprocess
import sys
import os

def main() -> int:
    root = Path(__file__).resolve().parent
    # ensure we run from repo root so relative paths resolve
    os.chdir(root)

    sep = ';' if os.name == 'nt' else ':'

    # PyInstaller expects config.json to exist even if empty
    config_path = root / "config.json"
    if not config_path.exists():
        config_path.write_text("{}", encoding="utf-8")

    cmd = [
        "pyinstaller",
        "--onefile",
        "--noconsole",
        "--name", "TopStatsAIO",
        "--distpath", ".",
        "--add-data", f"config.json{sep}.",
        "--add-data", f"themes{sep}themes",
        "--icon", "top-stats-aio.ico",
        "main.py",
    ]

    try:
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    return 0

if __name__ == "__main__":
    sys.exit(main())
